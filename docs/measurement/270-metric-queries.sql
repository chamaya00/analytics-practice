-- Metric queries for the second-pass measurement contract (#270, #277).
--
-- One named query per metric, M1 to M20, each implementing
-- docs/measurement/270-analytics-readiness-second-pass.md sections 8 and 9
-- exactly. It supersedes 219-launch-queries.sql, which is kept as history.
-- Paste ONE query at a time into the Supabase SQL Editor (a query starts at
-- its `-- name: Mn` line and ends at its `;`). All are read-only.
--
-- Where each query reads:
--   analytics.orders     M7, M8, M10, M12, M13, M14, M15 (order-unit metrics)
--   analytics.sessions   M2, M6a, M6b, M18
--   analytics.visitors   M6c
--   public.events_clean  everything else
-- The analytics views read only events_clean, so the owner's own browsers
-- (is_internal) are out of every query (R1).
--
-- Rules every query follows (contract R1-R8):
--   R2  a day is (received_at at time zone 'UTC')::date; windows are
--       half-open [w_start, w_end) on received_at, the server's clock. To
--       change the window, edit the two timestamps in the `params` CTE at
--       the top of the query. A day is final at 00:00 UTC the next day.
--       Order within one browser or tab, and the elapsed time between two
--       events of one browser (M9, M11), use occurred_at, then seq, then id.
--   R3  a row's city is coalesce(props->>'city', currency fallback).
--   R4  a prop the contract added is counted only on rows that have the key,
--       in numerator and denominator.
--   R5  a tab session's day is the UTC day of its earliest received_at.
--   R6  a browser is returning on D when it has a row on a UTC received_at
--       day in [D-7, D-1]. M3 reads that lookback, not all history.
--   R7  order metrics take their cohort from analytics.orders.placed_at in
--       the window; later events count whenever they happened, so recent
--       cohorts are still maturing.
--   R8  a session's source comes from its earliest session_started; a
--       session with none is '(unknown)' and is never dropped.
--
-- Rates are rounded to 4 places, with the numerator and denominator counts
-- beside every rate. An empty window returns no rows or nulls, never a
-- made-up zero. Never delete exported rows from the store: M6c and
-- analytics.visitors read all history.
--
-- Labels the numbers must carry: M3 under-reads for the store's first 7
-- days; M9 wall-to-order and M11 are read 24 hours after the window ends;
-- M18 is a lower bound on loss; M18, M19a and M20 are "new client only"
-- until G1-by-build passes 95%.

-- name: M1
-- Browsers by day. Unit: browser. No denominator, by design.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
)
select (received_at at time zone 'UTC')::date::text as day,
       count(distinct visitor_id)::int as browsers
from public.events_clean, params
where received_at >= w_start and received_at < w_end
group by 1
order by 1;

-- name: M2
-- Tab sessions by day (a diagnostic: a tab is not a visit), by session day
-- (R5). Unit: tab session. No denominator, by design.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
)
select session_day::text as day,
       count(*)::int as tab_sessions
from analytics.sessions, params
where started_at >= w_start and started_at < w_end
group by session_day
order by session_day;

-- name: M3
-- Returning browsers: active on day D with at least one row on a UTC
-- received_at day in [D-7, D-1] (R6). Unit: browser. The lookback reads up to
-- 7 days before the window. Under-reads for the store's first 7 days.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
active as (
  select distinct (received_at at time zone 'UTC')::date as day, visitor_id
  from public.events_clean, params
  where received_at >= w_start - interval '7 days' and received_at < w_end
)
select a.day::text as day,
       count(*)::int as browsers,
       (count(*) filter (where exists (
          select 1 from active p
          where p.visitor_id = a.visitor_id and p.day between a.day - 7 and a.day - 1
       )))::int as returning_browsers,
       round((count(*) filter (where exists (
          select 1 from active p
          where p.visitor_id = a.visitor_id and p.day between a.day - 7 and a.day - 1
       )))::numeric / count(*), 4)::float8 as returning_share
