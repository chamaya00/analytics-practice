# Promo carousel, header city pill, restaurant tile grid

Parent: #133. Reverses `docs/design/80-two-city-brand-and-flow.md`'s "exactly
one banner slot, not a carousel" decision (~line 359, under "Look outside this
repository") **on the owner's instruction**, recorded on #133 and repeated
here rather than re-argued: #80 chose one banner because a 2026 banner-design
case study found dense, high-saturation carousels get tuned out. The owner
has since compared this feed to Grab's home screen and decided the
single-slot banner reads as *too little* merchandising for what this product
is meant to teach — a carousel is going back in, with the one piece of #80's
finding that still holds carried forward on purpose: the "Ad" label. #80's
worry was banners nobody reads as ads; the fix there was fewer banners, the
fix here is one banner clearly marked when it's paid for. Same finding,
opposite lever.

## Outcome, constraints, guesses (design-craft)

**Outcome (fixed):** the home feed reads as a food-delivery app, not a
settings list, on first paint at 375px, in both cities and both themes.

**Constraints (checked, not assumed):**
- `.restaurant-card` is reused by the cart list (`cart-dom.ts` ~599) and the
  flash sheet (~1473) — confirmed by reading both call sites. The tile gets
  its own class.
- `image-budget.test.ts` caps the home feed's first-paint image weight at
  900KB, currently computed as the first six restaurant `heroImage`s
  (`RESTAURANT_THUMBNAIL_MAX_BYTES` = 180KB each, `fetch-photos.mjs`'s own
  cap). A carousel slide that shows a seventh, seen-before-the-fold image
  changes what "first paint" has to include — see "Image budget," below.
- `renderFeed()` re-runs on every city switch (location bar → picker →
  `renderFeed`, `home-dom.ts` ~209-215). Anything with a timer has to survive
  that or it leaks (parent issue's own "traps" section; also flagged in
  `docs/memory/designer.md`'s spirit even though that file has no carousel
  lesson yet).
- Tracking: `home_viewed` and `restaurant_opened` keep firing unchanged. No
  `track()` calls, contract edits, or migrations here — CLAUDE.md's "event
  tracking comes last" rule, restated on #133 itself. Slide impressions and
  taps go unlogged until a readiness objective.

**Guesses I'm resolving, stated as guesses:**
- **Slide order.** #133 doesn't specify one. I've alternated
  first-order → ad → promo → ad → promo → ad → promo, so the carousel never
  runs two ads back to back on a short attention span (see "Carousel," below,
  for the full sequence). A different order is a one-line change and not
  worth a question.
- **The cuisine tag is dropped from the tile.** The current row shows
  `cuisineTag · ★ rating (count)` on one line at full card width (~295px of
  text room at 375px). A tile is roughly 160px wide — see "Two-column tile
  grid" for the arithmetic — and cuisine + rating + count was the line most
  likely to wrap or clip under a long HCMC name. Cuisine stays reachable via
  the shortcut chips directly above the grid, so nothing becomes
  undiscoverable; the tile itself shows the two numbers that actually
  differentiate one photo-led card from its neighbor (rating and ETA/fee),
  which is also what the two web references below independently converge on.
- **Ad-slide subline.** #133 doesn't say what an ad slide contains besides
  "clearly labelled Ad." I've given it a one-line subline (cuisine · rating)
  so it isn't just a photo and a badge — the AD carries the same information
  scent as a normal listing, which is the honest version of an ad (it's
  *labelled*, not *disguised as different content*).

## Look at what's there now

`./scripts/app-render / docs/design/shots/137-app-today <seed>` (localStorage
city, an already-expired `sessionStorage` flash draw so the sheet doesn't
cover the feed), both cities, narrow width, reviewed and then deleted rather
than committed — they're a "before," not part of this issue's deliverable,
and the mocks below are what's checkable.

