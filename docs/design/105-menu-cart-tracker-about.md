# Mocks for the menu, cart, order placed, tracker and /about

Spec for issue #105, serving parent objective #103. Applies the system
`docs/design/80-two-city-brand-and-flow.md` and `docs/design/87-promo-offers-and-flash.md`
already chose — violet `#6C3CE0`/`#B79CFF`, the lowercase weight-split
wordmark, pill/rounded shapes, the shared type scale — to the five screens
#103 names as built with no visual target, plus the cart's new per-restaurant
shape the owner set directly on this issue (2026-09-27).

## The outcome, the constraints, the guesses

**Outcome (fixed, from #103 and this issue):** the restaurant menu page,
cart, order placed, tracker and /about read as the same app as the home and
checkout mocks — same pills, radii, type scale, chips, buttons and section
headings — rather than the placeholder hero / giant heading / square-Add
shape #103 found live. The cart additionally gets the shape the owner
described on this issue: one cart per restaurant with no combined cart, a
"Your carts" list when two or more exist, and removal by swipe-left or by a
confirm modal at qty 1 — never a plain Remove button on the row.

**Constraints (checked against the code and #80/#87's merged docs, not
assumed):**

- Every token below — `--font-size-h1/h2/nav-title/body/muted`,
  `--space-xs` through `--space-xxl`, the violet palette, `--color-tab-active-bg`
  — is copied verbatim from `80-home-sf.html`'s `:root` block, not
  re-derived. This is also what criterion 2's grep checks: a one-off value
  anywhere in these files would be a value nothing upstream chose.
- `Header.astro`'s reshape-at-480px pattern (top nav on desktop, fixed
  bottom tab bar on phone) is reused exactly, including the fix already
  landed for the CSS-order bug #80's critique found (the hide-at-desktop
  rule stays after the tab bar's base rule).
