
# Brand directions, full flow, and promo mechanics for a two-city delivery app

Spec for issue #80, serving parent objective #79. This replaces every remaining
Dontdropthatpromo-branded surface — `docs/design/65-parody-flow.md` and
`docs/design/72-dontdropthatpromo-identity.md` — with a realistic, two-city
food-delivery product in the register of Grab, not a Grab reskin and not a
parody. **65 and 72 are superseded by this document and kept only as history**;
nothing in either should be built against again. The event contract they
implied (`docs/measurement/66-parody-event-contract.md`) is likewise
superseded in substance — the analyst's child issue owns rewriting it, and
this document only names what changed, per the single-role rule 72 already
established for the same handoff.

## The outcome, the constraints, the guesses

**Outcome (fixed, from the parent issue's "done" items):** a first-time
visitor on a phone sees a realistic, polished delivery app under an original
brand; picks San Francisco or Ho Chi Minh City and that choice persists;
browses a home feed, a restaurant's menu, a cart and a checkout with a real
price breakdown; applies a promo that visibly, satisfyingly drops the total;
places an order that actually arrives after a short realistic wait and asks
for a rating; sees, at checkout and at delivery, an honest statement that
this is a demo. No card, email, phone, name, or free-text address field
anywhere, ever — the existing hard boundary, unchanged.

**Constraints (checked against the code, not assumed):**

- `src/styles/global.css`'s type scale (`--font-size-h1/h2/nav-title/body/
  muted`) and spacing scale (`--space-xs` through `--space-xxl`) are
  unchanged. The parent issue names this explicitly as still applying. What
  the parent issue *does* invite — "a deliberate rebrand of color tokens" —
  is exactly what this document does: every color token below is new,
  replacing `Dontdropthatpromo`'s palette rather than reusing it, because the
  brand itself is what's being replaced this time (65→72 kept the same
  tokens because only the *name* changed between them; this child changes
  the product, so the guess that the palette survives untouched doesn't hold
  here the way it held for 72).
- `Header.astro`'s reshape-at-480px pattern (top bar on desktop, fixed bottom
  tab bar on phone, filled-pill active state via `--color-tab-active-bg`,
  `aria-current="page"`) is structurally unchanged — see Nav, below, for what
  changes in its *content* (destination list, plus a new location control).
- `docs/design/46-phone-native.md`'s safe-area handling, touch feedback,
  motion durations/easings (320ms `cubic-bezier(0.22, 1, 0.36, 1)`), and
  `prefers-reduced-motion` rule are unchanged and reused as-is everywhere
  below a new animation is named.
- No accounts, no logins, no card/email/phone/name/free-text field, no real
  GPS map, no A/B test on promos (no arms, no exposure event) — all fixed by
  the parent issue's scope line, checked against `src/lib/order-store.ts`
  and `src/pages/checkout.astro` today: the current checkout already proves
  the "every field is a preset choice" pattern works end to end, so this
  document keeps that mechanic rather than introducing typed input anywhere
  to make the new fields (address, promo) feel "more real."
- `src/lib/restaurants.ts`'s compile-time-catalogue shape (no runtime fetch)
  is the right shape for this too — a real delivery app's catalogue is
  server-driven, but this site has no server, and ADR 0001 isn't reopened by
  this issue. Restaurants and menus stay static per-city arrays.
- The tracker's persistence model (`src/lib/order-store.ts`'s `PlacedOrder`,
  cleared only by an explicit action) and its pure-computation-from-timestamp
  design (`src/lib/tracker-state.ts`) are the right shape for "survives a
  refresh and a return visit" and are kept; what changes is the *meaning* of
  the steps and what the stalled step becomes (see Tracker, below).

**Guesses this document is making, called out as such:**

- The exact restaurant/dish rosters for both cities (plausible, licensable-photo-backed placeholders, not the only valid set).
- The elapsed-time thresholds that drive the tracker's five stages (a
  plausible "a few minutes" shape, not a value anyone measured — same caveat
  65 attached to its own stalled-tracker thresholds).
- The promo mechanic's specific shape (eligibility rules, which codes exist,
  the celebration treatment) — the parent issue leaves this to the designer
  by name ("How that works is the designer's to propose, and the owner
  picks... no arms or exposure event ships"); this is that proposal, not a
  question for the owner, because item 4 gives the *designer* the pen and
  reserves only the *A/B test itself* for later.
- Money's representation across two currencies is named here as a
  constraint the engineer must solve (see Money, below) but not solved here
  — this role has no write access to `src/lib`, and the parent issue's "For
  the orchestrator" section already flags it as an engineer problem.

## Look at what's there today

`./scripts/app-render / docs/design/_render` refuses:

```
app-render: SERVE_DIR is empty, so there is nothing to serve.
  Open scripts/app-render and set BUILD_CMD and SERVE_DIR to what
  builds this repository and where it builds to. Both are this
  project's to decide; the interface above is not.
```

Unchanged since #65 and #72 both hit the identical refusal — this role has no
write access to `scripts/`, so filling it in is out of scope here, and it's
worth noting again rather than silently working around: a third design child
in a row has been unable to compare a built page against its own mock.

Read instead, directly: `src/pages/index.astro` is a bare hero with the old
wordmark and a "Browse restaurants" CTA; `src/pages/restaurants/index.astro`
lists the three joke restaurants from `src/lib/restaurants.ts` with no photos,
no ratings, no ETA beyond the joke string `"ETA: yes"`, no delivery fee, no
search, no cuisine filter. `src/pages/checkout.astro` renders a single
`#checkout-root` mounted by `checkout-dom.ts` into the five preset-choice
groups 72 specified (drop-off spot, handling instructions, utensils, tip,
promo code) with no price breakdown beyond the cart's subtotal — no delivery
fee, no service fee, no discount line, because nothing before this issue ever
priced a promo at all; `PROMO_CODES` in `src/lib/tracking.ts` are validated as
an enum but nothing in the UI shows what any of them are worth.
`src/lib/tracker-state.ts` has four steps, stalls forever on `On the way`,
and `src/pages/tracker.astro` never shows a rating prompt because nothing
ever finishes. `Header.astro`'s three destinations are Restaurants/Cart/
Tracker with no location control anywhere in the shell. This is the surface
being replaced.

## Look outside this repository

- **Voucherify's coupon-UI guidance** (2026 update): show the discount as
  soon as it's applied — real-time, not after a page reload — label it
  explicitly ("Promo applied"), and put the savings figure in the order
  summary rather than leaving a visitor to do the subtraction themselves.
  I'm taking "state the number, don't make the visitor compute it" directly
  — see Checkout, below, where "You saved $4.30" is its own line, not
  implied by a struck-through price alone — and refusing the article's
  "surface every eligible coupon at once" advice for the *default* case:
  this app pre-applies the single best-value code rather than showing a
  wall of codes to compare, because the parent issue's "no more fields than
  the transaction needs" precedent (already established for 65's checkout)
  argues for the same restraint here — comparing codes is available, not
  forced.
- **A public critique of Grab's own promo-banner practice** (a Southeast-Asia
  banner-design case study, 2026): flashy, high-saturation banners with
  dense small text get tuned out by users who've learned to read them as
  ads, and the fix that case study lands on is fewer banners, each carrying
  one legible claim in the page's own type scale rather than banner-specific
  display type. I'm taking that directly — the home feed's promo banner
  reuses this site's own type scale and one accent color rather than
  inventing banner-specific styling, and there's exactly one banner slot
  live at a time, not a carousel of five. I'm refusing the instinct to make
  the banner *louder* to compete for attention, which is the opposite fix
  from what that case study found actually worked.
