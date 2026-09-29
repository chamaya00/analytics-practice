# ADR 0016: Metric definitions revised in place, and the entity views are Postgres views

Date: 2026-09-29
Status: accepted

## Context

`docs/research/266-fresh-analytics-assessment.md` reconciled a fresh reading of
the site's measurement with #219's contract. Four of #219's metrics measure
something other than their names, and two rules drift:

- Windowing on `occurred_at` (the device's clock) moves a phone's events into
  the wrong UTC day and makes every day revisable for 24 hours. `received_at`
  is final at midnight UTC.
- "Returning" against unwindowed first-seen rises as the store ages and
  under-reads on Safari, where ITP deletes storage after 7 idle days.
- M7 "completion" cannot fail for the reason it names. Every order is
  delivered by construction, and `order_delivered` fires only when the visitor
  reopens the tracker. It is nonetheless on the roadmap's guardrail list.
- M9's wall-to-order and M11's recovery are counted inside one tab, but a
  visitor waiting for the next drip (up to 9 hours) comes back in a new tab.
- M5's cohort misses a visitor who switched city from the header pill, which
  fires no `home_viewed`.
- "Sessions" are tabs, and the label invites reading them as visits.

Separately, every entity question (an order, a session, a first touch) is
re-derived in each query, and each query can derive it differently. Decision
D11 on #265 rules out dbt in this pass, because it would be the repository's
first Python dependency, which is the owner's call under house rules item 5.

## Decision

- **Metrics are redefined in place; M-numbers are not renumbered (O3).**
  The roadmap, the learner exercise and the queries all cite M1-M17. Every
  change is a query-time change over columns every historical row already
  has, so none needs a cut-over date. The old reading is stated beside each
  new one in the contract's §7.
  - R2: window on `received_at`; order within a browser by `(occurred_at, seq)`.
  - R6 and M3: returning means some row in the seven UTC days before D.
  - M2 is relabelled "tab sessions". M4's S5/S1 is named "home-to-order
    conversion" (still the primary metric) and S5/S4 "checkout-to-order
    conversion".
  - M5's cohort admits `location_selected` pairs.
  - M7 is renamed "tracker return rate" and leaves the guardrail list.
  - M9's wall-to-order and M11's recovery are per browser, with a 24-hour
    horizon on `received_at`.
  - M18 (loss rate), M19 (flash tap-through by fee mode and amount) and M20
    (restaurant conversion) are added, and guardrail G6 with M18.
    M21 (drip claims) is not added (D8).
- **The guardrail list** becomes home-to-order conversion, the loss rate, and
  the #79 rule. G1-G5 stand; G1 becomes exact with `build`.
- **Three derived entity views, `public.orders`, `public.sessions` and
  `public.visitors`,** are Postgres views in a migration, over `events_clean`,
  in plain SQL (CTEs, window functions, `distinct on`, `jsonb` operators; no
  procedural code, no `security definer`) so a dbt model can later be a copy
  of the body. Each is `security_invoker = true` and revoked from `anon` and
  `authenticated`. Events remain the only written truth. Their columns,
  grains and per-column SQL rules are the contract's §9.
- **`sessions` is one row per tab session,** not per 30-minute visit, because
  the flash draw, `session_started` and the sign-in trip are keyed to the
  tab. A `visits` column gives the 30-minute reading as a teaching column that
  no M-number reads.
- **dbt is out of this pass (D11).** It belongs with #257's export, which does
  not exist yet, and needs the owner's approval as a first Python dependency.

## Consequences

- Historical numbers computed under #219's definitions do not equal the new
  ones for M2, M3, M5, M9 and M11, and the label changes. No row is rewritten;
  only the queries and the roadmap wording change.
- Queries stop drifting: an order is the `orders` row, so duplicate
  `order_id`s, missing post-order events and rows from older clients are
  handled once, in the view, and are visible (`placed_rows`, nulls).
- **The views depend on `events_clean`.** A later migration that drops and
  recreates `events_clean` must drop these three first, or Postgres refuses.
  This migration therefore recreates `events_clean` before creating them.
- Lifting the views into dbt is a copy, so the choice does not bind #257.
- M3 under-reads for the store's first seven days, and M18 under-reads by
  construction (ADR 0015). Both are labelled in the contract.
- The roadmap's metric table and guardrail sentence change in the same PR that
  ships the queries. About's D10 wording (events "never joined by us, and
  never published" to accounts) rides in the client child. The join itself is
  not broken in this pass.

## Alternatives rejected

- **Renumber the metrics.** The roadmap, exercise and queries cite the
  numbers, and renumbering buys nothing but churn (O3).
- **Keep `occurred_at` windows and add a late-arrival allowance.** It fixes
  nothing the device clock breaks, and leaves every day revisable.
- **Keep M7 as a guardrail and add a server-side delivery job** so completion
  can fail. `delivery.ts` imagines one, but the product guarantees delivery, so
  a truthful completion metric is a constant.
- **Session-based conversion as the primary metric.** A session here is a tab,
  and a visitor who browses Tuesday and orders Wednesday is one failure and
  one success.
- **`sessions` as 30-minute visits.** Splits one flash draw across two
  sessions and cannot be joined to the tab keys the product uses.
- **dbt Core with `dbt-duckdb` now** (#267's recommended transform). Rejected
  for this pass by D11; not rejected for #257.
- **Browser-written entity tables beside `events`** (#266's S2). A second write
  per order makes two truths about one order after a partial failure.

## References

ADR 0005, ADR 0008 (the #79 rule and the wallet), ADR 0013, ADR 0014, ADR 0015,
`docs/measurement/219-analytics-readiness-contract.md`,
`docs/measurement/264-second-pass-measurement-contract.md` §6-§9,
`docs/research/266-fresh-analytics-assessment.md` and
`docs/research/267-data-infra-options.md`.
