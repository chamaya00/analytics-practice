# Phone-native card, nav, and dark theme

Spec for issue #46, serving parent objective #45. Extends the shipped
Signal × Field Notebook hybrid (`docs/design/5-second-pass-directions.md`,
tokens in `src/styles/global.css`) rather than replacing it: the type
scale and spacing scale below are unchanged, only the color tokens grow
a dark counterpart. Builds on the SwipeCard structure just rewritten in
`docs/design/3-swipe-poll.md` — read that first; this document does not
repeat the card's states, it specifies everything the objective asked
for around that card: nav, dark palette, touch feedback, motion, and
safe areas.

## The outcome, the constraints, the guesses

**Outcome (fixed):** the site reads as built for the phone in hand —
one card flung as a whole, primary nav within thumb reach, correct on
a notched/rounded-corner phone in both orientations, matches the OS's
light/dark preference at readable contrast, and feels pressed rather
than text-selected.

**Constraints (checked, not assumed):** the type scale and spacing
scale in `src/styles/global.css` stay as they are — extending them is
out of scope, per the objective. The A/B accent mechanic (variant `a`
cool, variant `b` warm) is fixed by `docs/design/3-swipe-poll.md` and
must keep its meaning in every theme. No manifest, no service worker,
no install/offline story. `drag-gesture.ts`'s threshold (80px / 0.5px
per ms / mostly-vertical rejection) is unchanged — issue #46 asks what
element the gesture attaches to, not what the gesture is.

**Guesses this document is making, called out as such:** whether the
top header keeps its nav links on phone at all (I'm removing them —
see Nav below), whether the tab bar carries icons (I'm not adding any
— see Nav below), and the exact dark palette hex values (chosen and
contrast-checked below, but a hex value is always a judgment call, not
a derivation).

## Look at what's there today

I built the current site (`npm run build`) and rendered both pages
with `scripts/design-render` at 1280×900 and 375×812. The render is
partial evidence, not full: the built pages load their JS bundle from
a root-absolute path (`/_astro/...`), which a `file://` URL — the only
kind `design-render` can open — cannot resolve, so the SwipeCard,
DogfoodingView, and their styles never mount in this method of
viewing. What does render is the static shell: `BaseLayout` and
`Header`. At 375px, the header stacks — site name on its own line,
then "Swipe poll" and "Results" as plain inline text directly beneath
it, "Swipe poll" underlined to show it's current. At 1280px the same
two links sit top-right, name top-left, on an otherwise near-empty
cream page (the card itself is invisible for the reason above). Two
things this confirms independent of the JS-loading gap: the header is
genuinely the only nav today, and it stacks rather than reshapes into
anything resembling a phone-native pattern — exactly the gap issue #46
names. It also confirms, first-hand, why the role's method insists on
a self-contained rendered mock rather than a built page: the build
artifact and the thing a design criterion can be checked against are
two different files here, and only one of them is `file://`-openable.

## Look outside this repository

- **Bottom tab bars, 2026 shape.** Current mobile guidance keeps
  bottom tab bars as the default primary-nav pattern (3–5 destinations,
  always enabled, never conditionally hidden) — this site has exactly
  two, comfortably inside that range. iOS 26 moved its own system tab
  bar to a floating, centered, pill-shaped container rather than a
  full-width bar. I'm taking the "always enabled, obvious current-item"
  part and refusing the floating-pill part: a floating tab bar reads as
  an iOS-specific system chrome choice, and this is a two-destination
  web page, not an iOS app chasing platform parity — a full-width bar
  fits this hybrid's "console"-leaning structure (Signal) better than
  a pill sitting on top of the page.
- **Dark mode as the primary surface, not an inversion.** 2026 mobile
  design coverage describes dark mode as a first-class theme designed
  alongside light, not derived from it by inverting values — which is
  exactly what `design-craft` already warns produces the worst
  accessibility failures. I'm taking that principle directly: the dark
  palette below keeps the same warm, paper-adjacent identity as the
  light one (a dim, lamplit page, not a cold console), rather than
  reusing Signal's own near-black/steel palette from the second-pass
  document, which would read as a different product at night.