- The five screens' *content* is fixed by `src/lib/restaurants.ts`,
  `order-store.ts` and `tracker-state.ts`, checked directly rather than
  invented: real dish names/prices/sections for Mission Taqueria (SF) and
  Bến Thành Bánh Mì (HCMC), the five-stage tracker
  (Placed → Preparing → Picked up → On the way → Delivered), and the
  `/about` copy already shipped (unchanged prose, only its container and
  type treatment are this document's concern).
- `docs/design/46-phone-native.md`'s motion durations/easings and
  `prefers-reduced-motion` rule are reused for the swipe reveal and the
  modal's entrance, rather than a second motion vocabulary.
- No event or contract change (CLAUDE.md, "Event tracking comes last") —
  nothing below assumes a new `track()` call; it specifies markup and look
  only.

**Guesses this document is making, called out as such:**

- The exact two SF/HCMC restaurants and dishes shown are `restaurants.ts`'s
  own first two per city (Mission Taqueria + North Beach Pizzeria for SF,
  Bến Thành Bánh Mì + Sài Gòn Phở Quán for HCMC) — a real, checkable choice,
  not an invented catalogue, but which two of the several available is this
  document's pick for a legible two-card "Your carts" list.
- The swipe-reveal's width (88px) and the modal's exact copy layout are a
  plausible instance of the owner's spec, not a value anyone measured.
- Order placed and the tracker show no price or currency-formatted amount on
  screen (checked against `order-placed-dom.ts`'s and `tracker-dom.ts`'s
  actual copy shape below), so this document treats them as **not**
  city-specific content under criterion 1 and ships one file each rather
  than two — the only per-city difference would be the restaurant's name,
  which is a text substitution, not a shape a reviewer needs to compare
  arithmetic against (unlike checkout, which #80 duplicated because its
  totals genuinely differ). Menu and cart *do* show prices in two different
  currencies and are duplicated per criterion 1.

## Look at what's there today

`./scripts/app-render` now builds and serves (fixed since #100/#101, unlike
the refusal #80/#87 both hit):

- **`/restaurants/mission-taqueria`, 375px:** the wordmark and tab bar
  already carry the corrected rounded system (#109 landed first), and dish
  rows already show a rounded 84px photo tile and a pill "Add" button — the
  per-component shapes are closer than #103 implied. What's still wrong is
  composition: a full-width, edge-to-edge hero reading "Placeholder /
  Mission Taqueria" in large black type dominates the top of the screen
  before any real content, the restaurant name repeats immediately below it
  at a similar weight with nothing to distinguish page title from hero
  caption, section headings ("Tacos", "Sides") are plain unstyled bold text
  with no muted treatment, and there is no persistent cart-summary bar above
  the tab bar at all.
- **`/cart`, `/tracker`, 375px, empty state:** both are close to the target
  already — rounded "Browse restaurants" button, the wordmark, the tab bar —
  because the empty state is short enough that #109's global fixes cover
  it. Neither has any populated-state markup to compare against: `/cart`
  has never rendered a line item, a per-restaurant grouping, or a remove
  affordance of any kind, and `/tracker` has never rendered a step or a
  rating prompt in this render (order-placed also didn't resolve to a
  populated state in this environment — no order is stored to render
  against — so this document works from `src/lib/order-store.ts`'s
  `PlacedOrder` shape and `docs/design/80-two-city-brand-and-flow.md`'s
  "Order placed" and "Tracker" sections directly, rather than a render
  nothing here can produce).
- **`/about`, 375px:** default long-form HTML — a large serif-looking `h1`,
  unstyled bullet list, no wordmark treatment, no card or callout around any
  paragraph. Reads as unstyled prose next to the mock system's rounded,
  violet-accented pages.

## Look outside this repository

- **A 2026 roundup on destructive-action UI ("Delete Button UI: Best
  Practices").** Its two live findings: keep a clear buffer between a
  destructive control and ordinary controls (never let a delete affordance
  sit flush against something else on the row), and don't let tapping delete
  jolt the row's own layout by expanding an inline confirm cluster inside
  the text area. I'm taking both directly — the swipe-revealed "Remove" is
  its own fixed-width panel to the row's right rather than text squeezed
  into the row, and the confirm modal is a separate overlay rather than an
  inline expansion of the row.
- **Current iOS/Material guidance on swipe-to-delete, surveyed across a few
  2026 implementation write-ups.** The recurring point: the deliberate swipe
  gesture is treated as the confirmation itself, so a swipe-revealed action
  fires immediately on tap rather than opening a second confirm. I'm taking
  that as the reason the two removal paths the owner specified behave
  differently — swipe-then-tap-Remove needs no dialog, tap-minus-at-quantity-1
  does — rather than reading the two paths as an inconsistency to fix. I'm
  refusing the same sources' "always show a visible bin icon too, gestures
  alone aren't discoverable" advice, because the owner's spec on this issue
  already names the two affordances and a third one isn't this document's to
  add.
- **General 2026 food-delivery UX coverage of the cart/checkout screens.**
  Nothing surveyed documents a multiple-restaurant-cart pattern specifically
  — worth recording as a real gap rather than pretending a reference
  covers it. The "Your carts" list below is built from first principles
  against the owner's own description on this issue (one card per
  restaurant: name, item count, subtotal), not against a borrowed pattern.

## New tokens this document introduces

One new color role, needed for the swipe reveal and the remove-confirm
button — neither #80 nor #87 needed a danger color, so nothing existing
covers it. Checked, not estimated, with `./scripts/contrast <fg> <bg> 4.5`,
light theme only (the mock convention #80/#87 both use — dark is a token
swap, not re-proven here):

| Pair | Context | Ratio | Passes 4.5:1? |
|---|---|---|---|
| `#FFFFFF` on `--color-danger` (`#C22C3C`) | swipe-reveal label, remove-confirm button | 5.65 | yes |
| `--color-danger` (`#C22C3C`) on `--color-bg` (`#FBF7FF`) | unused directly, checked for completeness | 5.34 | yes |
| `--color-danger` (`#C22C3C`) on `--color-surface` (`#F7F1FF`) | unused directly, checked for completeness | 5.10 | yes |

`--color-danger` is clear of every real brand hue #80's own check already
ruled out (nearest is DoorDash's `#FF3008`, which this is not — it's a
cooler, less saturated red chosen to sit apart from that specific check).

## The flow — what's added on top of #80/#87's existing flow document

### 3. Restaurant / menu (`/restaurants/<slug>`) — composition fix, no new states

Same states #80 already specified (available, added, sold-out, no error).
What changes here is composition, not content:

**Happy:** a contained (not edge-to-edge) hero photo tile, `160px` tall,
rounded `12px`, sitting inside `main`'s own padding rather than bleeding to
the viewport edge. Below it: the restaurant name at `--font-size-h2` weight
800 (the same weight/size the wordmark's strong half and the checkout
`<h1>` use — never the old giant `h1`), then one muted meta line (cuisine ·
rating · ETA, reusing `.restaurant-meta`'s exact treatment from the home
mock). Section headings ("Tacos", "Drinks") use `h2.section-title` at
`--font-size-h2` weight 700 — the home feed's own treatment for "Near you,"
reused rather than invented, since this page is a primary destination like
the feed rather than a settings-style subsection like checkout's muted
titles. Each dish row reuses `.photo-placeholder` unchanged (84px, `10px`
radius — the same class and the same size as the home feed's restaurant
thumbnail, which is what criterion 3 asks for), name, one-line description,
price, and an Add button that is a filled pill (`999px`, accent fill, white
text) — never a square. A persistent cart-summary bar (item count, subtotal,
"View cart") sits fixed directly above the tab bar on phone.

**Sold-out (unchanged in role from #80):** photo and description stay,
the Add pill is replaced with a `--color-text-muted`, non-interactive
"Sold out" label in the same pill shape — muted, not hidden, so the row's
height doesn't jump.

**Added (unchanged in role):** the Add pill becomes a stepper — a rounded
`999px` pill holding `−`, a count, `+` — the same stepper this document
reuses on the cart's own line items, so the two rows read as one component
rather than two.

### 4. Cart (`/cart`) — the owner's new per-restaurant shape

Replaces #80's single combined-cart section entirely; #80's own cart section
is superseded by this one, the same way #87 superseded #80's promo section.

**Two or more restaurants' carts (new — "Your carts" list):** one card per
restaurant: name, "N items", subtotal in that cart's own currency, a
chevron, the whole card tappable to open that restaurant's cart. Cards use
the same `12px`-radius surface-and-border treatment as a restaurant card on
the home feed.

**Exactly one restaurant's cart (unchanged in effect from opening a card
above, just skipping the list):** opens directly onto that restaurant's
cart. Its heading is the restaurant's own name (no "(Restaurant)" suffix on
any line item — every line already belongs to this one restaurant, so
repeating its name would be the same redundancy #80's own Offers-row
critique already removed once). Below the heading: one `.swipe-row` per line
item (photo thumbnail reusing `.photo-placeholder`, name, quantity stepper,
line total), then the breakdown preview (subtotal, delivery fee, "+ service
fee and any discount at checkout"), then "Go to checkout" scoped to this
restaurant only.

**Removing a line — two paths, no Remove button on the row:**

1. **Swipe left** on a row slides its content left to reveal a fixed
   `88px`, `--color-danger`-filled "Remove" panel behind it, sitting at the
   row's **right** edge (the gesture is named for the direction the
   content moves, not for the side the panel sits on) — this document
   mocks exactly one row in this state, per the "look outside" section's
   finding that the gesture itself is the confirmation, so tapping the
   revealed panel removes the line with no further dialog.
2. **Tap `−` at quantity 1** opens a confirm modal — a scrim over the page,
   a centered sheet: "Remove {dish}?", "It'll be taken out of your
   {restaurant} cart.", a neutral "Cancel" pill and a `--color-danger`-filled
   "Remove" pill. This is the path that gets the dialog, precisely because
   tapping `−` isn't itself a deliberate removal gesture the way a swipe is.

**Empty (unchanged in shape from #80):** one line, "Nothing in your cart
yet.", CTA back to the home feed — this state doesn't change when a cart
becomes empty by having zero restaurants' carts rather than zero lines in
one cart; the same message covers both.

**Error:** none — local-storage read, same reasoning #80 already gave for
this screen.

### 6. Order placed (`/order-placed`) — composition fix, no new states

Unchanged in role and copy from #80: one line summarizing the order (now
"Your order from {restaurant} is on its way." — a single restaurant, always,
since a placed order is one restaurant's checkout) and a "Track your order"
CTA pill. What this document fixes is that it now sits inside the shared
type scale (`--font-size-h2` heading, not a giant one) with the wordmark
above it exactly as checkout renders it, rather than whatever default
heading size the unmocked page carried before.

### 7. Tracker (`/tracker`) — composition fix, no new states

Unchanged in states from #80 (happy, refresh/return, already-rated, empty,
no error). This document adds the one thing #80 specified but never
rendered: the five-step vertical stepper itself (`TrackerStep`, filled /
current / unfilled, `aria-current` on the current step only), and the
`RatingPrompt` at Delivered — five tappable stars, three optional preset tag
chips, a Submit pill enabled once a star count is picked. The demo
disclosure (unchanged component from #80) sits directly above the rating
prompt, per #80's own placement rule.

### /about — composition fix only

The prose is unchanged — this document doesn't touch copy the analyst or the
owner didn't ask to change. What changes: the wordmark appears at the top in
the same treatment every other screen uses, the heading drops to
`--font-size-h2` (matching every other page's title, never a large default
`h1`), and the closing "one more thing" paragraph about the IP-hash spam
limit moves into the same `.disclosure` callout component checkout already
uses for its demo notice — it is, after all, the same kind of
"here's a fact about this page you might not expect" callout, and reusing
the component is more honest than inventing a second one that looks
slightly different for no reason.

## Components (named once, new or changed from #80/#87)

- **MenuHero** — contained `160px` photo tile, `12px` radius, never
  edge-to-edge.
- **CartsList** — one card per restaurant with an open cart: name, item
  count, subtotal, chevron. Only rendered when two or more restaurants have
  a cart; skipped straight to `RestaurantCart` otherwise.
- **RestaurantCart** — one restaurant's line items plus its own breakdown
  preview and its own "Go to checkout." Heading is the restaurant's name,
  no suffix.
- **SwipeRow** — wraps a cart line item. States: closed (default), open
  (content shifted left, `--color-danger` "Remove" panel revealed at the
  row's right edge). Tapping the revealed panel removes the line with no
  further dialog, per the "look outside" finding above.
- **RemoveConfirmModal** — scrim + centered sheet, reached only from tapping
  `−` at quantity 1. Fixed copy shape: "Remove {dish}?", "It'll be taken out
  of your {restaurant} cart.", Cancel (neutral) / Remove (danger-filled).
- **CartSummaryBar** — item count, subtotal, "View cart," fixed above the
  tab bar on phone / at the foot of content on desktop. Only rendered on the
  restaurant/menu screen.
- **TrackerStep** — as #80 named it, now actually rendered: label,
  filled/unfilled/current, `aria-current` on the current step only.
- **RatingPrompt** — as #80 named it, now actually rendered: five-star
  input, optional preset tag chips, Submit (enabled once a star is picked).
- **Disclosure-as-about-callout** — the existing `DemoDisclosure` component
  reused verbatim for /about's spam-limit paragraph, not a new component.

## The mocks

Ten self-contained files, light theme only, one screen-state per file (the
`docs/memory/designer.md` viewport-render lesson — a mock stacking several
full states risks the later ones never appearing in a 375×812 screenshot):

- `docs/design/105-menu-sf.html` — Mission Taqueria, USD, one sold-out item,
  one added-to-cart item, cart summary bar.
- `docs/design/105-menu-hcmc.html` — Bến Thành Bánh Mì, VND, same states.
- `docs/design/105-cart-list-sf.html` — "Your carts," two SF restaurants.
- `docs/design/105-cart-list-hcmc.html` — "Your carts," two HCMC restaurants.
- `docs/design/105-cart-single-sf.html` — Mission Taqueria's own cart, one
  row swiped open.
- `docs/design/105-cart-single-hcmc.html` — Bến Thành Bánh Mì's own cart,
  one row swiped open.
- `docs/design/105-cart-remove-modal.html` — the confirm modal open over a
  single restaurant's (unswiped) cart. Not duplicated per city: its copy
  substitutes a dish and restaurant name and shows no price or currency, so
  a second render would be the identical anatomy #87's own "no re-render"
  precedent already covers.
- `docs/design/105-order-placed.html` — one restaurant, no per-city
  duplication for the reason given under "Guesses," above.
- `docs/design/105-tracker.html` — Delivered state, rating prompt
  interactive, no per-city duplication for the same reason.
- `docs/design/105-about.html` — no per-city content at all.

Twenty PNGs total (ten files × two widths), committed alongside.

## Critique, after opening the rendered pictures

- **Real finding: the swipe-revealed row clipped its own photo tile.** The
  first pass built the "open" state with `transform: translateX(-88px)` on
  the row's content inside an `overflow: hidden` wrapper — the standard way
  to *animate* a swipe. Rendered, it clipped almost the entire 84px photo
  tile off the row's left edge, because translating the whole row left by
  more than the tile's own width pushes the tile past the container's left
  boundary, which `overflow: hidden` then clips permanently rather than
  scrolling. A text-only read of the markup gave no hint of this — the bug
  only exists once a browser actually paints it. Fixed by rebuilding the
  open state as a flex layout instead: the action panel is a normal flex
  sibling taking a fixed 88px, and the content sibling takes the remainder
  (`flex: 1`) rather than translating anywhere. Nothing clips, because
  nothing moves outside its own box. Confirmed in the re-render, both
  cities.
- **Second-order finding from the same fix: the narrower "open" row then
  clipped its own price.** Once the content column lost 88px to the action
  panel, the stepper and price no longer fit on one line and the price ran
  off the right edge. Fixed by moving each line's price under its stepper
  (a `flex-wrap: wrap` row) instead of beside it — both wrap cleanly at the
  narrower width and neither clips, confirmed in the re-render.
- **Driver review, revision round 1: the flex-sibling fix above put the
  panel on the wrong side.** Making the action panel and the content div
  flex siblings (rather than a clipped, translated single box) fixed the
  clipping, but the two divs were written action-panel-first, and a flex
  row places its children in source order — so the danger panel rendered
  at the row's *left* edge, against both this spec's own wording ("slides
  its content left to *reveal*") and #113's shipped behaviour. Fixed by
  reordering the markup (content div first, action panel second) rather
  than adding `order` or any positioning property — the same flex layout,
  read the other way round. Between the review's two offered options —
  clip the photo tile partway off the left edge to mimic a mid-swipe
  translate, or keep the content fully visible — this took the fully
  visible option: reintroducing any clipped or translated edge is exactly
  what the first finding above spent an iteration removing, for a mock
  that only ever shows the row at rest in its open state, never mid-drag.
  The same review also caught the price sitting in two different places
  between the open row (wrapped under the stepper, from the finding above)
  and the closed rows (still beside the stepper, flush right, because they
  had the width to fit it there) — the two states read as different rows
  rather than the same row in two states. Fixed by dropping the
  `flex-wrap`/`justify-content: space-between` trick and giving every
  `.cart-line-row` a plain `flex-direction: column`, so the price sits
  under the stepper on every row, open or closed, narrow or wide, with no
  dependence on how much width happens to be left. Re-rendered all four
  pictures (SF/HCMC × wide/narrow); confirmed by eye and re-grepped for
  `left` describing the panel's side (none left uncorrected — the two
  remaining "left" occurrences in this document, in the SwipeRow bullet
  above and "Removing a line" §5, both name the gesture's direction and
  now say explicitly that the panel itself sits at the row's right edge).
- **Checked deliberately: which tab reads as "current" on a screen that
  isn't one of the three destinations.** The restaurant/menu screen marks
  Home current (it's reached from the feed); the cart screens mark Cart
  current; the tracker marks Tracker current; order placed and /about mark
  none, since neither is genuinely any of the three and guessing one would
  be a claim nothing in the flow supports.
- **Grep-checked, all ten files:** every `border-radius` value across the
  set is one of `10px`, `12px`, or `999px` (the exact values `80-home-sf.html`
  and `80-checkout-sf.html` already use), and every heading/body/muted size
  is one of the shared `--font-size-*` tokens — no one-off value anywhere.
  One was caught and fixed by this check: the remove-confirm modal's sheet
  first used `16px`, a value nothing else in the system uses; changed to
  the system's own `12px` card radius and re-rendered.
- **Checked, all ten narrow renders:** the tab bar (or, on the two screens
  that skip it, the last piece of on-screen content) is fully visible with
  no overlap, and nothing before it clips mid-line — the menu, cart, and
  tracker mocks all carry enough content to run past one viewport's height,
  which is expected scrolling content rather than the clipping criterion 3
  asks about (checked by confirming the cut is between rows/paragraphs, not
  through one).
- **Real finding: the "Your carts" list and the single-restaurant cart
  disagreed on Mission Taqueria's own subtotal** ($13.75 on the list card,
  $15.00 once the same restaurant's own line items are added up) — an
  inconsistency a reader comparing the two files side by side would catch
  immediately, and exactly the kind of thing this pass exists to find
  before they do. Fixed by changing the list card to $15.00, matching the
  single-cart file's real arithmetic; the HCMC pair already agreed
  (65.000 ₫ in both) because those two files were written from the same
  numbers the first time.
- **Covering `--color-danger` with my hand** on the swiped row and the
  modal: "Remove" still reads from its own trash icon and bold weight, not
  from the red fill alone — the fill is reinforcement, not the only signal.
- What I'd remove if forced to cut one thing: the "Your carts" list's
  chevron. It stayed because every other tappable row in this system
  (a restaurant card, an Offers-screen voucher row) already implies
  tappability from its own layout without a chevron, and adding one here
  is the one inconsistency in an otherwise-reused vocabulary — but cutting
  it risks a two-restaurant list reading as two static summaries rather
  than two links, which is worse than one small inconsistency.