- **`docs/design/72-dontdropthatpromo-identity.md`'s own mark research**
  (Duolingo's motion-first mascot pattern, carried into 72's "held / caught
  / dropped" drop glyph) — I'm taking the same underlying idea forward again
  rather than re-researching it: a small mark with life-cycle states tied to
  what's actually happening reads better on a tracker than one static glyph.
  Below, Direction Swoop's mark plays this straight (a paper-plane glyph that
  visibly launches on order-placed and lands on delivered) while Direction
  Portside deliberately refuses it (a static pin, because a calm-concierge
  voice shouldn't be asked to perform) — naming the refusal is the point,
  per design-craft: a reference only borrowed from produces pastiche, and a
  reference *available to and refused by* one direction and not the other is
  what actually makes the two directions differ structurally rather than by
  palette alone.

## Two brand directions

Both stay clear of Grab's name, wordmark, logo shape, and signature green
(`#00B14F` and its near neighbors) as a primary color, and of every other
real delivery brand's name/mark I checked color and name against while
choosing these: DoorDash (`#FF3008` red), Deliveroo (`#00CCBC` teal), Swiggy
(`#FC8019` orange), Zomato (`#E23744` red), foodpanda (`#D6006D` magenta),
Uber (black/green). Neither direction's primary sits in any of those hues.
Both catalogues below use invented, generic-sounding restaurant names —
"believable" per the parent issue, never a real chain's name or mark.

### Direction A: Swoop (recommended)

**Voice:** energetic, deal-hunting, a little breathless about a good price —
the register of a friend who just found out the thing you both wanted is on
sale. Never sarcastic, never a joke at the product's own expense (that
register left with Dontdropthatpromo); the energy is genuine, not ironic.

**Primary color:** violet, `#6C3CE0` (light) / `#B79CFF` (dark) — a hue none
of the brands checked above use, and one that reads as neither "corporate
blue" nor "food-adjacent green/red/orange," which is deliberate: this isn't
trying to look like a delivery app that already exists.