- **Tinder-style card release motion.** Common implementations settle
  on an ease-out curve in the 300–500ms range for the completed
  swipe-away, with the card tracking the finger 1:1 (no easing) while
  a drag is in progress and only the release getting an eased
  animation. I'm taking the split (linear while held, eased on
  release) and refusing the longer end of that duration range — see
  Motion below.

## Direction

**Pocketable, tactile, unmistakably a phone's.** Every value below
answers to that, not to "responsive" — a responsive page that reflows
correctly can still read as a desktop page that happened to fit. It
must not look like a shrunk desktop layout wearing a hamburger menu,
and it must not borrow default system chrome (no default blue links,
no OS-default tab bar styling, no bare `:active` browser highlight) —
this hybrid already has a structure and a palette, and the phone
surface should look like the same product's own compact form, not a
generic mobile template applied on top of it.

## Nav: tab bar on phone, unchanged header on desktop

**`Header.astro` stays one component that reshapes at a breakpoint.**
It already owns the single list of destinations (`Swipe poll`,
`Results`); a second component would fork that list into two places
that can drift, for a page with exactly two destinations — not worth
it. The breakpoint stays `480px`, the value the header already
stacks at today, so this doesn't introduce a second breakpoint to keep
in sync with the first.

**At `480px` and above (desktop/tablet): unchanged.** Site name left,
the two nav links right, current page shown with an underline exactly
as today. Nothing here regresses the wide render — this is the
"deliberate desktop layout" the acceptance criteria ask to still see.

**Below `480px` (phone): the header stops carrying nav at all.**
Duplicating nav in two places (top links and a bottom bar) is worse
than either alone — a visitor would have two "am I here" indicators to
reconcile. So on phone:

- The top region becomes a slim bar with only the site name, no links,
  padded for the top safe-area inset (see Safe areas below). It scrolls
  with the page as it does today — it's branding, not the nav surface,
  so it doesn't need to stay pinned.
- The nav links move into a **bottom tab bar**: `position: fixed`,
  full width, anchored to the bottom of the viewport, one tab per
  destination, each tab a `min-height: 44px` tap target evenly
  splitting the width, label text only — no icon system exists
  anywhere on this site today, and inventing one for two destinations
  is scope this issue didn't ask for. Background `--color-surface`, a
  `1px` top border in `--color-border`, sitting above page content
  (page content gets bottom padding equal to the bar's height plus its
  safe-area inset so nothing renders underneath it).
- **Current page without an underline:** the active tab's label sets
  its color to that page's... there is no per-page accent in this
  site, so the active tab uses `--color-text` at full weight (700) on
  a filled pill — a rounded-rect background in `--color-surface`'s
  neighboring tint (see palette below, `--color-tab-active-bg`) sized
  to the label — while the inactive tab is `--color-text-muted` at
  regular weight, no pill. `aria-current="page"` stays on the element
  either way, unchanged from today, so nothing here weakens the
  non-visual signal.

## Dark palette

New tokens, added to the existing set in `src/styles/global.css` —
none of the light tokens change, and the type/spacing scales are
untouched:

| Token | Light (current) | Dark (new) |
|---|---|---|
| `--color-bg` | `#f7f1e3` | `#1c1712` |
| `--color-surface` | `#fffaf0` | `#241e17` |
| `--color-text` | `#3a2e1f` | `#f0e6d2` |
| `--color-text-muted` | `#8a7860` | `#b3a58c` |
| `--color-border` | `#d8c9a8` | `#45392c` |
| `--color-accent-a` | `#35608f` | `#7fb2e8` |
| `--color-accent-b` | `#c1601f` | `#e8935a` |