from active a, params
where (a.day::timestamp at time zone 'UTC') >= w_start
  and (a.day::timestamp at time zone 'UTC') < w_end
group by a.day
order by a.day;

-- name: M4
-- Home-to-order funnel. Unit: browser. S1 = browsers with a home_viewed in
-- the window; S2-S5 = members of S1 with that event in the window, in any
-- order. An empty cart (item_count 0) is not step 3. Step conversion =
-- Sk / Sk-1. The primary metric, home-to-order conversion, is S5 / S1 (on
-- the step 5 row); checkout-to-order conversion is S5 / S4.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
win as (
  select visitor_id, event_name, props
  from public.events_clean, params
  where received_at >= w_start and received_at < w_end
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
  select s.step, s.event_name, count(h.visitor_id)::int as browsers
  from steps s
  left join hit h using (event_name)
  group by s.step, s.event_name
),
ratios as (
  select step, event_name, browsers,
         lag(browsers) over (order by step) as step_denominator,
         first_value(browsers) over (order by step) as s1_browsers
  from counts
)
select step,
       event_name,
       browsers,
       step_denominator,
       round(browsers::numeric / nullif(step_denominator, 0), 4)::float8 as step_conversion,
       s1_browsers,
       round(browsers::numeric / nullif(s1_browsers, 0), 4)::float8 as share_of_s1,
       case when step = 5 then round(browsers::numeric / nullif(s1_browsers, 0), 4)::float8 end as home_to_order_conversion,
       case when step = 5 then round(browsers::numeric / nullif(step_denominator, 0), 4)::float8 end as checkout_to_order_conversion
from ratios
order by step;

-- name: M5
-- Funnel by city. Unit: (browser, city) pair. S1(c) = pairs with a
-- home_viewed whose city is c or a location_selected whose city is c in the
-- window (a header-pill switch fires no home_viewed). Steps 2-5 count cohort
-- pairs with that event on a row whose city (R3) is c. A browser active in
-- two cities is one pair in each, so pairs can sum above M4's step 1.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
win as (
  select visitor_id, event_name, props,
         coalesce(props->>'city', case props->>'currency' when 'VND' then 'hcmc' when 'USD' then 'sf' end) as city
  from public.events_clean, params
  where received_at >= w_start and received_at < w_end
),
cohort as (
  select distinct visitor_id, city
  from win
  where event_name in ('home_viewed', 'location_selected')
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
  values (2, 'restaurant_opened'), (3, 'cart_viewed'),
         (4, 'checkout_viewed'), (5, 'order_placed')
),
counts as (
  select city, 1 as step, 'home_viewed or location_selected'::text as event_name, count(*)::int as pairs
  from cohort
  group by city
  union all
  select c.city, s.step, s.event_name, count(h.visitor_id)::int
  from (select distinct city from cohort) c
  cross join steps s
  left join hit h on h.city = c.city and h.event_name = s.event_name
  group by c.city, s.step, s.event_name
),
ratios as (
  select city, step, event_name, pairs,
         lag(pairs) over (partition by city order by step) as step_denominator,
         first_value(pairs) over (partition by city order by step) as s1_pairs
  from counts
)
select city,
       step,
       event_name,
       pairs,
       step_denominator,
       round(pairs::numeric / nullif(step_denominator, 0), 4)::float8 as step_conversion,
       s1_pairs,
       case when step = 5 then round(pairs::numeric / nullif(s1_pairs, 0), 4)::float8 end as conversion_by_city
from ratios
order by city, step;

