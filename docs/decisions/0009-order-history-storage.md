# ADR 0009: Order history is a bounded, device-local list

Date: 2026-09-27
Status: accepted

## Context

`order-store.ts` kept exactly one placed order under `parody.order`: placing
a second order silently overwrote the first, and every per-order write
(`recordTrackerView`, `markOrderDelivered`, `submitRating`) assumed there was
only ever one order to act on. #134's tracker rework needs a device's whole
order history — a driver card, a total, a history list — which none of that
survives.

Two facts already in the code made a naive "just add a total and a driver to
the single record" fix wrong. First, `PlacedOrder.amountMinor` is the
subtotal (`order_placed.amount_minor`, contract-fixed); the checkout total is
computed at checkout and then thrown away, so nothing recorded what a
visitor's order actually cost. Second, `order_delivered` only ever fired for
whichever order was currently stored — an order replaced by a later one
before it reached its own delivery time silently never fired at all. Both
needed fixing at the storage level, not layered on top of it.

Per #134 (owner, comment at 17:17), this history stays device-local
(`localStorage`) rather than moving onto #136's forthcoming account —
`parody.*` here is one visitor's browser, not a shared record, and nothing
about that changes just because there can now be more than one order in it.

## Decision

Every placed order is stored, under a new key `parody.orders`, as an array
in the order it was placed (oldest first). The legacy single-order key
`parody.order` is read once — on the first call to `getOrders` after this
ships — converted into a one-element array under the new key, and removed;
every call after that reads `parody.orders` directly, so the migration never
runs twice for one visitor. A migrated order gains whatever it was missing:
`etaMinutes`/`deliveryMs` for a pre-#121 record (unchanged from before this
ADR), `totalMinor: null` (the total was never recorded, and nothing lets it
be recovered after the fact), and a driver drawn once from its own
restaurant's city pool and persisted immediately, so it never redraws.

Each order now carries `totalMinor` (the checkout breakdown's total,
optional on `placeOrder`'s fields and defaulting to the subtotal for a
caller with no breakdown) and `driver` (one entry from a new 25-per-city
pool in `drivers.ts`, drawn once at `placeOrder` from the order's own
restaurant's city — never the city picker, matching #129/#130's precedent
for the vehicle icon). The three per-order writes now take an explicit
`orderId` rather than assuming "whichever is latest," since latest can shift
under a caller between the read that named an order and the write meant to
land on it.

`checkDelivery` (`delivery.ts`) now checks every stored order on each call,
firing `order_delivered` once per order the first time it observes that
order past its own `deliveryMs` — not only the one order the tracker
currently displays. This is a behaviour change on top of the storage change:
an order that used to be silently replaced before delivery now always gets
its own firing.

Storage is capped at 20 orders. That's comfortably more than one visitor
places in a single demo sitting, while still bounding a `localStorage` blob
that nothing else ever clears on its own. Past the cap, the oldest order is
dropped first — except an order still live (not yet past its own
`deliveryMs`) or delivered with `order_delivered` not yet fired, either of
which is never dropped regardless of age, so eviction can never silently
swallow an event still owed.

## Consequences

`/tracker/` and `/order-placed/` are unchanged in what they show — the most
recently placed order — because `getLatestOrder` reads the same list
`getOrders` does. The multi-order tracker UI, driver card, avatars and
history list are explicitly out of this pull request's scope; this ADR only
guarantees the data they'll read is there, keyed by a stable `orderId`, with
a total and a driver on every order going forward and `null`/absent handled
honestly on anything migrated.

`order_delivered` firing for every order, not just the currently-displayed
one, is a heavier background workload in the pathological case (many
concurrent live orders in one browser) but the realistic case is one or two
orders per visitor, well under the 20-order cap either way.

A legacy visitor's order keeps its `deliveredEventFired`, `viewCount` and
`rating` exactly as before — migration copies them across rather than
resetting anything — so nobody sees a demo order "un-deliver" or an
already-submitted rating disappear because this shipped.

## Alternatives rejected

- **Keep `parody.order` and add a second key for "past orders."** Rejected:
  it recreates the "act on whichever is current" bug for every past order
  the moment two writers disagree about which key is current, and it forces
  every reader to check two keys and merge them instead of one.
- **Leave the legacy key in place after migrating, unread.** Rejected: once
  `parody.orders` exists, nothing ever reads `parody.order` again, so keeping
  it around is dead state with no reader and no purpose — carried on every
  visitor's device forever for no benefit.
- **No cap, or a cap enforced by wall-clock age instead of count.** Rejected:
  an age-based cap can still evict an order mid-delivery on a slow clock or a
  visitor who leaves a tab open for days, which is exactly the silent-drop
  failure this ADR exists to close off. A count cap with delivery-state
  protection bounds storage without that risk.
- **Move history onto an account now, alongside #136.** Rejected per the
  owner's decision on #134: #136 is still in flight, and coupling this
  child's storage shape to a not-yet-built account system would block this
  work on that one rather than the reverse.
