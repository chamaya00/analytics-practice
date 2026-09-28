-- Launch-day queries for the analytics-readiness contract (#219, #226).
--
-- One named query per metric, M1 to M17, each implementing
-- docs/measurement/219-analytics-readiness-contract.md section 11 exactly.
-- Paste ONE query at a time into the Supabase SQL Editor (a query starts at
-- its `-- name: Mn` line and ends at its `;`). All are read-only.
--
-- Rules every query follows (contract R1-R8):
--   R1  reads public.events_clean, never the raw table, so the owner's own
--       browsers (is_internal) are already out.
--   R2  a day is (occurred_at at time zone 'UTC')::date; windows are
--       half-open [w_start, w_end) on occurred_at. To change the window,
--       edit the two timestamps in the `params` CTE at the top of the query.
--       Read yesterday's numbers the day after (the store accepts
--       occurred_at up to a day before received_at).
--   R3  a row's city is coalesce(props->>'city', currency fallback).
--   R4  a prop the contract added is counted only on rows that have the key.
--   R5  a session's day is the UTC day of its earliest row.
--   R6  a visitor's first-seen day is their earliest row, unwindowed.
--   R7  order metrics take their cohort from order_placed in the window;
--       later events count whenever they happened, so recent cohorts mature.
--   R8  a session's source comes from its earliest session_started; a
--       session with none is '(unknown)' and is never dropped.
--
-- Rates are rounded to 4 places. An empty window returns no rows or nulls,
-- never a made-up zero.

-- name: M1
-- Visitors by day. Unit: visitor. No denominator, by design.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
)
select (occurred_at at time zone 'UTC')::date::text as day,
       count(distinct visitor_id)::int as visitors
from public.events_clean, params
where occurred_at >= w_start and occurred_at < w_end
group by 1
order by 1;

-- name: M2
-- Sessions by day, by session day (R5). Unit: session. No denominator.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
sessions as (
  select session_id, min(occurred_at) as first_at
  from public.events_clean
  group by session_id
)
select (first_at at time zone 'UTC')::date::text as day,
       count(*)::int as sessions
from sessions, params
where first_at >= w_start and first_at < w_end
group by 1
order by 1;

-- name: M3
-- Returning visitors: active on day D with a first-seen day (R6) before D.
-- Unit: visitor. Never delete exported rows from the store: trimming old
-- rows makes returning visitors look new.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
first_seen as (
  select visitor_id, (min(occurred_at) at time zone 'UTC')::date as first_day
  from public.events_clean
  group by visitor_id
),
active as (
  select distinct (occurred_at at time zone 'UTC')::date as day, visitor_id
  from public.events_clean, params
  where occurred_at >= w_start and occurred_at < w_end
)
select a.day::text as day,
       count(*)::int as visitors,
       (count(*) filter (where f.first_day < a.day))::int as returning_visitors,
       round((count(*) filter (where f.first_day < a.day))::numeric / count(*), 4)::float8 as returning_share
from active a
join first_seen f using (visitor_id)
group by a.day
order by a.day;

-- name: M4
-- Home-to-order funnel. Unit: visitor. Cohort = visitors with a home_viewed
-- in the window; each step counts cohort visitors with that event in the
-- window, in any order. An empty cart (item_count 0) is not step 3.
-- checkout_conversion (step 5 / step 1) is the primary metric.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
win as (
  select visitor_id, event_name, props
  from public.events_clean, params
  where occurred_at >= w_start and occurred_at < w_end
),
cohort as (
  select distinct visitor_id from win where event_name = 'home_viewed'
),
hit as (
  select distinct w.visitor_id, w.event_name
  from win w
  join cohort c using (visitor_id)
  where case when w.event_name = 'cart_viewed'
             then (w.props->>'item_count')::int >= 1
             else true end
),
steps(step, event_name) as (
  values (1, 'home_viewed'), (2, 'restaurant_opened'), (3, 'cart_viewed'),
         (4, 'checkout_viewed'), (5, 'order_placed')
),
counts as (
  select s.step, s.event_name, count(h.visitor_id)::int as visitors
  from steps s
  left join hit h using (event_name)
  group by s.step, s.event_name
)
select step,
       event_name,
       visitors,
       round(visitors::numeric / nullif(lag(visitors) over (order by step), 0), 4)::float8 as step_conversion,
       round(visitors::numeric / nullif(first_value(visitors) over (order by step), 0), 4)::float8 as checkout_conversion
