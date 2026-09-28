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

**Amended for #184 (parent #180).** Two changes, both the owner's, both
recorded here rather than re-argued: the first-order slide moves from index 0
to index 3 (4th of 7), so the carousel opens on a restaurant photo instead of
on the site's own promo text; and that slide's plain tinted-panel treatment
becomes a designed banner. Every section below is edited in place to describe
the current state rather than kept as a history of two documents — the
"Revision round" critique further down stays dated, since it records what a
rendering pass actually found, but "Slide order," "Reduced motion," "Image
budget," and "Contrast checked" now state the #184 outcome directly.

**Revised again after the driver's review on PR #187.** The first #184 round
kept the old panel's flat rectangle and added a two-stop gradient plus three
15%-opacity circle outlines behind the text — the review found the circles
"barely show" at phone size and aren't load-bearing (its own words: "cover
the accent with your hand … still reads as a designed surface … the motif is
decoration on top of that, not load-bearing"), so the slide was still
text-on-a-tint underneath the gradient. It also found the offer amount ("$2
off" / "10.000 ₫ off") set at the same size as the rest of the sentence, with
nothing making it the reason the slide exists. "First-order banner," below,
is rewritten for this round: the gradient and the fixed-chrome reasoning are
unchanged (the review said to keep both), but the decorative circles are
replaced by one solid, nameable coupon/ticket graphic, and the claim text is
split so the offer amount sits on the ticket at a larger size than "your
first order" beside it. The "no new display type size" rule (see "Promo
carousel," below) is deliberately lifted for the amount only, per the
review's own offer to do so — sized and reasoned in "First-order banner."

**Revised a second time after the driver's second review on PR #187 (the
last revision round).** The ticket shape and the split amount both stayed —
the review said the direction was right — but the HCMC value, `10.000 ₫`,
didn't fit inside the ticket in the committed renders: it overflowed the
right edge and the notch, and wrapped onto its own line. "First-order
banner," below, is edited again for this round only where it's affected: the
ticket widens from 116×104 to 148×104, and the HCMC value alone drops to a
smaller, still-focal size (`0.8125rem`) via a new
`.carousel-banner-ticket-value--compact` modifier, applied to that one
string rather than both currencies. The review also asked for "your first
order" capitalized beside the ticket, now "Your first order" — a copy change
only, no new class. Nothing else the review named as passing (the gradient,
the ticket's notch/tear-line silhouette, the split itself, the four existing
contrast rows) changed in this round.