Both read exactly like the parent issue's complaint. The wordmark
(`dontdropthatpromo`) sits on its own line; `San Francisco ▾` / `Ho Chi Minh
City ▾` sits on the *next* line as a free-floating pill with nothing beside
it, so the header is two short rows where one would do. Below that: a search
field, then one bordered box in the page's own type scale — "$2 off your
first order" / "10.000 ₫ off your first order," which is legible but reads
exactly like a form's help text, not a claim the page wants you to see.
Below that, cuisine chips, then a vertical list of identical rows — small
square photo on the left, three lines of text on the right, repeated five,
six, ten times. Nothing on the screen is bigger, bolder, or more prominent
than anything else; every row has the same weight, so scrolling it feels like
reading a table rather than browsing a menu. That flatness is the actual
finding, more than any one element being wrong on its own — it's what "reads
like a settings list" (#133) means in practice, and it's the thing the
carousel and the tile grid both exist to fix.

## Look outside this repository

- **[WCAG 2.2's accessible-carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/)
  and the A11Y Collective's implementation guide** — an accessible carousel
  is a landmark region, its slides are `aria-roledescription="slide"`,
  off-screen slides carry `aria-hidden`, a Previous/Next pair and a
  Play/Pause control (state-dependent name) sit with the slides rather than
  hidden in a menu, and the position indicator is a set of controls (a
  `tablist`/radio-group pattern), not decoration. I'm taking the *shape* of
  this directly into the component spec below (a visible, always-present
  pause control; dots that are real controls, not painted circles) and
  refusing the full ARIA choreography as something for the mock to draw —
  the mock names the states and controls; the engineer wires the roles, same
  as every other interactive spec in this repository.
- **DoorDash's Sponsored Brands / self-serve Sponsored Listings creative
  guidelines** (`advertising.doordash.com`) — a real delivery platform's own
  rule for paid placements: sponsored creative is a distinctly bordered
  card-in-feed, and DoorDash's own guidelines explicitly forbid a sponsored
  unit imitating the platform's native UI chrome (badges, buttons, the
  platform's own logo) so it can't be mistaken for organic content. I'm
  taking "the ad card is visually a listing, honestly labelled" directly —
  it's the same principle #80 already committed to for the single banner,
  just now applied per-slide. I'm refusing DoorDash's own palette and
  placement conventions (red-accented corner ribbon, always bottom-of-feed)
  — this app already has a direction (#80's violet) and a badge language
  (`.deal-badge`'s pill), and pasting DoorDash's would fight both.
- **Mobbin's current food-delivery card-grid samples and the "bento-style,
  photo-led, large-format tappable card" pattern surveyed across 2026
  redesigns** — the common thread across the current crop is a big photo
  doing the work a small square thumbnail can't (texture, freshness,
  appetite appeal) with a short, scannable text stack under it. I'm taking
  "photo leads, text stack is short" directly into the tile. I'm refusing
  the asymmetric/bento sizing itself (some cards bigger than others) — this
  catalogue has no signal that would justify one restaurant's card being
  larger than another's (no "featured" flag, and inventing one is exactly
  the kind of unrequested feature `CLAUDE.md` warns against), so the grid
  stays a plain, predictable 2-column grid instead.

## Direction

**Confident, photo-led, and honest about what's paid.** Not: dense,
high-saturation, or "salesy" — the thing #80's own Grab critique warned
against and that this document is not walking back. The energy comes from
photography and real typographic contrast (a slide claim and a tile name are
both bolder and a size step up from the muted meta line under them), not from
more color or motion. One accent (`--color-accent-a`) still does the
highlighting; the badge language (`--color-accent-b` fill, `--color-badge-ink`
text) is unchanged, just now also placed on tiles and (for "Ad") on slides.

## Content picked

Six restaurants per city, three for ad slides and three different ones for
promo slides, all from the existing catalogue — none invented, per #133's own
scope. Every name and every promo dish is grepped against the catalogue
source below; every restaurant is confirmed to be that city's own (`city:
'sf'` / `city: 'hcmc'` on its own record).

### San Francisco (USD)

| Slide | Restaurant | Source | Claim |
|---|---|---|---|
| Ad | Mission Taqueria | `src/lib/restaurants.ts:51` | "Ad" + "Tacos · ★ 4.6" |
| Ad | Inner Richmond Sushi Bar | `src/lib/catalogue-more.ts:136` | "Ad" + "Sushi · ★ 4.8" |
| Ad | Ocean Beach Fish House | `src/lib/catalogue-more.ts:556` | "Ad" + "Seafood · ★ 4.8" |
| Promo | North Beach Pizzeria | `src/lib/restaurants.ts:102` | "Free Garlic knots with a $20 minimum" (dish: `restaurants.ts:135`, its own "Garlic knots," $7.50) |
| Promo | Noe Valley Morning Kitchen | `src/lib/catalogue-more.ts:433` | "Buy 1 get 1 free: Buttermilk pancakes" (dish: `catalogue-more.ts:447`) |
| Promo | Valencia Street Tandoor | `src/lib/catalogue-more.ts:201` | "Free Mango lassi with a $18 minimum" (dish: `catalogue-more.ts:248`, $5.75) |

Grep used: `grep -n "name: '(Mission Taqueria|Inner Richmond Sushi Bar|Ocean
Beach Fish House|North Beach Pizzeria|Noe Valley Morning Kitchen|Valencia
Street Tandoor)'" src/lib/restaurants.ts src/lib/catalogue-more.ts` and the
same shape for the three dish names (`Garlic knots`, `Buttermilk pancakes`,
`Mango lassi`) — all six restaurants and all three dishes found, once each,
in the expected file.