from counts
order by step;

-- name: M5
-- Funnel by city. Unit: (visitor, city) pair. Cohort = pairs with a
-- home_viewed carrying that city in the window; step k counts cohort pairs
-- with a step-k event whose row city (R3) is that city. A visitor active in
-- two cities is one pair in each, so pairs can sum above M4's step 1.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
win as (
  select visitor_id, event_name, props,
         coalesce(props->>'city', case props->>'currency' when 'VND' then 'hcmc' when 'USD' then 'sf' end) as city
  from public.events_clean, params
  where occurred_at >= w_start and occurred_at < w_end
),
cohort as (
  select distinct visitor_id, city from win where event_name = 'home_viewed'
),
hit as (
  select distinct w.visitor_id, w.city, w.event_name
  from win w
  join cohort c on c.visitor_id = w.visitor_id and c.city = w.city
  where case when w.event_name = 'cart_viewed'
             then (w.props->>'item_count')::int >= 1
             else true end
),
steps(step, event_name) as (
  values (1, 'home_viewed'), (2, 'restaurant_opened'), (3, 'cart_viewed'),
         (4, 'checkout_viewed'), (5, 'order_placed')
),
counts as (
  select c.city, s.step, s.event_name, count(h.visitor_id)::int as pairs
  from (select distinct city from cohort) c
  cross join steps s
  left join hit h on h.city = c.city and h.event_name = s.event_name
  group by c.city, s.step, s.event_name
)
select city,
       step,
       event_name,
       pairs,
       round(pairs::numeric / nullif(lag(pairs) over (partition by city order by step), 0), 4)::float8 as step_conversion,
       round(pairs::numeric / nullif(first_value(pairs) over (partition by city order by step), 0), 4)::float8 as conversion_by_city
from counts
order by city, step;

-- name: M6
-- Acquisition by source (R8). Unit: session, except part c (visitor).
-- One result, three parts, each as numerator / base / rate:
--   a  source share by session day: sessions with source s / all sessions
--      that day (base includes '(unknown)').
--   b  session conversion: sessions with source s and a session day in the
--      window that have an order_placed / all of them.
--   c  first-touch visitor conversion: visitors whose earliest
--      session_started is in the window, by the source of that session,
--      with an order_placed at any time / all of them. For "did LinkedIn
--      bring buyers", read part c.
-- utm_medium and utm_campaign ride alongside the source, never folded in.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
started as (
  select distinct on (session_id)
         session_id, visitor_id, occurred_at,
         case
           when props->>'utm_source' not in ('(none)', '(invalid)') then props->>'utm_source'
           when props->>'referrer_host' = '(self)' then '(self)'
           when props->>'referrer_host' = '(invalid)' then '(invalid)'
           when props->>'referrer_host' <> '(none)' then props->>'referrer_host'
           else '(direct)'
         end as source,
         props->>'utm_medium' as utm_medium,
         props->>'utm_campaign' as utm_campaign
  from public.events_clean
  where event_name = 'session_started'
  order by session_id, occurred_at, id
),
sessions as (
  select e.session_id,
         min(e.occurred_at) as first_at,
         bool_or(e.event_name = 'order_placed') as ordered,
         coalesce(s.source, '(unknown)') as source,
         coalesce(s.utm_medium, '(unknown)') as utm_medium,
         coalesce(s.utm_campaign, '(unknown)') as utm_campaign
  from public.events_clean e
  left join started s using (session_id)
  group by e.session_id, s.source, s.utm_medium, s.utm_campaign
),
part_a as (
  select 'a'::text as part,
         (first_at at time zone 'UTC')::date::text as day,
         source, utm_medium, utm_campaign,
         count(*)::int as numerator,
         (sum(count(*)) over (partition by (first_at at time zone 'UTC')::date))::int as base
  from sessions, params
  where first_at >= w_start and first_at < w_end
  group by (first_at at time zone 'UTC')::date, source, utm_medium, utm_campaign
),
part_b as (
  select 'b'::text as part,
         null::text as day,
         source, utm_medium, utm_campaign,
         (count(*) filter (where ordered))::int as numerator,
         count(*)::int as base
  from sessions, params
  where first_at >= w_start and first_at < w_end
  group by source, utm_medium, utm_campaign
),
first_touch as (
  select distinct on (visitor_id)
         visitor_id, occurred_at, source, utm_medium, utm_campaign
  from started
  order by visitor_id, occurred_at, session_id
),
part_c as (
  select 'c'::text as part,
         null::text as day,
         f.source, f.utm_medium, f.utm_campaign,
         (count(*) filter (where exists (
            select 1 from public.events_clean o
            where o.visitor_id = f.visitor_id and o.event_name = 'order_placed'
         )))::int as numerator,
         count(*)::int as base
  from first_touch f, params
  where f.occurred_at >= w_start and f.occurred_at < w_end
  group by f.source, f.utm_medium, f.utm_campaign
),
combined as (
  select * from part_a
  union all select * from part_b
  union all select * from part_c
)
select part, day, source, utm_medium, utm_campaign, numerator, base,
       round(numerator::numeric / nullif(base, 0), 4)::float8 as rate