-- name: M6
-- Acquisition by source (R8). One result, three parts, each as numerator /
-- base / rate:
--   a  source share by session day: tab sessions with source s / all tab
--      sessions with that session day (base includes '(unknown)'). Unit:
--      tab session (analytics.sessions).
--   b  tab-session conversion: sessions with source s and a session day in
--      the window that have an order_placed / all of them
--      (analytics.sessions).
--   c  first-touch browser conversion: browsers whose first-touch
--      session_started (analytics.visitors.first_touch_at) is in the window,
--      by first-touch source, with at least one order ever / all of them.
--      For "did LinkedIn bring buyers", read part c. Caveat: a LinkedIn
--      in-app view and Safari can be two browsers.
-- utm_medium and utm_campaign ride alongside the source, never folded in.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
in_window as (
  select s.*
  from analytics.sessions s, params
  where s.started_at >= w_start and s.started_at < w_end
),
part_a as (
  select 'a'::text as part,
         session_day::text as day,
         source, utm_medium, utm_campaign,
         count(*)::int as numerator,
         (sum(count(*)) over (partition by session_day))::int as base
  from in_window
  group by session_day, source, utm_medium, utm_campaign
),
part_b as (
  select 'b'::text as part,
         null::text as day,
         source, utm_medium, utm_campaign,
         (count(*) filter (where ordered))::int as numerator,
         count(*)::int as base
  from in_window
  group by source, utm_medium, utm_campaign
),
part_c as (
  select 'c'::text as part,
         null::text as day,
         v.first_touch_source as source,
         v.first_touch_utm_medium as utm_medium,
         v.first_touch_utm_campaign as utm_campaign,
         (count(*) filter (where v.orders > 0))::int as numerator,
         count(*)::int as base
  from analytics.visitors v, params
  where v.first_touch_at >= w_start and v.first_touch_at < w_end
  group by v.first_touch_source, v.first_touch_utm_medium, v.first_touch_utm_campaign
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
-- Tracker return rate (an engagement metric, not a guardrail). Unit: order.
-- Cohort = orders placed in the window (R7); delivery_seen_at not null means
-- the tracker was opened after the delivery time, not "delivered" (every
-- order is delivered by construction).
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
)
select count(*)::int as orders,
       (count(*) filter (where delivery_seen_at is not null))::int as delivery_seen,
       round((count(*) filter (where delivery_seen_at is not null))::numeric / nullif(count(*), 0), 4)::float8 as tracker_return_rate
from analytics.orders, params
where placed_at >= w_start and placed_at < w_end;

-- name: M8
-- Rating rates. Unit: order. Denominator = orders in cohort W with
-- delivery_seen_at; restaurant and driver rates share it.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
)
select count(*)::int as delivery_seen_orders,
       (count(*) filter (where restaurant_rated_at is not null))::int as restaurant_rated,
       round((count(*) filter (where restaurant_rated_at is not null))::numeric / nullif(count(*), 0), 4)::float8 as restaurant_rate,
       (count(*) filter (where driver_rated_at is not null))::int as driver_rated,
       round((count(*) filter (where driver_rated_at is not null))::numeric / nullif(count(*), 0), 4)::float8 as driver_rate
from analytics.orders, params
where placed_at >= w_start and placed_at < w_end
  and delivery_seen_at is not null;

