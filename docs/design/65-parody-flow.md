# Naming, brand, and flow for the order-that-never-comes parody

**Superseded by `docs/design/80-two-city-brand-and-flow.md` (issue #80,
objective #79), kept as history only.** The parody product this document
specifies — name, flow, and the tracker that never delivers — is being
replaced wholesale by a realistic two-city delivery app; nothing here should
be built against going forward.

Spec for issue #65, serving parent objective #63. This replaces the swipe
poll's entire product surface — nav, pages, everything a visitor does — with
a food-delivery parody, so this document treats the *mechanics* of
`docs/design/46-phone-native.md` as fixed (nav pattern, dark-mode strategy,
safe-area handling, touch feedback, motion, type/spacing scale) and specifies
a new product on top of them. It does not repeat 46's reasoning for those
mechanics; read that document first. No separate `48-nav-safe-area.md` exists
— issue #48 built directly against 46's spec, so 46 is the only source
document the parent issue's "phone-native/dark-mode/safe-area system" refers
to.

Event logging (what fires, what it contains) is issue #66's, not this one's.
Where a screen's behavior depends on whether an event send succeeded, this
document says only what the *visitor* must never see (a spinner waiting on
analytics) — the contract itself is out of scope here.

## The outcome, the constraints, the guesses

**Outcome (fixed):** a visitor can go landing → restaurant → items → cart →
checkout → order-placed → tracker, the tracker never delivers, and that's the
joke — it has to land as one on a phone, including for someone who refreshes
mid-wait or comes back later having given up. Checkout collects nothing that
identifies a real person.

**Constraints (checked, not assumed):**
- `src/styles/global.css`'s type scale, spacing scale, color tokens (light
  and dark), and the `.reset-button` treatment are unchanged. The parent
  issue asks for a new *identity* (name, brand voice, screens) inside the
  *existing* phone-native system, not a new palette — changing the hex
  values would be a guess with nothing asking for it, so this document
  reuses them as-is in both directions below. One thing that does not carry
  over: `--color-accent-a`/`-b` lose their swipe-poll meaning ("variant a
  cool, variant b warm," 46-phone-native.md) along with the poll itself,
  which objective #63 deletes outright. Below, they're reused only as two
  hex values — `a` for primary links/selected default choices, `b` for the
  one emphasis moment on the tracker — not as a resumed variant mechanic.
- `Header.astro`'s reshape-at-480px pattern (top bar on desktop, fixed bottom
  tab bar on phone, filled-pill active state, `aria-current="page"`) is
  unchanged structurally. What changes is its content: two destinations
  become three (see Nav, below).
- No card, email, phone, or free-text field anywhere in checkout — the issue
  states this twice (summary and acceptance criteria), which is the signal
  to treat it as a hard boundary rather than a starting point to negotiate
  from.
- No backend beyond the analytics writes ADR 0005 already settled (Supabase,
  insert-only, best-effort). Every screen below has to work with that write
  failing or never returning — nothing in the flow may block on it.

**Guesses this document is making, called out as such:** the two name/brand
directions themselves (the owner's call, per the issue); the exact joke
copy on each screen (restaurant names, tracker flavor text) — reasonable
placeholders, not precious; and the elapsed-time thresholds on the tracker
(see State 7c) — a plausible shape for "refresh vs. give up," not a value
anyone measured.

## Look at what's there today

`./scripts/app-render / docs/design/_render` refuses:

```
app-render: SERVE_DIR is empty, so there is nothing to serve.
  Open scripts/app-render and set BUILD_CMD and SERVE_DIR to what
  builds this repository and where it builds to. Both are this
  project's to decide; the interface above is not.
  Until then, no role can see this repository rendered, and a run
  told to compare a page against a mock should say so rather than
  describing a page nobody has opened.
```

Filling those two lines in is outside this issue's scope (it's a build
question, not a naming/flow one, and this role has no write access to
`scripts/`) — noting it here rather than guessing at a look nobody has
rendered. What the current site *is*, read rather than rendered: the swipe
poll (`src/pages/index.astro`, `results.astro`) inside the phone-native shell
46 already specified and shipped (confirmed working when I rendered that
document's own mocks locally with `design-render` — both open and match its
description). This document's job is what replaces the poll pages, not what
the shell already does correctly.

## Look outside this repository