**Amended for #214 (parent #204).** #204's own research is merged: the ad
slide's content source is a direct-sold static slot (`docs/research/204-ad-
source.md`, PR #208) and its first creative is a self-made Coursera image
(`docs/research/204-affiliate-partners.md`, PR #212). This round adds a new
top-level section, "Paid ad slide (#214)," specifying which of the 7 slots
carries it, its content shape, and its shown/fallback states, and edits
"Slide order" (under "Content picked"), "Image budget," "Contrast checked,"
and "Mocks" in place to describe the resulting current state rather than kept
as history — same convention this document has used since the #184
amendment. Nothing else in this document changes: the carousel's visual
language, motion, and every other slide's content are untouched by this
round.

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
- **For #214:** the ad source and its shape are fixed, not this document's to
  pick again — a direct-sold static slot (one self-hosted image, one link
  with `rel="sponsored noopener"`, an "Ad" label, no script, no cookie),
  owner-approved on #207 (`docs/research/204-ad-source.md`, PR #208). The
  first creative is a self-made, self-hosted Coursera image, ranked first for
  both cities with no per-city variant (`docs/research/204-affiliate-
  partners.md`, PR #212) — not yet supplied (owner step), which is exactly
  why the fallback state below has to carry the slide until it is.
  Both research documents agree the visual anatomy doesn't need to differ
  from a catalogue `ad` slide (same "Ad" label, same photo-plus-caption
  shape) — the difference is content and destination only, so this round
  adds no new direction, palette, or component; "Paid ad slide (#214),"
  below, reuses "Promo carousel"'s existing anatomy rather than inventing one.

**Guesses I'm resolving, stated as guesses:**
- **Slide order.** #133 doesn't specify one. I've alternated
  first-order → ad → promo → ad → promo → ad → promo, so the carousel never
  runs two ads back to back on a short attention span (see "Carousel," below,
  for the full sequence). A different order is a one-line change and not
  worth a question. *(Superseded by #184: the owner did ask for a different
  order, moving the first-order slide from index 0 to index 3 so the carousel
  opens on a photo — see "Slide order," under "Content picked," for the
  current sequence. Left here rather than rewritten, since it's the record of
  why the original order was a guess and not a constraint.)*
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

One of the seven slides (both cities) is the existing first-order claim,
unchanged: `PROMO_BANNER_CLAIM` in `home-dom.ts` (`$2 off your first order` /
`10.000 ₫ off your first order`). It's no longer the slide the carousel opens
on — see "Slide order," directly below.

**Slide order (both cities), per #184, amended by #214:** **paid ad** → promo
1 → ad 2 → first-order → promo 2 → ad 3 → promo 3 — position 1 of 7 (`ad1` in
the two tables above) is now the paid ad slide specified in "Paid ad slide
(#214)," below, not the second independent catalogue-restaurant ad slide it
used to be. Every other slide keeps its #184 position: first-order is still
4th of 7, and the remaining two ad slides (`ad2`, `ad3`) and all three promo
slides are unmoved. `ad1`'s restaurant (Mission Taqueria / Bến Thành Bánh Mì)
is not deleted from the table above or from `CAROUSEL_RESTAURANT_SLIDES` — it
becomes the fallback content the paid slide falls back to when no creative is
configured, or when the creative's image fails to load ("Both states," under
"Paid ad slide (#214)," below). It no longer appears as an independent slide
in the carousel while a creative is live, though it stays reachable in the
tile grid beneath it, which this issue does not touch. Confirmed against
`CAROUSEL_RESTAURANT_SLIDES` in `src/lib/home-dom.ts` (`:41`-`:58`, the array
this document still leaves unchanged by name — the engineer's work is to
change what fills the combined sequence's first slot, not to reorder or
shrink this six-entry constant itself, since entry 0 is still read for the
fallback).

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

### First-order banner (#184)

Now the 4th slide, not the 1st (see "Slide order," above), and the one issue
that opened this follow-up: today's `.carousel-slide-panel` is a plain
tinted-surface box holding the claim and sub as two lines of text — legible,
and exactly the "reads like a form's help text" flatness this document's own
"Look at what's there now" section already diagnosed the *old* single banner
for, now reproduced one slide deep into a carousel that's supposed to have
fixed it.

**Directions considered, structurally, not just by palette (design-craft):**

- **A — Gradient reward panel.** A full-bleed, fixed (non-retheming)
  two-stop gradient fills the slide's whole photo-equivalent area, a small
  decorative motif sits behind the text, and the claim/sub overlay it in a
  light color — the same "content sits on a ground, ground fills the frame"
  structure every photo slide already has, with color standing in for the
  photo instead of a smaller box of text on the page's own surface.
- **B — Icon-led card, page-surface ground.** Keep the page's own
  per-theme surface/text tokens (fully rethemed, no fixed exception), and
  add one large single decorative icon or illustration to the left of the
  claim/sub as the structural focal point — a bank-app-style icon+text tile
  rather than a full-bleed ground.

**Recommendation: A.** Every other slide in this carousel is a photo filling
the frame with text riding on top of it; B keeps this one slide compositionally
closer to today's plain box (an icon in the corner of an otherwise page-colored
rectangle) than to its six neighbors, so the carousel would still have one
visibly flatter slide in the rotation — a smaller version of the exact problem
this follow-up exists to fix. A costs one themed exception (the gradient is
fixed across light/dark, like the Ad-label scrim below), which is a cost this
document already accepted once for the same reason: chrome that has to hold
its own regardless of what's behind or around it doesn't retheme. I'm taking A.

**Look outside this repository, for this decision specifically:**

- **Mobbin's banner-pattern catalogue** (`mobbin.com/glossary/banner` — the
  page itself refused automated fetching with a 403; this is drawn from its
  indexed summary, said plainly rather than dressed up as a full read). Its
  stated convention for a promotional banner with no product photo is "an
  eye-catching color or gradient" standing in for the image. I'm taking
  "gradient stands in for the photo, not a flat near-identical tint" directly
  — it's why the panel gets a two-stop gradient rather than a slightly
  different flat surface color. I'm refusing the "eye-catching" instruction's
  most literal reading (bright, saturated, chosen to pop): this carousel's own
  Direction section above is "confident... not... high-saturation," so the
  gradient stays inside the one violet accent already used everywhere else on
  this screen rather than introducing a second, louder hue.
- **Envato's 2026 mobile color-scheme trends piece**
  (`elements.envato.com/learn/color-scheme-trends-in-mobile-app-design`),
  fetched directly. Its duotone description is specifically "two dominant
  hues," named for use in "promotional imagery." I'm taking "two hues, not
  many" directly — the gradient is `--color-accent-a`'s own violet fading to
  one deeper shade of that same hue, never a second accent color — which is
  just "one accent, used a few times" (design-craft) applied to a background
  rather than a border or a badge. I'm refusing the same piece's separate
  "gradient mesh" trend (several unrelated hues blended together): that's the
  opposite of the one-accent discipline every other surface on this screen
  already holds to.

**The design (revised after the driver's review on PR #187):**

- **Background.** `linear-gradient(135deg, #6c3ce0 0%, #2f1861 100%)` — fixed
  in both themes, the same "doesn't retheme, because it holds its own regardless
  of what's around it" reasoning the Ad-label scrim and `global.css`'s
  `--color-flash-tile-bg` already use elsewhere in this document, extended here
  to a treatment the panel owns outright (its whole background) rather than one
  that only sits over unpredictable photo content. `#6c3ce0` is this app's own
  `--color-accent-a` at its light-theme value — the one accent already doing
  every highlight on this screen, not a new hue; `#2f1861` is a deeper shade of
  the same violet, not a second color. Kept unchanged from the first round —
  the review's complaint was the graphic sitting on it, not the gradient
  itself.
- **The ticket.** A solid white coupon/ticket, 148×104, right-aligned in the
  panel (roughly its right third): a rounded rectangle with a semicircular
  notch cut into its left and right edges and a dashed vertical "tear" line
  set back from the left notch, the standard coupon silhouette — replacing
  the first round's three 15%-opacity circle outlines, which the review found
  wasn't a graphic a reviewer could name from the 375px PNG without reading
  this document. Drawn as inline SVG: the rounded-rect body is one `<path>`,
  the two notches are cut with an SVG `<mask>` (two black circles on a white
  rect) rather than baked into the fill path, so the shape stays a single
  clean fill no matter how the notch geometry changes later. The mask's `id`
  is suffixed per mock file (`carousel-ticket-notch-sf-light`, etc.) — this
  document's own standing lesson on shared-id inline SVGs (`docs/memory/designer.md`)
  is about the same id appearing twice in one document and only the first
  copy drawing; each of the four mocks here uses the pattern once, but the
  suffix costs nothing and removes the risk if a slide is ever duplicated
  within one file. White fill (`#ffffff`), not a tinted white, for maximum
  legibility of the dark ink text sitting on it. Widened from the first
  revision's 116×104 to 148×104 in this round — see "Revised again after the
  driver's second review," in the critique below, for why.
- **The offer amount, on the ticket.** The claim's amount — `$2 off` (SF) /
  `10.000 ₫ off` (HCMC), i.e. `PROMO_BANNER_CLAIM[city]` minus its own literal
  `your first order` suffix — sits inside the ticket's main (right)
  compartment, split onto two lines: the value (`$2` / `10.000 ₫`) at
  `1rem`/800 weight (SF) or `0.8125rem`/800 weight (HCMC — see below), then
  `off` on its own line at `0.625rem`/800 weight/uppercase/0.06em tracking,
  both in `#2f1861` (the gradient's own darker stop — reused ink, not a third
  color) on the ticket's white fill — `./scripts/contrast '#2f1861' '#ffffff' 4.5`
  → **14.75**, see "Contrast checked" below (the ratio holds at either size;
  size doesn't change a color pairing's contrast, so this round adds no new
  row). This is the one place this document deliberately lifts its own
  "nothing about slide chrome invents a new display type size" rule (see
  "Promo carousel," above): that rule was written for photo-slide captions,
  where the photo already carries the visual weight and the caption is
  deliberately restrained; this slide has no photo, and the review asked
  directly for the amount to be "the focal point" rather than body-size text
  in a sentence. `1rem` is one step above `--font-size-body` (0.9375rem) —
  enough to read as a distinct, larger figure next to "your first order"
  without becoming a second, competing display size on a slide that still
  has to sit quietly among six photo slides in the same rotation. Two-line
  (value, then `off`) rather than one line, both cities, unchanged from the
  first revision round.
  **The HCMC value gets a smaller size, `.carousel-banner-ticket-value--compact`
  (`0.8125rem`), applied only to the long-currency string.** The second
  driver review on PR #187 found `10.000 ₫` still didn't fit at `1rem` even
  after the first revision's fix (it overflowed the ticket's right edge and
  wrapped onto its own line in the committed renders) — caught against the
  actual PNGs, not the arithmetic, exactly as that review asked. Fixed with
  two changes together, not one: the ticket widened 116px → 148px (the tear
  line moved from 44px to 42px from the left, so the stub stays visually the
  same size and all the extra width goes to the amount's compartment), and
  the HCMC value alone steps down to `0.8125rem` (13px) — smaller than `1rem`
  and, unlike the SF value, now below `--font-size-body` (0.9375rem) too.
  It's still visibly larger and bolder than everything else on the ticket
  (the `off` label at `0.625rem`) and reads as the ticket's focal point in
  all eight re-rendered PNGs (checked, not assumed — see the critique below),
  which is the bar the review actually set, not "must be `1rem`." SF's `$2`
  keeps `1rem` unmodified — it was never
  the value the review flagged, and forcing both currencies to the smaller
  size to avoid a size difference between them would shrink the one case
  that already worked. `.carousel-banner-ticket-value` also switched from
  `overflow-wrap: break-word` (a wrap-if-it-must rule that produced the
  broken second line the review is responding to) to `white-space: nowrap` —
  a value that doesn't fit now overflows visibly in a local render rather
  than silently wrapping into the notch, which is the failure mode this
  round exists to stop.
- **"Your first order," beside the ticket.** The claim element keeps its
  existing class, type scale (`--font-size-body`, white, 800 weight,
  unchanged from every prior round), and DOM position — its text content is
  `Your first order` (capitalized — see "Revised again," below, for why this
  round changed it from the first revision's lowercase `your first order`),
  since the amount now lives on the ticket instead of at the front of this
  sentence. The sub (`Applied automatically at checkout`, `--font-size-muted`,
  `#ece4ff`) is completely unchanged.
- **Reading order.** `.carousel-banner` is a flex row with
  `flex-direction: row-reverse`: the ticket is first in DOM order (so a
  screen reader meets the amount before "your first order," reconstructing
  the original sentence's order) but paints last, i.e. on the right, which
  is where every other visual cue on this slide (and the row-reverse
  convention itself) puts the emphasis element. Only the ticket's decorative
  `<svg>` carries `aria-hidden="true"` — the amount text itself is ordinary,
  readable content, not hidden decoration duplicated elsewhere; nothing on
  this slide repeats the same text twice for sighted and assistive users.
- **Layout.** The panel fills the slide's full 256px height (200px
  photo-equivalent + 56px caption-equivalent — see "Promo carousel"'s own
  arithmetic above) as one element, not photo-plus-separate-caption-strip:
  `display: flex; flex-direction: row-reverse; align-items: center; gap:
  var(--space-md)` (14px), `--space-lg` (20px) padding each side. The pause
  button keeps its existing top-right scrim placement, photo or not — the
  control doesn't move based on what slide type it's sitting on.
- **What doesn't change.** No "Ad" label (this isn't a paid placement — it's
  the site's own offer, same as today). Tapping this slide still goes nowhere
  (unchanged; see "Promo carousel," above). No `<img>`, so nothing here touches
  "Image budget," below, beyond what the reordering itself already changes —
  the ticket is CSS/SVG, zero bytes, same as the panel it replaces.

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

## Paid ad slide (#214)

**No new visual language.** Both merged research documents agree on this:
`docs/research/204-ad-source.md` says the slide "won't visually or
structurally need to differ from a catalogue ad slide, since both already
carry the same 'Ad' label," and `docs/research/204-affiliate-partners.md`
treats "the slot's shape and label" as already settled by that document. So
this section specifies content and behaviour, and reuses "Promo carousel"'s
existing anatomy above (the 200px `.carousel-slide-media` photo, the
`.carousel-caption` strip, `.carousel-ad-label`, the pause button) without
change — no new component, no new palette, no new direction to carry through
design-craft's "look outside this repository" step, because there is no new
look here to look for.

### Position

**Position 1 of 7 — `ad1`, the carousel's on-load slide** — not the 2nd, not
alongside the first-order slide, and not a new 8th slide.

**Why this satisfies "early in the rotation."** Position 1 is the earliest
slide there is, and the affiliate research's own arithmetic is explicit about
why that matters more than usual here: "the first slide is the only one
every visitor sees, because a later slide needs the visitor to stay 5s times
its index" (`docs/research/204-affiliate-partners.md`, "Buildable now"). That
same document also computed the expected sale rate at this site's traffic —
0.01–0.15 sales a month — so there is no volume to spend on a slide most
visitors never reach; impressions are the only lever available, and position
1 is the only slot that gets one from every visitor. The ad-source research's
own instruction is to "replace a restaurant ad slide early in the sequence,
not late," not the first-order banner or a promo slide — `ad1` is the
earliest ad slide there is, so replacing it (rather than `ad2` or `ad3`) is
the most literal reading of "early" available.

**Why this doesn't reopen #184.** #184 moved the first-order slide off
position 0 specifically because it is *text on a tint*, not a photo — the
owner's own words were that the carousel should open "on a restaurant photo
instead of on the site's own promo text." The paid slide's shown state (see
"Both states," below) is photo-led with the exact same anatomy as any
catalogue `ad` slide: a full-bleed photo, the "Ad" label, a caption strip
below it. The carousel still opens on a photo under this change — only whose
photo changes, not whether a photo leads. And until the owner supplies a
creative, or if that creative's image ever fails, the fallback state
restores `ad1`'s exact pre-#214 content (Mission Taqueria / Bến Thành Bánh
Mì), so the on-load slide is visually unchanged from production today for as
long as no creative is configured.

**Full 7-slide sequence, both cities** (superseding the #184 sequence in
"Slide order," under "Content picked," above — reproduced here as its own
checkable table, per this issue's own AC1):

| # | Type | San Francisco | Ho Chi Minh City |
|---|---|---|---|
| 1 | **Paid ad** (was `ad1`) | Shared sponsor creative (see "Content shape," below) | Shared sponsor creative — same creative as SF |
| 2 | Promo | North Beach Pizzeria | Sài Gòn Phở Quán |
| 3 | Ad (`ad2`) | Inner Richmond Sushi Bar | Hủ Tiếu Nam Vang Hòa Phát |
| 4 | First-order | "$2 off your first order" | "10.000 ₫ off your first order" |
| 5 | Promo | Noe Valley Morning Kitchen | Bún Chả Cô Ba |
| 6 | Ad (`ad3`) | Ocean Beach Fish House | Quán Lẩu Út Hạnh |
| 7 | Promo | Valencia Street Tandoor | Bò Bít Tết Chú Tám Gò Vấp |

Seven rows, both cities — the slide count this issue's own acceptance
criteria ask to be checked against.

### Content shape

Every field the engineer needs, mapped onto the fields a catalogue `ad`
slide already fills (`claim`, `sub`, `photo`, `href` in `home-dom.ts`'s
`CarouselSlide` interface) so the DOM and CSS need no new shape, only new
data:

| Field | Fills | Value |
|---|---|---|
| **Placeholder/creative image** | `photo` → `.carousel-slide-photo` | Self-hosted (never hot-linked from an advertiser's own server — `docs/research/204-ad-source.md`'s own consent reasoning depends on this). **One file, shared by both cities** — not a `Record<City, ...>` like the six catalogue restaurant photos, because the affiliate research's first pick is "one creative serves both cities," not a per-city variant. |
| **Alt text** | `photo`'s `alt` attribute | Empty string (`alt=""`), matching every other carousel and tile photo in this codebase today (`home-dom.ts`'s `img.alt = ''` on every restaurant photo). Not a new pattern: the image is decorative, and the caption strip beside it already carries the same information to assistive tech, exactly as it does for a catalogue `ad` slide's restaurant name and rating. |
| **Advertiser label text** | `claim` → `.carousel-claim` | The advertiser's own name or a short headline (e.g. "Coursera"), same bold/position treatment a restaurant name gets on a catalogue `ad` slide. One string, shared by both cities. |
| **Tagline** | `sub` → `.carousel-sub` | One short muted line under the advertiser label (e.g. a course name or a one-line pitch) — the shape a catalogue `ad` slide fills with `cuisineTag · ★ rating`, but free text here since there's no equivalent structured data for an advertiser. One string, shared by both cities. |
| **Destination link** | `href` → the slide's `<a>` | The owner-supplied tracking URL, **used exactly as supplied**: `rel="sponsored noopener"` (already the ad-source research's own requirement), and code never appends a query parameter to it and never inserts the visitor/browser id (`getVisitorId`, `order-store.ts`) — the affiliate research's own explicit warning ("the tempting mistake is the other direction... putting this site's random browser ID into one would hand a per-visitor identifier to a third party"). One URL, shared by both cities, not filled by this document because none exists yet — it's an owner step (`docs/research/204-affiliate-partners.md`, "Owner steps," #3). **Opens in a new tab** (`target="_blank"`, alongside the `rel` above): every other slide's link is an in-app navigation to a page on this site, and an external destination that replaced the whole app in the same tab would strand a visitor mid-carousel on someone else's site; a catalogue `ad` slide has no equivalent case, so this is new only for this slide type, not a change to the shared link markup pattern. |
| **"Ad" label** | `.carousel-ad-label` | Reused exactly as-is: same text ("Ad"), same fixed dark-scrim pill, same top-left position, same "doesn't retheme" reasoning ("Composition," above). No new disclosure or consent element — both research documents independently conclude the existing label is sufficient disclosure (ad-source research's own requirement; affiliate research's "Disclosure" section: "No extra line is strictly needed for Coursera or DataCamp"). |