-- name: M9
-- Sign-in wall, per surface (checkout or tip).
--   Start / pass: unit tab session. P = sessions whose first
--   sign_in_prompt_shown for the surface, by (occurred_at, seq, id), has its
--   received_at in the window. Start = a sign_in_started for the surface;
--   pass = a sign_in_completed for it with outcome success.
--   Wall-to-order: unit browser. P_b = browsers with a prompt for the
--   surface received in the window; t0 = occurred_at of the earliest such
--   row in the window. Converted = an order_placed (tip surface: tip_sent) by
--   the browser with occurred_at in (t0, t0 + 24 hours]. Read it 24 hours
--   after the window ends.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
prompts as (
  select session_id, props->>'surface' as surface, received_at,
         row_number() over (partition by session_id, props->>'surface' order by occurred_at, seq, id) as rn
  from public.events_clean
  where event_name = 'sign_in_prompt_shown'
),
p as (
  select session_id, surface
  from prompts, params
  where rn = 1 and received_at >= w_start and received_at < w_end
),
p_agg as (
  select p.surface,
         count(*)::int as sessions,
         (count(*) filter (where exists (
            select 1 from public.events_clean e
            where e.session_id = p.session_id and e.event_name = 'sign_in_started'
              and e.props->>'surface' = p.surface
         )))::int as started,
         (count(*) filter (where exists (
            select 1 from public.events_clean e
            where e.session_id = p.session_id and e.event_name = 'sign_in_completed'
              and e.props->>'surface' = p.surface and e.props->>'outcome' = 'success'
         )))::int as passed
  from p
  group by p.surface
),
pb_rows as (
  select visitor_id, surface, occurred_at,
         row_number() over (partition by visitor_id, surface order by occurred_at, seq, id) as rn
  from (
    select visitor_id, props->>'surface' as surface, occurred_at, seq, id
    from public.events_clean, params
    where event_name = 'sign_in_prompt_shown'
      and received_at >= w_start and received_at < w_end
  ) w
),
pb as (
  select visitor_id, surface, occurred_at as t0 from pb_rows where rn = 1
),
pb_agg as (
  select pb.surface,
         count(*)::int as browsers,
         (count(*) filter (where exists (
            select 1 from public.events_clean e
            where e.visitor_id = pb.visitor_id
              and e.event_name = case pb.surface when 'checkout' then 'order_placed' else 'tip_sent' end
              and e.occurred_at > pb.t0 and e.occurred_at <= pb.t0 + interval '24 hours'
         )))::int as converted
  from pb
  group by pb.surface
)
select surface,
       p_agg.sessions,
       p_agg.started,
       round(p_agg.started::numeric / nullif(p_agg.sessions, 0), 4)::float8 as start_rate,
       p_agg.passed,
       round(p_agg.passed::numeric / nullif(p_agg.sessions, 0), 4)::float8 as pass_rate,
       pb_agg.browsers,
       pb_agg.converted,
       round(pb_agg.converted::numeric / nullif(pb_agg.browsers, 0), 4)::float8 as wall_to_order_rate
from p_agg
left join pb_agg using (surface)
order by surface;

-- name: M10
-- Wallet-paid share. Unit: order. Orders in cohort W with wallet_paid not
-- null (R4: an older client's order is outside numerator and denominator).
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
)
select count(*)::int as orders,
       (count(*) filter (where wallet_paid))::int as wallet_paid_orders,
       round((count(*) filter (where wallet_paid))::numeric / nullif(count(*), 0), 4)::float8 as wallet_paid_share
from analytics.orders, params
where placed_at >= w_start and placed_at < w_end
  and wallet_paid is not null;

-- name: M11
-- Short-balance recovery. Unit: browser. B = browsers with a
-- wallet_short_shown for surface checkout received in the window; t0 =
-- occurred_at of the earliest such row. Recovered = an order_placed by the
-- browser with occurred_at in (t0, t0 + 24 hours]. Read it 24 hours after
-- the window ends.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
b as (
  select visitor_id, min(occurred_at) as t0
  from public.events_clean, params
  where event_name = 'wallet_short_shown'
    and props->>'surface' = 'checkout'
    and received_at >= w_start and received_at < w_end
  group by visitor_id
)
select count(*)::int as browsers,
       (count(*) filter (where exists (
          select 1 from public.events_clean e
          where e.visitor_id = b.visitor_id and e.event_name = 'order_placed'
            and e.occurred_at > b.t0 and e.occurred_at <= b.t0 + interval '24 hours'
       )))::int as recovered,
       round((count(*) filter (where exists (
          select 1 from public.events_clean e
          where e.visitor_id = b.visitor_id and e.event_name = 'order_placed'
            and e.occurred_at > b.t0 and e.occurred_at <= b.t0 + interval '24 hours'
       )))::numeric / nullif(count(*), 0), 4)::float8 as recovery_rate
from b;

-- name: M12
-- Tip rate. Unit: order. Orders in cohort W with wallet_paid = true and
-- delivery_seen_at not null; tipped = tipped_at not null.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
)
select count(*)::int as eligible_orders,
       (count(*) filter (where tipped_at is not null))::int as tipped_orders,
       round((count(*) filter (where tipped_at is not null))::numeric / nullif(count(*), 0), 4)::float8 as tip_rate