- **FoodNeverComes** (`foodnevercome.com`), a South Korean site that went
  viral in 2026 with exactly this genre: browse, cart, checkout for free, a
  tracker that shows a rider moving on a live map through prep/pickup/
  transit and never arriving. I'm taking the core insight — a *stepped*
  tracker (not a blank "processing" spinner) is what makes the never-arrival
  funny, because a visitor has to watch it *almost* finish — and refusing
  the live map: this is a static site with no geo data and no real courier,
  and a fake map is the kind of prop that reads as trying to look real
  rather than admitting the joke, which is the opposite of what a parody
  needs. It's also not a delivery brand this repo needs to stay clear of by
  name (it's already a parody itself, not a real delivery service), but I'm
  still keeping this site's name and marks clear of it — sharing a genre
  with a viral product is not the same as being mistaken for it.
- **2026 mobile checkout UX writing** (multiple sources converge on this):
  sticky bottom CTA, large tap targets, no more fields than the transaction
  needs, keep transactional flows "simple and predictable rather than
  conversational." I'm taking "no more fields than the transaction needs"
  and pushing it further than a real checkout would — see Checkout, below,
  where every field is a preset choice rather than free text, which a real
  checkout couldn't get away with but a joke one can and should.
- **Order-tracking stepper patterns** (Eleken, Lollypop, and others
  describing 2026 implementations): a vertical stepper on phone, a step per
  status (received → confirmed → preparing → on the road → delivered),
  timestamps per step, an animated pulse on the current step, the current
  step announced to assistive tech. I'm taking the vertical-stepper-on-
  phone shape and the "announce the current step" accessibility pattern
  directly (see Tracker, below); I'm refusing the fifth step. There is no
  "delivered" — the stepper's whole job is stopping one short of it forever.

## Naming and brand: two directions

Both stay clear of every existing delivery brand's name roots (no "Eats,"
"Dash," "Grub," "Door," "Postmates," "Seamless," "Deliveroo," "Swiggy,"
"Zomato," "Instacart," or their marks) and of FoodNeverComes's own name.
Both run on the same tokens (Constraints, above) — the difference between
them is voice and the small amount of brand-specific mark work each carries
(a wordmark treatment and a handful of joke copy lines), not the color
system or the type scale.

### Direction A: Phantom Fork (recommended)

A ghost theme, played earnestly rather than winkingly. The order isn't
"delayed" — it's become a phantom, and the app's whole voice treats that as
a fact about the world rather than an apology. Tagline: **"Order. Wait.
Wonder."**

- **Wordmark:** "PHANTOM FORK" set in the existing `h1` treatment (uppercase,
  800 weight, `0.03em` tracking) with a small fork glyph before it whose
  tines trail off into three fading dots instead of finishing square — the
  one mark this direction adds, reused everywhere the wordmark appears
  (header, order-placed screen, tracker).