### Both states

**Shown (creative configured).** Uses exactly the `.carousel-slide-media`
(200px photo) + `.carousel-caption` anatomy "Promo carousel," above, already
specifies for a catalogue `ad`/`promo` slide — not the 256px first-order
banner box, which stays unique to that one slide. The placeholder/creative
image fills the photo area (`object-fit: cover`, same as every other slide's
photo); the "Ad" label sits top-left over it, unchanged; the pause button
sits top-right over it, unchanged; the caption strip below shows the
advertiser label (bold) and tagline (muted); tapping the slide navigates to
the destination link, in a new tab, per "Content shape," above.

**Fallback (no creative configured, or the image's `onerror` fires).** Shows
`ad1`'s own pre-#214 content, unchanged: the same restaurant (Mission
Taqueria for SF, Bến Thành Bánh Mì for HCMC), the same photo, the same claim
(restaurant name) and sub (`cuisineTag · ★ rating`), the same "Ad" label, and
the same in-app link to that restaurant's own page — literally the content
"Content picked," above, already specifies for `ad1`, not a new placeholder
or a generic "no ad" message. This is what "shows the existing slide
content" (this issue's own AC3 wording) means concretely: the fallback is a
second *data* variant at the same slide index, not a second UI.

**Why this fallback and not a new one.** I considered a distinct "Sponsor
this slot" house creative (the affiliate research's own #3-ranked option,
meant to run in the shown-state gap before the owner's Impact application is
approved) as the fallback instead. I'm not taking it: that option is new
copy, a new image, and a new link (`mailto:` or a contact page) — a second
new content variant needing its own legibility and contrast check, to
satisfy a criterion ("names which *existing* slide content it shows") that a
literal reuse of `ad1` already satisfies for free. The "Sponsor this slot"
creative remains available as something the owner could put *in* the
shown-state creative fields above while waiting for Impact — that's a
content decision for whoever fills in "Content shape," above, not a second
code path this document needs to specify.