Applied via a `prefers-color-scheme: dark` media query re-declaring
these custom properties on `:root` — the site follows the OS setting
with no manual toggle, per the objective ("a dark theme that follows
the OS"); a toggle is a different feature this issue didn't ask for.

**Why these six, not Signal's own dark palette from the second-pass
document:** Signal's palette (`#0b0e11` / `#161a1f` / cool steel text)
is a different design — a console at night. This hybrid's identity
is Field Notebook's warm paper; the dark counterpart is that same page
dimly lit, not a different product. `#1c1712` and `#241e17` keep the
same brown-black hue family as the light `#3a2e1f` text, inverted in
value rather than swapped in hue. The muted tan border becomes a dark
brown-tan (`#45392c`) rather than a cool gray for the same reason.

**Accent colors**, chosen so `a` still reads cool and `b` still reads
warm against the dark surface (both need to lighten from their light-
theme hex values — the originals are too dark to clear 4.5:1 on a
near-black background):

- Variant `a`: `#7fb2e8`, a lighter sky blue than the light theme's
  `#35608f` — still unambiguously cool, and no longer readable as
  "gray" the way a barely-lightened dark blue would be.
- Variant `b`: `#e8935a`, a lighter peach-orange than `#c1601f` — still
  unambiguously warm.

**Contrast, computed against both `--color-bg` and `--color-surface`**
using the WCAG relative-luminance formula (`L = 0.2126R + 0.7152G +
0.0722B` on linearized sRGB channels, contrast `= (L1+0.05)/(L2+0.05)`).
No script-execution tool was available in this run's environment to
verify these by machine (`python3`, `node`, and `awk` all refused —
see the pull request for the exact refusal); the values below are a
manual application of the formula and are comfortably clear of the
4.5:1 floor rather than borderline, but a spot-check with a contrast
tool before this merges is worth the minute it costs:

| Pair | Ratio | Passes 4.5:1? |
|---|---|---|
| `--color-text` (`#f0e6d2`) on `--color-bg` (`#1c1712`) | ≈14.4:1 | yes |
| `--color-text` on `--color-surface` (`#241e17`) | ≈13.3:1 | yes |
| `--color-text-muted` (`#b3a58c`) on `--color-bg` | ≈7.3:1 | yes |
| `--color-text-muted` on `--color-surface` | ≈6.8:1 | yes |
| `--color-accent-a` (`#7fb2e8`) on `--color-bg` | ≈8.0:1 | yes |
| `--color-accent-a` on `--color-surface` | ≈7.4:1 | yes |
| `--color-accent-b` (`#e8935a`) on `--color-bg` | ≈7.4:1 | yes |
| `--color-accent-b` on `--color-surface` | ≈6.9:1 | yes |

Every pair clears 4.5:1 with at least 1.5 points of margin, which is
the point of picking lighter accents up front rather than nudging the
light-theme hex values by a few points and hoping.

## Touch feedback

- **No default tap-highlight.** `-webkit-tap-highlight-color:
  transparent` on the card, its two `OptionPanel`s, and both tab-bar
  links — the blue-grey flash issue #46 names by name.
- **A real pressed state, applied by the code that's already
  listening.** `poll-dom.ts` already attaches `pointerdown` /
  `pointerup` / `pointercancel` handlers to drive the drag (now on the
  card — see `docs/design/3-swipe-poll.md`). The same handlers toggle
  a `.pressed` class, rather than relying on the CSS `:active`
  pseudo-class, which iOS Safari does not reliably apply to an element
  with no native touch behavior. `.pressed` (on the card when not
  mid-drag, and on a tab-bar link) applies `transform: scale(0.97)`
  and shifts the element's border to `--color-accent-a`/`-b` at 50%
  opacity, over `100ms ease-out` — quick enough to read as immediate
  contact, distinct from the slower release animation in Motion below.
- **No text selection on press-and-hold.** `user-select: none`,
  `-webkit-user-select: none`, and `-webkit-touch-callout: none` on
  the card and its panels, so a long press starts a drag rather than a
  text-selection or iOS's link-preview callout.
- **No page rubber-band during a card drag.** `overscroll-behavior:
  contain` on the card's containing block, and `touch-action: pan-y`
  on the card itself by default (allowing a vertical scroll to start
  normally) rather than `touch-action: none` — the card only claims
  the gesture fully, via the pointer capture `poll-dom.ts` already
  calls, once `drag-gesture.ts` has resolved a mostly-horizontal
  motion past the same thresholds it already uses for the vote
  commit. This is the direct fix for the failure mode named on the
  parent objective: `touch-action: none` on a full-width card leaves
  nowhere on it to start a vertical scroll, and a card that spans the
  viewport (as this one now does) is the whole visible column.

## Card motion

- **While held:** the card's `translate`/`rotate` tracks the pointer
  1:1, no easing, no transition — it must feel attached to the finger,
  not animated toward it.
- **On release (vote committed):** the remaining distance off-screen
  animates over **320ms**, easing **`cubic-bezier(0.22, 1, 0.36, 1)`**
  (a fast-start, soft-settle curve — commonly called "ease-out-expo")
  — chosen over the current global style block's `400ms ease-in` for
  the swipe-out because an ease-in exit reads as the card accelerating
  away under its own weight; a released card should read as already
  moving and decelerating only at the very end, which an ease-out
  curve is what says "thrown," not "pulled." This value replaces the
  `.swipe-out-left` / `.swipe-out-right` transition timing in
  `src/pages/index.astro`'s style block; it does not touch
  `TRANSITION_MS` in `poll-dom.ts` (the delay before the next pair
  renders), which stays independently tunable to match.
- **`prefers-reduced-motion: reduce`:** the transform animation is
  removed entirely, not shortened. The voted card is removed and the
  next pair (or the End state) appears in the same frame, with no
  translate, no rotate, and no opacity fade standing in for either —
  a plain state change. The confirmation message and the accent
  highlight on the chosen panel (state 3a/3b in
  `docs/design/3-swipe-poll.md`) are unaffected; only the transform-
  based exit is what reduced motion removes.

## Safe-area insets

Requires `viewport-fit=cover` in `BaseLayout.astro`'s viewport meta
tag, which is absent today (`width=device-width, initial-scale=1`
alone) — every `env(safe-area-inset-*)` value resolves to `0` without
it, so this whole section is inert until that one attribute is added.

- **Top (notch), portrait:** the slim phone header (see Nav) gets
  `padding-top: max(var(--space-sm), env(safe-area-inset-top))`, so
  the site name clears a notch or a Dynamic-Island-style cutout rather
  than sitting under it.
- **Top, landscape:** the same top padding still applies (the header
  is still the top edge), plus `padding-left`/`padding-right: max(var(
  --space-lg), env(safe-area-inset-left/right))` on the header, since
  in landscape a notch or the display's rounded corners sit at the
  side the header spans, not only at the top.
- **Bottom (home indicator), portrait:** the tab bar gets
  `padding-bottom: max(var(--space-sm), env(safe-area-inset-bottom))`,
  added to its content height rather than replacing its padding, so
  tab labels don't sit flush against — or under — the home-indicator
  bar.
- **Bottom, landscape:** the same bottom padding still applies (the
  home indicator stays bottom-center in both orientations), plus the
  same left/right safe-area padding as the header, so the outermost
  tab on either side isn't cut into by a rounded corner or a
  landscape-side notch.

## The mock

`docs/design/46-phone-native-light.html` and
`docs/design/46-phone-native-dark.html` — two self-contained pages
(same markup and structure, each hardcoding one theme's palette rather
than relying on the media query, so each renders its theme regardless
of the browser's own OS setting). Both show: the phone header/tab-bar
split described above, the one-unit SwipeCard from the rewritten
`docs/design/3-swipe-poll.md` with its two demoted `OptionPanel`s, a
pressed-state example, and both A/B accents side by side so cool-vs-
warm can be checked in both themes at once. Rendered at both sizes
with `scripts/design-render`, four PNGs total, committed alongside.

### Critique, after opening the four renders

- The narrow render's eye lands on the card first, then the tab bar
  immediately below it, in both themes — the two things the objective
  asked to dominate the phone view. Confirmed by looking, not assumed.
- First pass had the two `OptionPanel` chips at the same visual weight
  as the card's caption, which recreated a small version of the old
  two-column read — I sized them down and moved them flush to the
  card's bottom edge, under the caption, so the caption is what's read
  first.
- Blurring my eyes at the wide render, the composition that survives
  is header / card+caption / accent pair — the tab bar's absence at
  this width is itself doing work, since its presence would be the
  "phone column on a big screen" tell the objective calls out.
- The one deliberate oddity: the active tab's filled pill is sized to
  the label's text, not to a fixed tab-width box — it reads as a
  highlight the current label is wearing, not a slot every tab already
  had cut out for it. Kept because it's the thing separating "current
  page" from "the tab bar has five equal boxes and one is tinted,"
  which is the more generic version of the same idea.

## No ADR

Nothing here contradicts ADR 0001 (framework/hosting), 0002 (variant-
seen event), or 0003 (happy-dom for component tests) — no schema, data
shape, or dependency changes. None is added.
