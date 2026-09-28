-- #225: acquisition and owner traffic
-- (docs/measurement/219-analytics-readiness-contract.md §5, §6 and §13
-- item 7), amending ADR 0005 and ADR 0007 per
-- docs/decisions/0013-session-started-and-is-internal.md. Additive: no
-- applied migration is edited and no stored row is changed. This file
--   1. adds the `session_started` event (name CHECK and a validator branch),
--   2. adds the `is_internal` column and anon's insert grant on it, and
--   3. recreates `events_clean` so it excludes every row of a visitor who
--      has any `is_internal = true` row.
--
-- STRICT SUPERSET (contract §13, amendment 4): #224's validator is kept
-- whole under a new name, `event_is_valid_224`, and the new
-- `event_is_valid` decides `session_started` itself and hands every other
-- event name to it unchanged. So every (event_name, props) pair the store
-- accepts on main is still accepted, by the very same code.

-- 1a. Event names: #224's 17 plus `session_started`. Dropped and re-added
-- `not valid`, as in #85 and #224, so historical rows aren't re-scanned.
alter table public.events
  drop constraint events_event_name_check;

alter table public.events
  add constraint events_event_name_check check (event_name in (
    'location_selected', 'home_viewed', 'restaurant_opened', 'cart_viewed',
    'checkout_viewed', 'flash_sheet_shown', 'flash_sheet_closed',
    'order_placed', 'tracker_viewed', 'order_delivered', 'rating_submitted',
    'driver_rating_submitted', 'tip_sent', 'sign_in_prompt_shown',
    'sign_in_started', 'sign_in_completed', 'wallet_short_shown',
    'session_started'
  )) not valid;

-- 1b. Keep #224's validator, unchanged, under its own name. Renaming keeps
-- its body, owner and grants. Its execute grant is deliberately left as it
-- is: the RLS check below runs as the inserting role, so `anon` must still
-- be able to execute it through the wrapper.
alter function public.event_is_valid(text, jsonb) rename to event_is_valid_224;

-- The wrapper. `session_started` carries acquisition and nothing else
-- (contract §6): the referring host, or one of the three sentinels, and the
-- three utm_ values, each a sentinel or a value matching the pattern. `/`,
-- `?`, `@`, `:`, `=` and `&` cannot match either pattern, so no URL, query
-- string or email address can be stored in these props. Wrapped in
-- coalesce so a missing or mistyped value refuses the row rather than
-- yielding null, which a policy check would let through.
create function public.event_is_valid(event_name text, props jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  keys text[];
  utm_key text;
begin
  if event_name = 'session_started' then
    select coalesce(array_agg(k order by k), array[]::text[])
      into keys
    from jsonb_object_keys(props) k;

    if not coalesce(
      keys = array['referrer_host', 'utm_campaign', 'utm_medium', 'utm_source']
      and jsonb_typeof(props->'referrer_host') = 'string'
      and (
        props->>'referrer_host' in ('(none)', '(self)', '(invalid)')
        or (
          length(props->>'referrer_host') between 1 and 253
          and props->>'referrer_host' ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$'
        )
      ),
      false) then
      return false;
    end if;

    foreach utm_key in array array['utm_source', 'utm_medium', 'utm_campaign'] loop
      if not coalesce(
        jsonb_typeof(props->utm_key) = 'string'
        and (
          props->>utm_key in ('(none)', '(invalid)')
          or props->>utm_key ~ '^[a-z0-9][a-z0-9._-]{0,49}$'
        ),
        false) then
        return false;
      end if;
    end loop;

    return true;
  end if;

  return public.event_is_valid_224(event_name, props);
end;
$$;

-- The policy was bound to the function itself, not its name, so after the
-- rename it calls `event_is_valid_224`. Recreate it against the wrapper,
-- with the same name, role and check expression ADR 0005 §2 records.
drop policy events_insert_anon on public.events;

create policy events_insert_anon on public.events
  for insert
  to anon
  with check (public.event_is_valid(event_name, props));

-- 2. The owner-traffic flag (contract §5, O12). A column, not a prop, so it
-- rides on every event without changing any event's key set. The default
-- lets a tab still running the previous client insert without it. True or
-- false only: never an identifier, never linked to sign-in.
alter table public.events
  add column is_internal boolean not null default false;

grant insert (is_internal) on public.events to anon;

-- 3. `events_clean`'s first real exclusion rule (contract §5): drop every
-- row whose visitor has at least one flagged row, so the owner's earlier,
-- unflagged rows from the same browser go too. Recreated rather than
-- replaced, because a `select *` view does not pick up a new column; the
-- same `security_invoker` setting and the same revokes as
-- 20260925000000_events.sql, since Supabase grants anon and authenticated
-- default privileges on every new relation in `public`.
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
