# Event contract: the food-delivery parody funnel

Issue: #66 (child of objective #63). Reads `docs/decisions/0005-hosted-event-store.md`
(store, schema constraints, anti-spam bounds) and `docs/design/65-parody-flow.md`
(the seven screens, their states, and the checkout fields) as fixed. Neither
document is repeated here beyond what a given event needs to cite.

**Decision this contract serves:** whether the parody's funnel is actually
funny enough, and honest enough, to keep — i.e. where real visitors drop off
between landing and an order, and whether the ones who reach the tracker
linger (refresh, come back) or vanish. Those two questions are what every
event below earns its place by answering; nothing here is logged because it
was easy to capture.

## 1. Events not logged, and why

- **Individual "Add to cart" / quantity-stepper taps.** `cart_viewed`'s
  `item_count` and `subtotal_cents` already answer "how big is the cart by
  the time someone reaches it" — the per-tap sequence only answers "which
  menu item is more popular," a question this round has no decision behind.
- **Nav taps, scroll, and every other UI interaction** not named below. None
  of them changes what anyone does next; they are clicks, not funnel steps.
- **Checkout field changes before submission.** Only the final choice at
  `order_placed` is logged. A visitor toggling the tip selector twice before
  landing on 15% is not a second decision point.
- **"What we log, and why" page views.** It is a disclosure page, not a
  funnel step; reading it is not part of the joke the funnel measures.
- **True silent abandonment** (someone who never returns to the tracker and
  never presses "Start over"). This is a deliberate gap, not an oversight —
  see §7.

## 2. IDs — generated, stored, and what they carry