**Why neither state affects the slide count, the box, or the timer.** The
carousel's slide array is always exactly 7 entries — the fallback swaps which
*data* renders at index 0, it never removes or adds a slide, so the 7-slide
count this issue's own AC1 and AC3 both ask to be checked never moves. The
media box's 200px height is fixed by CSS (`.carousel-slide-media`,
"Composition," above) rather than driven by the image's own natural size, so
neither a configured creative nor a failed `onerror` swap changes the box's
dimensions — no layout shift either way. And `startAutoAdvance()`
(`home-dom.ts:232`) reads only `current` and the slide count to schedule the
next `goToSlide()` call; it never inspects slide *content*, so which data
variant is rendering at index 0 has no path to the running timer at all —
the same "For the engineer" note on this file's interval-per-render
discipline (below) applies unchanged to this slide as to every other.

### Look outside this repository (why none, here)

Design-craft asks this step be taken even when the issue asks for one thing.
It isn't skipped here as much as it's already been taken, twice, by the
research this issue is scoped against: `docs/research/204-ad-source.md`
surveyed AdSense, EthicalAds and Carbon's own placement conventions before
recommending the direct-sold slot's shape, and the composition decisions in
"Promo carousel" and "First-order banner," above, already carry this
document's own DoorDash/Mobbin/WCAG references for exactly this slide
anatomy (a distinctly bordered, honestly labelled sponsored card-in-feed).
Repeating that search here, for a slide this document has just finished
arguing needs no new visual language, would be pastiche of a decision
already made rather than craft.

## States (not just the happy path)

- **Empty (search/cuisine match nothing):** unchanged — the existing
  "No restaurants match…" block, still full-width under the grid slot (a
  1-column message, not an empty 2-column grid).
- **Fewer than 2 restaurants match:** the grid still lays out fine — CSS
  grid with `auto-rows` doesn't require a full row; one tile just sits alone
  in the first column.
- **Carousel with `prefers-reduced-motion: reduce`:** static on the first
  slide — position 1 of 7, no longer the first-order slide (per #184, now the
  4th of 7) and, per #214, now the paid ad slide's shown or fallback content
  rather than always `ad1`'s restaurant — no auto-advance; swipe and the dots
  still navigate it manually. Whichever content the paid slide is showing
  (creative or fallback, "Both states" under "Paid ad slide (#214)," above)
  is exactly what sits still, since reduced motion changes only whether
  `goToSlide` is ever called automatically, not what content index 0 holds.
- **Storage-blocked (private browsing):** unaffected — the carousel and grid
  don't read storage themselves; the existing location-picker notice already
  covers this at the point storage actually matters.
- **Flash-sheet-live:** unchanged interaction, but note that the collapsed
  reopen bar and the sheet itself keep rendering into `.restaurant-card`'s
  own row shape (`flash-sheet-dom.ts`), not the new tile — this issue's
  scope is the home feed's grid, not the sheet.

## Image budget

No new raster asset, still. Every restaurant slide's image is that
restaurant's own existing `heroImage`, already fetched and credited
(`photos.json` / `80-photo-credits.md`) — reused, not duplicated. The
first-order banner (see "First-order banner," above) is CSS gradient plus one
small, unshared inline `<svg>` — no `<img>`, no external file — so it adds
zero bytes to any budget, same as the plain-panel treatment it replaces.

What changes is which restaurant's photo is on screen at first paint. Per
#184's reordering, the carousel's on-load slide (index 0) is no longer the
text-only first-order slide — it's now the first ad slide, `ad1`: Mission
Taqueria (`mission-taqueria-hero.jpg`, 63,667 bytes) for San Francisco, Bến
Thành Bánh Mì (`ben-thanh-banh-mi-hero.jpg`, 74,950 bytes) for Ho Chi Minh
City.

