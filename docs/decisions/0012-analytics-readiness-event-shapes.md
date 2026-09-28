# ADR 0012: The store accepts the analytics-readiness shapes, and keeps accepting the old ones

Date: 2026-09-28
Status: accepted

## Context

`docs/measurement/219-analytics-readiness-contract.md` (#219, §8 and §13)
supersedes #81's contract: Los Angeles joins `sf` and `hcmc`, `cart_viewed`,
`checkout_viewed` and `order_placed` gain props, `flash_sheet_shown` carries
the whole 5-6 restaurant draw, and six events are new
(`driver_rating_submitted`, `tip_sent`, `sign_in_prompt_shown`,
`sign_in_started`, `sign_in_completed`, `wallet_short_shown`). The store
refuses any shape it does not know and nothing reports the refusal
(ADR 0005): `flash_sheet_shown` has been refused since the sheet began
drawing 5-6 restaurants, LA is refused everywhere, and none of the new events
can land. ADR 0007 already decided that the store checks shapes, enums and
bounds, and leaves cross-field invariants (currency against city, saved
amount against vouchers) to client tests.

Tabs that are already open keep sending #81's shapes after the new client
ships. A row the store refuses is lost silently.

## Decision

One additive migration,
`supabase/migrations/20261001000000_analytics_readiness_event_contract.sql`
(#224), replaces `event_is_valid` and the `event_name` CHECK (dropped and
re-added `not valid`, as in #85, so historical rows are not re-scanned). No
applied migration is edited and no stored row changes.

- **New shapes.** `cart_viewed` and `checkout_viewed` in a 4-key shape with
  `city`; `order_placed` in a 14-key shape (`city`,
  `thanks_voucher_amount_minor`, `vip_level`, `vip_saved_amount_minor`,
  `wallet_paid` added); `flash_sheet_shown` with 5-6 distinct slugs; the six
  new events, keys matched exactly, enumerated values (surfaces, providers,
  outcomes, tip presets per currency) checked.
- **`la`** is accepted wherever a city is checked, and the five `la-*`
  voucher ids join the voucher list for both `order_placed` shapes.
- **Strict superset, indefinitely.** Every (`event_name`, `props`) pair the
  previous `event_is_valid` accepts is still accepted, including the 3-key
  cart/checkout shapes, the 9-key `order_placed`, and a 2-slug
  `flash_sheet_shown`. This reverses #81's "old shapes rejected" posture
  (its AC7) on purpose: those shapes are still described by the new contract
  and map cleanly. There is no date on which the old shapes stop being
  accepted; retiring them would be a new decision.
- **No cross-field checks**, per ADR 0007.
- **Out of this migration:** `session_started`, the `is_internal` column and
  `events_clean` (#225's migration and ADR).

The owner's setup checklist in ADR 0005 names this file next, with a
read-only confirming query.

## Consequences

Old and new clients can write at the same time. The store is now looser than
the client: an old shape stays valid forever, so a metric that needs a new
prop must filter to rows that carry it. The proof is
`supabase/migrations/analytics-readiness-superset.migration.test.ts`, which
re-runs `two-city-event-contract.migration.test.ts` unmodified against the
new function, and `analytics-readiness-event-contract.migration.test.ts` for
the new shapes.

## Alternatives rejected

- **Replace the shapes outright, as #85 did.** Open tabs would write refused
  rows silently during the rollout.
- **Enforce currency against city in the store.** ADR 0007 decided against
  cross-field checks on the primary-metric rows; a refused row is gone, an
  inconsistent one can be counted and excluded.
- **A separate list of voucher ids for the old shape.** One list is simpler
  and widening the old shape costs nothing.

## References

ADR 0005 (the store), ADR 0007 (two-city contract), and
`docs/measurement/219-analytics-readiness-contract.md` §8 and §13.