Every row also carries `id` (client-generated `crypto.randomUUID()`, the
ADR's retry key), `event_name`, `occurred_at`, and server-set `received_at`.
Those four are fixed by the ADR and not restated per event below.

**`visitor_id`** — identifies the browser, not the person. Generated once
with `crypto.randomUUID()` the first time any event would be sent from a
browser that has none stored, and kept in `localStorage` under
`parody.visitorId` indefinitely — it is **not** one of the keys ADR 0004's
"start over" pattern clears, because it identifies the browser across
however many orders it places, not any one order. It carries no personal
data: no name, email, IP, or device fingerprint, and no way to reverse it
into one starting from the stored rows, because the `events` table itself
gives `anon` no `select` grant (ADR 0005). Clearing site data or using a
different browser produces a new one; that is the extent of "anonymous
per-browser."

**`session_id`** — identifies one browsing session, not the visitor.
Generated the same way, kept in `sessionStorage` under `parody.sessionId`,
so it is fresh every time a tab or window opens and gone when it closes. The
schema requires it (ADR 0005); no metric in this document uses it — it is
carried so a later objective can ask "how many funnel steps happen in one
sitting" without a schema change, and its absence from every metric below is
itself the record that it is not load-bearing yet.

**`order_id`** — not a store column; a property. Generated once,
client-side, when an order is placed (`order_placed`, below), and reused on
every subsequent event about that same order (`tracker_viewed`,
`order_abandoned`). It ties those events together the same way the design
doc's stored "current order" record does, and should live in that same
record so it survives refresh and return-later reads (`docs/design/65-parody-flow.md`,
"State & persistence"). A browser that places a second order after
"Start over" gets a new `order_id`; `visitor_id` is what links the two
orders back to one browser if that is ever asked.

## 3. Experiment arm: none ships this round

No experiment ships in this objective. `docs/design/65-parody-flow.md`
explicitly retires the swipe poll's variant mechanic rather than carrying it
forward ("`--color-accent-a`/`-b` lose their swipe-poll meaning... along
with the poll itself"), and neither it nor #63's "done" list describes an
arm to assign. Every row's `variant` column (present per ADR 0005, for a
future experiment) is therefore always `null` this round; the store's
`CHECK` on it should be `check (variant is null)` until an experiment is
actually specified, rather than an open text column nothing constrains. If
a later objective adds an arm, ADR 0002's lesson applies exactly as it did
for the swipe poll: the assignment needs its own exposure event, fired when
the arm is assigned and before anything renders, whether or not that
visitor goes on to act — that is a new contract, not an extension of this
one, and it is not written here because nothing to expose exists yet.

## 4. The event contract

One row per event; `props` is the `jsonb` object each event's
`event_is_valid(event_name, props)` check (ADR 0005 §2) must accept. Every
`props` object here is well under the ADR's 1 KB cap.

| Event | Fires when | `props` (name: type, limit) | Invariant |
|---|---|---|---|
| `landing_viewed` | Every load of `/`. | `has_active_order: boolean` — whether the returning-order banner rendered. | No dedup; a repeat visit fires again. Metrics count `distinct visitor_id`, not row count. |
| `restaurants_viewed` | Every load of `/restaurants`. | `{}` — the list is fixed content, nothing to parameterize. | Fires once per page load. |
| `restaurant_opened` | Every load of `/restaurants/<slug>`. | `restaurant_slug: string, 1–60 chars, lowercase kebab-case`. | Fires once per page load; `restaurant_slug` must be one the compiled site actually built (the sender never constructs one from user input — there is no free-text entry point that could feed it something else). |
| `cart_viewed` | Every load of `/cart`, populated or empty. | `item_count: integer, 0–999`; `subtotal_cents: integer, 0–100000`. | Both reflect cart state at page load, including the empty state (`item_count: 0`). |
| `checkout_viewed` | Every load of `/checkout`. | `item_count: integer, 1–999`; `subtotal_cents: integer, 1–100000`. | `/checkout` is only reachable from a populated cart (design doc, "Cart"), so `item_count` is never 0 here — a 0 would mean the flow was entered somewhere it shouldn't be reachable from. |
| `order_placed` | Once, when "Place order" is tapped and the order record is written to browser storage — independent of whether the Supabase write itself succeeds (best-effort, never blocking; design doc, checkout). | `order_id: uuid`; `item_count: integer, 1–999`; `subtotal_cents: integer, 1–100000`; `drop_off_spot: enum [couch, wherever_i_am, the_void, behind_you]`; `handling_instructions: enum [guard_it, wing_it, two_hands, surprise_me]`; `utensils: boolean`; `tip_percent: enum [0, 10, 15, 20]`; `promo_code: enum [dont_drop10, still_here, clumsy15, gotcha]`. | Exactly one `order_placed` per `order_id` — the "Place order" control must disable itself on first tap so a double-tap cannot fire it twice for the same order. |
| `tracker_viewed` | Every load of `/tracker` that finds a stored order (design doc states 7a–7d). **Not** fired for state 7e (no active order — nothing to view). | `order_id: uuid`; `minutes_since_order: number, ≥0`; `view_number: integer, ≥1`. | `view_number` increments by exactly 1 each time this fires for the same `order_id`, and never resets or decreases — `view_number: 1` is "viewed," anything higher is a refresh or return, which is how this one event covers both without a second event name. |
| `order_abandoned` | The "Start over" control on the tracker's given-up state (7d) is tapped, clearing the stored order. This is the *only* control this event is wired to — no other exit or navigation counts. | `order_id: uuid`; `minutes_since_order: number, ≥0`; `view_count: integer, ≥1` (the last `tracker_viewed.view_number` seen for this order). | Exactly one per `order_id` that is explicitly cleared this way; an order nobody ever returns to clear produces zero — see §7. |

`session_id` and `visitor_id` are store columns present on every row per
ADR 0005's schema, not listed again per event above.

## 5. Metrics

**Unit assigned vs. unit counted, since there is no experiment arm to fix
these against:** funnel conversion is counted per **visitor** (`visitor_id`)
— a visitor either reaches a step or does not, once, no matter how many
times they reload it. Tracker linger is counted per **order** (`order_id`)
— a visitor who places two orders across two "Start over" cycles
contributes two independent linger observations, because the joke resets
with the order, not with the browser.

**Primary metric — checkout conversion:**
`count(distinct visitor_id where order_placed) ÷ count(distinct visitor_id where landing_viewed)`,
computed from `events_clean` (ADR 0005's bot-and-anomaly-excluded view), not
raw `events`. This is the one number that says whether the funnel — not
just the tracker joke at the end of it — is working.

**Funnel step-over-step, same denominator pattern:** for each pair of
adjacent steps in `landing_viewed → restaurants_viewed → restaurant_opened →
cart_viewed → checkout_viewed → order_placed`, `count(distinct visitor_id)`
at the later step ÷ `count(distinct visitor_id)` at the earlier step. This
is what tells a reader *where* the drop happens, not just that it happens.

**Tracker linger — the joke's own metric:** for each `order_id`, the
distribution of `max(minutes_since_order)` reached across its
`tracker_viewed` rows (how long someone kept checking) and
`max(view_number)` (how many times they checked). Read together, not
separately: a high `minutes_since_order` with `view_number: 1` is someone
who opened one tab and left it running, not someone who kept coming back —
those are different jokes landing.

**Give-up rate:** `count(distinct order_id with order_abandoned) ÷
count(distinct order_id with order_placed)`. This is a floor on true
abandonment, not the real number — see §7.

## 6. Whether this can be read yet

Yes, with one caveat carried from the research doc (#64): `events` can
contain rows from a patient script sending valid-shaped events from many
IPs, which none of the ADR's bounds stop. Every metric above must be
computed from `events_clean`, never raw `events`, for that reason — this
document treats that view, not the table, as the readable dataset. Because
the send is best-effort and un-queued (design doc: "nothing in the flow may
block on it"), some fraction of real events never reach the store at all;
that loss should apply roughly evenly across every event name from the same
sender, so step-over-step *ratios* stay meaningful even though absolute
counts are an undercount. If that assumption turns out to be false — e.g.
the Supabase project is paused after a quiet week and a whole day's `events`
never land — the ratios for that window are not meaningful either, and a
reader should check the project's activity before trusting a number.

## 7. Failure cases

- **The Supabase write fails or is skipped** (unreachable, unconfigured,
  paused free project). The event is not logged, not retried, and does not
  block the screen (design doc). This visitor is simply missing from every
  count above, not a third state — the same treatment the instrumentation
  skill gives someone who never registers.
- **A visitor gives up without pressing "Start over."** No `order_abandoned`
  fires — that visitor is invisible to the give-up-rate metric, permanently.
  The give-up rate is therefore a **floor**, not a true rate; a later
  objective wanting the true rate would need to infer it from the last
  `tracker_viewed` per `order_id` with no later event, which needs a
  read-time cutoff (e.g. "30+ days since last view, no `order_abandoned`")
  rather than anything this contract can log directly. Worth revisiting if
  that number is ever wanted; not needed for this objective's "does the
  joke land" question.
- **A duplicate `order_placed`** (a double-tap that got past the disable
  guard). The ADR's primary-key-on-`id` refuses the retried row outright if
  the client resends the same `id`; if the client instead generates a new
  `id` for the same `order_id` because the guard failed, that is a real bug
  in the disable logic and shows up as two `order_placed` rows sharing one
  `order_id` — the invariant in §4 is what a test should assert against to
  catch it before it ships.

## 8. Disclosure text — "What we log, and why" (`/about`)

`docs/design/65-parody-flow.md` fixes where this page is linked from
(checkout, and the sitewide footer) and hands its content to this issue.
Required content, plain language:

> **What we log, and why**
>
> This site is a parody, but the analytics are real — we log what you do
> here so we (and, eventually, anyone learning from this project) can see
> real usage. Specifically:
>
> - **A random ID for this browser**, generated the first time you do
>   anything here and stored only in this browser. It isn't your name,
>   email, or anything that identifies you — it's a made-up number that
>   lets us tell "one visitor came back" from "two different visitors,"
>   nothing more.
> - **Which screens you visit and when** — landing, restaurants, a
>   restaurant's menu, your cart, checkout, and the tracker (including
>   every time you come back to check on your order).
> - **The choices you make at checkout** — your joke drop-off spot, your
>   handling instructions (mostly about the promo), whether you want
>   utensils, your tip percentage, and the promo code you pick. There is no
>   name, address, phone number, email, or payment field anywhere in this
>   app for us to log, because we never ask for one.
>
> **What we don't log:** anything that identifies you as a real person.
> No account, no card, no email, no address, no cross-site tracking cookie.
>
> **One more thing, in the interest of actually being honest about it:** to
> stop spam from overwhelming this free database, every write is checked
> against a short-term limit keyed to a scrambled (one-way hashed) version
> of your IP address. That scrambled value is kept for **up to one hour**,
> only to enforce that limit, and it never appears next to anything you did
> here — it isn't stored in the same place as the events above and can't be
> joined back to them. We're naming it here because it's still something
> your visit causes this site to process, even though it never becomes part
> of the dataset you can query.

This satisfies acceptance criterion 6: the rate-limit hash is named plainly
as something the site processes, distinct from the events table it never
reaches.

## No ADR

This document adds event names and per-event `props` shapes, which ADR 0005
already assigns to the analyst rather than fixing itself ("The event names,
per-event properties... are the analyst's contract (#66), not this ADR's").
It changes no schema, dependency, or service the ADR did not already commit
to — the `variant` `CHECK` narrowing in §3 is a tightening of a column ADR
0005 already declared, not a new one. No ADR needed.
