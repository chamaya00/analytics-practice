# ADR 0016: Metrics are windowed on `received_at` and redefined in place as M1-M20; orders, sessions and visitors are Postgres views in an `analytics` schema

Date: 2026-09-29
Status: accepted (the definitions are decided here; the store child builds the views, and the queries child builds the queries)

## Context

#219's metrics M1-M17 are cited by number from:

- `docs/roadmap.md`;
- the learner exercise;
- `docs/measurement/219-launch-queries.sql`, and its test.

#264's second pass (`docs/research/266-fresh-analytics-assessment.md`,
Part 2) found five of them misread their own behaviour:

- **Windowing on `occurred_at` adds only device clock error.** This client
  stamps it at send time. So a phone whose clock is off puts its events on
  the wrong day, and every day stays revisable for 24 hours.
- **M3 reads "first seen" from all history.** It drifts upward as the store
  ages. Safari's ITP resets a browser after 7 idle days, which also
  under-reads it.
- **M7 "completion" cannot fail.** Every order is delivered by construction,
  so M7 measures return to the tracker. It was nevertheless a roadmap
  guardrail.
- **M9's wall-to-order and M11's recovery were confined to one tab.** Both
  behaviours cross tabs and hours: a drip window can be 9 hours long.
- **M5's cohort missed city switches.** A switch from the header pill fires
  no `home_viewed`.

Every order-, session- and browser-level question was also re-derived inside
each query, and could be derived differently in each.

#267 recommended dbt for that shared logic. D11 on #265 decided against dbt
in this pass: it would be the repository's first Python dependency, the
owner's call under house rules, and it has nowhere to run until #257's
export exists. O3 decided that M-numbers are not renumbered.

## Decision

The full specification is
`docs/measurement/270-analytics-readiness-second-pass.md` §8-§11.

**Metric definitions, redefined in place, with no renumbering (O3):**

- **R2.** Windows and days use `received_at`. Order within a browser, and
  elapsed time between two of its events, use `occurred_at`, then `seq`, then
  `id`.
- **R6 and M3.** Returning on day D means active on D **and** active on some
  day in [D−7, D−1].
- **R5 and R7** are kept, on R2's column.
- **M1 and M2 are relabelled.** M1 counts "browsers". M2 counts "tab
  sessions", and is a diagnostic only.
- **M4's ratios are named.**
  - The primary metric, \|S5\| ÷ \|S1\|, is **home-to-order conversion**.
  - \|S5\| ÷ \|S4\| is **checkout-to-order conversion**.
- **M5's cohort also admits `location_selected`.**
- **M7 is renamed "tracker return rate"** and removed from every guardrail
  list.
- **M9's wall-to-order and M11's recovery are measured per browser,** within
  24 hours of the first prompt or block. M9's start and pass rates stay per
  tab session.
- **New metrics:**
  - M18, the loss rate (ADR 0015);
  - M19, flash tap-through by fee mode and by amount;
  - M20, restaurant conversion.

  M21 (drip claims) is not added (D8).
- **Guardrails.** G1-G5 are kept, and G1 is made exact by `build`. **G6**
  bounds M18. The roadmap's launch guardrails become M4's home-to-order
  conversion, G6, and the #79 rule.

**Derived views, as plain SQL in one migration (D11):**

- **Where they live.** Schema `analytics`, which Supabase's Data API does not
  expose. Each view is `security_invoker = true`, revoked from `anon` and
  `authenticated`, and reads only `public.events_clean`. The three views are:
  - `analytics.orders`: one row per `order_id` with an `order_placed`;
  - `analytics.sessions`: one row per tab session;
  - `analytics.visitors`: one row per browser.
- **Grain and rules.** Each view's grain, columns and SQL-level rules are in
  the contract's §11. These include:
  - duplicate `order_id`s are collapsed to the earliest row;
  - missing post-order events are `null`;
  - orphan post-order events are excluded;
  - older clients' rows are read through R3 and R4.