### Ho Chi Minh City (VND)

| Slide | Restaurant | Source | Claim |
|---|---|---|---|
| Ad | Bến Thành Bánh Mì | `src/lib/restaurants.ts:258` | "Ad" + "Bánh mì · ★ 4.8" |
| Ad | Hủ Tiếu Nam Vang Hòa Phát | `src/lib/catalogue-more.ts:617` | "Ad" + "Hủ tiếu · ★ 4.6" |
| Ad | Quán Lẩu Út Hạnh | `src/lib/catalogue-more.ts:733` | "Ad" + "Lẩu · ★ 4.7" |
| Promo | Sài Gòn Phở Quán | `src/lib/restaurants.ts:309` | "Free Gỏi cuốn with an 80.000 ₫ minimum" (dish: `restaurants.ts:342`, its own "Gỏi cuốn," 40.000 ₫) |
| Promo | Bún Chả Cô Ba | `src/lib/restaurants.ts:411` | "Buy 1 get 1 free: Bún chả Hà Nội" (dish: `restaurants.ts:425`) |
| Promo | Bò Bít Tết Chú Tám Gò Vấp | `src/lib/catalogue-more.ts:1153` | "Free Khoai tây chiên with a 150.000 ₫ minimum" (dish: `catalogue-more.ts:1193`, 35.000 ₫) |

Grep used: the same two-command shape against the six HCMC restaurant names
and the three dish names (`Gỏi cuốn`, `Bún chả Hà Nội`, `Khoai tây chiên`) —
all found, once each, in the expected file. `Bò Bít Tết Chú Tám Gò Vấp` is
also this document's answer to AC5 (the long-name overflow check): it's a
real catalogue restaurant, not a synthetic string, carrying 25 characters
across five diacritic-heavy words — the worst case already sitting in the
data rather than invented for the test.

The seventh slide (both cities) is the existing first-order claim,
unchanged: `PROMO_BANNER_CLAIM` in `home-dom.ts` (`$2 off your first order` /
`10.000 ₫ off your first order`).

**Slide order (both cities):** first-order → ad 1 → promo 1 → ad 2 → promo 2
→ ad 3 → promo 3.

## Composition

**Header row.** *(Revised 2026-09-27 per the driver's review on #139 — the
pill's position moved from "next to the wordmark" to centred in the row's
top middle, and a placeholder for #136's wallet balance now reserves the top
right. Everything below describes the current, revised composition.)*