from combined
order by part, day, source, utm_medium, utm_campaign;

-- name: M7
-- Completion rate. Unit: order. Cohort = order_placed in the window (R7);
-- delivered counts whenever it happened.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
placed as (
  select distinct props->>'order_id' as order_id
  from public.events_clean, params
  where event_name = 'order_placed'
    and occurred_at >= w_start and occurred_at < w_end
),
delivered as (
  select distinct props->>'order_id' as order_id
  from public.events_clean
  where event_name = 'order_delivered'
)
select count(*)::int as placed,
       (count(*) filter (where d.order_id is not null))::int as delivered,
       round((count(*) filter (where d.order_id is not null))::numeric / nullif(count(*), 0), 4)::float8 as completion_rate
from placed p
left join delivered d using (order_id);

-- name: M8
-- Rating rates. Unit: order. Denominator = delivered orders in the
-- order_placed cohort (R7). Restaurant and driver share it.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
delivered as (
  select distinct d.props->>'order_id' as order_id
  from public.events_clean d, params
  where d.event_name = 'order_delivered'
    and exists (
      select 1 from public.events_clean p
      where p.event_name = 'order_placed'
        and p.props->>'order_id' = d.props->>'order_id'
        and p.occurred_at >= w_start and p.occurred_at < w_end
    )
),
restaurant as (
  select distinct props->>'order_id' as order_id
  from public.events_clean where event_name = 'rating_submitted'
),
driver as (
  select distinct props->>'order_id' as order_id
  from public.events_clean where event_name = 'driver_rating_submitted'
)
select count(*)::int as delivered,
       (count(*) filter (where r.order_id is not null))::int as restaurant_rated,
       round((count(*) filter (where r.order_id is not null))::numeric / nullif(count(*), 0), 4)::float8 as restaurant_rate,
       (count(*) filter (where v.order_id is not null))::int as driver_rated,
       round((count(*) filter (where v.order_id is not null))::numeric / nullif(count(*), 0), 4)::float8 as driver_rate
from delivered d
left join restaurant r using (order_id)
left join driver v using (order_id);