`image-budget.test.ts`'s current first-paint assertion sums
`restaurantsForCity(city).slice(0, 4)`'s `heroImage`s — the tile grid's first
two rows — against the 900KB cap, on the reasoning (its own comment) that the
carousel's on-load slide contributed nothing because it was text-only. That
reasoning no longer holds once the carousel opens on a photo, so the sum
needs to explicitly account for whichever restaurant is now the carousel's
first slide, rather than silently assume "still four."

Checked directly against `src/lib/restaurants.ts` and `home-dom.ts`, that
restaurant turns out to already be `restaurantsForCity(city)[0]` in both
cities: `mission-taqueria` is `SF_RESTAURANTS`' own first entry
(`restaurants.ts:50`) and `ben-thanh-banh-mi` is `HCMC_RESTAURANTS`' own first
entry (`restaurants.ts:257`), and those are exactly `CAROUSEL_RESTAURANT_SLIDES`'s
`ad1` for each city (`home-dom.ts:43`, `:51`). So the file the carousel now
opens on is the same file already inside the test's existing four-image
slice — not a fifth image to add, in the catalogue as it stands today. That's
the catalogue's own ordering, not something this document arranges, and it
should be confirmed rather than assumed permanent: the engineer's job is to
make this reasoning explicit in the test's own comment (as the current
`slice(0, 4)` comment already does for the old state), including what would
have to change — a fifth image, `ad1`'s `heroImage`, added to the sum rather
than assumed absorbed — if a later catalogue reorder ever puts a different
restaurant at `restaurantsForCity(city)[0]` than the one `CAROUSEL_RESTAURANT_SLIDES`
names as `ad1`. Leaving that link implicit is exactly how a future catalogue
edit would quietly under-count the budget.

**Amended for #214.** The reasoning directly above still holds for the
**fallback** state — `ad1`'s own restaurant photo, already inside the
existing `slice(0, 4)` sum, unchanged. It does not hold for the **shown**
state: once the owner configures a creative, the on-load slide's image is a
new asset the catalogue doesn't already own, not `ad1`'s `heroImage` — the
`slice(0, 4)` reasoning above was specifically that the on-load slide
"contributed nothing because it was text-only" (first-order) and, after
#184, "was the same file already inside the test's existing four-image
slice" (`ad1`'s own restaurant). Neither is true once a real creative is
configured: the shown state's image is a fifth, previously-uncounted file at
first paint. This document doesn't add a byte figure for it — the creative
doesn't exist yet (owner step, "Content shape," above) — but the engineer's
job, added to the note above rather than replacing it, is to make
`image-budget.test.ts`'s sum conditional on which state is live: `slice(0,
4)` alone while the fallback renders, plus the creative's own file size once
one is configured. Get the creative's byte count from the file the owner
supplies rather than assuming `RESTAURANT_THUMBNAIL_MAX_BYTES`'s 180KB
catalogue cap applies to it — nothing in this document sets a budget for a
sponsor creative, and that's a gap for whoever adds the config entry to
close, not an oversight to silently inherit a restaurant photo's cap.

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
| First-order banner claim (white), both themes (fixed, see "First-order banner" above) | banner gradient, lighter stop `#6c3ce0` | 6.25 | `./scripts/contrast '#ffffff' '#6c3ce0' 4.5` |
| First-order banner claim (white), both themes | banner gradient, darker stop `#2f1861` | 14.75 | `./scripts/contrast '#ffffff' '#2f1861' 4.5` |
| First-order banner sub (`#ece4ff`), both themes | banner gradient, lighter stop `#6c3ce0` | 5.09 | `./scripts/contrast '#ece4ff' '#6c3ce0' 4.5` |
| First-order banner sub (`#ece4ff`), both themes | banner gradient, darker stop `#2f1861` | 12.01 | `./scripts/contrast '#ece4ff' '#2f1861' 4.5` |
| First-order banner ticket amount (`#2f1861`), both themes (revised, PR #187 review) | ticket fill (`#ffffff`) | 14.75 | `./scripts/contrast '#2f1861' '#ffffff' 4.5` |

The banner's gradient is fixed across both themes (see "First-order banner,"
above), so one pair of rows covers both — the same reasoning the Ad-label row
above already uses for its own fixed scrim. Both stops are checked, not just
the darker one, because the gradient's lightest point (its `0%` stop) is where
contrast is tightest; every point between the two stops sits at or above the
lighter stop's own ratio, so checking both endpoints covers the whole gradient
the same way the Ad-label row's own "scrim floor" reference does.

