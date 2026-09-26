# ADR 0007: Additive migration for the two-city event contract

Date: 2026-09-26
Status: accepted

## Context

`docs/measurement/81-two-city-event-contract.md` (#81) replaces the parody
funnel's event contract in full: three event names retire outright
(`landing_viewed`, `restaurants_viewed`, `order_abandoned`), six are new
(`location_selected`, `home_viewed`, `flash_sheet_shown`,
`flash_sheet_closed`, `order_delivered`, `rating_submitted`), and the events
that carry forward (`restaurant_opened`, `cart_viewed`, `checkout_viewed`,
`order_placed`, `tracker_viewed`) change props — most visibly, every amount
becomes a currency-typed `amount_minor`/`currency` pair (§2) instead of a
bare `subtotal_cents`, so a VND order can carry a whole-đồng amount well
above today's 100000-cent USD bound.

ADR 0005's `event_is_valid` function and the table's `event_name` `CHECK`
(`supabase/migrations/20260925000000_events.sql`) encode exactly the
contract's previous shape, in the database, because the store's Data API
endpoint is public — a stale client (a cached tab, an old service worker)
has to be refused by Postgres itself, not merely by `src/`'s code (out of
scope for this issue, #83's own child). Changing what `event_is_valid`
accepts is the kind of schema change house rules calls a category change,
and #81 explicitly assigns writing this ADR to this issue (#85) rather than
to itself, since #81 describes the contract, not yet a migration.

`20260925000000_events.sql` may already be applied to a live Supabase
project (per the parent issue and ADR 0005's own "needs a person" step),
one that may already hold real rows under the retired event names and
props. The new contract's own "AC7" section is explicit that those
historical rows are untouched either way — this migration only changes what
a *new* insert must look like.

## Decision

A second, additive migration file,
`supabase/migrations/20260926000000_two_city_event_contract.sql`, replaces
`public.event_is_valid` (`create or replace function`) with the contract's
full eleven-event shape and replaces the table's `event_name` `CHECK`. The
original migration file is never edited.

The `event_name` `CHECK` is dropped and re-added **`not valid`** rather than
being widened in place. A plain `add constraint` validates every existing
row against the new list at the moment it's added, which would fail the
migration outright on a live project already holding rows under a now-
retired name (`landing_viewed`, for instance) — exactly the failure #81's
own "AC7" section warns the client-side send path against, now showing up
one layer down, at the schema. Postgres's documented behaviour for `not
valid` is the fit: a `not valid` check "will still be enforced against
subsequent inserts or updates," but existing rows are never scanned against
it. A fresh database (nothing in `events` yet) and an already-migrated one
holding real historical rows both apply this migration cleanly either way;
only the second case actually depends on `not valid` to do so.

`event_is_valid` is replaced wholesale rather than patched name-by-name,
because the function's shape (one `if/elsif` per event name, falling
through to `return false`) already makes a retired name fall out simply by
no longer being listed — there is no separate "reject this name" branch to
add. A shared helper, `public.amount_minor_in_bounds(props, field, currency,
allow_zero)`, is pulled out for the one per-currency bound (§2) that four
different props on three different events now need (`cart_viewed` and
`checkout_viewed`'s `amount_minor`, `order_placed`'s `amount_minor` and
`saved_amount_minor`), rather than inlining the same `USD`/`VND` range check
four times; `flash_sheet_shown`'s `amount_minor` uses its own narrower,
fixed drawn range instead (§7) and is checked inline, since it isn't the
shared bound.

## Consequences

**Easy:** the store refuses every retired event name and every retired enum
value on a new insert, from `event_is_valid`'s ordinary shape, with no
separate migration step for "and also reject the old ones"; the migration
applies with no manual intervention whether the target database is empty or
already holds real, differently-shaped historical rows; `supabase/
migrations/two-city-event-contract.migration.test.ts` proves both of those
applications and the accept/reject shapes entirely against PGlite, with no
live credentials (ADR 0006's approach, extended rather than repeated).

**Hard:** a `not valid` check constraint is *unvalidated* against history
forever unless someone later runs `alter table … validate constraint …`
by hand — this migration doesn't do that, deliberately, since validating it
would require deciding what to do with any row that fails it (rewrite?
delete?), which is a data decision for a person, not this migration's to
make. A reader of `\d events` on the live project will see the constraint
marked `NOT VALID` and should not read that as an oversight.

**Needs a person:** the same step ADR 0005 already named — someone applies
migrations to the actual Supabase project. This migration changes nothing
about who does that or how.

## Alternatives rejected

- **Widen the existing `CHECK` to accept both old and new shapes.** Rejected
  by the contract itself (#81 "AC7"): accepting a retired shape indefinitely
  lets a stale cached client keep writing parody-shaped rows into a store
  the new contract no longer describes, silently, since sends are
  best-effort and swallow errors.
- **A plain `add constraint … check (…)` with no `not valid`.** Correct on
  a database with no rows yet, but fails outright the moment it meets a
  live project that already has rows under a retired name — which is
  exactly the state ADR 0005's own "needs a person" step implies the real
  project is likely already in.
- **A `not valid` constraint immediately followed by `validate constraint`
  in the same migration.** Would re-fail for the identical reason a plain
  `add constraint` does — `validate constraint` scans and rejects on the
  first row that doesn't match, so it only defers the same failure, it
  doesn't avoid it.
- **One `event_is_valid` for the old contract and a second, differently-
  named function for the new one, switched by an app-level flag.** Two
  functions to keep in sync is worse than one function with an old branch
  removed, and the RLS policy only calls one function by name regardless.