-- name: M9
-- Sign-in wall. Unit: session. Base P = sessions whose first
-- sign_in_prompt_shown for that surface is in the window. Per surface:
-- start rate, pass rate (outcome success), and wall-to-order (checkout:
-- order_placed; tip: tip_sent) later than the session's first prompt.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
prompted as (
  select session_id, props->>'surface' as surface, min(occurred_at) as first_prompt
  from public.events_clean
  where event_name = 'sign_in_prompt_shown'
  group by session_id, props->>'surface'
),
base as (
  select p.*
  from prompted p, params
  where p.first_prompt >= w_start and p.first_prompt < w_end
)
select b.surface,
       count(*)::int as sessions,
       (count(*) filter (where exists (
          select 1 from public.events_clean e
          where e.session_id = b.session_id and e.event_name = 'sign_in_started'
            and e.props->>'surface' = b.surface
       )))::int as started,
       round((count(*) filter (where exists (
          select 1 from public.events_clean e
          where e.session_id = b.session_id and e.event_name = 'sign_in_started'
            and e.props->>'surface' = b.surface
       )))::numeric / count(*), 4)::float8 as start_rate,
       (count(*) filter (where exists (
          select 1 from public.events_clean e
          where e.session_id = b.session_id and e.event_name = 'sign_in_completed'
            and e.props->>'surface' = b.surface and e.props->>'outcome' = 'success'
       )))::int as passed,
       round((count(*) filter (where exists (
          select 1 from public.events_clean e
          where e.session_id = b.session_id and e.event_name = 'sign_in_completed'
            and e.props->>'surface' = b.surface and e.props->>'outcome' = 'success'
       )))::numeric / count(*), 4)::float8 as pass_rate,
       (count(*) filter (where exists (
          select 1 from public.events_clean e
          where e.session_id = b.session_id
            and e.event_name = case b.surface when 'checkout' then 'order_placed' else 'tip_sent' end
            and e.occurred_at > b.first_prompt
       )))::int as converted,
       round((count(*) filter (where exists (
          select 1 from public.events_clean e
          where e.session_id = b.session_id
            and e.event_name = case b.surface when 'checkout' then 'order_placed' else 'tip_sent' end
            and e.occurred_at > b.first_prompt
       )))::numeric / count(*), 4)::float8 as wall_to_action_rate
from base b
group by b.surface
order by b.surface;

-- name: M10
-- Wallet-paid share. Unit: order. Only order_placed rows that carry the
-- wallet_paid key (R4); order_placed in the window.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
orders as (
  select distinct on (props->>'order_id')
         props->>'order_id' as order_id,
         (props->>'wallet_paid')::boolean as wallet_paid
  from public.events_clean, params
  where event_name = 'order_placed'
    and props ? 'wallet_paid'
    and occurred_at >= w_start and occurred_at < w_end
  order by props->>'order_id', occurred_at, id
)
select count(*)::int as orders,
       (count(*) filter (where wallet_paid))::int as wallet_paid_orders,
       round((count(*) filter (where wallet_paid))::numeric / nullif(count(*), 0), 4)::float8 as wallet_paid_share
from orders;

-- name: M11
-- Short-balance recovery. Unit: session. Base = sessions whose first
-- checkout wallet_short_shown is in the window; recovered = an
-- order_placed later in the same session.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
shorts as (
  select session_id, min(occurred_at) as first_short
  from public.events_clean
  where event_name = 'wallet_short_shown' and props->>'surface' = 'checkout'
  group by session_id
),
base as (
  select s.*
  from shorts s, params
  where s.first_short >= w_start and s.first_short < w_end
)
select count(*)::int as sessions,
       (count(*) filter (where exists (
          select 1 from public.events_clean e
          where e.session_id = b.session_id and e.event_name = 'order_placed'
            and e.occurred_at > b.first_short
       )))::int as recovered,
       round((count(*) filter (where exists (
          select 1 from public.events_clean e
          where e.session_id = b.session_id and e.event_name = 'order_placed'
            and e.occurred_at > b.first_short
       )))::numeric / nullif(count(*), 0), 4)::float8 as recovery_rate
from base b;

-- name: M12
-- Tip rate. Unit: order. Base = wallet-paid orders (wallet_paid key present,
-- R4) in the order_placed cohort (R7) that were delivered; tipped = a
-- tip_sent for the order, whenever it happened.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
base as (
  select distinct p.props->>'order_id' as order_id
  from public.events_clean p, params
  where p.event_name = 'order_placed'
    and p.props ? 'wallet_paid'
    and (p.props->>'wallet_paid')::boolean
    and p.occurred_at >= w_start and p.occurred_at < w_end
    and exists (
      select 1 from public.events_clean d
      where d.event_name = 'order_delivered' and d.props->>'order_id' = p.props->>'order_id'
    )
),
tipped as (
  select distinct props->>'order_id' as order_id
  from public.events_clean where event_name = 'tip_sent'
)
select count(*)::int as eligible_orders,
       (count(*) filter (where t.order_id is not null))::int as tipped_orders,
       round((count(*) filter (where t.order_id is not null))::numeric / nullif(count(*), 0), 4)::float8 as tip_rate