from analytics.orders, params
where placed_at >= w_start and placed_at < w_end
  and wallet_paid
  and delivery_seen_at is not null;

-- name: M13
-- VIP mix. Unit: order. Each level's share of orders in cohort W with
-- vip_level not null (R4).
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
)
select vip_level,
       count(*)::int as orders,
       (sum(count(*)) over ())::int as all_orders,
       round(count(*)::numeric / sum(count(*)) over (), 4)::float8 as share
from analytics.orders, params
where placed_at >= w_start and placed_at < w_end
  and vip_level is not null
group by vip_level
order by vip_level;

-- name: M14
-- Thanks-voucher use. Unit: order. Orders in cohort W with
-- thanks_voucher_amount_minor not null (R4); used = amount > 0.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
)
select count(*)::int as orders,
       (count(*) filter (where thanks_voucher_amount_minor > 0))::int as thanks_voucher_orders,
       round((count(*) filter (where thanks_voucher_amount_minor > 0))::numeric / nullif(count(*), 0), 4)::float8 as thanks_voucher_share
from analytics.orders, params
where placed_at >= w_start and placed_at < w_end
  and thanks_voucher_amount_minor is not null;

-- name: M15
-- Voucher attachment. Unit: order. Every order in cohort W (both shapes
-- carry applied_voucher_ids).
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
)
select count(*)::int as orders,
       (count(*) filter (where applied_voucher_count > 0))::int as orders_with_voucher,
       round((count(*) filter (where applied_voucher_count > 0))::numeric / nullif(count(*), 0), 4)::float8 as voucher_attachment
from analytics.orders, params
where placed_at >= w_start and placed_at < w_end;

-- name: M16
-- Flash view-to-action. Unit: (tab session, city) pair. Base = pairs with a
-- flash_sheet_shown received in the window; acted = those pairs with a
-- flash_sheet_closed whose outcome is restaurant_tapped, at any time.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
shown as (
  select distinct session_id, props->>'city' as city
  from public.events_clean, params
  where event_name = 'flash_sheet_shown'
    and received_at >= w_start and received_at < w_end
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
-- Location switch rate. Unit: browser. Browsers with a location_selected in
-- the window, and those among them with is_switch true.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
)
select count(distinct visitor_id)::int as browsers_selecting,
       (count(distinct visitor_id) filter (where (props->>'is_switch')::boolean))::int as browsers_switching,
       round((count(distinct visitor_id) filter (where (props->>'is_switch')::boolean))::numeric
             / nullif(count(distinct visitor_id), 0), 4)::float8 as switch_rate
from public.events_clean, params
where event_name = 'location_selected'
  and received_at >= w_start and received_at < w_end;

-- name: M18
-- Loss rate (guardrail G6). Unit: event slot, one seq value issued in a tab
-- session. Sum of seq_lost / sum of seq_max over analytics.sessions rows
-- with session_day D and seq_max not null; the session count is beside it.
-- A lower bound on loss: tail and whole-session loss are invisible. Judge a
-- day only when seq_max_sum >= 200. New client only.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
)
select session_day::text as day,
       count(*)::int as sessions,
       sum(seq_max)::int as seq_max_sum,
       sum(seq_lost)::int as seq_lost_sum,
       round(sum(seq_lost)::numeric / nullif(sum(seq_max), 0), 4)::float8 as loss_rate
from analytics.sessions, params
where started_at >= w_start and started_at < w_end
  and seq_max is not null
group by session_day
order by session_day;

