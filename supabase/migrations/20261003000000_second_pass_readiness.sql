-- #273: additive migration for the second-pass measurement contract
-- (docs/measurement/270-analytics-readiness-second-pass.md §4.4, §5.1 and
-- §11), amending ADR 0005 and ADR 0007 per ADRs 0014, 0015 and 0016.
-- Additive: no applied migration is edited and no stored row is changed.
-- This file
--   1. accepts two new event shapes (order_placed's 15-key shape and
--      flash_sheet_shown's 5-key shape) through a wrapper validator,
--   2. adds the `seq` and `build` envelope columns and anon's insert grants,
--   3. recreates `events_clean` so it picks the two columns up, and
--   4. creates schema `analytics` with the views `orders`, `sessions` and
--      `visitors`, readable by the owner only.
--
-- STRICT SUPERSET (contract §4.1): #225's validator is kept whole under a
-- new name, `event_is_valid_225`, and the new `event_is_valid` decides only
-- the two new shapes and hands everything else to it unchanged. So every
-- (event_name, props) pair the store accepts on main is still accepted, by
-- the very same code. Cross-field invariants are still NOT checked in the
-- store (ADR 0007), except the one ADR 0014 records: fee_modes has as many
-- elements as restaurant_slugs.

-- 1a. Keep #225's validator, unchanged, under its own name. Renaming keeps
-- its body, owner and grants. Its execute grant is deliberately left as it
-- is: the RLS check below runs as the inserting role, so `anon` must still
-- be able to execute it through the wrapper (ADR 0013).
alter function public.event_is_valid(text, jsonb) rename to event_is_valid_225;

-- The wrapper (contract §4.4). Each new branch is guarded step by step
-- rather than in one `and` chain, because Postgres does not promise
-- short-circuit order and jsonb_array_length raises on a non-array. A
-- missing or mistyped value refuses the row: every check is wrapped in
-- coalesce, so null never passes.
create function public.event_is_valid(event_name text, props jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  keys text[];
begin
  select coalesce(array_agg(k order by k), array[]::text[])
    into keys
  from jsonb_object_keys(props) k;

  if event_name = 'order_placed' then
    if coalesce(public.event_is_valid_225(event_name, props), false) then
      return true;
    end if;
    -- The 15-key shape: #219's 14 keys plus restaurant_slug. Everything
    -- shared is checked by #225's code on the 14-key remainder.
    return coalesce(
      keys = array[
        'amount_minor', 'applied_voucher_ids', 'city', 'currency', 'delivery_instructions',
        'drop_off_preset', 'item_count', 'order_id', 'restaurant_slug', 'saved_amount_minor',
        'thanks_voucher_amount_minor', 'utensils', 'vip_level', 'vip_saved_amount_minor',
        'wallet_paid'
      ]
      and jsonb_typeof(props->'restaurant_slug') = 'string'
      and length(props->>'restaurant_slug') between 1 and 60
      and props->>'restaurant_slug' ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      and public.event_is_valid_225(event_name, props - 'restaurant_slug'),
      false);

  elsif event_name = 'flash_sheet_shown' then
    if coalesce(public.event_is_valid_225(event_name, props), false) then
      return true;
    end if;
    -- The 5-key shape: the 4-key shape (5 or 6 distinct slugs, never the
    -- legacy 2) plus fee_modes, aligned by index with restaurant_slugs.
    if not coalesce(
      keys = array['amount_minor', 'city', 'currency', 'fee_modes', 'restaurant_slugs']
      and public.event_is_valid_225(event_name, props - 'fee_modes')
      and jsonb_array_length(props->'restaurant_slugs') in (5, 6)
      and jsonb_typeof(props->'fee_modes') = 'array',
      false) then
      return false;
    end if;
    return coalesce(
      jsonb_array_length(props->'fee_modes') = jsonb_array_length(props->'restaurant_slugs')
      and (
        select bool_and(jsonb_typeof(elem) = 'string' and (elem #>> '{}') in ('free', 'reduced'))
        from jsonb_array_elements(props->'fee_modes') elem
      ),
      false);
  end if;

  return public.event_is_valid_225(event_name, props);
end;
$$;

-- 1b. The policy was bound to the function itself, not its name, so after
-- the rename it calls `event_is_valid_225`. Recreate it against the
-- wrapper, with the same name, role and check expression ADR 0005 §2
-- records.
drop policy events_insert_anon on public.events;

create policy events_insert_anon on public.events
  for insert
  to anon
  with check (public.event_is_valid(event_name, props));

-- 2. The envelope (contract §5.1). Columns, not props, so they ride on
-- every event without changing any event's key set. Both are nullable with
-- no default: null means "sent by a client from before this pass" (R4),
-- never zero and never "unknown build". A CHECK passes a null, so an old
-- tab's insert is unaffected.
alter table public.events
  add column seq integer,
  add column build text;

alter table public.events
  add constraint events_seq_check check (seq between 1 and 100000),
  add constraint events_build_check check (build ~ '^[0-9a-f]{40}$' or build = '(unknown)');

grant insert (seq) on public.events to anon;
grant insert (build) on public.events to anon;

-- 3. `events_clean`, recreated so it exposes the new columns (a `select *`
-- view does not pick them up otherwise), with its definition unchanged: the
-- same `security_invoker` setting, the same exclusion of every visitor with
-- any `is_internal` row, and the same revokes as 20261002000000, since
-- Supabase grants anon and authenticated default privileges on every new
-- relation in `public`.
drop view public.events_clean;

create view public.events_clean
  with (security_invoker = true) as
  select e.*
  from public.events e
  where not exists (
    select 1
    from public.events flagged
    where flagged.visitor_id = e.visitor_id
      and flagged.is_internal
  );

revoke all on public.events_clean from anon;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.events_clean from authenticated';
  end if;
end
$$;

-- 4. Schema `analytics` (contract §11). Supabase's Data API exposes
-- `public` by default and not a new schema, and anon and authenticated get
-- no usage on this one, so a missed revoke on a view cannot publish it to
-- the browser. Every view reads only `public.events_clean` and other
-- `analytics` views (R1), so the owner-traffic exclusion holds for all of
-- them, and none reads `private`, `auth` or a wallet relation. Plain SQL
-- (CTEs and row_number(), `->` and `->>` only) so it lifts into dbt
-- unchanged. "First" is always the earliest by (received_at, id).
create schema analytics;

revoke all on schema analytics from public;
revoke all on schema analytics from anon;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema analytics from authenticated';
  end if;
end
$$;

-- 4a. One row per order_id with at least one order_placed row (§11.2).
create view analytics.orders
  with (security_invoker = true) as
with placed as (
  select
    e.visitor_id,
    e.session_id,
    e.occurred_at,
    e.received_at,
    e.build,
    e.props,
    row_number() over (partition by e.props->>'order_id' order by e.received_at, e.id) as rn,
    count(*) over (partition by e.props->>'order_id') as n
  from public.events_clean e
  where e.event_name = 'order_placed'
),
p as (
  select * from placed where rn = 1
),
first_delivered as (
  select order_id, received_at, props from (
    select e.props->>'order_id' as order_id, e.received_at, e.props,
      row_number() over (partition by e.props->>'order_id' order by e.received_at, e.id) as rn
    from public.events_clean e
    where e.event_name = 'order_delivered'
  ) x where rn = 1
),
first_rating as (
  select order_id, received_at, props from (
    select e.props->>'order_id' as order_id, e.received_at, e.props,
      row_number() over (partition by e.props->>'order_id' order by e.received_at, e.id) as rn
    from public.events_clean e
    where e.event_name = 'rating_submitted'
  ) x where rn = 1
),
first_driver_rating as (
  select order_id, received_at, props from (
    select e.props->>'order_id' as order_id, e.received_at, e.props,
      row_number() over (partition by e.props->>'order_id' order by e.received_at, e.id) as rn
    from public.events_clean e
    where e.event_name = 'driver_rating_submitted'
  ) x where rn = 1
),
first_tip as (
  select order_id, received_at, props from (
    select e.props->>'order_id' as order_id, e.received_at, e.props,
      row_number() over (partition by e.props->>'order_id' order by e.received_at, e.id) as rn
    from public.events_clean e
    where e.event_name = 'tip_sent'
  ) x where rn = 1
)
select
  (p.props->>'order_id')::uuid as order_id,
  p.visitor_id as visitor_id,
  p.session_id as session_id,
  p.received_at as placed_at,
  p.occurred_at as placed_occurred_at,
  (p.received_at at time zone 'UTC')::date as placed_day,
  p.build as build,
  case
    when p.props->'restaurant_slug' is not null then '#270'
    when p.props->'city' is not null then '#219'
    else '#81'
  end as props_shape,
  p.n::integer as placed_rows,
  coalesce(
    p.props->>'city',
    case p.props->>'currency' when 'VND' then 'hcmc' when 'USD' then 'sf' end
  ) as city,
  p.props->>'currency' as currency,
  p.props->>'restaurant_slug' as restaurant_slug,
  (p.props->>'amount_minor')::bigint as amount_minor,
  (p.props->>'item_count')::integer as item_count,
  p.props->'applied_voucher_ids' as applied_voucher_ids,
  jsonb_array_length(p.props->'applied_voucher_ids') as applied_voucher_count,
  (p.props->>'saved_amount_minor')::bigint as saved_amount_minor,
  (p.props->>'thanks_voucher_amount_minor')::bigint as thanks_voucher_amount_minor,
  p.props->>'vip_level' as vip_level,
  (p.props->>'vip_saved_amount_minor')::bigint as vip_saved_amount_minor,
  (p.props->>'wallet_paid')::boolean as wallet_paid,
  p.props->>'drop_off_preset' as drop_off_preset,
  p.props->>'delivery_instructions' as delivery_instructions,
  (p.props->>'utensils')::boolean as utensils,
  d.received_at as delivery_seen_at,
  r.received_at as restaurant_rated_at,
  (r.props->>'stars')::integer as restaurant_stars,
  dr.received_at as driver_rated_at,
  (dr.props->>'stars')::integer as driver_stars,
  t.received_at as tipped_at,
  (t.props->>'tip_amount_minor')::bigint as tip_amount_minor
from p
left join first_delivered d on d.order_id = p.props->>'order_id'
left join first_rating r on r.order_id = p.props->>'order_id'
left join first_driver_rating dr on dr.order_id = p.props->>'order_id'
left join first_tip t on t.order_id = p.props->>'order_id';

-- 4b. One row per session_id (a tab session, not a 30-minute visit) with
-- at least one row (§11.3).
create view analytics.sessions
  with (security_invoker = true) as
with agg as (
  select
    e.session_id,
    count(distinct e.visitor_id)::integer as visitor_ids,
    min(e.received_at) as started_at,
    max(e.received_at) as last_received_at,
    count(*)::integer as event_rows,
    (count(*) filter (where e.event_name = 'session_started'))::integer as session_started_rows,
    bool_or(e.event_name = 'order_placed') as ordered,
    (count(distinct e.props->>'order_id') filter (where e.event_name = 'order_placed'))::integer as orders,
    max(e.seq) as seq_max,
    count(distinct e.seq) as seq_count
  from public.events_clean e
  group by e.session_id
),
first_row as (
  select session_id, visitor_id from (
    select e.session_id, e.visitor_id,
      row_number() over (partition by e.session_id order by e.received_at, e.id) as rn
    from public.events_clean e
  ) x where rn = 1
),
ss as (
  select session_id, props from (
    select e.session_id, e.props,
      row_number() over (partition by e.session_id order by e.occurred_at, e.id) as rn
    from public.events_clean e
    where e.event_name = 'session_started'
  ) x where rn = 1
)
select
  agg.session_id as session_id,
  first_row.visitor_id as visitor_id,
  agg.visitor_ids as visitor_ids,
  agg.started_at as started_at,
  (agg.started_at at time zone 'UTC')::date as session_day,
  agg.last_received_at as last_received_at,
  agg.event_rows as event_rows,
  agg.session_started_rows as session_started_rows,
  case
    when ss.session_id is null then '(unknown)'
    when ss.props->>'utm_source' not in ('(none)', '(invalid)') then ss.props->>'utm_source'
    when ss.props->>'referrer_host' = '(self)' then '(self)'
    when ss.props->>'referrer_host' = '(invalid)' then '(invalid)'
    when ss.props->>'referrer_host' <> '(none)' then ss.props->>'referrer_host'
    else '(direct)'
  end as source,
  coalesce(ss.props->>'referrer_host', '(unknown)') as referrer_host,
  coalesce(ss.props->>'utm_source', '(unknown)') as utm_source,
  coalesce(ss.props->>'utm_medium', '(unknown)') as utm_medium,
  coalesce(ss.props->>'utm_campaign', '(unknown)') as utm_campaign,
  agg.ordered as ordered,
  agg.orders as orders,
  agg.seq_max as seq_max,
  case when agg.seq_max is null then null else agg.seq_count::integer end as seq_distinct,
  case when agg.seq_max is null then null else (agg.seq_max - agg.seq_count)::integer end as seq_lost
from agg
join first_row on first_row.session_id = agg.session_id
left join ss on ss.session_id = agg.session_id;

-- 4c. One row per visitor_id (a browser) with at least one row (§11.4).
create view analytics.visitors
  with (security_invoker = true) as
with agg as (
  select
    e.visitor_id,
    min(e.received_at) as first_seen_at,
    max(e.received_at) as last_seen_at,
    count(distinct (e.received_at at time zone 'UTC')::date)::integer as active_days,
    count(distinct e.session_id)::integer as sessions
  from public.events_clean e
  group by e.visitor_id
),
ft as (
  select visitor_id, session_id, received_at, props from (
    select e.visitor_id, e.session_id, e.received_at, e.props,
      row_number() over (partition by e.visitor_id order by e.occurred_at, e.id) as rn
    from public.events_clean e
    where e.event_name = 'session_started'
  ) x where rn = 1
),
o as (
  select visitor_id, count(*)::integer as orders
  from analytics.orders
  group by visitor_id
),
fo as (
  select visitor_id, order_id, placed_at from (
    select a.visitor_id, a.order_id, a.placed_at,
      row_number() over (partition by a.visitor_id order by a.placed_at, a.order_id) as rn
    from analytics.orders a
  ) x where rn = 1
)
select
  agg.visitor_id as visitor_id,
  agg.first_seen_at as first_seen_at,
  (agg.first_seen_at at time zone 'UTC')::date as first_seen_day,
  agg.last_seen_at as last_seen_at,
  agg.active_days as active_days,
  agg.sessions as sessions,
  ft.session_id as first_touch_session_id,
  ft.received_at as first_touch_at,
  case
    when ft.session_id is null then '(unknown)'
    when ft.props->>'utm_source' not in ('(none)', '(invalid)') then ft.props->>'utm_source'
    when ft.props->>'referrer_host' = '(self)' then '(self)'
    when ft.props->>'referrer_host' = '(invalid)' then '(invalid)'
    when ft.props->>'referrer_host' <> '(none)' then ft.props->>'referrer_host'
    else '(direct)'
  end as first_touch_source,
  coalesce(ft.props->>'referrer_host', '(unknown)') as first_touch_referrer_host,
  coalesce(ft.props->>'utm_source', '(unknown)') as first_touch_utm_source,
  coalesce(ft.props->>'utm_medium', '(unknown)') as first_touch_utm_medium,
  coalesce(ft.props->>'utm_campaign', '(unknown)') as first_touch_utm_campaign,
  coalesce(o.orders, 0) as orders,
  fo.order_id as first_order_id,
  fo.placed_at as first_order_at
from agg
left join ft on ft.visitor_id = agg.visitor_id
left join o on o.visitor_id = agg.visitor_id
left join fo on fo.visitor_id = agg.visitor_id;

-- Each view revoked from anon and authenticated, as events_clean is, and
-- granted to no one (§11.1).
revoke all on analytics.orders from anon;
revoke all on analytics.sessions from anon;
revoke all on analytics.visitors from anon;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on analytics.orders from authenticated';
    execute 'revoke all on analytics.sessions from authenticated';
    execute 'revoke all on analytics.visitors from authenticated';
  end if;
end
$$;
