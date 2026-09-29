# ADR 0014: `order_placed` carries its restaurant, `flash_sheet_shown` carries its fee modes, and the store keeps accepting the old shapes

Date: 2026-09-29
Status: accepted

## Context

`docs/measurement/264-second-pass-measurement-contract.md` (#270, §3) revises
#219's contract on two events, after `docs/research/266-fresh-analytics-assessment.md`
found:

- `order_placed` does not say which restaurant. A browser can hold several
  carts, so restaurant-level conversion (directions E and C) can only be
  guessed from the last `restaurant_opened`.
- The site already runs a randomised experiment: each tab session's flash draw
  gives every drawn restaurant `free` or `reduced` delivery, 50/50.
  `flash_sheet_shown` logs the slugs but not the modes, so the one treatment
  the site randomises cannot be read.

The owner approved both additions as privacy calls (D4, D5 on #265). The store
refuses any shape it does not know and reports nothing (ADR 0005), and tabs
that are already open keep sending the old shapes after a new client ships
(ADR 0012).

## Decision

Two new accepted shapes, alongside the old ones, in one additive migration
(the store child of #264). Both are matched by exact sorted key set, as every
shape is (ADR 0005 §2).

- **`order_placed`** accepts a 15-key shape: #219's 14 keys plus
  `restaurant_slug`, a string of 1-60 characters matching
  `^[a-z0-9]+(-[a-z0-9]+)*$`. Every other check on the 14-key shape applies
  unchanged.
- **`flash_sheet_shown`** accepts a 5-key shape: the 4-key shape's keys plus
  `fee_modes`, an array of strings, each `free` or `reduced`, of length 5 or 6
  **and equal to the length of `restaurant_slugs`**, whose element `i` is the
  treatment of `restaurant_slugs[i]`.
- **Strict superset, without an end date.** Every (`event_name`, `props`) pair
  the current `event_is_valid` accepts is still accepted: `order_placed` in
  its 9-key and 14-key shapes, `flash_sheet_shown` in its 4-key shape
  (including a 2-slug array). The 15-key and 5-key shapes are additions. An
  old shape stops being sent when the client stops sending it, never by the
  store refusing it. Retiring one would be a new decision.
- **The equal-length rule is enforced by the store.** This is the one
  exception to ADR 0007's rule that the store checks shapes and bounds and
  leaves cross-field invariants to client tests.
- Sixteen other events are unchanged, and no event is added or retired.
  `drip_claimed` is not added (D8). `restaurant_opened.entry` waits for #204's
  follow-up (O4).

## Consequences

- Restaurant-level conversion (M20) and the flash treatment read (M19) become
  possible, for rows from the new client only. A metric that needs the new
  props filters to rows that carry them (R4 and R4' of the contract), and
  describes a subset of orders until old tabs are gone.
- The store is looser than the client for as long as it lives: the old shapes
  stay valid, and a metric can never assume every `order_placed` has a
  restaurant.
- Cross-field consistency of the slug (that it belongs to `city`) stays a
  client test, not a store check (ADR 0007).
- A `fee_modes` array of the wrong length is refused and lost, and G1 or G4
  is where that shows. That is the intended trade.
- The privacy caveat for `restaurant_slug`, that catalogue fees make an order
  total nearly reconstructable and a wallet-paid total equals the debit, is
  the driver's D4 and does not add an account key to any event.
- Proof: the existing superset tests run unmodified against the new function,
  and new PGlite accept-tests cite the contract's §3.1 and §3.2 by section.

## Alternatives rejected

- **Infer the restaurant from the session's last `restaurant_opened`.**
  Ambiguous the moment a browser holds two carts, and it can't be
  corrected afterwards.
- **A separate `flash_treatment` event, one per drawn restaurant.** It would
  be up to six new rows per draw, against the 60-writes-per-5-minutes limit
  (ADR 0005 §4), to carry what one array on an existing event carries.
- **Leave `fee_modes` un-length-checked, per ADR 0007.** A mismatched array
  silently pairs a slug with another slug's treatment. Unlike currency against
  city, it can't be counted and excluded afterwards, so refusing it is the
  smaller harm.
- **Replace the old shapes outright, as #85 did.** Open tabs would write
  refused rows silently during the rollout (ADR 0012).

## References

ADR 0005 (the store), ADR 0007 (no cross-field checks), ADR 0012 (the
strict-superset posture), ADR 0013 (the wrapper pattern a later
`event_is_valid` should follow),
`docs/measurement/264-second-pass-measurement-contract.md` §3, and
`docs/research/266-fresh-analytics-assessment.md`.