- **Portable SQL.** The views use CTEs and `row_number()`, and test key
  presence with `->`, so they lift into dbt unchanged once dbt is approved.
- **"Session" means `session_id`,** a tab. A 30-minute analytic session, if
  #257 builds one, is named `visits`.
- **What #257 publishes** is named in §11.5:
  - learner views over `events_clean` and the three views;
  - `seq`, `build` and minute-truncated `received_at` added to the allow-list;
  - D9's re-keying of the uuid-valued prop `order_id`;
  - `dim_cities`, `dim_restaurants` and `dim_vouchers`.

## Consequences

- **Every change is query-time,** over columns every historical row already
  has, except M18, M19a and M20, which read this pass's new fields. So no
  cut-over date is needed, and the store keeps accepting every old shape
  (ADR 0014, ADR 0015).
- **Old readings shift in known ways.**
  - A day computed on `received_at` can differ from the same day computed on
    `occurred_at`, by the rows whose device clock crossed midnight UTC.
    That difference is the correction.
  - M3 reads lower than the "ever seen" version, and stops drifting with the
    store's age.
- **One live definition of an order, a tab session and a browser.** The M1-M20
  queries read the views, where they apply, instead of re-deriving them.
- **`docs/measurement/219-launch-queries.sql` becomes history.**
  `270-metric-queries.sql` replaces it. The roadmap's metric table,
  guardrails and north-star wording ("place an order") change in the same
  child.
- **The rule "never delete exported rows" (ADR 0005 step 7) stands.** It now
  rests on M6c and `analytics.visitors.first_seen_at`, not on M3.
- **Views now depend on `events_clean`.** A later migration that drops and
  recreates `events_clean`, as #225 did, must drop and recreate these views
  too, or use `cascade`.
- **dbt stays one decision away.** Approving it on #257 moves these three
  views into models with no rewrite. Only the JSON access needs porting for
  DuckDB.

## Alternatives rejected

- **Keep windowing on `occurred_at`.** A day would stay revisable for 24
  hours, and it would inherit every device's clock error. The client uses none
  of the one-day back-dating allowance that justified it.
- **Keep "returning" as "first seen before D, from all history".** It rises
  mechanically as the store ages, and on Safari it measures ITP's 7-day reset
  as much as behaviour.
- **Renumber the metrics into a clean new scheme.** Two numbering schemes
  would be live in the roadmap, the learner exercise and the queries (O3).
- **Keep M7 as a guardrail, and make delivery real with a server job.** The
  product guarantees delivery, so a truthful completion rate is a constant.
- **Session-based conversion as the primary metric,** the GA default. A
  session here is a tab, so its denominator is a browser-behaviour artefact.
  A browser that browses on Tuesday and orders on Wednesday would count as
  one failure and one success.
- **dbt Core with dbt-duckdb now** (#267's recommendation). It is the first
  Python dependency, which is the owner's approval to give (D11). It also has
  no runner until #257's Action exists.
- **Browser-written `orders` tables beside `events`.** A second write per
  order creates two truths about one order when one write fails. It also
  needs its own validator, RLS and rate accounting, and would hold only what
  `order_placed` already holds.
- **Materialised tables instead of views.** They would need a refresh
  schedule, and the site has no server to run one. At this volume, a view is
  fast enough.
- **Views in `public`, beside `events_clean`.** The Data API exposes
  `public`, so one missed revoke would make the views readable from every
  browser. A separate schema fails closed.
- **`sessions` as 30-minute inactivity sessions.** No M-number reads them. A
  second meaning of "session" beside `session_id` is the confusion this pass
  set out to remove.

## References

- ADR 0005, ADR 0012, ADR 0013, ADR 0014 and ADR 0015.
- `docs/measurement/219-analytics-readiness-contract.md` §11-§12, the base.
- `docs/measurement/270-analytics-readiness-second-pass.md` §8-§11 and §13.
- `docs/research/266-fresh-analytics-assessment.md` (Part 2 and its
  Recommendation), and `docs/research/267-data-infra-options.md`.
- Decisions D9, D11, O3 and O4 on #265.