Wordmark, city pill, and a wallet-balance placeholder share one row, laid
out as a three-column grid — `grid-template-columns: 1fr auto 1fr` — rather
than a two-item flex row: wordmark in the first column (left-aligned, its
own natural width), the city pill in the middle (`auto`-sized, but
*centred on the full row*, not merely centred in the space left over after
the wordmark, which is what the grid's two equal `1fr` side columns buy —
the middle column stays on the row's true centre line regardless of how the
wordmark's or the balance placeholder's own widths compare), and the
balance placeholder in the third column (right-aligned). `Header.astro` is
static and site-wide; the pill and the placeholder are both client-rendered,
home-only — the row reserves both slots (min-height 32px, matching each
element's own `min-height`) **only on the home route**; `home-dom.ts` fills
the pill once the stored city is known. Every other route's header renders
with neither slot — not collapsed, absent — so nothing on `/cart`,
`/tracker`, `/about`, or a restaurant page gains empty space it didn't have.
The reserved slots are what stop the pill "flashing in late and shifting the
layout" (#133's own trap): the space is already there before the client
script runs, so filling it is a paint, not a reflow.

The balance placeholder (`.balance-slot` in the mock) is drawn with a dashed
border rather than the pill's solid one — this repository's own convention
for "reference only, not this issue's to build" (the same dashed treatment
`.slide-ref-card` already uses below) — and its content (`$20.00` /
`200.000 ₫`, in each city's own currency) is a placeholder value, not real
wallet data; #136 owns what actually renders there.

**Whether all three fit legibly at 375px:** checked by rendering, not
assumed. Ho Chi Minh City is this catalogue's longest city name
(`Ho Chi Minh City ▾`, 19 characters including the caret) and the tightest
case. At 375px the wordmark's own column has less room than it had when it
was the row's only other element, and it wraps — "dont" / "drop" / "that" /
"promo" break across two lines at one of the `<wbr>` word boundaries
`docs/design/80-two-city-brand-and-flow.md`'s "wordmark's 375px rule"
already names as the only place it may break (~line 194 of that document:
"it breaks only at a word boundary"). That rule was written when the
wordmark had the row to itself and never needed to invoke it; this is the
first composition that does, and it resolves inside the rule rather than
outside it — no text shrinks below the existing type scale, and no new
break point is introduced. Confirmed in all four rendered mocks: the pill
sits centred on the row in every one, the balance placeholder's right edge
never touches the pill, and nothing clips or overlaps at 375px. Rendered,
not estimated — `docs/design/137-home-feed-hcmc-light-narrow.png` is the
tightest case and the one to check first.

**Promo carousel**, replacing the single `.promo-banner` slot, same position
in the flow (between search and the cuisine chips):
- A photo-led slide, full-bleed width. *(Corrected 2026-09-27 per the
  driver's review on #139 — the arithmetic below replaces this document's
  original "two rows at ~72px" derivation, which under-measured.)* The
  original arithmetic used `.restaurant-card-photo`'s raw 72px height alone
  as a stand-in for "one row," multiplied by two — but a row's own rendered
  height also carries `.restaurant-card`'s padding (`--space-sm`, 8px, top
  and bottom) and its 1px border on both edges, which the first draft
  dropped: a real row is 72 + 8 + 8 + 1 + 1 = 90px, not 72px, so "two rows"
  was never going to land near what the driver measured against the
  rendered app (`BaseLayout.astro` ~261-293). Rather than keep stretching a
  "sized like two list rows" analogy that doesn't actually reach the target
  once it's computed correctly, the slide is now sized on its own terms, as
  a hero image: **200px** of photo, tall enough to read as the lead visual
  the "photo-led" direction calls for, plus the caption strip's own measured
  height beneath it — `--space-sm` padding top and bottom (8+8=16px), the
  claim line (`--font-size-body`, 0.9375rem/15px at 1.4 line-height ≈ 21px),
  a 2px margin, and the subline (`--font-size-muted`, 0.75rem/12px at 1.4
  line-height ≈ 17px) — 16+21+2+17 = 56px. **200 + 56 = 256px** total (image
  plus caption strip, excluding the dot row below it), inside the driver's
  requested 250-260px band. Confirmed against the rendered mocks, not just
  the arithmetic.
- The claim sits **under** the image, not on top of it, in a caption strip
  using the page's own surface/text colors and its own type scale (`
  --font-size-body` for the claim, `--font-size-muted` for the restaurant
  name/subline) — same restraint #80's Grab critique already established for
  the one banner, carried onto every slide rather than dropped now that
  there are more of them. Nothing about slide chrome invents a new display
  type size.
- The one thing that *does* sit on the photo is the **"Ad" label**, top-left
  corner, on ad slides only: a small pill, fixed dark scrim (`rgba(0, 0, 0,
  0.72)`) with white text, in both themes — deliberately the one element on
  this screen that doesn't retheme, the same reasoning `--color-flash-tile-bg`
  in `global.css` already uses for the flash countdown tile (a fixed pairing
  because it sits over unpredictable photo content, not over the page's own
  background). Contrast: white on that scrim is 18.17:1
  (`./scripts/contrast '#ffffff' '#1a1224' 4.5`; the darkest plausible photo
  tone under the scrim only pushes the ratio higher, never lower, since the
  scrim is already near-opaque).
- A small pause/play icon button, top-right corner of the image, same fixed
  dark-scrim treatment as the Ad label for the same reason (sits on the
  photo). Its accessible name toggles with its state ("Pause carousel" /
  "Play carousel") — WCAG 2.2.2, and the reference above.
- A row of 7 dots centered under the caption strip (on the page's own
  surface, not on the photo, so it uses ordinary theming), current slide
  filled and larger. These are real controls (buttons, one per slide, not
  painted circles) per the accessible-carousel reference above — jumping to
  a slide is a click/tap on its dot, not scroll-only.
- Tapping a restaurant slide (ad or promo) opens that restaurant's menu.
  Tapping the first-order slide goes nowhere (unchanged from today).
- **Motion, named.** *(Corrected 2026-09-27 per the driver's review on
  #139 — auto-advance resumes after an interaction; only the pause button
  stops it for good. This replaces the "stops permanently on any
  interaction" wording below, which read #133's "stops... while being
  touched or interacted with" as if "while" meant "forever," and the owner
  wants a carousel that keeps moving.)* Advances every 5 seconds, single
  slide, no easing beyond a plain 250ms crossfade or slide translate (either
  is fine; whichever the engineer's existing transition patterns favor —
  nothing else in this codebase names one, so this isn't a decision worth
  blocking on). A swipe, a dot tap, or any touch/pointer interaction with the
  carousel pauses auto-advance; it resumes about 5s after the interaction
  ends, matching the WAI accessible-carousel reference above, which pauses
  rotation while focus or a pointer is on the carousel rather than stopping
  it outright. Only the pause button stops it for good, until the visitor
  presses play again — that is the one control whose whole job is "stop and
  stay stopped," per WCAG 2.2.2, and it is the only interaction that should
  read that way; every other interaction is a visitor briefly looking at
  something, not a request to end the rotation. Never auto-advances when
  `prefers-reduced-motion: reduce` is set; the position dots and swipe still
  work. The interval is created once per mount and explicitly cleared before
  the next one — `renderFeed()` re-runs on every city switch (`home-dom.ts`
  ~209-215), and a carousel that starts a new `setInterval` on every
  re-render without clearing the last one is exactly the leak #133's own
  "traps" section names. The engineer's tests follow this wording: pausing
  on interaction and resuming ~5s after it ends are both behaviors to cover,
  not just "stops and never restarts."

**Two-column tile grid**, replacing `.restaurant-list`'s vertical stack,
same position (under the "Near you" heading):
- CSS grid, 2 columns, `gap: var(--space-md)` (14px) both axes. At 375px,
  main's own padding is `var(--space-lg)` (20px) each side, so content width
  is 375 − 40 = 335px; two tiles and one gap gives (335 − 14) ÷ 2 ≈ 160px per
  tile.
- Anatomy, top to bottom: photo (full tile width, `aspect-ratio: 4 / 3`,
  ~160×120 at this width — wider than today's 96×96 square, because a wider
  photo is what "photo-led" asks for and a 2-column tile has the width to
  spare that a full-width row didn't); name (bold, wraps to as many lines as
  it needs — no truncation, no `line-clamp`, which is what AC5 actually
  requires: not that a long name fits on one line, but that it never clips
  or ellipses); rating with count (`★ 4.8 (3k+)`, muted); a line with the
  vehicle icon, ETA, and fee (`🛵 24 min · 10.000 ₫ delivery`, muted, same
  `createVehicleIcon`/`etaLabel`/`formatReviewCount` helpers `home-dom.ts`
  already uses — this changes layout, not data).
- `Deal` badge: same absolute-corner placement as today (top-right of the
  photo), same token (`--color-accent-b` fill, `--color-badge-ink` text).
- `Flash` badge: inline, next to the ETA/fee line, same small pill it is
  today — placement on the tile is the ETA/fee line's own end, not a new
  row, so it doesn't push tile height around per restaurant.
- Tapping a tile opens that restaurant's menu (unchanged).
- **New class, not a restyle.** The tile is `.tile-card` (photo:
  `.tile-card-photo`, body: `.tile-card-body`, etc.), sharing no selector
  with `.restaurant-card`. `.restaurant-card` keeps its current row shape
  for the cart list and the flash sheet, both of which reuse it today and
  neither of which this issue touches — restyling `.restaurant-card` in
  place would silently restyle both. `renderRestaurantCard()` either grows a
  `variant` argument or the tile gets its own render function; either is an
  implementation choice for the engineer, not this document's to make.

## States (not just the happy path)

- **Empty (search/cuisine match nothing):** unchanged — the existing
  "No restaurants match…" block, still full-width under the grid slot (a
  1-column message, not an empty 2-column grid).
- **Fewer than 2 restaurants match:** the grid still lays out fine — CSS
  grid with `auto-rows` doesn't require a full row; one tile just sits alone
  in the first column.
- **Carousel with `prefers-reduced-motion: reduce`:** static on the first
  slide (first-order claim), no auto-advance; swipe and the dots still
  navigate it manually.
- **Storage-blocked (private browsing):** unaffected — the carousel and grid
  don't read storage themselves; the existing location-picker notice already
  covers this at the point storage actually matters.
- **Flash-sheet-live:** unchanged interaction, but note that the collapsed
  reopen bar and the sheet itself keep rendering into `.restaurant-card`'s
  own row shape (`flash-sheet-dom.ts`), not the new tile — this issue's
  scope is the home feed's grid, not the sheet.

## Image budget

No new photo. Every slide's restaurant image is that restaurant's own
existing `heroImage`, already fetched and credited (`photos.json` /
`80-photo-credits.md`) — reused, not duplicated. The first-order slide stays
text-only (no image), same as today's banner, so it adds nothing to the
budget.

What changes is what counts as "first paint." Today's 900KB budget
(`image-budget.test.ts`) sums the first six restaurant `heroImage`s. With a
carousel in front of the grid, first paint also includes whichever slide is
current on load (the first-order slide, which is text-only — so in practice
the currently-visible slide contributes nothing extra either). The other six
slide images are carousel content, not simultaneously on screen, and should
load the same way `renderRestaurantCard()`'s photos already do:
`loading="lazy"`, decoded only as a slide becomes reachable (next/previous
neighbor) rather than all seven eagerly. That keeps true first-paint weight
at "grid's first screen of tiles," unchanged from today's number — but the
test itself measures committed file bytes, not runtime laziness, so its
six-restaurant slice and its 900KB comment should be revisited by whoever
implements this to say explicitly what it's now bounding (the engineer's
job, flagged here so it isn't missed).

## Contrast checked

| Foreground | Background | Ratio | Command |
|---|---|---|---|
| Ad label / pause icon (white) | fixed photo scrim (`rgba(0,0,0,0.72)`, sampled as `#1a1224`) | 18.17 | `./scripts/contrast '#ffffff' '#1a1224' 4.5` |
| Reference: white on solid black (scrim floor — the scrim is 72% opaque, so the true ratio against any photo sits between this and the row above) | — | 21.00 | `./scripts/contrast '#ffffff' '#000000' 4.5` |
| Slide claim / tile name (`--color-text`, light) | `--color-surface`, light | 14.83 | `./scripts/contrast '#241b33' '#f7f1ff' 4.5` |
| Slide claim / tile name (`--color-text`, dark) | `--color-surface`, dark | 14.62 | `./scripts/contrast '#f1e9ff' '#1e1730' 4.5` |
| Muted subline/meta (`--color-text-muted`, light) | `--color-surface`, light | 5.38 | `./scripts/contrast '#6b5d85' '#f7f1ff' 4.5` |
| Muted subline/meta (`--color-text-muted`, dark) | `--color-surface`, dark | 7.76 | `./scripts/contrast '#b7a6d9' '#1e1730' 4.5` |
| `Deal` badge ink on fill, light | `--color-accent-b`, light | 6.35 | `./scripts/contrast '#241b33' '#ff7a45' 4.5` |
| `Deal` badge ink on fill, dark | `--color-accent-b`, dark | 9.49 | `./scripts/contrast '#16101f' '#ffa36b' 4.5` |

Every pairing above is also already covered by `contrast.test.ts` — this
table re-runs the same tokens in this component's own combinations rather
than asserting a new one. The `Flash` badge (white on `--color-accent-a`)
and the dots (`--color-border` inactive / `--color-accent-a` active, both
non-text UI) are the same tokens already in that table too; nothing on the
carousel or the tile introduces a token/background pairing outside the
Ad-label/pause-icon scrim.

## Motion, tap targets, and the accessibility floor

- Auto-advance: 5s, pauses on interaction and resumes ~5s after it ends, off
  entirely under `prefers-reduced-motion: reduce` (see "Composition" above).
- Pause control: the one interaction that stops rotation for good rather
  than pausing it — WCAG 2.2.2, visible at all times (not revealed on
  hover — this is a touch-first phone screen), state-dependent accessible
  name.
- Every dot and the pause button meet the 44px touch-target floor
  (`docs/design/46-phone-native.md`'s existing rule) even though they're
  visually smaller — padding, not just paint, gets them there.
- No meaning by color alone: the "Ad" label is a text label, not a color
  cue; `Deal`/`Flash` badges keep their existing text, unchanged.
- Tab order: dots, pause button, and the current slide's link are all
  reachable by keyboard, in that visual order.

## Mocks

Four self-contained files, no build step, `./scripts/design-render`'d at
both widths:

- `137-home-feed-sf-light.html`
- `137-home-feed-sf-dark.html`
- `137-home-feed-hcmc-light.html`
- `137-home-feed-hcmc-dark.html`

Each shows the full feed (header row, search, carousel on an **ad** slide —
the state AC2 asks to be checked visually — with the dot row and pause
control, cuisine chips, "Near you," and the tile grid with one `Deal` tile
and one `Flash` tile) plus a small labelled reference strip immediately under
the live carousel showing a **promo**-type slide's anatomy side by side with
the ad slide's, since a static picture can only show one slide "live" at a
time and AC2 needs both anatomies checked. Dark files hardcode the dark
palette (this repository's own convention — see `46-phone-native-dark.html`
— `design-render` doesn't emulate `prefers-color-scheme`, so a dark render
has to carry its own values rather than rely on the browser's OS setting).

**Real photos, not gradient placeholders.** *(Added 2026-09-27 per the
driver's review on #139.)* Every carousel slide, tile, and slide-anatomy
reference image is an `<img>` pointing at that restaurant's own existing
hero photo under `public/images/restaurants/`, referenced by relative path
from `docs/design/` (`../../public/images/restaurants/<file>.jpg` —
`design-render` opens each mock as a `file://` URL, so a relative `src`
resolves against the mock's own location on disk, same as any other local
asset). No new photo, nothing added to `photos.json` — see "Image budget,"
below. This is what actually lets AC2's "legible over any photo" claim be
checked: the "Ad" label and the pause control sit over the real Mission
Taqueria and Bến Thành Bánh Mì photos in the rendered PNGs, not over a
gradient no visitor will ever see.

## Critique (after rendering — see pull request for the pictures)

Written after opening all eight PNGs, not before:

- **First look, narrow width:** the eye lands on the carousel photo first in
  every render, which is the intended read — confirmed rather than assumed.
- **HCMC name check:** `Bò Bít Tết Chú Tám Gò Vấp` wraps to two lines in its
  tile and does not clip or ellipsis — the thing AC5 asks to be checked.
- **Changed after the first render:** the HCMC mock's tile grid originally
  listed `Bò Bít Tết Chú Tám Gò Vấp` — the long-name check AC5 asks for —
  third, after two shorter names. At 375px `design-render`'s screenshot is
  viewport-sized, not full-page (`docs/memory/designer.md`'s standing
  lesson), and the first render cut it below the fold entirely: the one tile
  this document exists to prove doesn't clip was itself invisible in its own
  picture. Reordered it into the grid's first row in both the HCMC mocks so
  it's guaranteed on-screen at 375px without depending on scroll position.
- **What stayed:** the fixed dark scrim on the Ad label even in the dark
  mock, where it reads as a slightly odd, deliberately-different chip next
  to the page's own dark surface. Kept — it's legible over every photo this
  catalogue has, which a retheme of it can't promise, and the flash tile
  precedent (`--color-flash-tile-bg`) already established that "doesn't
  retheme" is an acceptable answer for chrome sitting over unpredictable
  content rather than over the page's own background.

**Revision round (2026-09-27), after re-rendering all eight PNGs against the
driver's review on #139:**

- **Header, the case that mattered:** re-rendered `137-home-feed-hcmc-light`
  and `-dark` first, since Ho Chi Minh City is the longest city name and the
  tightest fit for a three-way row. The pill sits centred on the row in
  both, the balance placeholder's dashed pill clears it with visible margin
  on both sides, and nothing overlaps or clips at 375px. The wordmark wraps
  to two lines (see "Composition → Header row" for why that's the rule
  working, not a bug) — legible at its existing size in both themes.
- **Ad label over a real photo:** confirmed the actual risk AC2 names —
  white text on the fixed scrim reads clearly over both Mission Taqueria's
  and Bến Thành Bánh Mì's hero photos, busy and food-colored as real photos
  are, in both themes. A gradient could never have shown this; that's the
  reason this round exists.
- **Carousel height:** the rendered slide (200px photo + caption strip) now
  reads as a real hero image rather than a slightly-tall list row — a
  proportion check the arithmetic alone can't make, only the picture can.

## For the engineer

- `.tile-card` is a new class; `.restaurant-card` is untouched by this
  issue.
- The carousel's `setInterval` must be created once per `renderFeed()` call
  and cleared on the next call (city switch) and on unmount — test it with
  fake timers, per the parent issue's "traps" section.
- Auto-advance pauses on interaction and resumes ~5s after the interaction
  ends; only the pause button stops it until the visitor presses play again
  — two different timers (or one timer whose deadline is pushed out on
  interaction) rather than one boolean, and both need the same
  create-once/clear-on-re-render discipline as the advance interval itself.
- The header row is a three-column grid (`1fr auto 1fr`), not a flex row —
  the pill's centring depends on the two side columns being equal, not on
  the wordmark and the balance placeholder happening to match widths.
- `theme.build.test.ts` (~143) and `home-dom.test.ts` currently assert the
  old single-banner and single-row shapes; update them deliberately to the
  new ones rather than deleting or loosening them (house-rules: tests before
  merge, and watch each new check fail before trusting it).
- `image-budget.test.ts`'s home-feed-first-paint assertion needs a decision
  about what it now bounds — see "Image budget," above.
- No `track()` calls, event-contract edits, or migrations in this issue —
  `home_viewed` and `restaurant_opened` keep firing exactly as they do today.