Every pairing above except the last is also already covered by
`contrast.test.ts` — this table re-runs the same tokens in this component's
own combinations rather than asserting a new one. The `Flash` badge (white on
`--color-accent-a`) and the dots (`--color-border` inactive /
`--color-accent-a` active, both non-text UI) are the same tokens already in
that table too. The ticket-amount row is the one new pairing this revision
introduces — `#2f1861` (the gradient's own dark stop, already a value in this
document, but not previously checked directly against white) on `#ffffff`
(the ticket's own fill, new to this document) — and it is not yet in
`contrast.test.ts`; the "For the engineer" section below asks for it to be
added alongside the other assertions the carousel work is already touching.

**#214 introduces no new pairing.** The paid ad slide's caption
(advertiser label / tagline) sits in `.carousel-claim`/`.carousel-sub` on
`--color-surface` — the "Slide claim / tile name" and "Muted subline/meta"
rows above, already checked in both themes, cover it exactly, since "Content
shape" above specifies the same classes a catalogue `ad` slide already uses.
The fallback state is `ad1`'s own pre-#214 content, so it's covered by the
same rows it always was. The mocks' placeholder "TEST AD" graphic
(white and `#ece4ff` text on `#6c3ce0`, "Mocks," below) deliberately reuses
the first-order banner's own gradient light stop rather than a new color —
the "First-order banner claim/sub, lighter stop `#6c3ce0`" rows above (6.25
and 5.09) already cover both pairs. Nothing in this round needed a new
`./scripts/contrast` invocation because nothing in it introduces a token
combination the table didn't already have.

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

Each shows the full feed (header row, search, carousel on the
**first-order banner** slide — 4th of 7 per #184's reordering, and the state
#184's own acceptance criteria ask to be checked visually, since it's the new
graphic treatment this follow-up adds — with the dot row (4th dot filled) and
pause control, cuisine chips, "Near you," and the tile grid with one `Deal`
tile and one `Flash` tile) plus a small labelled reference strip immediately
under the live carousel showing an **ad**-type slide's anatomy side by side
with a **promo**-type slide's, since a static picture can only show one slide
"live" at a time and both anatomies still need checking even though neither
is the slide type #184 changed. Dark files hardcode the dark palette (this
repository's own convention — see `46-phone-native-dark.html` — `design-render`
doesn't emulate `prefers-color-scheme`, so a dark render has to carry its own
values rather than rely on the browser's OS setting).

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

**Amended for #214.** The live carousel slide in all four mocks is unchanged
— it still shows the first-order banner, since that's still the graphic
treatment nothing else in this codebase's rendered pictures cover. Each of
the four files gains a **second reference row**, below the existing ad/promo
one, labelled "Paid ad slide (#214) — shown vs. fallback": two
`.slide-ref-card`s at the same size and treatment as the existing reference
row, so the new row reads as more of the same convention rather than a
different one.

- **Shown-state card.** No real creative exists yet (owner step, "Content
  shape," above) — per the affiliate research's own "buildable now" note, the
  placeholder is "a self-hosted image clearly marked as a test ad." This mock
  draws it as an inline SVG (not a photo file) so the mock stays
  self-contained per this repository's own mock convention — nothing in
  `docs/design/` should need a build step or a new asset under `public/` to
  render, and the real creative doesn't exist to reference yet regardless.
  The SVG is a flat `#6c3ce0` rectangle (the app's own accent, not a new
  hue — see "Contrast checked," above, for why this choice needed no new
  check) with "TEST AD" in bold white and "placeholder creative" in
  `#ece4ff` beneath it, so a reviewer can immediately tell this is a stand-in
  and not the real Coursera creative. The "Ad" label sits over it exactly as
  it would over a real photo. Caption: **"Learn Data Analytics"** (bold,
  standing in for an advertiser label) / *"Structured courses, real
  datasets"* (muted, standing in for a tagline) — placeholder copy for the
  same reason the image is a placeholder, not real Coursera copy this
  document has no license to invent.
- **Fallback-state card.** The real Mission Taqueria (SF) / Bến Thành Bánh Mì
  (HCMC) photo and caption, already used elsewhere in these same mocks (the
  tile grid's first tile) — because the fallback state, per "Both states"
  above, is pixel-identical to `ad1`'s pre-#214 content. No new image
  reference for this card; it reuses the same `../../public/images/
  restaurants/mission-taqueria-hero.jpg` / `ben-thanh-banh-mi-hero.jpg` path
  the tile grid already points at in the same file.

This is why the fallback state doesn't get its own separate check beyond
this card: it's the same anatomy, same image, same tokens as the *existing*
ad-slide reference card one row up — there is nothing new about it for a
render to reveal.

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

**Revision round (2026-09-28, #184), after re-rendering all four mocks with
the first-order slide now live in the carousel:**

- **Legibility, the thing the acceptance criteria actually ask for:** in all
  four renders (both cities, both themes) the claim and sub read clearly
  against the gradient at both widths — confirmed against the picture, not
  just the computed ratios in "Contrast checked," above.
- **Cover the accent with your hand:** with the gradient covered, the banner
  slide is a blank purple rectangle with two lines of white text — it still
  reads as a designed surface, not a broken one, because the text hierarchy
  (bold claim, dimmer sub) carries on its own. The motif is decoration on top
  of that, not load-bearing for it.
- **Blur test:** at a squint, the banner reads as one solid violet block
  sitting where a photo sits on every other slide — the intended "carousel
  still looks like one rhythm, not six photos and one odd panel" read from
  the "Recommendation: A" reasoning above, confirmed rather than assumed.
- **What I considered removing:** the decorative motif. It's the one element
  on this slide that carries no information at all. Kept, for the reason
  given where it's specified — a hand over the gradient (not the motif) turns
  the slide back into a flat, undecided rectangle; the motif is what a flat
  color ground needed to stop reading as a placeholder, and at 15% opacity
  behind the text it never once competed with the claim or sub in any of the
  eight renders checked (four here, four from the prior round).
- **Dark theme, checked specifically:** the fixed gradient (identical values
  in both themes, per "First-order banner," above) sits noticeably lighter
  than the dark theme's own near-black page background, the same "reads as a
  deliberately different, fixed chip" effect the Ad-label scrim already gets
  in the dark mock — expected, and consistent with the rest of this
  document's reasoning for fixed chrome, rather than a new problem.

*(This round's "kept the motif" finding is superseded by the next round,
below — the driver's review on PR #187 read the same rendered motif as not
load-bearing, and it's gone from the design.)*

**Revision round (2026-09-28, PR #187 review), after replacing the motif with
the ticket and re-rendering all eight PNGs again:**

- **The thing the review actually asked for:** can a reviewer name the
  graphic from the 375px PNG alone? Yes, in all four narrow renders — it
  reads as a coupon or ticket immediately (the notched sides and the dashed
  tear-line are doing that work), not as an abstract rounded shape. This is
  the test the first round's motif failed and this round is built to pass.
  Cross-checked against the wide renders too: same read, more breathing room
  around the shape.
- **Is the amount the focal point?** In all eight renders, the eye lands on
  the white ticket before the sentence beside it — solid white on saturated
  violet is the highest-contrast thing on the slide, and the amount is the
  largest text on it. Covering the ticket with a hand, "your first order"
  alone reads as an incomplete sentence rather than a claim — which is
  correct: the amount is now load-bearing for the sentence's meaning, not
  merely decorative the way the old motif was for the ground.
- **The HCMC case, specifically:** `10.000 ₫ off` was the long value this
  round's own arithmetic was checking. First attempt at this shape (a
  92px-wide ticket, the amount on one line) overflowed the ticket's right
  edge in the very first render — caught by rendering, not by the
  arithmetic, which is why this is written down rather than only fixed
  silently. Widened the ticket to 116px and split the value from its `off`
  label onto two lines; re-rendered, and `10.000 ₫` now sits inside the
  ticket with visible margin on both sides in both the narrow and wide HCMC
  renders, in both themes.
  *(This finding was wrong — the driver's second review on PR #187 read the
  actual committed PNGs and found the value still overflowing the right edge
  and the notch, wrapped onto its own line, in `hcmc-dark-narrow` and
  `hcmc-light-wide`. The "visible margin on both sides" claim above was
  written without opening those two files again after the last edit to this
  section — see the next round's critique, below, for the fix and for what
  changed about how this document checks a claim like this one before making
  it.)*
- **Cover the accent with your hand (redone):** covering the gradient itself
  (not the ticket), the slide keeps a white ticket with dark text floating on
  nothing, which reads as broken rather than designed — unlike the first
  round, the gradient is no longer optional background, it's what makes the
  ticket read as sitting *on* something. This is a stronger dependency on the
  gradient than the previous round had, and it's the correct one: the ground
  is now doing real compositional work instead of being a tinted rectangle a
  motif was patching.
- **Blur test:** at a squint, the slide now reads as a violet block with one
  bright rectangular highlight on the right — still one solid shape in the
  carousel's rhythm (per the original "Recommendation: A" reasoning), with a
  clearer focal point than the blurred first-round render had.
- **What I considered removing:** the dashed tear-line inside the ticket. Kept
  — without it, the notched rounded rectangle reads as a generic pill or a
  loyalty-card shape rather than specifically a coupon; the tear-line is what
  a reviewer's eye uses to name it "ticket" rather than "rounded rectangle
  with two dents," per this round's first finding above.
- **Reading order, checked by reading the DOM, not just looking at the
  picture:** the panel's source order is ticket-amount, then "your first
  order," then the sub — `row-reverse` only changes paint order, not DOM
  order, so a screen reader still meets "$2 off," "your first order,"
  "Applied automatically at checkout" in that sequence, matching the original
  unsplit sentence. Confirmed by reading the markup in each of the four
  mocks, not assumed from the CSS alone.

**Revision round (2026-09-28, PR #187 second review, the last round), after
widening the ticket and re-rendering all eight PNGs a third time:**

- **The two PNGs the review named, checked directly, not re-derived:**
  `137-home-feed-hcmc-dark-narrow.png` and `137-home-feed-hcmc-light-wide.png`
  were opened first, since those were the review's own evidence. `10.000 ₫`
  now sits on one line, fully inside the ticket, with visible margin from the
  right edge, the notch cutout, and the tear line in both. The other two
  HCMC renders (`hcmc-light-narrow`, `hcmc-dark-wide`) were checked the same
  way rather than assumed to follow from the two the review named — same
  result in both.
- **What actually fixed it, and why the first attempt (116px, two-line
  split) didn't:** the failure wasn't the value/`off` split — that was
  already two lines — it was that `10.000 ₫` itself, one line at `1rem`,
  needed roughly 70px and the ticket's right compartment (after the tear
  line, before the notch) only had about 50px to give it, at either 116px or
  the notch-avoidance a vertical reposition would have bought. No amount of
  layout tweaking inside that compartment was going to fit an 8-character
  string in 50px at that size, which is the arithmetic this document should
  have run before the last round's "visible margin" claim. Fixed with two
  changes, not one, because neither alone was enough: the ticket widened to
  148px (giving the compartment room), and the HCMC value alone stepped down
  to `0.8125rem` via `.carousel-banner-ticket-value--compact` (giving the
  string itself less room to need). `white-space: nowrap` replaced
  `overflow-wrap: break-word` on the value so a future string that still
  doesn't fit overflows visibly in the next render instead of silently
  wrapping into the notch again.
- **SF, checked for a regression this round could have caused:** widening
  the ticket 116px → 148px shrinks the copy column (`.carousel-banner-copy`)
  by the same 32px, on both cities. `$2` (SF, unmodified `1rem`, not
  `--compact`) still sits centered in the ticket with generous margin in all
  four SF renders — it was never the tight case. The copy column's own
  wrapping (already noted as acceptable in the first revision round, since
  "checkout" was already wrapping in HCMC before this round) is unchanged in
  SF and reads the same as every prior round's renders.
- **"Your first order," checked against all eight renders, not just one:**
  reads as a complete phrase, capitalized, beside the ticket in every render
  — the lowercase fragment the review flagged is gone everywhere, not just
  in the two PNGs named.
- **What this round did not touch, confirmed by re-reading the diff before
  committing:** the gradient, the ticket's notch/tear-line silhouette itself
  (only its size and the tear line's offset moved, not its shape), the
  ticket-amount contrast pairing (`#2f1861` on `#ffffff` — a size change
  doesn't change a ratio), and the reading-order/DOM-order reasoning from the
  round above, which doesn't depend on the ticket's exact pixel width.

**Revision round (2026-09-28, #214), after adding the paid-ad-slide
reference row to all four mocks and rendering all eight PNGs again:**

- **Legibility, this issue's own AC4:** in all eight renders (both cities,
  both themes, both widths) the "TEST AD" placeholder text, the "placeholder
  creative" subline, and the "Ad" label sitting over the violet card are all
  clearly legible — the label reads exactly as it does over a real photo two
  cards to its left, no scrim adjustment needed. The fallback card (Mission
  Taqueria / Bến Thành Bánh Mì) reads identically to the existing ad-slide
  reference card one row up, which is the point: nothing distinguishes it
  from `ad1`'s pre-#214 rendering, because nothing about it changed.
- **First look, narrow width, re-checked:** the eye still lands on the
  first-order banner first — the new row sits below two existing reference
  rows and doesn't compete with the live carousel, same as the original
  ad/promo reference row already didn't.
- **Cover the accent with your hand:** covering the "TEST AD" card's violet
  fill, it becomes a blank rectangle with invisible white text — same
  "reads as broken, not designed" result the first-order banner's own
  critique found for its gradient, and for the same reason: the color was
  never decoration here either, since there's no photo standing in for it.
  This is expected and consistent with why the fixed accent was chosen
  rather than a truly blank placeholder box.
- **Blur test:** at a squint, the new row reads as one more pair of small
  labelled cards under the two already there — same rhythm, not a third,
  visually distinct block competing for attention.
- **What I considered removing:** the "placeholder creative" subline inside
  the TEST AD card. Kept — without it, a reviewer glancing only at the wide
  render could mistake violet-plus-white-text for an intentional creative
  direction rather than a stand-in; the subline is what makes "this isn't
  the real thing" legible in the picture itself, not just in this document's
  prose.
- **Consistency check against the existing reference row, read side by
  side:** same card size, same dashed border, same caption typography, same
  "Ad" label position and scrim — a reviewer's eye treats the new row as
  more of the established convention on first look, in all eight renders,
  not a new one to learn.

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

**Added for #184:**

- **Slide order.** Splice the first-order slide into index 3 of the combined
  seven-slide sequence — `CAROUSEL_RESTAURANT_SLIDES`'s own six-entry array
  (`home-dom.ts:41`-`:58`) is unchanged by this document; `carouselSlidesForCity`
  (`home-dom.ts:68`-`:90`) is what currently hardcodes `[firstOrder,
  ...restaurantSlides]` and needs to become `[...restaurantSlides.slice(0, 3),
  firstOrder, ...restaurantSlides.slice(3)]` or equivalent. `home-dom.test.ts`'s
  slide-order assertions (and any test asserting `carousel-dot-0` is the
  first-order slide, or that `prefers-reduced-motion` holds on the first-order
  slide) need to move to the new index deliberately, watched red before green,
  per house-rules.
- **First-order banner.** `.carousel-slide-panel` (`home-dom.ts:266`-`:278`)
  gets the gradient background and the row-reverse layout specified in
  "First-order banner," above — the element and its own `data-testid` stay.
  Its `-claim` child (`panelClaim`, `home-dom.ts:270`-`:272`) is no longer set
  to the full `slide.claim` string: it now gets the sentence's tail only,
  capitalized (`Your first order`), and the amount moves to a new sibling.
  This is a DOM
  change, not just a CSS one — the review's ask (the amount visually distinct
  from the rest of the sentence, at a size this document's rule wouldn't
  otherwise allow) can't be done by styling a single text node in parts.
  Concretely: add a `PROMO_BANNER_AMOUNT: Record<City, string>` constant next
  to `PROMO_BANNER_CLAIM` (`home-dom.ts:33`-`:36`) — `{ sf: '$2 off', hcmc:
  '10.000 ₫ off' }` — and keep `PROMO_BANNER_CLAIM` itself unchanged (other
  code may still read the full sentence). In the panel-building branch
  (`home-dom.ts:266`-`:278`), build, in this DOM order: (1) a `.carousel-slide-panel-ticket`
  wrapper holding the decorative `<svg>` (`aria-hidden="true"` on the `<svg>`
  itself, not the wrapper — the amount text must stay in the accessibility
  tree) plus a `.carousel-slide-panel-amount` element split into a value span
  (the amount minus its trailing `off`, e.g. `$2` / `10.000 ₫`) and an `off`
  span; then (2) the existing `panelClaim` (textContent now `Your first
  order`) and `panelSub` inside their own wrapper. `panelClaim`'s own
  `data-testid` (`carousel-panel-claim`) stays on that element; give the new
  amount element its own testid (e.g. `carousel-panel-amount`) so a test can
  assert it independently rather than string-matching a substring of the
  claim. `home-dom.test.ts`'s existing assertion that `carousel-panel-claim`
  equals the full claim sentence needs to move deliberately to the new
  split (asserting the amount and the tail separately), watched red before
  green, per house-rules — this is exactly the kind of test a revision has to
  touch on purpose rather than loosen. The exact SVG markup (148×104
  viewBox, notch circles at `cx=8`/`cx=140`, `r=9`, `cy=52`, tear line at
  `x=42`), the mask-based notch technique, and the class names' CSS are in
  "First-order banner," above and the four mocks
  (`docs/design/137-home-feed-*.html`); copy the `<path>`/`<mask>` values
  from there rather than redrawing them, and give the mask a
  component-scoped id (e.g. `carousel-ticket-notch`) since, unlike the
  mocks, only one instance of this slide ever exists in the DOM at once.
  **Apply `.carousel-banner-ticket-value--compact` to the value span only
  for the long (HCMC) string** — the amount steps down to `0.8125rem` there
  because `10.000 ₫` doesn't fit the ticket at `1rem` (see the last critique
  round, above, for the render that proved it); SF's `$2` keeps the base
  `1rem` and gets no modifier class. This document doesn't prescribe how the
  engineer decides which is which (a per-city map alongside
  `PROMO_BANNER_AMOUNT`, a length check on the string, or a CSS
  `container`/`clamp()` alternative that fits both without a modifier are
  all reasonable); whichever is chosen, `home-dom.test.ts` should assert
  which class (or computed size) the HCMC amount renders with, not just that
  it renders.
  `.carousel-slide-media--first-order`'s existing 56px-growth rule
  (`home-dom.ts:297`) is unaffected — the banner still needs the full 256px,
  same as before, just filled differently.
- **Contrast test.** Add the new ticket-amount pairing (`#2f1861` on
  `#ffffff`, 14.75:1) to `contrast.test.ts` alongside whatever assertions
  this issue's other carousel changes already touch there — see "Contrast
  checked," above, for why this one pairing isn't covered by an existing row.
- **Image budget.** `image-budget.test.ts`'s first-paint test and its own
  comment need to say explicitly that the carousel's on-load slide is now
  `ad1`'s restaurant, and why that restaurant's `heroImage` is already inside
  the existing `slice(0, 4)` sum rather than a fifth image — see "Image
  budget," above, for the exact reasoning and the two source lines it depends
  on (`restaurants.ts:50`/`:257`, `home-dom.ts:43`/`:51`). Unaffected by this
  round's banner rework: the ticket is still CSS/SVG, zero new bytes.

**Added for #214:**

- **A new, city-independent config, not a sixth `Record<City, ...>` entry.**
  `CAROUSEL_RESTAURANT_SLIDES` (`home-dom.ts:76`-`:93`) stays a six-entry
  array per city, unchanged — `ad1`'s entry is still needed, for the
  fallback. Add a separate constant next to it, shaped for one shared
  creative rather than per-city (unlike everything else in this file):
  ```ts
  interface SponsoredSlide {
    image: string;
    advertiserName: string;
    tagline: string;
    destinationUrl: string | null; // null until the owner supplies one
  }
  const SPONSORED_SLIDE: SponsoredSlide | null = null; // unset until configured
  ```
  `null` (or a `destinationUrl` of `null`/empty) is "not configured" — both
  read the same as "no creative," per "Both states," above; this document
  doesn't prescribe which of the two the engineer picks, only that "no
  creative" and "creative present but its `destinationUrl` is missing" must
  not be treated differently, since a slide with an image and no destination
  is not a usable ad either.
- **Splicing the paid slide into position 1.** `carouselSlidesForCity`
  (`home-dom.ts:103`-`:128`) currently builds `restaurantSlides` from all six
  `CAROUSEL_RESTAURANT_SLIDES` entries and splices `firstOrder` into index 3.
  It now has to build the *shown-or-fallback* slide for index 0 first —
  `SPONSORED_SLIDE`'s data (type stays `'ad'`, per both research documents'
  own note that no new `type` value is needed yet) if configured, else
  `CAROUSEL_RESTAURANT_SLIDES[city][0]` unchanged (today's `ad1` mapping) —
  and only then splice `firstOrder` in at index 3 of the resulting seven,
  exactly as #184 already does. The remaining five restaurant slides
  (`CAROUSEL_RESTAURANT_SLIDES[city].slice(1)`) are unaffected: `ad2`, `ad3`,
  and all three promo slides keep their #184 positions and content untouched.
- **The `onerror` fallback.** Only the paid slide's `<img>` needs this — no
  other slide has a fallback path. On `error`, swap that slide's rendered
  content (photo `src`, claim, sub, href) to `CAROUSEL_RESTAURANT_SLIDES[city][0]`'s
  values in place, without touching `current`, the interval, or any other
  slide's DOM — the same box, so no reflow. `home-dom.test.ts` needs a test
  that fires a synthetic `error` event on the slide-1 image (happy-dom
  supports dispatching it) and asserts the fallback's claim/sub/href appear,
  per the affiliate research's own "Blocked-path tests" note and house-rules'
  "watch it fail before trusting it green."
- **Link attributes.** `rel="sponsored noopener"` and `target="_blank"` on
  the paid slide's `<a>` only — every other slide's link stays an in-app,
  same-tab navigation, unchanged. Never append a query parameter to
  `destinationUrl`, and never pass `getVisitorId()`'s value into it — "Content
  shape," above, for why.
- **Contrast test.** No new `contrast.test.ts` assertion — "Contrast
  checked," above, for why this round introduces no new token pairing.
- **Image budget.** See "Image budget"'s "Amended for #214" note, above —
  `image-budget.test.ts`'s sum needs to branch on whether `SPONSORED_SLIDE`
  is configured, not just add a flat fifth image unconditionally.
- **No `track()` calls, event-contract edits, or migrations in this issue** —
  restated from #184's own note above, and still true: the carousel sends no
  events today, and this document doesn't change that. `docs/research/204-
  ad-source.md`'s "Constraints for the downstream children" section is the
  one to read before the later analytics-readiness objective adds impression
  and click tracking here — in particular, no ad-network identifier,
  advertiser id, affiliate tag, or the visitor id may ever go into an event,
  and the store rejects an unknown slide-`type` shape silently rather than
  loudly (ADR 0005), which is exactly why this document keeps `type: 'ad'`
  unchanged rather than inventing `'sponsored'` now.