**Wordmark treatment:** lowercase, in the existing `h1` treatment's weight
(800) but *without* its uppercase transform — "swoop," set in sentence case,
because the whole point of this direction is friendly urgency, and an
all-caps wordmark reads as corporate the same way it read as deadpan for The
Waitlist (65's rejected direction). The second "o" carries a small tail
curling off its bottom-right, the one mark this direction adds, standing in
for a logomark — it appears at the wordmark's size everywhere the wordmark
appears (header, order-placed, tracker) and nowhere smaller, so it's never
asked to read as an icon at a size it can't survive.

**Structural idea (not just a palette):** the promo mechanic is a visible,
comparable set of deal chips — the visitor can *see* more than one deal and
watch the app pick the best one, which is the "gamified deal-hunting" feeling
Direction A's voice is built around (see Promo mechanic, below).

### Direction B: Portside

**Voice:** calm, competent, quietly confident — the register of a good
concierge, not an excited friend. States the outcome plainly ("Free delivery
applied") rather than celebrating it. Chosen name plays on both cities
actually being port cities (San Francisco Bay, the Saigon River) without
naming either.

**Primary color:** cobalt blue, `#2451B8` (light) / `#7FA6F0` (dark) — again
clear of every brand checked above (nearest real neighbor is a generic
"fintech blue," not a delivery brand's).

**Wordmark treatment:** uppercase, tracked (`0.03em`, matching the existing
`h1` convention exactly, unlike Swoop's deliberate departure from it), no
glyph tail — a small fixed pin-drop mark sits before it, static throughout
the flow rather than animating, which is Portside's own deliberate refusal
(see "Look outside this repository," above): a calm voice doesn't perform a
mascot moment even at the one beat (order-placed) where Swoop's mark does.

**Structural idea:** the promo mechanic auto-applies the best deal silently
and states the outcome once, plainly, in the order summary — no chip
comparison, no "look how many deals you get to pick from." Savings are
real and stated; the *experience* of claiming them is deliberately
low-key rather than gamified.

**Trade-off between them:** Swoop asks more of the visitor's attention (a
chip group to read, a mark that performs) in exchange for the stronger
"emotional centrepiece" moment the parent issue's item 4 asks for by name;
Portside is the safer, calmer product and risks the promo landing as one
line among several rather than a moment. **Recommending Swoop** for exactly
that reason — item 4 is the one requirement in this issue that names a
feeling ("the small hit of excitement... getting a surprisingly good deal"),
and Swoop's structure is built to produce that feeling on purpose rather than
hoping a discount line does it unaided. Portside renders on the identical
flow, fields, and components with its own tokens, mark, and copy swapped in
if the owner prefers it — nothing about layout or component structure differs
between them. The mock below builds Swoop.

**The owner's question** is asked as its own issue comment (see the end of
this document), not decided here.

## Neutral tokens (shared shape, direction supplies the hex)

Both directions use the same *roles* — `--color-bg`, `--color-surface`,
`--color-text`, `--color-text-muted`, `--color-border`, `--color-accent`
(primary — doubles as the discount/success color, see Checkout), and
`--color-accent-secondary` (badge-fill only, never used as text-on-page-
background — see Contrast, below, for why that restriction exists). Light
and dark values for each direction:

| Token | Swoop light | Swoop dark | Portside light | Portside dark |
|---|---|---|---|---|
| `--color-bg` | `#FBF7FF` | `#16101F` | `#F5F8FC` | `#0D1420` |
| `--color-surface` | `#F7F1FF` | `#1E1730` | `#EFF4FA` | `#131C2C` |
| `--color-text` | `#241B33` | `#F1E9FF` | `#16233D` | `#ECF1F8` |
| `--color-text-muted` | `#6B5D85` | `#B7A6D9` | `#5C7089` | `#9FB0C4` |
| `--color-border` | `#E3D6FA` | `#3A2E52` | `#D7E1EE` | `#2A3A50` |
| `--color-accent` | `#6C3CE0` | `#B79CFF` | `#2451B8` | `#7FA6F0` |
| `--color-accent-secondary` (badge fill) | `#FF7A45` | `#FFA36B` | `#C08A2E` | `#E0B15C` |

`--color-tab-active-bg` (the filled-pill nav treatment `Header.astro` already
uses) becomes each direction's surface tint one step warmer than
`--color-surface` — an implementation detail for the engineer, not a new
value this document needs to separately contrast-check, since the pill only
ever holds `--color-text` at full weight, already checked against
`--color-surface` above.

## Contrast — every pairing this direction introduces, computed not estimated

Run with `./scripts/contrast <fg> <bg> 4.5`, both directions, both themes:

| Pair | Ratio | Passes 4.5:1? |
|---|---|---|
| Swoop `--color-text` on `--color-bg` | 15.51 | yes |
| Swoop `--color-text` on `--color-surface` | 14.83 | yes |
| Swoop `--color-text-muted` on `--color-bg` | 5.62 | yes |
| Swoop `--color-text-muted` on `--color-surface` | 5.38 | yes |
| Swoop `--color-accent` (discount color) on `--color-bg` | 5.91 | yes |
| Swoop `--color-accent` on `--color-surface` | 5.65 | yes |
| Swoop dark `--color-text` on `--color-bg` | 15.82 | yes |
| Swoop dark `--color-text` on `--color-surface` | 14.62 | yes |
| Swoop dark `--color-text-muted` on `--color-bg` | 8.40 | yes |
| Swoop dark `--color-text-muted` on `--color-surface` | 7.76 | yes |
| Swoop dark `--color-accent` on `--color-bg` | 8.17 | yes |
| Swoop dark `--color-accent` on `--color-surface` | 7.55 | yes |
| Portside `--color-text` on `--color-bg` | 14.69 | yes |
| Portside `--color-text` on `--color-surface` | 14.15 | yes |
| Portside `--color-text-muted` on `--color-bg` | 4.77 | yes |
| Portside `--color-text-muted` on `--color-surface` | 4.59 | yes |
| Portside `--color-accent` (discount color) on `--color-bg` | 6.70 | yes |
| Portside `--color-accent` on `--color-surface` | 6.45 | yes |
| Portside dark `--color-text` on `--color-bg` | 16.26 | yes |
| Portside dark `--color-text` on `--color-surface` | 15.04 | yes |
| Portside dark `--color-text-muted` on `--color-bg` | 8.33 | yes |
| Portside dark `--color-text-muted` on `--color-surface` | 7.71 | yes |
| Portside dark `--color-accent` on `--color-bg` | 7.57 | yes |
| Portside dark `--color-accent` on `--color-surface` | 7.00 | yes |

`--color-accent-secondary` is never placed as text or an icon stroke directly
on `--color-bg`/`--color-surface` — checked and rejected first: Swoop light
`#FF7A45` on `#FBF7FF` is **2.44**, Portside light `#C08A2E` on `#F5F8FC` is
**2.85**, both fail outright. It's used exactly one way instead — as a filled
badge background with dark ink text on top, in both themes:

| Pair (badge fill + text) | Ratio | Passes 4.5:1? |
|---|---|---|
| Swoop light: `--color-text` (`#241B33`) on badge fill (`#FF7A45`) | 6.35 | yes |
| Swoop dark: `--color-bg` (`#16101F`) on badge fill (`#FFA36B`) | 9.49 | yes |
| Portside light: `--color-text` (`#16233D`) on badge fill (`#C08A2E`) | 5.15 | yes |
| Portside dark: `--color-bg` (`#0D1420`) on badge fill (`#E0B15C`) | 9.33 | yes |
| (checked and rejected) white text on Swoop light badge fill | 2.59 | no |
| (checked and rejected) white text on Portside light badge fill | 3.04 | no |

That last pair is why "dark ink on the fill, never white" is written into the
component spec below as a rule, not a suggestion: white was the first thing
tried and it fails in both directions.

## The flow

Screens, in order. Every state below is one of: **happy**, **empty**, or
**error** — a screen with no error state says why, matching 65/72's own
convention rather than inventing a fourth label for "doesn't apply."

### 1. Location picker (overlay on first visit, reachable anytime from the header)

**Happy:** on a visit with no persisted city, a modal sheet covers the home
feed behind a scrim: two large tappable cards, "San Francisco" and "Ho Chi
Minh City," each with a representative photo (see Photos, below) and its
currency named once ("Prices in USD" / "Prices in VND" — stated up front so
switching currencies is never a surprise later at checkout). Tapping a card
persists the choice (`localStorage`, key the engineer names following
`order-store.ts`'s existing naming convention) and dismisses the sheet. A
location bar — city name plus a small chevron — sits in the header on every
subsequent screen (new nav element, see Nav below) and reopens this same
sheet on tap, so switching cities later doesn't require finding a settings
page.

**Empty (no persisted choice):** identical to first-visit happy — there is
no default city, deliberately, unlike every other preset choice in this app.
Guessing a city would put the wrong catalogue and currency in front of a
visitor silently, which is a worse failure than one extra tap on the first
visit.

**Error (storage blocked — private browsing or a blocked-storage setting):**
the sheet still functions for the current page load (an in-memory fallback,
not a hard failure), but carries one small inline line beneath the two cards:
"Your city won't be remembered after you close this." This is checkable
without a real private-browsing harness: the component takes its persistence
layer as an argument the same way `order-store.ts`'s functions already take
a `Storage` the caller supplies, so a test can hand it a `Storage` stub whose
`setItem` throws (exactly how Safari's private-mode `localStorage` actually
fails) and assert the inline line appears.

### 2. Home feed (`/` — replaces both the old landing page and `/restaurants`)

A real delivery app opens directly onto its feed rather than a hero page with
a "browse" button in between; the two collapse into one screen, which is
also a deletion the parent issue asks for by naming `/restaurants` among "the
app (from #63)" surfaces being replaced.

**Happy:** top to bottom — the location bar (city, tap to reopen the picker),
a search field (client-side filter over the current city's catalogue, no
network), one promo banner (a single slot, not a carousel — see "Look
outside this repository," above), a row of cuisine shortcut chips specific to
the current city's catalogue (e.g. SF: "Tacos," "Pizza," "Dim sum," "Bowls";
HCMC: "Phở," "Bánh mì," "Cơm," "Bún"), then a vertical list of restaurant
cards: photo, name, star rating, ETA range ("25–35 min"), delivery fee
("$1.99" / "Free" if a citywide promo currently zeroes it, see Promo
mechanic), and a deal badge (the `--color-accent-secondary` filled pill,
e.g. "20% OFF") on any restaurant currently carrying a promo. Tapping a card
opens its menu (screen 3).

**Empty (search or cuisine filter matches nothing):** the list is replaced
by one block: "No restaurants match “ramen” in Ho Chi Minh City yet." plus a
"Clear filter" action — worded to name the *current city* specifically,
since the same empty search could later mean something different after a
city switch, and a visitor who just switched cities needs to know that's
why their old search came up empty.

**Error:** none. The catalogue is a compile-time array per city (extending
`restaurants.ts`'s existing shape, keyed by city), never a runtime fetch —
same reasoning 65 already established for the identical screen shape, still
true here.

### 3. Restaurant (`/restaurants/<slug>`)

**Happy:** restaurant name, cuisine tag, rating and ETA repeated from the
card (consistency, not new information), a hero photo, then the menu in
named sections (e.g. "Starters," "Mains," "Drinks" — a new structural field
on `MenuItem` grouping items, where today's flat array has none), each item
showing a thumbnail photo, name, one-line description, and price in the
current city's currency. Add button becomes a quantity stepper once tapped,
exactly as today. A persistent cart summary bar (item count, subtotal,
"View cart") sits above the tab bar on phone / at the bottom of content on
desktop — unchanged from 65's identical component.

**Empty (an item is sold out):** the item's photo and description stay
visible (so the menu doesn't visibly shrink and look broken) but the Add
button is replaced with a disabled "Sold out" label — the one new per-item
state this document adds, needed because a real menu screen without it
invites "why is the button missing" the moment any dish is ever marked
unavailable.

**Error:** none — same fixed-content reasoning as screen 2.

### 4. Cart (`/cart`)

**Populated (happy):** each line item (photo thumbnail, name, quantity
stepper, remove, line total), then a **preview** of the breakdown checkout
will show in full (subtotal, delivery fee, one line: "+ service fee and any
discount at checkout" rather than repeating the whole breakdown twice) and
one CTA, "Go to checkout."

**Empty:** unchanged in shape from 65's cart empty state — one line
("Nothing in your cart yet.") and a CTA back to the home feed, reachable
either by never having added anything or by removing the last item.

**Error:** none — local-storage read, matching 65's own reasoning.

### 5. Checkout (`/checkout`)

The screen item 4 of the parent issue calls the emotional centrepiece, and
the one every acceptance criterion in this issue asks about most directly.

**Happy:**

1. **Delivery details** — two preset choices, no typed fields, carrying the
   existing "reachable in one tap" guarantee forward: **Drop-off** (a short
   list of realistic presets per city — "Home," "Office," "Front desk" — not
   the old joke locations, framed as saved addresses rather than free text,
   per the parent issue's "Saved addresses are presets" note) and
   **Delivery instructions** (the old "Handling instructions" group,
   revoiced — "Leave at door," "Hand to me," "Meet downstairs," "Call on
   arrival").
2. **Utensils & napkins** — unchanged yes/no toggle, kept for the same
   reason 72 kept it (harmless, ordinary, no identity risk).
3. **Promo** — see Promo mechanic, below. Not a "code" field any more; a
   comparison of the deals currently available, one pre-selected.
4. **Price breakdown**, in order: Subtotal, Delivery fee (struck through and
   replaced with "Free" if the selected promo zeroes it), Service fee, then
   — only when a promo is selected — a **Discount** line in
   `--color-accent`, bold weight, with a small tag icon (never color alone,
   per the contrast section's own rule), reading "Discount (SWOOP10) −$4.30"
   followed immediately by its own bold sub-line "You saved $4.30" (the
   Voucherify pattern above: state the number, don't make the visitor do the
   subtraction), then **Total**, at the largest weight on the screen next to
   the wordmark.
5. **Demo disclosure** (see its own section, below) sits directly above the
   CTA.
6. CTA: **"Place order"** — plain, because this app is no longer joking
   about whether an order is real.

**Empty (cart became empty mid-checkout — e.g. cleared in another tab):** the
breakdown and fields are replaced with one line, "Your cart is empty," and a
CTA back to the home feed, rather than rendering a $0.00 breakdown that looks
like a bug.

**Error (a selected promo stops being eligible):** each promo carries a
plain-language eligibility rule (a minimum subtotal, or "one use per visitor"
tracked the same way `order-store.ts` already tracks a `visitorId` — no new
personal data, just a boolean flag next to the existing id). If the visitor
removes cart items and the selected promo's minimum is no longer met, or the
promo was already claimed earlier in this browser (checked against the
existing local storage, no network round-trip), its chip shows a disabled
visual treatment with one inline reason ("Needs a $15 subtotal — add $3.20
more" / "Already used on this device"), and selection silently falls back to
the next-best *eligible* promo, or to no promo if none qualify — checkout
never becomes unsubmittable because of a promo, which keeps the "reachable in
one tap" guarantee true even in this state.

### 6. Order placed (`/order-placed`, brief)

Unchanged in shape from 65/72 (a confirmation screen, not a toast, using the
existing 320ms ease-out-expo entrance, removed under reduced motion) — what
changes is the mark: Swoop's paper-plane glyph animates from a slightly
lower/tilted position into level flight (its "launch" state, the direct
descendant of 72's "caught" beat); Portside's pin mark does not animate here
at all, per its own deliberate refusal, above. One line summarizing the order
and a "Track your order" CTA, both unchanged in role from 65.

### 7. Tracker (`/tracker`) — now five stages, ending in Delivered

**Happy:** a vertical stepper, **Placed → Preparing → Picked up → On the
way → Delivered** — the same shape 65 researched (a stepped tracker, no live
map, `aria-live` announcing the current step) with the one change the parent
issue asks for: a fifth step that actually resolves. Elapsed-time-driven,
computed from the stored order's timestamp exactly as `tracker-state.ts`
already does — a plausible guess at pacing (Guesses, above): Placed
instantly, Preparing at ~30s, Picked up at ~2 min, On the way at ~4 min,
Delivered at ~7 min. Reaching Delivered reveals the rating prompt in the
same screen (not a new route) — five stars, tap to select, plus optional
preset tag chips ("Fast," "Great packaging," "Order was correct" — no
free text), and a "Submit" button that's enabled the moment a star count is
picked (tags are optional). The demo disclosure (below) sits directly above
the rating prompt.

**Refresh or return, same day:** identical to 65's own convention — the
stepper reflects the same stored timestamp, nothing resets, the clock only
counts up until Delivered, after which it stays at Delivered permanently
(this order is finished, unlike the old tracker that never finished
anything).

**Already rated (return visit after submitting):** the star/tag input is
replaced with a static "Thanks for rating this order" line and the stars
already chosen, shown filled but non-interactive — prevents a visitor from
re-submitting a rating for the same order, the one new idempotency state
this document adds because nothing before this issue ever had a second
write to guard against.

**Empty (no active order):** unchanged from 65's 7e — "Nothing to track yet"
plus a CTA to the home feed.

**Error:** none — same reasoning as 65 (the tracker computes from a locally
stored timestamp, never a network call); a stored order that fails to parse
is already handled by `getOrder`'s existing try/catch returning `null`,
which this document reuses rather than adding a second error path for the
same failure.

## Promo mechanic (Swoop; Portside's structural difference is named above)

The parent issue's item 4 in one sentence: applying a promo has to *feel*
better than a plain discount line, without asking for anything real (no
payment details, no personal data) and without shipping any A/B exposure
event.

- Three to four live promos exist per city at a time (content, not code —
  the analyst/engineer decide the exact enum, same handoff 72 used for its
  own promo codes). Each has a plain-language label, a value ("20% off,"
  "$5 off," "Free delivery"), and an eligibility rule (a minimum subtotal,
  or first-order-only tracked against the existing `visitorId`).
- On the home feed, any restaurant a live promo applies to carries the deal
  badge named in screen 2 — a visitor sees the deal before they've decided
  what to order, which is the "regularly lands better-than-expected deals"
  feeling item 4 asks for, rather than a promo that only appears once you've
  already committed to checkout.
- At checkout, the **best eligible promo for the current cart is
  pre-selected automatically** — zero required taps to get the discount, the
  same "reachable in one tap" guarantee every other field on this screen
  already keeps. A `PresetChoiceGroup` (existing component, reused) beneath
  it lists every *other* eligible promo so a visitor can compare and switch,
  each chip showing its own savings figure computed against the current
  cart rather than a flat label, so "20% off" and "$5 off" are directly
  comparable in the same currency.
- **The celebration moment:** the instant a promo is applied — pre-selected
  on load, or switched by hand — the discount line and the new total animate
  in using the existing 320ms ease-out-expo entrance (no new motion system),
  and the "You saved $X" sub-line briefly increases weight/size for one beat
  before settling (a named, subtle emphasis — not a confetti burst, which
  would be a new visual language this site doesn't otherwise have). Removed
  entirely under `prefers-reduced-motion: reduce`: the discounted total and
  savings line simply appear in their final state, matching this site's
  existing reduced-motion rule everywhere else.
- Nothing here is an experiment: one deterministic "best eligible promo"
  computation, no assignment to an arm, no exposure event — built so a real
  A/B test could later replace "the best one" with "the assigned one"
  without changing any of the surrounding UI, which is the parent issue's
  explicit ask ("design so one could be added later, but ship no arms or
  exposure event").

## Demo disclosure

Not solely the `/about` link (the parent issue and this issue's AC5 both name
this explicitly). A specific, persistent UI element — a bordered callout box
in `--color-surface` with a `1px` `--color-border` border and a small icon,
visually distinct from ordinary body copy the way a warning or info box is in
any real product — carrying exactly this copy: **"This is a demo. No payment
is taken and no food is sent."** with a small "What we log, and why →" link
continuing to `/about` for anyone who wants the longer version.

Appears on exactly two screens, at minimum, per AC5: **checkout** (above the
"Place order" CTA — the same placement precedent 65/72 already used for their
own privacy line, kept because it's still the moment a visitor's guard is up)
and **the tracker's Delivered state** (above the rating prompt — the moment
a visitor might otherwise believe food is actually en route to them, which is
exactly the honesty risk the parent issue names by name: "a realistic app
that takes an order and shows 'Delivered' can mislead a real person").

## Money, named for the engineer rather than solved here

This role has no write access to `src/lib`, and the parent issue's own "For
the orchestrator" section already flags this as the engineer's problem to
solve, not the designer's — naming it here is so the flow above isn't
silently assuming a representation nobody has checked:

- `priceCents` (today's shape) assumes a currency with a fractional minor
  unit. VND has none in ordinary use — prices are whole numbers in the
  thousands or millions. Whatever replaces it needs to represent SF prices
  in cents and HCMC prices in whole đồng without forcing one currency's
  shape onto the other.
- Every price and total in this flow displays via `Intl.NumberFormat` with
  the city's own locale and currency (`en-US`/`USD` for SF, `vi-VN`/`VND` for
  HCMC) rather than a hand-built string — this is what makes "₫45,000" happen
  correctly (thousands separator, no decimal places, symbol placement) without
  this document or the engineer hard-coding either convention.
- The existing `subtotal_cents` event-prop bound (100000, i.e. $1,000) is far
  too low for VND subtotals and is the analyst/engineer's fix, not this
  document's — named here only so the mock's own HCMC prices below aren't
  mistaken for a proposal that the bound already covers them.

## Photos

License-clean, named per category rather than left for whoever builds this to
guess:

- **Restaurant hero images, SF cuisines:** Unsplash search "modern taqueria
  interior," "neighborhood pizzeria interior," "dim sum restaurant interior" —
  one licensed photo per SF restaurant in the mock's catalogue.
- **Restaurant hero images, HCMC cuisines:** Unsplash search "vietnamese
  street food stall," "banh mi shop vietnam," "com tam restaurant vietnam."
- **Dish thumbnails, SF:** Unsplash search "tacos close up," "pizza slice
  close up," "dim sum bamboo steamer."
- **Dish thumbnails, HCMC:** Unsplash search "pho bowl close up," "banh mi
  sandwich close up," "vietnamese broken rice plate."
- **City cards (location picker):** Unsplash search "san francisco street
  golden gate," "ho chi minh city street motorbikes."

All of the above are searches against Unsplash's own license (free to use,
attribution not legally required) rather than a specific photographer's work
picked in advance — the engineer picks the actual image per query at build
time. Attribution is recorded anyway, as good practice rather than a legal
requirement: a `docs/design/80-photo-credits.md` file, one line per image
(photographer name, Unsplash photo URL, which screen/slot it fills), created
by whichever role first commits an actual image file — this document only
names the categories and the searches, since no photo is committed by a
designer with no write access to `src/`.

**Image-weight budget for the home feed:** the initial render (one promo
banner image + up to six visible restaurant card thumbnails, phone width) is
budgeted at **900KB of image weight total**, each restaurant thumbnail
individually capped at **40KB** as a properly sized, compressed WebP/AVIF —
checkable by an engineer against the built page's network panel or a
build-time size assertion, whichever this repository already has a pattern
for. Anything below the fold (restaurant cards beyond the first six) loads
lazily, so the budget covers only what a visitor's first paint actually
downloads.

## Nav

`Header.astro`'s reshape-at-480px pattern is unchanged structurally. Its
destination list changes from **Restaurants, Cart, Tracker** to **Home, Cart,
Tracker** (matching the merged home-feed screen replacing `/restaurants`),
and it gains one new element not present in 65/72: the **location bar** — a
small pill showing the current city name with a chevron, sitting beside the
wordmark on desktop and directly under the slim phone header on mobile (not
inside the tab bar — the tab bar's three destinations stay exactly 3-of-3,
and a fourth item would break the "3-5 destinations" range research already
covered rather than genuinely need a fourth destination, since switching
cities is a rare action, not a primary nav item). Tapping it reopens the
location picker (screen 1). Cart badge is unchanged.

## Components (named once, reused everywhere they appear)

- **LocationPicker** — the modal sheet from screen 1. States: happy
  (two cards, neither pre-selected), storage-blocked (inline notice added).
- **LocationBar** — header element, current city + chevron. Never renders
  before a city is chosen (the app shows the picker first, so this always
  has a value once it renders).
- **RestaurantCard** — photo, name, rating, ETA, delivery fee, deal badge
  (badge only rendered when a live promo applies — never an empty pill).
- **MenuItemRow** — photo thumbnail, name, description, price, Add button /
  quantity stepper / disabled "Sold out" label. States: available,
  added (stepper), sold-out.
- **PriceBreakdown** — subtotal, delivery fee (struck through + "Free" when
  zeroed), service fee, discount line (conditional), total. Used on cart
  (preview) and checkout (full). Must never show a discount line with no
  selected promo — that state doesn't exist in this flow.
- **PromoChipGroup** — built on the existing `PresetChoiceGroup`, one chip
  per eligible promo plus disabled chips for ineligible ones (with their
  reason inline, per Checkout's error state), always exactly one selectable
  chip active or none if no promo qualifies.
- **DemoDisclosure** — the bordered callout from its own section above.
  Fixed copy, two fixed placements (checkout, tracker-delivered). Never a
  bare link standing in for it.
- **TrackerStep** — unchanged in role from 65: label, filled/unfilled/
  current visual state, `aria-current` on the current step only. Now five
  possible instances instead of four.
- **RatingPrompt** — five-star input, optional preset tag chips, Submit.
  States: unrated (interactive), already-rated (static, filled stars, no
  inputs).
- **CartBadge** — unchanged from 65/72.

## The mock

Four self-contained files, each hardcoding Direction Swoop's tokens (light
theme only — dark is a straight token swap, the same convention 65/72 both
used, not re-proven here) and one city's currency, so the two required
comparisons (SF vs. HCMC, at a screen level) are four separate files rather
than one file switching state, per this repository's own `docs/memory/
designer.md` lesson: a rendered screenshot is viewport-sized, not full-page,
so a mock stacking multiple full screens risks the later ones never
appearing in the picture at all. One screen per file avoids that outright
rather than fighting it with spacing:

- `docs/design/80-home-sf.html` — home feed, San Francisco, USD.
- `docs/design/80-home-hcmc.html` — home feed, Ho Chi Minh City, VND.
- `docs/design/80-checkout-sf.html` — checkout with a promo applied, San
  Francisco, USD.
- `docs/design/80-checkout-hcmc.html` — checkout with a promo applied, Ho
  Chi Minh City, VND.

Each rendered at both widths with `scripts/design-render`, eight PNGs total,
committed alongside.

## Critique, after opening the rendered pictures (three passes, not one)

The mocks went through three real rounds of "render, look, fix" — recorded
here as what actually happened, not what I expected going in, because the
first two guesses in that process were wrong in specific, checkable ways.

- **Round 1 finding: the cuisine-shortcut row clips its last chip flush
  against the viewport edge, both widths, both cities** ("Bakery" / "Chè" cut
  mid-word with no visual cue that the row scrolls further). An abrupt clip
  reads as a bug, not a scrollable list. Fixed with a right-edge mask
  (`mask-image: linear-gradient(to right, black 88%, transparent)`) so the
  last visible chip fades rather than snapping off — confirmed in the
  re-render on both cities.
- **Round 1 finding: the promo comparison chips were unreadable.** The spec
  calls for each chip to show its label and its savings figure; the first
  render put both in one flex row with no line break, so "SWOOP20 — 20%
  offBest deal" ran together as one string. Fixed by making each promo chip
  its own flex column (label line, then a bold sub-line) — confirmed
  legible at both widths in the re-render, both cities.
- **Round 1 finding: the demo-disclosure icon rendered as an empty glyph box**
  in the headless render (`ⓘ`, U+24D8, isn't covered by the environment's
  default font) — a real finding a text-only read of the markup would never
  catch, which is the entire argument for opening the picture rather than
  trusting the HTML. Replaced with an inline SVG (a circle, a stem, a dot)
  for the info icon and the same treatment for the discount line's tag icon,
  which had been relying on an emoji glyph with the identical risk. Both
  render correctly in the re-render, both cities.
- **Round 1 finding: the checkout mocks omitted the fixed bottom tab bar**
  that the real page will actually have (`Header.astro`'s phone nav), so the
  first pass proved nothing about whether "Place order" clears it. Added the
  tab bar to both checkout files before judging the narrow render at all —
  the omission would have been the same mistake 65/72's own critique
  sections warn against: comparing a mock to a page it doesn't actually
  represent.
- **Round 2 finding, and the real version of the "Place order clips" risk:**
  once the tab bar was added *and* the promo chips became two-line stacks
  (the round 1 fix above), the narrow checkout render clipped before "Place
  order" on both cities — the same failure shape 65 and 72 both hit, arrived
  at for a new reason each time. Fixed by tightening what was actually
  costing the space: chip min-height 36px→32px, chip padding tightened,
  section-title top margin `--space-md`→`--space-sm`, the promo chip's own
  padding reduced, and the breakdown rows' vertical padding 3px→2px. Did
  **not** cut a field or a state to make room — the fix is spacing, not
  scope. Re-rendered until "Place order," the discount line, and the demo
  disclosure were all visible with no scroll, both cities.
- **Round 2 finding: the header's location bar wrapped onto three lines at
  desktop width** ("San / Francisco / ▾") once the wide layout put it inline
  next to the wordmark and nav links — it had been sized only for its
  original stacked-on-phone layout. Fixed with `white-space: nowrap` and
  `flex: none`. Confirmed in the re-render that "Ho Chi Minh City ▾," the
  longer of the two city names, also stays on one line at desktop width,
  which is the actual test the fix has to pass, not just the shorter name.
- **Round 2 finding: the phone tab bar stayed visible at desktop width**,
  overlapping the home feed's own top nav links, because the CSS rule
  hiding it at ≥481px was declared *before* the tab bar's own base styles in
  source order and lost the cascade to a later, unconditional rule. This
  wasn't a design decision to re-argue, it was a bug in the mock's own CSS —
  fixed by moving the hide rule after the base rule it overrides, and
  confirmed in the re-render that wide shows the top nav only and narrow
  shows the tab bar only, on both home feed files.
- **Round 3, the corrected reading — checkout, wide, both cities:** the eye
  lands on "CHECKOUT" first (the largest, boldest thing on the page, as it
  should), then on the filled violet "SWOOP20 — Best deal" chip as the first
  solid block of color the eye crosses scanning down, then on the bold
  violet discount/total figures at the bottom. This is a *correction* to an
  earlier draft of this section, which claimed the promo group was
  "structurally the second thing seen" — it isn't; three preset-choice
  sections (drop-off, instructions, utensils) sit above it. What survives
  the correction is the actual point: the promo is still the first and only
  *colored* thing the eye crosses before the total, which is what Direction
  Swoop's "structural idea" argued for, and that part held up under
  re-reading the picture rather than the earlier assumption.
- **Checkout, narrow, both cities (final):** drop-off, delivery instructions,
  utensils, all three promo chips with the ineligible one's reason text,
  the full price breakdown including "You saved $X.XX" / "Bạn đã tiết kiệm
  X ₫", the demo disclosure, and the complete "Place order" / "Đặt đơn"
  button are all visible with no scrolling past the tab bar, on both cities.
- **Home feed, wide, both cities:** blurring my eyes, the composition that
  survives is nav row / search / one promo banner / restaurant cards in a
  column — the single-banner discipline from the Grab-banner critique above
  reads correctly: nothing on the page competes with the cards for attention
  the way a five-banner carousel would.
- **Home feed, narrow, both cities:** the location bar, search field, promo
  banner, and first two restaurant cards (each with its deal badge) are
  visible without scrolling.
- Covering `--color-accent` with my hand on both checkout renders: the
  discount line still reads as distinct from an ordinary breakdown row from
  its bold weight and its tag icon alone — checked deliberately, since a
  discount line is exactly the kind of element that quietly ends up
  color-only if nobody checks.
- **The HCMC total ("395.000 ₫") does not wrap at either width** — worth
  recording as a non-finding rather than silently deleting the question,
  since a six-figure VND number next to an SF two-figure dollar total was a
  real risk going in. It didn't materialize because the total's line is
  allowed to size to its content rather than sitting in a fixed-width
  column; no fix was needed here, unlike every other item in this list.
- What I'd remove if forced to cut one thing: the cuisine shortcut chip row
  on the home feed. It stayed because it's the fastest way a returning
  visitor narrows the feed without typing, and removing it would leave
  search as the only filter — a real regression against "in the register of
  Grab," which has both.

## The owner's question

Posted as its own issue comment (not decided in this document): which brand
direction — Swoop or Portside — the site takes. Recommendation: Swoop, for
the reason given above (item 4's "emotional centrepiece" is a feeling, and
Swoop's structure is built to produce it rather than hope a discount line
does). Proceeding under Swoop for the mock and for every following child
issue unless the owner answers otherwise.

## No ADR

The color-token rebrand is a style change within a category already chosen
(this site already has a token-based light/dark palette; a new set of hex
values inside that same mechanism is not a new category, the same test
house-rules asks: "would somebody reversing this need to know why, or only
that it happened?" — only the latter, here). Nothing here adds a dependency
or a service. The event-contract and schema changes the parent issue's "For
the orchestrator" section names are the analyst's ADR to write against the
migration it implies, not this document's.
