# Mocks for the tall flash-deal sheet and its collapsed reopen bar

Spec for issue #119, child of parent #117 ("bottom nav always on top, a
Grab-size flash deals sheet, and a real delivery ETA with a live
countdown"). This document only covers the sheet and its collapsed state —
the tab bar's always-on-top stacking and the delivery-ETA countdown are
#117's other children, not restated or changed here. It replaces the small,
two-row card `docs/design/87-flash-sheet-hcmc.html` (built for #87) with a
Grab-sized sheet, and gives the flash mechanic a San Francisco mock for the
first time — #87 only ever shipped a Ho Chi Minh City one.

## The outcome, the constraints, the guesses

**Outcome (fixed, from the issue):** the sheet reads as the dominant thing on
screen when it opens — a fixed header (amount, split MM:SS countdown,
minimum-spend line) over a scrolling list of 5–6 deal restaurants — and
collapses, on dismissal, into a slim bar pinned directly above the tab bar
that reopens the sheet on tap.

**Constraints, checked against the code and the reused docs rather than
assumed:**

- The violet `#6C3CE0`/`#FF7A45` system, the `--color-*` tokens, and the
  radius scale this issue's own acceptance criterion narrows to — `10px`,
  `12px`, `999px` — from `docs/design/80-home-sf.html` /
  `87-flash-sheet-hcmc.html`. This is narrower than what those two files
  actually contain (the old sheet mock itself used `20px`, `8px`, `4px` in
  places); the new mocks hold to the three named values throughout, checked
  by `grep` below, rather than carrying the old file's wider set forward.
- `docs/memory/designer.md`'s lessons, applied directly: the render is
  viewport-sized so the sheet's own internal scroll region is what clips a
  6th row, not a page-scroll problem; the collapsed bar's mock includes the
  real tab bar rather than just its reserved space; CSS override order isn't
  at stake here (no two rules target one selector at differing specificity);
  every icon is inline SVG; no text run gets `display: flex` for no reason
  of its own.
- The 15-minute countdown length, the per-restaurant fee mechanic (free or a
  flat reduction off the normal fee), and the HCMC figures (₫15.000 off,
  ₫80.000 minimum spend) are #87's own settled values, carried forward
  unchanged rather than re-decided here.
- No event or contract change, no `src/` change — this issue's own scope
  line, and the parent objective's "event tracking comes last" rule
  (`CLAUDE.md`).

**Guesses this document is making, called out as such:**

- The San Francisco flash figures ($5.00 off, $10.00 minimum spend) are a
  plausible draw inside #87's already-settled $2–$6 range and fixed $10.00
  minimum — not a value anyone measured, and not a new decision: #87's own
  catalogue already reserved this range for a city that had no mock yet.
- The six named restaurants per city are a plausible draw from each city's
  existing catalogue (`80-home-hcmc.html` / `80-home-sf.html` name four of
  them already; two per city — HCMC's `Cơm Tấm Sài Gòn`, SF's `Bay Bao House`
  and `Ramen Yotsuba` — are invented in the same plausible style this
  repository's other mocks already use for restaurant names). A different
  session would show a different six, per #87's per-session draw mechanic.
- The collapsed bar's fill color (`--color-accent`, matching the open
  sheet's header) is this document's own call — the issue's reference
  describes the bar's content and position, not its color. Kept
  purple-filled rather than a plain surface tile so the collapsed state
  still reads as "the same flash thing, tucked away" rather than a
  different, unrelated component.
- The per-row ETA figures are single numbers (`18 mins`, `29 mins`, …),
  matching the issue's own reference line exactly, rather than the range
  format (`20–30 min`) `80-home-*.html`'s ordinary restaurant cards still
  use elsewhere. This isn't this issue's call to make consistent — #117's
  other child is replacing every ranged ETA with a single random draw
  network-wide, and single numbers here anticipates that without
  implementing it.

## Look outside this repository

- **The Material Design 2 bottom-sheet spec** (still the reference
  vocabulary for this component as of 2026): a drag handle, rounded top
  corners, and a scrim behind a modal sheet. I'm taking the anatomy
  directly — it's what `87-flash-sheet-hcmc.html` already used — and
  refusing its suggestion that a bottom sheet's own body scroll and its
  header scroll together; this issue's fixed-header-over-scrolling-list
  split is a deliberate departure the reference itself names as the
  "expanding" bottom sheet.
- **NN/g's bottom-sheet guidance**: a sheet that starts modal in its full
  state and a non-modal collapsed remnant staying reachable is the general
  shape of "expand/collapse," and I'm taking that framing for why dismissal
  doesn't mean gone. I'm refusing NN/g's own preferred trigger for that
  transition — a drag gesture that leaves the sheet partially open — because
  the issue's own model is binary (open sheet, or collapsed bar, reached by
  a tap either way) rather than a draggable range of intermediate heights.
- **iOS 26's tab-bar "bottom accessory"** (Apple's own current pattern,
  shown by Apple Music's mini-player: a slim row that lives directly above
  the tab bar and collapses inline with it): I'm taking the structural
  precedent directly — a persistent slim bar anchored to the tab bar's own
  top edge is now a platform-native pattern, not a bespoke stack this app
  invented — and refusing its glass/blur material, since this app's system
  is flat color fills throughout (#80/#87), and a second depth language for
  one bar would be exactly the "one language of depth" violation
  `design-craft` warns about.

## What "modern" means here, stated up front

Two or three adjectives: **dominant, textured, legible**. Not: a card that
happens to be taller. The header has to be the first thing the eye lands on
(dominant), the decorative tag graphic and the fixed-header/scrolling-list
split have to read as one considered idea rather than a stack of default
choices (textured), and every row has to hold up at 375px with no clipped
name and no ambiguous icon (legible — the repository's own recurring
failure mode, per `docs/memory/designer.md`).

## Components (named once)

- **`.sheet`** — fixed to the viewport bottom, `height: 88vh` (not a pixel
  guess: a percentage of the viewport height directly produces "roughly
  85–90% at 375px" at any viewport, which is what the acceptance criterion
  asks for), `border-radius: 12px 12px 0 0`, `overflow: hidden` so its own
  rounded corners clip everything inside, including the header's full-bleed
  color block.
  - **`.handle-strip`** — the drag handle and the "×" close glyph, on the
    sheet's plain background, above the header rather than inside it, so
    the header itself stays a clean full-bleed rectangle.
  - **`.sheet-header`** — full width, no side inset, `--color-accent` fill,
    white text: the amount heading, the countdown, and a low-opacity
    decorative tag icon cropped by the header's own `overflow: hidden`.
    Never inset with padding around it — that was the old mock's card-style
    header, and this issue's reference is explicit that the new one is a
    color block spanning the sheet's full width.
  - **`.countdown` / `.tile`** — two tiles and a separator, `var(--color-
    text)` fill (not a new fixed dark hex — see below) with white tabular
    numerals.
  - **`.min-spend-line`** — plain sheet background, muted text, between the
    header and the list.
  - **`.deal-list`** — `flex: 1; overflow-y: auto` — the only region that
    scrolls; the header and minimum-spend line are flex siblings above it
    that never move.
  - **`.deal-row`** — photo tile (80px, `10px` radius, gradient between
    `--color-accent` and `--color-border` — the same gradient
    `80-home-sf.html` already uses for a placeholder photo, not a new one),
    a pill "Deal" sticker, name (bold, one line, ellipsis-truncated), a
    rating/price-level/cuisine line, and a deal-price line (bold accent
    price, struck-through original, muted minutes).
- **`.reopen-bar`** (the collapsed state, new) — full width, rounded top
  corners, `--color-accent` fill, the amount on the left, a lightning icon
  and the same two-tile countdown on the right. Sits in a `.bottom-stack`
  flex column directly above `.tab-bar`, both fixed to the viewport bottom —
  a shared ancestor rather than a pixel offset guessed against the tab bar's
  own height, so the two can never drift apart if either one's height
  changes later.

## The tile color, not a new hex

`87-flash-sheet-hcmc.html` fixed its countdown tiles to a hardcoded
`#1A1230`/`#FFFFFF` pair, justified in `87-promo-offers-and-flash.md`'s
Contrast section as deliberately theme-independent. This issue's own
acceptance criterion narrows the allowed palette to existing tokens, so
these mocks use `var(--color-text)` (`#241B33`) as the tile fill instead —
close to the same near-black, already an existing token, and one fewer fixed
hex for the next reader to reconcile against the token list. Contrast holds
either way (below).

## Contrast — every pairing this document introduces or reuses, computed

Run with `./scripts/contrast <fg> <bg> 4.5`:

| Pair | Context | Ratio | Passes 4.5:1? |
|---|---|---|---|
| `#FFFFFF` on `var(--color-accent)` (`#6C3CE0`) | header amount text, countdown separator | 6.25 | yes |
| `#FFFFFF` on `var(--color-text)` (`#241B33`) | countdown tile numerals | 16.41 | yes |
| `var(--color-text)` (`#241B33`) on `var(--color-accent-secondary)` (`#FF7A45`) | "Deal" sticker | 6.35 | yes |
| `var(--color-text-muted)` (`#6B5D85`) on `var(--color-bg)` (`#FBF7FF`) | minimum-spend line, struck-through price, ETA minutes | 5.62 | yes |
| `var(--color-accent)` (`#6C3CE0`) on `var(--color-bg)` (`#FBF7FF`) | deal price | 5.91 | yes |

`var(--color-text)` on `var(--color-accent)` (dark ink directly on the
purple fill) was checked and **fails** at 2.63 — confirming why every label
on the accent-filled header and reopen bar stays white, never the ink color,
matching `87-promo-offers-and-flash.md`'s own established rule for this
pairing.

## The mocks

Rendered at both widths with `./scripts/design-render`, light theme only —
this repository's own convention (`87-promo-offers-and-flash.md`): dark is a
token swap, not re-proven per mock.

- `docs/design/119-flash-sheet-open-hcmc.html` — the tall sheet, Ho Chi Minh
  City: ₫15.000 off, ₫80.000 minimum spend, six rows.
- `docs/design/119-flash-sheet-open-sf.html` — the same, San Francisco:
  $5.00 off, $10.00 minimum spend, six rows.
- `docs/design/119-flash-bar-collapsed-hcmc.html` — the collapsed reopen
  bar over a normally-scrolling feed, Ho Chi Minh City.
- `docs/design/119-flash-bar-collapsed-sf.html` — the same, San Francisco.

Eight PNGs total (four files × two widths), committed alongside.

## Critique, after opening the rendered pictures

- **Real finding: a stray `4px` radius survived from the old mock's feed
  skeleton and violated this issue's own acceptance criterion.** The
  dimmed background feed behind the scrim reused `87-flash-sheet-hcmc.html`'s
  skeleton-line styling verbatim, including its `border-radius: 4px` — legal
  in the old file, not in the three values this issue's own criterion
  narrows the new files to. Caught by grepping my own new files for radius
  values before calling the mocks done, not by looking at the picture (a
  4px-vs-10px radius on a 10px-tall decorative line is not something a
  screenshot could show a difference on). Changed to `10px` in all four
  files and re-rendered; the pictures are pixel-indistinguishable, which is
  itself the confirmation that nothing about the visible design depended on
  the old value.
- **Checked, both open-sheet renders, narrow:** the header (amount +
  countdown) is what the eye lands on first, matching the "dominant"
  adjective from the direction statement — the purple fill and the size
  jump from the countdown numerals to the body text below are doing that
  work together, not the accent color alone (see the hand-cover check
  below).
- **Checked, both open-sheet renders, narrow:** only four of the six rows
  are visible before the sheet's own bottom edge — the fifth and sixth are
  genuinely off-screen inside the scrolling region, not merely styled to
  look cut off. That's the scrolling list the acceptance criterion asks
  for, verified by what's absent from the picture rather than present in
  it.
- **Checked, both open-sheet renders:** no restaurant name clips or wraps at
  375px — the longest name in either city's six (`Bún Chả Hà Nội Quán`,
  `Golden Dragon Dim Sum`) stays on one line with room to spare before the
  `text-overflow: ellipsis` rule would ever engage.