-- name: M19
-- Flash tap-through by treatment. One result, two parts. Sheets are
-- (tab session, city) pairs; a pair with more than one flash_sheet_shown
-- uses the earliest by (occurred_at, seq, id). Window on
-- flash_sheet_shown.received_at.
--   a  by fee mode, over sheets that carry fee_modes (R4). Unit: slot
--      (tab session, city, restaurant): slot i is restaurant_slugs[i] with
--      fee_modes[i]. A slot is tapped when a flash_sheet_closed exists, at
--      any time, with the same session and city, outcome restaurant_tapped
--      and restaurant_slug equal to the slot's slug. Read it as a comparison
--      between modes, never as a sum: a sheet has at most one tap, so
--      cluster any interval by sheet. New client only.
--   b  by amount_minor, over every sheet of either shape. Unit: sheet.
--      Tapped = a restaurant_tapped close in the same session and city.
-- Both are split by city.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
shown_rows as (
  select session_id, props, received_at,
         row_number() over (partition by session_id, props->>'city' order by occurred_at, seq, id) as rn
  from public.events_clean
  where event_name = 'flash_sheet_shown'
),
sheets as (
  select session_id, props
  from shown_rows, params
  where rn = 1 and received_at >= w_start and received_at < w_end
),
taps as (
  select distinct session_id, props->>'city' as city, props->>'restaurant_slug' as slug
  from public.events_clean
  where event_name = 'flash_sheet_closed' and props->>'outcome' = 'restaurant_tapped'
),
slots as (
  select s.session_id,
         s.props->>'city' as city,
         s.props->'restaurant_slugs'->>g.i as slug,
         s.props->'fee_modes'->>g.i as fee_mode
  from sheets s
  cross join lateral generate_series(0, jsonb_array_length(s.props->'restaurant_slugs') - 1) as g(i)
  where s.props->'fee_modes' is not null
),
part_a as (
  select 'a'::text as part, city, fee_mode, null::int as amount_minor,
         count(*)::int as shown,
         (count(*) filter (where exists (
            select 1 from taps t
            where t.session_id = slots.session_id and t.city = slots.city and t.slug = slots.slug
         )))::int as tapped
  from slots
  group by city, fee_mode
),
part_b as (
  select 'b'::text as part, s.props->>'city' as city, null::text as fee_mode,
         (s.props->>'amount_minor')::int as amount_minor,
         count(*)::int as shown,
         (count(*) filter (where exists (
            select 1 from taps t
            where t.session_id = s.session_id and t.city = s.props->>'city'
         )))::int as tapped
  from sheets s
  group by s.props->>'city', (s.props->>'amount_minor')::int
),
combined as (
  select * from part_a
  union all select * from part_b
)
select part, city, fee_mode, amount_minor, shown, tapped,
       round(tapped::numeric / nullif(shown, 0), 4)::float8 as tap_through
from combined
order by part, city, fee_mode, amount_minor;

-- name: M20
-- Restaurant conversion. Unit: (browser, restaurant) pair. R(r) = browsers
-- with a restaurant_opened for r received in the window AND build not null
-- (so the browser's client also sends restaurant_slug on orders, R4).
-- Converted = browsers in R(r) with an order_placed whose restaurant_slug is
-- r, received in the window. A restaurant with a handful of browsers is not
-- a finding. New client only.
with params as (
  select timestamptz '2026-10-01 00:00:00+00' as w_start,
         timestamptz '2026-11-01 00:00:00+00' as w_end
),
opened as (
  select distinct visitor_id, props->>'restaurant_slug' as restaurant_slug
  from public.events_clean, params
  where event_name = 'restaurant_opened'
    and build is not null
    and received_at >= w_start and received_at < w_end
),
ordered as (
  select distinct visitor_id, props->>'restaurant_slug' as restaurant_slug
  from public.events_clean, params
  where event_name = 'order_placed'
    and props->'restaurant_slug' is not null
    and received_at >= w_start and received_at < w_end
)
select o.restaurant_slug,
       count(*)::int as browsers_opened,
       (count(*) filter (where d.visitor_id is not null))::int as browsers_ordered,
       round((count(*) filter (where d.visitor_id is not null))::numeric / nullif(count(*), 0), 4)::float8 as conversion
from opened o
left join ordered d using (visitor_id, restaurant_slug)
group by o.restaurant_slug
order by o.restaurant_slug;