from base b
left join tipped t using (order_id);

-- name: M13
-- VIP mix. Unit: order. New-shape order_placed rows only (vip_level key
-- present, R4), in the window; each level's share of those orders.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
orders as (
  select distinct on (props->>'order_id')
         props->>'order_id' as order_id,
         props->>'vip_level' as vip_level
  from public.events_clean, params
  where event_name = 'order_placed'
    and props ? 'vip_level'
    and occurred_at >= w_start and occurred_at < w_end
  order by props->>'order_id', occurred_at, id
)
select vip_level,
       count(*)::int as orders,
       (sum(count(*)) over ())::int as all_orders,
       round(count(*)::numeric / sum(count(*)) over (), 4)::float8 as share
from orders
group by vip_level
order by vip_level;

-- name: M14
-- Thanks-voucher use. Unit: order. New-shape order_placed rows only
-- (thanks_voucher_amount_minor key present, R4), in the window.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
orders as (
  select distinct on (props->>'order_id')
         props->>'order_id' as order_id,
         (props->>'thanks_voucher_amount_minor')::bigint as thanks_amount
  from public.events_clean, params
  where event_name = 'order_placed'
    and props ? 'thanks_voucher_amount_minor'
    and occurred_at >= w_start and occurred_at < w_end
  order by props->>'order_id', occurred_at, id
)
select count(*)::int as orders,
       (count(*) filter (where thanks_amount > 0))::int as thanks_voucher_orders,
       round((count(*) filter (where thanks_amount > 0))::numeric / nullif(count(*), 0), 4)::float8 as thanks_voucher_share
from orders;

-- name: M15
-- Voucher attachment. Unit: order. Every order_placed in the window (both
-- shapes carry applied_voucher_ids).
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
orders as (
  select distinct on (props->>'order_id')
         props->>'order_id' as order_id,
         jsonb_array_length(props->'applied_voucher_ids') as voucher_count
  from public.events_clean, params
  where event_name = 'order_placed'
    and occurred_at >= w_start and occurred_at < w_end
  order by props->>'order_id', occurred_at, id
)
select count(*)::int as orders,
       (count(*) filter (where voucher_count > 0))::int as orders_with_voucher,
       round((count(*) filter (where voucher_count > 0))::numeric / nullif(count(*), 0), 4)::float8 as voucher_attachment
from orders;

-- name: M16
-- Flash view-to-action. Unit: (session, city). Base = pairs with a
-- flash_sheet_shown in the window; acted = those pairs with a
-- flash_sheet_closed whose outcome is restaurant_tapped.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
shown as (
  select distinct session_id, props->>'city' as city
  from public.events_clean, params
  where event_name = 'flash_sheet_shown'
    and occurred_at >= w_start and occurred_at < w_end
),
tapped as (
  select distinct session_id, props->>'city' as city
  from public.events_clean
  where event_name = 'flash_sheet_closed' and props->>'outcome' = 'restaurant_tapped'
)
select count(*)::int as sheets_shown,
       (count(*) filter (where t.session_id is not null))::int as restaurant_tapped,
       round((count(*) filter (where t.session_id is not null))::numeric / nullif(count(*), 0), 4)::float8 as view_to_action
from shown s
left join tapped t using (session_id, city);

-- name: M17
-- Location switch rate. Unit: visitor. Visitors with a location_selected in
-- the window, and those among them with is_switch true.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
)
select count(distinct visitor_id)::int as visitors_selecting,
       (count(distinct visitor_id) filter (where (props->>'is_switch')::boolean))::int as visitors_switching,
       round((count(distinct visitor_id) filter (where (props->>'is_switch')::boolean))::numeric
             / nullif(count(distinct visitor_id), 0), 4)::float8 as switch_rate
from public.events_clean, params
where event_name = 'location_selected'
  and occurred_at >= w_start and occurred_at < w_end;