- **Checked, both collapsed-bar renders, narrow and wide:** the bar's
  rounded top corners sit flush against the tab bar's top edge with no gap
  and no overlap, at both widths — the shared `.bottom-stack` ancestor
  (rather than a guessed pixel offset) holding regardless of viewport.
- **Covering `--color-accent` with my hand**, both open-sheet renders: the
  header's white-on-purple amount text goes white-on-nothing and
  disappears, as expected for a color block — but every row below still
  reads as a deal without it, from the bold price weight, the
  strikethrough, and the orange "Deal" sticker (a separate token) alone.
  The accent is doing the header's job, not carrying the whole list.
- **Blurring the picture**, both open-sheet renders: the purple block up top
  and the repeating row rhythm below survive as the composition — two
  bands, not a wash of undifferentiated card.
- What I'd remove if forced to cut one thing: the decorative tag-icon crop
  in the header. It stayed because covering it (mentally) leaves the header
  as flat color and two lines of text — readable, but exactly the "uniform
  padding, nothing textured" dated tell `design-craft` warns about — and the
  icon is the one deliberate oddity earning its place under that heading.

## No ADR

This document's own new shape — `.bottom-stack` as a shared fixed ancestor
for the reopen bar and tab bar — is a layout pattern, not a schema, service,
or first dependency from a new ecosystem; nothing here crosses the
house-rules bar for a decision record. The restaurant/session/draw data
shape is #87's, unchanged.

## Who reads this

- **The engineer who eventually builds #117's flash-sheet child** (not
  queued by this issue — the parent issue's own scope line keeps this
  document to design only): the component list, the `88vh` sizing rule, the
  `.bottom-stack` pattern for the collapsed bar, and the contrast table
  above are what that build checks itself against.

## Out of scope, unchanged

No `src/` change, no event or contract change, no A/B test, no real brand's
marks — per this issue's own scope line and the parent objective's
"event tracking comes last" rule.