- **Voice:** deadpan-supernatural. Restaurant names lean into it ("Ghost
  Kitchen," "Sisyphus Sushi," "The Long Wait Diner"), and the tracker's
  stalled-state copy reads as sincere reporting ("Your rider has been seen.
  Once.") rather than a customer-service apology.
- **Why recommended:** it gives the tracker — the screen the whole joke has
  to land on — a visual and copy hook that isn't just a progress bar that
  stops. "Phantom" motivates *why* nothing arrives in a way a visitor gets
  instantly, and it's the stronger direction to actually render, so the mock
  below builds this one. Direction B renders on the identical structure with
  its own wordmark and copy swapped in if the owner picks it instead —
  nothing about the flow or components changes between them.

### Direction B: The Waitlist

A deadpan corporate-startup name — the joke is that "waitlist" is already
what every hyped product's actual delivery looks like, so naming the app
that skips a step. Tagline: **"Delivery, eventually."**

- **Wordmark:** plain uppercase wordmark, no glyph, with a small animated
  ellipsis (`···`) standing in for a logomark wherever a real app would put
  an icon — always pending, never a fourth dot.
- **Voice:** flat, SaaS-onboarding-email register, applied to a food order
  ("Your request has been received and is in queue. Position: unknown.").
  The comedy is entirely in the mismatch between register and stakes, not
  in any single joke line.
- **Trade-off against A:** funnier the more a visitor already recognizes
  startup-onboarding clichés (a narrower audience than "ghost" needs), and
  it gives the tracker screen less to visually hold onto — the joke lives
  almost entirely in copy, where Phantom Fork's lives in copy *and* a
  mascot-able visual idea.

**This is the owner's call, not mine** — presenting both per the issue; the
rest of this document (flow, states, components) is identical either way, and
the mock renders direction A.

## State & persistence, used by several screens below

No accounts, no backend beyond the best-effort analytics write. The
*current order* (what's in the cart, and once placed, the placed order and
its timestamp) lives in the visitor's own browser storage, the same pattern
the swipe poll already used for its own state (`docs/design/3-swipe-poll.md`,
ADR 0004) — one keyed record for the active order, cleared by the same kind
of explicit "start over" action ADR 0004 established, never cleared by a
refresh. The exact storage key and shape are the engineer's to pick, matching
existing naming conventions; what this document fixes is the *behavior*: a
refresh or a later visit to `/tracker` reads that same stored order rather
than generating a new one, which is what makes the "refresh" and "return
later" states below possible at all.

## The flow

### 1. Landing (`/`)

Hero: wordmark, tagline, one line of honest pitch ("Order real food. Watch
it not arrive. That's the whole app."), one primary CTA ("Browse
restaurants"). If a stored active order exists (see above), a second, equally
prominent element appears above the CTA: an order-in-progress banner ("Your
order is still out there →") linking straight to `/tracker` — a returning
visitor with something to check on shouldn't have to re-discover the tracker
through the nav.

No loading, empty, or error state: this is static content with no network
read, so nothing renders differently on a slow connection, an empty result,
or a failed request. Only variation is the banner above, which is a presence/
absence check against local storage, not a fetch.

### 2. Restaurant (`/restaurants`)

A list of joke restaurants, built at compile time (fixed content, not a
runtime fetch): name, one-line cuisine tag, and a deliberately useless ETA
("ETA: yes"). Tapping a card opens its menu (screen 3).

No loading/empty/error: the list is fixed and always has entries. I
considered a search/filter (a real delivery app always has one) and left it
out — it would need its own empty state ("no restaurants match") for a list
short enough that scrolling it costs nothing, which is added surface with no
joke behind it.

### 3. Items (`/restaurants/<slug>`)

Restaurant name and tagline at top, then a list of menu items: name, fake
price, an "Add" button that becomes a quantity stepper (−, count, +) once
tapped. A persistent small cart summary (item count + subtotal) sits above
the tab bar / at the bottom of the content on desktop, tappable through to
the cart.

States: **empty-cart-on-this-page** (default — every item shows its plain
"Add" button) and **items-added** (added items show the stepper instead, cart
summary appears). No loading/error — same fixed-content reasoning as screen 2.

### 4. Cart (`/cart`)

- **Populated:** each line item (name, quantity stepper, remove, line total),
  a fake subtotal, one CTA ("Checkout").
- **Empty:** no line items — replaces the list with one line ("Nothing here
  yet.") and a CTA back to Restaurants. This is the one state on this screen
  that's reachable two ways (never added anything, or removed the last item),
  so it's worth being an explicit state rather than an edge case: the CTA is
  what keeps either path from being a dead end.

No loading/error: cart contents are local-storage reads, not a fetch.

### 5. Checkout (`/checkout`)

The screen the issue calls the easiest to get wrong, so every field below is
a **preset choice — nothing typed, anywhere**, which is a stronger guarantee
than "no free-text address": a visitor can't paste a real address, phone
number, or name into a field that doesn't accept typing in the first place.
All four fields default to a pre-selected first option, so checkout is
reachable in one tap with zero required input — matching the "simplify
mobile checkout" research above, and consistent with the joke (ordering
something that will never arrive should be the easiest part of the
experience).

**Exactly these four fields, all single-select, no exceptions:**

1. **Drop-off spot** — radio/chip group of preset joke locations: "My
   couch," "Wherever I am," "The void," "Behind you."
2. **Instructions for the ghost rider** — radio/chip group: "Leave it & run,"
   "Knock loudly," "Don't knock," "Surprise me." (Shortened from an earlier
   draft's longer phrasing once the narrow render showed the longer labels
   pushing the group to one chip per row instead of two — see critique.)
3. **Utensils & napkins** — a yes/no toggle. The one genuinely realistic
   field on the screen, kept because it's harmless (no identity, no
   location) and its ordinariness is part of the joke — everything else on
   the page is absurd and this one field plays it completely straight.
4. **Tip for the rider** — segmented control, preset percentages (0/10/15/
   20%), pure flavor — nothing is actually charged anywhere in this flow.

Below the fields, above the "Place order" button: one line, small and
muted-text-styled, **"What we log, and why →"**, linking to a dedicated page
(`/about`, see Privacy note, below). This is the primary placement — right
where a visitor's guard would normally be up, because this is where a real
checkout would ask for the things this one deliberately never does.

CTA: **"Place order — it's free, no really."** No payment step exists to
lead into, so the button says so rather than implying one is coming.

No loading/error/empty state: nothing here is fetched, nothing can fail to
load, and every field has a default, so there is no "nothing selected yet"
state to design for.

### Privacy note: where "what we log, and why" lives

Two placements, not one, because they answer two different moments:

- **Contextual, on checkout** (above) — reassurance at the exact point a
  visitor might brace for a card or address field and find none.
- **Persistent, sitewide** — a footer link, "What we log, and why," present
  in `BaseLayout` under the tab-bar-clearing padding on every page (same
  link text and destination as the checkout one, so it's recognizable as
  the same thing found twice, not two different documents). This is what
  makes it discoverable *before* checkout, for a visitor who wants to know
  going in, and it's what a link from `/about` or a search engine lands on
  directly. Content of that page is the analyst/engineer's to write once
  the event contract (#66) exists; this document only fixes where the
  door to it is.

### 6. Order placed (`/order-placed`, brief)

A confirmation screen, not a toast — the issue names it as one of the seven
steps. Large confirmation mark (a check, or in Direction A, the fork glyph
completing rather than trailing off — one moment where the mark resolves,
which is why it's worth keeping as its own screen instead of folding into a
toast), one line summarizing what was ordered and from where, and a "Track
your order" CTA. Uses the existing named motion system from 46 (320ms,
`cubic-bezier(0.22, 1, 0.36, 1)`) for the mark's entrance, removed entirely
(no fallback fade) under `prefers-reduced-motion: reduce`, matching 46's
existing rule rather than inventing a second one.

No loading/error: this screen only renders once an order exists to confirm,
which only happens client-side after checkout completes — nothing here waits
on a network response (the analytics write, if any, never blocks this).

### 7. Tracker (`/tracker`)

The screen the whole joke depends on. A vertical stepper (per the research
above): **Placed → Preparing → Picked up → On the way** — four steps, no
fifth. Steps fill in quickly on first view (a few seconds apart, driven by
the stored order's placed timestamp, not a live connection), then the
stepper stops solid at "On the way" and stays there, forever, with
increasingly specific flavor text underneath as time passes.

**7a. Fresh (just placed, first minute):** steps filling in one by one,
current step announced to assistive tech via `aria-live`, matching the
research pattern. Flavor text: "Your rider is nearby (allegedly)."

**7b. Settled, same visit (after ~1 minute):** all four steps filled, "On
the way" pulsing gently (a named, subtle animation — opacity 100%↔70%,
1.6s ease-in-out, looping; removed under reduced motion, static full-opacity
instead) as the only sign anything is still "happening." Flavor text:
"Still on the way. Any minute now."

**7c. Refresh or return, same day:** reopening `/tracker` reads the same
stored order and its original placed timestamp — the stepper shows the
identical filled state (not reset to step one, which would imply progress
that didn't happen and undercut the joke), with flavor text keyed to
elapsed time: "42 minutes and counting" past an hour, "New personal record"
past three hours. This is the concrete answer to the acceptance criterion
about refresh/return: **nothing resets except the visible clock**, and the
clock only ever counts up.

**7d. Return much later, given up (a plausible cut: 24+ hours):** a distinct
screen, not the stepper — the stepper having "almost delivered" forever
stops being funny and starts being a bug once the timeframe is absurd on its
face. Instead: the wordmark's fork glyph fully faded, one honest line
("Look — we don't think it's coming either."), and a "Start over" button
that clears the stored order (same clear-on-explicit-action pattern as ADR
0004) and returns to Restaurants. This is a guess (Guesses, above) on the
exact threshold; the behavior it exists to produce — a dead order eventually
offers an exit instead of an infinite identical screen — is the fixed part.

**7e. No active order (`/tracker` visited directly, nothing stored):** empty
state — "Nothing to track yet. Go order something that won't arrive." CTA to
Restaurants. This is the one true "empty state" on the tracker, distinct
from 7d (which has an order, just an old one).

No error state: the tracker never depends on a network call succeeding —
elapsed time is computed from a locally stored timestamp, never fetched.

## Nav

`Header.astro`'s existing reshape (480px breakpoint, filled-pill active tab,
`aria-current="page"`) is unchanged. Its destination list grows from two to
three — **Restaurants, Cart, Tracker** — still inside the 3–5 range 46's own
research called the standard range, so no new nav pattern is needed, only
new labels.

**One new small piece, not present in 46:** a cart item-count badge — a
small filled circle in `--color-accent-a` (or `-b`; pick whichever direction
carries) sitting at the label's top-right corner on the Cart tab, showing
the item count, only rendered when the count is greater than zero. This is
the one genuinely new nav component this flow needs; everything else about
the tab bar is reused as-is.

## Components (named once, reused everywhere they appear)

- **RestaurantCard** — name, cuisine tag, ETA joke. States: default only (see
  screen 2).
- **MenuItemRow** — name, price, Add button / quantity stepper. States:
  not-added, added (stepper).
- **PresetChoiceGroup** — a labeled group of chip/radio buttons, one always
  selected. Used for Drop-off spot and Instructions. Must never render with
  nothing selected — that state doesn't exist in this flow.
- **TrackerStep** — one stepper row: label, filled/unfilled/current visual
  state, `aria-current` on the current step only.
- **CartBadge** — the small count circle described under Nav. Never renders
  at zero.

## The mock

`docs/design/65-parody-checkout.html` and `docs/design/65-parody-tracker.html`
— two self-contained pages, dark theme only (light is a straight token swap
46-phone-native.md already proved out; not duplicated here). Both hardcode
Direction A's tokens and wordmark rather than relying on `prefers-color-
scheme`, same convention as 46's own mocks. The checkout file shows
checkout's one state; the tracker file stacks all five named tracker states
(7a–7e) top to bottom with a labeled eyebrow above each, primary state 7b
("the never-delivers state") placed second so it's guaranteed inside the
375px render's visible area. Rendered at both widths with
`scripts/design-render`, four PNGs total, committed alongside.

## Critique, after opening the four rendered pictures

- **The first narrow checkout render was the real finding.** It cropped
  before the "What we log, and why" line and the "Place order" button
  entirely — the fixed tab bar sat directly under a mid-page "Tip for the
  rider" heading, which means the one criterion this screen most needs to
  pass (a visitor can actually submit the order at 375px) would have failed
  silently if I'd only read the HTML rather than the picture. Fixed by
  shortening the instruction chip labels so they wrap two-per-row instead
  of one, dropping the drop-off group from five options to four, merging
  Utensils and Tip under compact inline labels instead of two full `<h2>`
  sections, and trimming the section spacing from `--space-xl` to
  `--space-sm`/`--space-md`. Re-rendered until the button cleared the tab
  bar with room to spare — this document's field list and the mock now
  match, rather than the mock being a rough illustration of a longer list.
- **Checkout, wide:** the eye lands on "PHANTOM FORK" first, then the four
  preset groups reading top-to-bottom, "Place order" last — the order I
  intended, confirmed by looking rather than assumed.
- **Checkout, narrow (after the fix):** all four fields, the privacy line,
  and the submit button are visible with no scrolling past the tab bar;
  none of the chip labels clip at 375px.
- **Tracker, wide:** blurring my eyes, the composition that survives is
  wordmark / stepper / flavor line — the stepper is unambiguously the
  largest weight of anything on the screen, which is correct: it's the
  punchline, not decoration around one.
- **Tracker, narrow:** state 7a and the full primary state 7b ("the
  never-delivers state") are both visible without scrolling — I put 7b
  immediately after 7a rather than later in the stack for exactly this
  reason, since a full-page capture at 375px only has room for roughly two
  of the five states before the tab bar. States 7c–7e exist in the file for
  a reader who opens it, not in either screenshot, and that's an accurate
  trade rather than a gap: the acceptance criterion asks for the
  never-delivers state at both widths, and it's the one state guaranteed
  visible in both.
- Covering the accent color with my hand on both tracker renders: the
  filled-vs-unfilled step distinction still reads from weight and fill
  alone (solid fill vs. outline), not color alone — checked deliberately,
  since "On the way" pulsing is the one place color usually gets asked to
  carry meaning by itself.
- The "given up" state (7d) sitting in the same visual rhythm as the live
  stepper states, with nothing distinguishing which one a reader is looking
  at, was a real risk in the markup even though only one state ever ships
  at a time in the real product — I added a `state-eyebrow` label above
  every state block (visible in the render, not just an HTML comment) so
  the picture itself disambiguates them, not just the source.
- What I'd remove if forced to cut one thing: the tip percentage selector.
  It stayed because "nothing is charged, so why does the field exist" is
  itself part of the joke (a real checkout would never ask this without a
  reason), which is a stronger reason to keep it than the field pulls its
  own weight structurally.

## No ADR

Nothing here changes a schema, a dependency, or a service — no ADR needed.
The event contract that does touch schema is #66's, downstream of this
document.
