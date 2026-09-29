# ADR 0014: `order_placed` gains `restaurant_slug`, `flash_sheet_shown` gains `fee_modes`, and the store keeps accepting every older shape

Date: 2026-09-29
Status: accepted (the contract is decided here; the store child of #264 implements it)

## Context

#264's second analytics pass found two gaps that one prop each would close
(`docs/research/266-fresh-analytics-assessment.md`, Part 1 findings 2 and 3,
and Part 2's verdict table).

- **`order_placed` does not say which restaurant.** Carts are per restaurant,
  and a browser can hold several. So restaurant-level conversion can only be
  guessed from the session's last menu view. Direction E ("more content")
  and direction C (a promo slide's value) both need that number.
- **The flash sheet's randomised treatment is not logged.**
  - Every tab session draws 5-6 restaurants per city, and each is drawn
    `free` or `reduced` delivery at 50/50 (`drawFlashDeal`).
  - `flash_sheet_shown` logs the slugs, but not the fee modes.
  - The one randomised treatment the site runs cannot be read.

Both additions were approved as privacy calls on #265: D4 for
`restaurant_slug` and D5 for `fee_modes`. The #79 rule is untouched: a slug is
public catalogue data, and a fee mode describes the site's draw.

Three constraints shape how the store takes them:

- `event_is_valid` matches each event's key set exactly (ADR 0005 §2), so a
  new prop is a new shape.
- Open tabs keep sending the current shapes after a deploy, and a refused row
  is lost silently (ADR 0005).
- ADR 0012 and ADR 0013 already committed the store to a strict superset.

## Decision

The full specification is
`docs/measurement/270-analytics-readiness-second-pass.md` §4.

- **`order_placed` gains a 15-key shape:** #219's 14 keys plus
  `restaurant_slug`.
  - The slug is a string of 1-60 characters matching
    `^[a-z0-9]+(-[a-z0-9]+)*$`.
  - Its value is the checkout's own `restaurantSlug`, never inferred.
- **`flash_sheet_shown` gains a 5-key shape:** #219's 4 keys plus `fee_modes`.
  - `fee_modes` is an array the same length as `restaurant_slugs`, in drawn
    order.
  - Each element is `free` or `reduced`.
  - `restaurant_slugs` in this shape has 5 or 6 elements. The legacy length of
    2 is accepted only in the old 4-key shape.
- **The store checks that the two arrays have equal length.**
  - This is a structural check on one object, not a business invariant.
    ADR 0007 kept business invariants (currency against city, saved amount
    against vouchers) out of the store, because an inconsistent primary-metric
    row can be counted and excluded while a refused one is gone.
  - Here a misaligned row cannot be read at all.
  - The client validator drops the same row before sending, so the store's
    check adds no loss.
  - It matches the store's existing structural checks, such as
    `flash_sheet_closed.restaurant_slug` against its `outcome`, and
    `tip_sent`'s preset against its currency.
- **A strict superset, indefinitely.** Every (`event_name`, `props`) pair the
  live validator accepts is still accepted:
  - `order_placed` in its 9-key (#81) and 14-key (#219) shapes;
  - `flash_sheet_shown` in its 4-key shape with 2, 5 or 6 slugs.

  Events are retired in the contract and the client, never by the store
  refusing them.
- **How the store is built.** The store child renames the live
  `event_is_valid` to `event_is_valid_225`, as ADR 0013 did with `_224`. A new
  `event_is_valid`:
  - accepts the 15-key `order_placed` when the slug checks pass and
    `event_is_valid_225('order_placed', props - 'restaurant_slug')` is true;
  - accepts the 5-key `flash_sheet_shown` when the `fee_modes` checks pass and
    `event_is_valid_225('flash_sheet_shown', props - 'fee_modes')` is true;
  - passes everything else to `event_is_valid_225`, unchanged.

  The insert policy is then recreated against the new function. The
  event-name CHECK does not change, because no event name is added.
- **The client sends only the new shapes** once its release ships.

## Consequences

- **Old and new clients write side by side, forever.** A metric reading
  `restaurant_slug` or `fee_modes` counts only rows that carry the key (R4):
  - M19a counts only `fee_modes` rows;
  - M20 counts only rows from the new client, bounded by `build`
    (ADR 0015).
- **The strict superset is proved by re-running** the #81, #224 and #225
  contract suites unmodified against the new stack. The new shapes are proved
  by accept and refuse tests built from the client's exact payloads.
- **The client must not ship before the migration is applied.** A 15-key
  `order_placed` sent to today's store is refused, and it is the primary
  metric's numerator. The contract (§5.4) makes the owner's apply step a
  merge gate on the client child.
- **An order's total becomes roughly reconstructable** from its slug and the
  catalogue's fees. This is D4's accepted caveat. No account key is in the
  event, so the wallet debit stays unjoinable from events.
- **A later migration that replaces `event_is_valid`** wraps this one the
  same way, or re-inlines every body, and re-runs these superset tests.

## Alternatives rejected

- **Infer the restaurant from the session's last `restaurant_opened`.** It is
  ambiguous whenever a browser holds more than one cart. It also silently
  credits the wrong restaurant, rather than showing an unknown one.
- **`fee_modes` as an object keyed by slug** (`{"pho-place": "free", ...}`).
  The keys would be open-ended, so the store's exact key matching cannot
  check them. JSON object key order is also not preserved, so drawn order
  would be lost.
- **One `flash_slot_shown` event per drawn restaurant.** That is 5-6 rows per
  sheet against a rate limit of 60 writes per IP per 5 minutes. The sheet is
  also one exposure, and splitting it across rows invites a partial,
  unreadable sheet when one row is lost.
- **Accept any `fee_modes` length, and exclude mismatches in M19.** The
  client never sends a mismatch, so the only rows this would admit are forged
  ones.
- **Also add `drip_claimed` and `restaurant_opened.entry` now.**
  - `drip_claimed` waits for direction A to be shortlisted (D8).
  - `entry` waits for #204's carousel design to merge (O4).

  Wiring either now means wiring it twice.

## References

- ADR 0005 (the store), ADR 0007 (no business invariants in the store),
  ADR 0012 and ADR 0013 (the strict-superset posture, and the wrapper).
- `docs/measurement/270-analytics-readiness-second-pass.md` §4, §7 and §14.
- `docs/research/266-fresh-analytics-assessment.md`, and decisions D4, D5 and
  D8 on #265.
