# Event contract: the two-city delivery journey

Issue: #81 (child of objective #79). Supersedes
`docs/measurement/66-parody-event-contract.md` in full — that document is now
history, kept only as a record of the parody's own funnel; nothing in it
should be built against again, and nothing it already said correctly (the
store's shape, the ID conventions that carry forward unchanged) is repeated
here beyond what a given event needs to cite. Reads `docs/decisions/
0005-hosted-event-store.md` (store, schema constraints, anti-spam bounds),
`supabase/migrations/20260925000000_events.sql` (today's accepted event names,
props and numeric bounds), `docs/design/80-two-city-brand-and-flow.md` (the
flow, screens and states) and `docs/design/87-promo-offers-and-flash.md` (the
Offers screen, voucher catalogue, tiers and the flash-deal sheet) as fixed.

**Decision this contract serves:** whether the new journey — pick a city,
browse, find and stack a good deal, place an order that actually arrives, and
rate it — converts, and specifically whether the promo mechanic the owner
named as the centrepiece ("the small hit of excitement... getting a
surprisingly good deal") is reaching visitors and getting used. Every event
below earns its place answering one of: where the funnel loses people, whether
a placed order completes and gets rated (which it never did before), and
whether the flash-deal sheet and the voucher catalogue are seen and acted on.

## 1. What changed from #66, at a glance

- **Two screens merged into one:** `landing_viewed` and `restaurants_viewed`
  are retired — `/` and `/restaurants` are one screen now (`home_viewed`,
  below).
- **A new mandatory step:** `location_selected` — nothing existed for this in
  #66 because there was only one city.
- **A promo mechanic replaces a promo mechanic:** `order_placed`'s
  `promo_code` enum (four joke codes) is retired outright — see §4 and AC4,
  below — replaced by an array of real catalogue voucher ids.
- **Two new preset enums replace two joke enums:** `drop_off_spot` and
  `handling_instructions`' parody values (`the_void`, `wing_it`, …) are
  retired for #80's real presets.
- **`tip_percent` is retired outright, not carried forward.** #66's tip
  selector was one of the parody checkout's five groups; #80's merged
  checkout has no tip control (its groups are Drop-off, Delivery
  instructions, Utensils, Offers and the breakdown), so there is nothing
  left for this prop to record. Logging it anyway would force #82 to either
  fabricate a value on every `order_placed` or build a tip selector nobody
  designed.
- **The funnel gets an ending:** `order_delivered` and `rating_submitted` are
  new — #66's tracker never reached a state worth naming.
- **`order_abandoned` and "tracker linger" are retired outright**, not
  redefined — see §6.
- **A new, session-scoped screen:** `flash_sheet_shown` and
  `flash_sheet_closed` are new — see §4 and AC5.
- **Money changes shape everywhere an amount is carried** — see §2 and AC2.

## 2. Money — one representation, used everywhere an amount is carried (AC2)

Every event below that carries a monetary amount carries exactly two props
for it: an integer **`amount_minor`** and a **`currency`** enum of exactly
`USD` / `VND`. No event ever carries a bare float, a pre-formatted string, or
an amount with no currency alongside it.

**Minor unit, defined per currency, because VND has none in ordinary use:**

- **USD** — the cent, unchanged from today's `priceCents`/`subtotal_cents`
  convention: `amount_minor` is the number of cents (`$4.30` is `430`).
- **VND** — there is no smaller unit than the đồng in ordinary circulation
  (no VND coin or note denomination is offered in fractions of one), so this
  contract fixes VND's own "minor unit" as **the đồng itself**: `amount_minor`
  is the whole đồng amount, unscaled (`₫45.000` is `45000`). This is the same
  choice payment processors that support VND already make for exactly this
  reason (a "zero-decimal" currency) — not a new convention invented here,
  just the one this contract commits to in writing so no two events pick
  different scales for the same currency.

**One `currency` prop per event, not per amount.** An event only ever
describes one visitor's one basket in one city, so one `currency` value
governs every `amount_minor` prop that event carries — no event mixes two
currencies. `currency` also stands in for `city` on every money-carrying
event below (`USD` ⇔ `sf`, `VND` ⇔ `hcmc`, fixed by the location picker,
§4), so those events do not separately repeat a `city` prop.

**Numeric bounds, stated once per currency and reused by every `amount_minor`
prop below** (cart's is the one case allowing zero, for an empty cart —
every other context requires a nonzero amount):

| Currency | Zero allowed (cart only) | Every other context |
|---|---|---|
| `USD` (cents) | `0`–`100000` | `1`–`100000` |
| `VND` (đồng) | `0`–`5000000` | `1`–`5000000` |

`USD`'s bound is unchanged from today's `subtotal_cents` check (ADR 0005's
migration) — it already covers a realistic SF order. `VND`'s upper bound
(₫5.000.000, ≈ $200 at an ordinary exchange rate) is set against the concrete
figures #87's catalogue and #80's checkout mock actually use: the highest
single number either document names is #87's `hcmc-discount-t3` minimum
spend, ₫350.000, and #80's own rendered HCMC checkout mock totals ₫395.000 —
₫5.000.000 is roughly 13× the highest real figure in the design, wide enough
that a large multi-item group order isn't clipped, and still narrow enough to
refuse a value that's off by orders of magnitude (a stray `45000000` from a
unit-confusion bug, for instance, is refused outright). The same shared bound
is used for every `amount_minor` prop regardless of which field it's on
(subtotal, discount, saved, or the flash-sheet's drawn amount) — one bound
per currency, not one per field, keeping the representation genuinely single
rather than "one shape with several different ranges hiding inside it."

**What this bound does not enforce, stated so it isn't assumed:** the DB
check on a single `amount_minor` value cannot see whether a `discount_
amount_minor` or `saved_amount_minor` value is consistent with the basket it
claims to discount (e.g., a discount larger than the subtotal it applies to)
— that is a cross-field invariant, listed per-event in §4, and it is the
client's and #85's migration test's to prove, not something a single
column-level numeric range can catch.

## 3. Events not logged, and why

Carried forward from #66, still true:

- **Individual "Add to cart" / quantity-stepper taps**, **nav taps, scroll,
  and every other UI interaction** not named below, **checkout field changes
  before submission** (only the final choice at `order_placed` is logged),
  and **"What we log, and why" page views** — same reasoning as #66 §1 for
  each: none of them changes what anyone does next, or the final value
  already answers the question.
- **True silent abandonment** (a visitor who never returns and never
  triggers a terminal event). Still a deliberate gap — see §7.

New to this contract:

- **Individual voucher checkbox toggles on the Offers screen before
  "Apply."** Only the final applied set at `order_placed` is logged — the
  same reasoning #66 already gave for the tip selector: toggling three
  vouchers before landing on two is not three separate decisions, it's one,
  taken at "Apply"/"Place order."
- **The Offers screen being opened.** `checkout_viewed` plus `order_placed`'s
  `applied_voucher_ids` (§4) already answer "did vouchers get seen and used,"
  which is the decision named in this objective. A separate view event would
  answer "was the screen opened," which is a navigation curiosity nobody
  named a use for — logging it is the "logging what is easy to capture"
  trap the instrumentation skill names directly.
- **A voucher moving from greyed-out to qualifying as the basket grows**
  (AC6, decided **no**). A basket crosses a threshold and re-crosses it back
  every time an item is added or removed while someone is still composing
  their order — logging every crossing floods the log with a UI re-render
  detail nobody described wanting to read, and `order_placed`'s
  `applied_voucher_ids` already tells us, per completed order, which
  threshold-gated vouchers were unlocked *and actually used* — the number
  that answers whether the tier ladder is working. Whether a basket
  flickered across `t2`'s line five times before settling is not a question
  this objective named a decision for; if a later objective wants a
  cart-abandonment-at-the-threshold question answered, that's a new
  contract with its own decision stated, not a silent addition to this one.
- **The flash-deal sheet's own draw** (which two restaurants, which amount)
  as a separate event from it being shown. The draw and the display are the
  same moment — nothing happens between "drawn" and "shown" for a visitor to
  fail to reach — so `flash_sheet_shown`'s own props carry the drawn values
  (§4) rather than a second event describing the same instant.

## 4. IDs — carried forward from #66, one addition

`id`, `event_name`, `occurred_at`, `received_at` are fixed by the ADR, as
before. `visitor_id` and `session_id` are unchanged in how they're generated
and stored (§2 of #66) — one addition to what `session_id` means in
practice: **it is now load-bearing.** #66 noted no metric here used it yet;
#87's flash-deal draw is keyed to the same `sessionStorage` boundary
("session" here is the same boundary the event contract uses for
`session_id`" — #87's own words), so `flash_sheet_shown`/`flash_sheet_closed`
below are the first events whose invariants are stated in terms of
`session_id`. `order_id` is unchanged in shape and lifecycle (client-generated
once at `order_placed`, reused by every later event about that order) with
one open question named rather than guessed at: #80 keeps "cleared only by
an explicit action" as the persistence model, but the explicit action it
described (7d's "Start over") no longer exists once the tracker always
resolves. This contract does not invent a replacement clearing control or an
event for it — if #82/#83 add one (e.g. an "Order again" affordance after a
rating), it needs its own event and its own line here, added when that
control actually exists, not guessed at now.

## 5. Experiment arm: still none

Unchanged from #66 §3: no arm ships this round, the parent issue's scope line
rules one out explicitly, and `variant` stays `null` on every row.

## 6. `order_abandoned` and "tracker linger": retired, not redefined (AC3)

**`order_abandoned` is retired outright.** It fired on exactly one control —
the "Start over" button on the old tracker's permanent give-up state (7d).
That state doesn't exist in the new flow (#80's tracker has five states:
happy, refresh/return, already-rated, empty, and no error state — no
"stalled" state to give up from), so there is no control left for this event
to be wired to. Redefining it to fire on something else would be inventing a
new event under an old name, which is worse than retiring it plainly: a
reader who finds `order_abandoned` in a query would reasonably assume it
still means what #66 said it meant.

**"Tracker linger" is retired as a metric, for the same reason.** It read
`max(minutes_since_order)` and `max(view_number)` together as "how long did
someone keep checking on an order that would never come" — the joke's own
punchline. An order that reliably reaches Delivered in ~7 minutes has nothing
left to linger over in that sense. `tracker_viewed` itself is **not**
retired — it still fires on every tracker load exactly as before, and its
rows remain queryable for a future engagement question — but no metric is
defined against it here, because "how often does someone check the tracker
before it resolves" is not a question this objective named a decision for.
Inventing one now would be exactly the "logging what nobody named a decision
for" trap the instrumentation skill warns against, wearing the shape of a
metric section instead of an event.

**What replaces them — completion and rating, in the primary metric's own
numerator-over-denominator form** (§8 gives the full definitions; named here
to answer AC3's requirement directly): a **completion rate**, unit of
assignment and of counting both the **order** (`count(distinct order_id with
order_delivered) ÷ count(distinct order_id with order_placed)`), and a
**rating rate**, same units (`count(distinct order_id with rating_submitted)
÷ count(distinct order_id with order_delivered)`). Both are genuinely new
questions the old funnel had no ending to ask, not a redefinition of the
retired pair above.

## 7. The event contract

One row per event; `props` is the `jsonb` object each event's
`event_is_valid(event_name, props)` check (ADR 0005 §2) must accept. Every
`props` object here is well under the ADR's 1 KB cap. `visitor_id` and
`session_id` are store columns present on every row (§4) and not repeated
per event below.

| Event | Fires when | `props` (name: type, limit) | Invariant |
|---|---|---|---|
| `location_selected` | A location card is tapped in the location picker (first-visit modal or reopened from the header's location bar), persisting the choice. | `city: enum [sf, hcmc]`; `is_switch: boolean` — `true` only when a *different* city was already persisted before this tap; `false` on the very first choice or when the tap reselects the city already persisted. | Fires once per tap on a card; reopening and dismissing the picker without tapping a card fires nothing (§3). |
| `home_viewed` | Every load of `/` (replaces `landing_viewed` and `restaurants_viewed` — §1). | `city: enum [sf, hcmc]`. | No dedup; a repeat visit fires again, exactly as `landing_viewed` did. Metrics count `distinct visitor_id`. |
| `restaurant_opened` | Every load of `/restaurants/<slug>`. | `city: enum [sf, hcmc]`; `restaurant_slug: string, 1–60 chars, lowercase kebab-case`. | Fires once per page load; `restaurant_slug` must be one the compiled site actually built **for that `city`** — added because each city has its own catalogue and a slug valid in one is not guaranteed meaningless-but-harmless in the other. |
| `cart_viewed` | Every load of `/cart`, populated or empty. | `item_count: integer, 0–999`; `amount_minor: integer` (§2 bounds, zero-allowed column); `currency: enum [USD, VND]`. | All three reflect cart state at page load, including the empty state (`item_count: 0`, `amount_minor: 0`). |
| `checkout_viewed` | Every load of `/checkout` with a populated cart. | `item_count: integer, 1–999`; `amount_minor: integer` (§2 bounds, nonzero column); `currency: enum [USD, VND]`. | `item_count`/`amount_minor` are never 0 here — `/checkout` is only reachable from a populated cart (#80, "Cart"). |
| `flash_sheet_shown` | The flash-deal sheet opens: the first home-feed load, this session, for a given city (#87, "The flash-deal sheet"). | `city: enum [sf, hcmc]`; `amount_minor: integer`, bounded to that city's drawn range (`10000`–`30000` VND, `200`–`600` USD cents, §2's currency-typed representation, step-aligned per #87); `currency: enum [USD, VND]`; `restaurant_slugs: array of string, exactly 2 elements`, each `1`–`60` chars lowercase kebab-case and one the compiled site built for that city. | At most one per (`session_id`, `city`) pair — a test can violate this by simulating two home-feed loads in the same session for the same city and asserting the second produces no second `flash_sheet_shown`, matching #87's "doesn't re-draw or reopen" rule. |
| `flash_sheet_closed` | The sheet closes, by any of its four exits (#87, "Dismissal"): dragging past the threshold, tapping the scrim, the "×", or tapping a restaurant row — or the countdown reaching `00:00` while still open. | `city: enum [sf, hcmc]`; `outcome: enum [restaurant_tapped, dismissed, expired]` (drag/scrim/"×" all map to `dismissed`; the countdown reaching zero maps to `expired`); `seconds_remaining: integer, 0–900` (900 = the fixed 15-minute countdown in seconds; `0` when `outcome = expired`); `restaurant_slug: string` — one of the paired `flash_sheet_shown`'s two `restaurant_slugs` when `outcome = restaurant_tapped`, and the fixed literal `"none"` otherwise (never omitted — an exact-match `props` shape has no optional key, so "not applicable" is its own fixed value, not a missing one). | At most one per `flash_sheet_shown`; `restaurant_slug` is a real drawn slug if and only if `outcome = restaurant_tapped`. Together with `flash_sheet_shown`, sufficient to compute view-to-action: `count(outcome = restaurant_tapped) ÷ count(flash_sheet_shown)`. |
| `order_placed` | Once, when "Place order" is tapped and the order record is written to browser storage — independent of whether the Supabase write itself succeeds (best-effort, never blocking, unchanged from #66). | `order_id: uuid`; `item_count: integer, 1–999`; `amount_minor: integer` (subtotal, §2 bounds, nonzero column); `currency: enum [USD, VND]`; `drop_off_preset: enum [home, office, front_desk]` (#80's real drop-off presets, replacing `drop_off_spot`'s joke enum — AC4); `delivery_instructions: enum [leave_at_door, hand_to_me, meet_downstairs, call_on_arrival]` (#80's real delivery-instruction presets, replacing `handling_instructions`'s joke enum — AC4); `utensils: boolean`; `applied_voucher_ids: array of string, 0–2 elements, no duplicates`, each one of the ten fixed catalogue ids across both cities (`hcmc-delivery-entry`, `hcmc-discount-t1`, `hcmc-discount-t2`, `hcmc-discount-t3`, `hcmc-flash`, `sf-delivery-entry`, `sf-discount-t1`, `sf-discount-t2`, `sf-discount-t3`, `sf-flash` — #87's catalogue tables, verbatim, by `id` column, never a display label); `saved_amount_minor: integer` (§2 bounds, zero-allowed column — the sum of every applied voucher's saving, matching the checkout "You saved" line). | Exactly one `order_placed` per `order_id` (unchanged double-tap guard). `applied_voucher_ids` replaces `promo_code` entirely — **no typed free-text string is ever logged for a voucher: only a known catalogue id, or the empty array for "none applied"** (AC4's "fixed invalid/none value," realized here as `[]` rather than a sentinel string, since the array shape already makes "no voucher" a distinct, typed, non-string state rather than an omitted field). `saved_amount_minor` is `0` if and only if `applied_voucher_ids` is `[]`, and greater than `0` otherwise — a test can violate this by asserting a nonempty voucher list with zero savings, or an empty list with nonzero savings. Whether more than one applied voucher is logged as one array or one row per voucher is settled here: **one array on the single `order_placed` row** — an order is one funnel event with one set of choices, and #87's own stack-group rule caps the array at 2 elements, which is cheap to unnest in SQL (`jsonb_array_elements`) without paying for a second event name per voucher. |
| `tracker_viewed` | Every load of `/tracker` that finds a stored order. | `order_id: uuid`; `minutes_since_order: number, ≥0`; `view_number: integer, ≥1`. | Unchanged from #66: `view_number` increments by exactly 1 each time this fires for the same `order_id`, never resets or decreases. |
| `order_delivered` | The first time a tracker computation for a stored order observes the stepper at **Delivered** (#80's fifth stage) — whether that's the initial `/tracker` load after enough time has passed, or a later refresh/return that crosses the threshold. | `order_id: uuid`; `minutes_since_order: number, ≥0` (elapsed time at the moment Delivered was first observed). | Exactly one `order_delivered` per `order_id` — a test can violate this by rendering the tracker twice past the Delivered threshold for the same order and asserting only the first render's pass fires the event (guarded by whether an `order_delivered` has already been recorded for this `order_id`, the same "has this already happened" guard `tracker_viewed`'s already-rated state needs anyway). This is the completion metric's numerator (§6, §8). |
| `rating_submitted` | "Submit" is tapped on the rating prompt (tracker's Delivered state, not-yet-rated) — star count is required, tags are optional (#80, "Tracker"). | `order_id: uuid`; `stars: integer, 1–5`; `tags: array of enum [fast, great_packaging, order_was_correct], 0–3 elements, no duplicates`. | Exactly one `rating_submitted` per `order_id` — the already-rated state (#80) replaces the interactive prompt with a static line specifically to prevent a second submission, and a test can violate the invariant by attempting Submit twice for the same order and asserting only one event fires. This is the rating metric's numerator (§6, §8). |

## 8. Metrics

**Units, since there is still no experiment arm to fix these against.**
Funnel conversion (through `order_placed`) is counted per **visitor**
(`visitor_id`), unchanged from #66 — a visitor either reaches a step or
doesn't, once, no matter how many times they reload it. Everything from
`order_placed` onward is counted per **order** (`order_id`) — completion and
rating describe what happens to a specific placed order, not a browser, and
a visitor who places two orders in one browser contributes two independent
completion/rating observations. The flash-deal sheet is counted per
**(`session_id`, `city`) pair** — #87 fixes the draw to that boundary, so
that is the unit a visitor is "assigned" a flash deal at, and the unit its
own metric below counts in.

**Primary metric — checkout conversion**, unchanged in form from #66, updated
denominator event name: `count(distinct visitor_id where order_placed) ÷
count(distinct visitor_id where home_viewed)`, computed from `events_clean`
(ADR 0005's bot-and-anomaly-excluded view), never raw `events`.

**Funnel step-over-step**, same denominator pattern as #66, starting at
`home_viewed` rather than `location_selected`: for each pair of adjacent
steps in `home_viewed → restaurant_opened → cart_viewed → checkout_viewed →
order_placed`, `count(distinct visitor_id)` at the later step ÷ the earlier
step's. `location_selected` is deliberately not the funnel's first step: it
fires only on a first choice or a switch (§7's invariant), so a returning
visitor whose city is already persisted produces `home_viewed` with no
`location_selected` in the same window. Over any date range that excludes a
visitor's first-ever visit, `home_viewed ÷ location_selected` would exceed
1, and every later step's ratio would inherit that distortion. Starting the
chain at `home_viewed` instead matches the primary metric's own denominator
and sidesteps the problem entirely.

**Location switch rate** (new, per visitor, kept separate from the funnel
for the reason just given): `count(distinct visitor_id where
location_selected with is_switch = true) ÷ count(distinct visitor_id where
location_selected)`. Unit: **visitor**. Answers "of the visitors who made an
explicit location choice this window, how many changed city rather than
confirming their first one" — the number `location_selected` is actually
suited to answer, without the windowing problem that ruled it out of the
funnel chain.

**Completion rate** (new — replaces the retired give-up rate, §6):
`count(distinct order_id with order_delivered) ÷ count(distinct order_id
with order_placed)`. Unit of assignment and of counting: **order**. This
should sit close to 1 given the tracker is now deterministic and
time-driven rather than something a visitor can get stuck in — a value
meaningfully below 1 is itself a finding (a bug in `tracker-state.ts`'s new
fifth stage, or visitors closing the tab before ~7 minutes pass and never
returning to let it resolve).

**Rating rate** (new): `count(distinct order_id with rating_submitted) ÷
count(distinct order_id with order_delivered)`. Unit of assignment and of
counting: **order**.

**Voucher attachment rate** (new — the promo mechanic's own delight metric,
directly answering the objective's "are vouchers actually landing" item):
`count(distinct order_id where applied_voucher_ids is not empty) ÷
count(distinct order_id with order_placed)`. Unit: **order**. This is what
tells a reader whether the tier ladder and the flash sheet are doing their
job, as distinct from whether the funnel converts at all.

**Flash-deal view-to-action rate** (new, AC5): `count(distinct (session_id,
city) with flash_sheet_closed where outcome = restaurant_tapped) ÷
count(distinct (session_id, city) with flash_sheet_shown)`. Unit:
**(session_id, city) pair**.

## 9. Whether this can be read yet

Yes, with #66's own caveat carried forward unchanged: every metric above must
be computed from `events_clean`, never raw `events`, because nothing in ADR
0005's bounds stops a patient script sending valid-shaped events from many
IPs. The best-effort, never-blocking send (unchanged in this objective) means
some fraction of real events never reach the store; that loss applies evenly
across event names from the same sender, so ratios stay meaningful even
though absolute counts undercount — same reasoning, same caveat about
checking the Supabase project's activity before trusting a number from a
quiet window.

## 10. Failure cases

Carried forward from #66, unchanged: **the Supabase write fails or is
skipped** (visitor missing from every count, not a third state); **a
duplicate `order_placed`** (the disable-guard's job; the ADR's PK on `id`
refuses a literal retry, a disable-guard bug producing two rows sharing one
`order_id` is what the invariant in §7 is for).

New to this contract:

- **A duplicate `order_delivered` or `rating_submitted`.** Unlike a retried
  `order_placed`, these aren't guarded by the store's `id` PK against a
  same-order double-fire, because a client-side bug re-evaluating "has this
  already happened" incorrectly would generate a fresh `id` each time and
  both rows would insert successfully — the store has no constraint that
  refuses a second `order_delivered` for an `order_id` it has already seen
  one for. This is the same class of gap #66 named for `order_placed`'s own
  double-tap guard: the invariant in §7 is what a test asserts against, not
  something the DB enforces independently. Worth a note rather than a schema
  fix, because ADR 0005 gives `anon` no `select` grant — a
  check-before-insert the DB itself could run would need one, which is a
  bigger change than this contract should ask for to close a gap the client
  guard should already prevent.
- **A visitor who never returns to the tracker after Delivered would fire**
  (the tracker computes Delivered eagerly, before anyone rates it). Someone
  who closes the tab at "On the way" and never returns produces
  `order_placed` with no `order_delivered` at all — this is the completion
  rate's own numerator gap (§8), not a separate failure mode to name twice.

## 11. Demo disclosure

Unchanged from #66 §8 — #80 keeps the same copy and the same two placements
(checkout, tracker's Delivered state), just retitled to match the new brand;
no change to what this contract requires here.

## No ADR

This document changes `event_is_valid`'s accepted shapes (new event names,
new props, new enums, a new numeric-bound scheme), which is exactly the kind
of schema change house-rules calls a category change. That ADR is **#85's to
write, not this document's** — #85's own AC5 already assigns it explicitly
("Given a schema change of this kind is a category change per house rules,
when the migration is reviewed, then an ADR in `docs/decisions/` records it
in the same diff, referencing ADR 0005 and the contract (#81) by number"),
and #85 is the child that actually turns this contract into a migration
(AC7, below). Writing an ADR here, before that migration exists, would
describe a schema change nobody has made yet.

## AC7 — what the migration this contract implies must do, left to #85

This document's decision, stated plainly so #85's engineer builds against it
rather than inventing one: the migration is **strictly additive** — a new
file under `supabase/migrations/`, `20260925000000_events.sql` untouched, as
the parent issue and #85 both already require. Under the new
`event_is_valid`, every old parody-only shape is **rejected**, not accepted
and not migrated:

- The retired event names (`landing_viewed`, `restaurants_viewed`,
  `order_abandoned`) are no longer in the accepted `event_name` set at all.
- The retired enum values (`order_placed`'s old `drop_off_spot` values —
  `couch`, `wherever_i_am`, `the_void`, `behind_you` — its old
  `handling_instructions` values, and every `promo_code` value) are rejected
  under the new `order_placed` shape, which uses different prop names
  entirely (`drop_off_preset`, `delivery_instructions`, `applied_voucher_ids`
  — §7) — an old-shaped payload fails on missing/extra keys before its enum
  values are even reached.

**Why rejected rather than migrated:** `event_is_valid` is an insert-time
check, not a data migration — it can refuse or accept a new row, but it
cannot rewrite one, so "migrate" isn't actually an option available to a
validation function; it could only mean leaving the old shapes accepted
alongside the new ones. Accepting them indefinitely would let a stale cached
client (an old service worker, a tab left open across the deploy) keep
writing parody-shaped rows into a store the new contract no longer describes,
silently, since sends are best-effort and swallow errors. Existing historical
rows already in `events` are untouched either way — this migration is
additive and never edits or deletes a stored row, only what a *new* insert
must look like.

This is #81's decision for #85 to build against, not #85's to make — its own
PGlite test (AC2, AC3, AC4 on #85) is where "an HCMC `order_placed` with a
VND-sized amount is accepted" and "an old parody enum value is rejected" both
get proved.
