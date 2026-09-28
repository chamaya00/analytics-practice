# Color scheme proposals: red, black-and-green, blue

Spec for issue #181. Proposals only — the owner picks one, and changing
`src/styles/global.css` (or any component) is a separate, follow-up engineer
issue filed after that choice. Nothing in this document ships.

## The outcome, the constraints, the guesses

**Outcome (fixed, from the issue):** at least three palette families — red,
black-and-green, blue — each filling every existing `--color-*` token role
in `global.css` with no renames, in both a light and a dark value set, with
contrast computed (not estimated) for the pairs the issue names, a committed
side-by-side screenshot set, and one recommended option per family plus an
overall pick.

**Constraints (checked against the code, not assumed):**

- The twelve token roles are exactly `global.css`'s `:root` list: `--color-
  bg`, `-surface`, `-text`, `-text-muted`, `-border`, `-accent-a`, `-accent-
  b`, `-tab-active-bg`, `-badge-ink`, `-danger`, `-flash-tile-bg`, `-vip-
  gold(-ink)`, `-vip-platinum(-ink)`. No new token, no renamed one — checked
  by reading `global.css` and `contrast.test.ts` side by side, since the
  test file is the second place a token's exact role is pinned down (`--
  color-accent-a` is the discount/success color and the thing `.place-order`
  puts `--color-bg` text on; `--color-accent-b` is badge-fill-only, never
  text-on-page-background; `--color-flash-tile-bg` is a *fixed* dark value,
  not redeclared for dark theme, checked against literal white; `--color-
  danger` carries `--color-bg` text on its own fill, the cart's swipe-
  revealed "Remove").
- The type scale, spacing scale, and every component's structure are
  unchanged — this issue is a palette swap, not a redesign. `design-craft`'s
  "carry at least two *structurally different* directions" doesn't apply the
  same way here: the issue itself fixes structure and asks only for hue,
  so exploring structural variants would be answering a question this issue
  didn't ask.
- `#80`'s own brand document already researched and explicitly avoided real
  delivery brands' colors when picking violet: DoorDash red (`#FF3008`),
  Zomato red (`#E23744`), foodpanda magenta (`#D6006D`), Grab's green
  (`#00B14F`), Deliveroo teal (`#00CCBC`), Swiggy orange (`#FC8019`). A
  red-toned or green-toned proposal here walks back toward exactly the
  colors #80 walked away from, so each family below says explicitly how it
  stays clear of the nearest real brand rather than landing on it by
  accident.

**Guesses this document is making, called out as such:**

- **One option per family, not more.** The issue invites more ("more than
  one option in a family is welcome") but doesn't require it. Every
  additional option multiplies the screenshot cost by four (light/dark ×
  narrow/wide) for a variation that, per the constraint above, can only ever
  differ by hue — not by composition, since structure is fixed. Three
  well-argued options the owner can actually compare beats six thin ones;
  if the owner wants a second option inside a family they liked, that's a
  cheap follow-up on a decision already narrowed to one direction.
- The exact restaurant names, prices, and copy in the two mocks are reused
  unchanged from `docs/design/80-two-city-brand-and-flow.md` and `docs/
  design/162-rating-win-tips-rewards-vip.md` — this document isn't proposing
  new content, only new colors behind existing content.
- Which two screens are "representative" (home feed, checkout) is the
  issue's own example, taken directly rather than second-guessed, because
  between them they're the only two-screen combination that reaches every
  one of the twelve token roles (see "The mocks," below, for exactly which
  screen carries which token).

## Look outside this repository

- **["Best 8 Mobile App Color Scheme Trends for 2026" (Envato Elements)](https://elements.envato.com/learn/color-scheme-trends-in-mobile-app-design)
  and the 2026 color-trend roundups it echoes:** red is moving from bright,
  aggressive fire-engine tones toward deeper, more desaturated reds —
  described as "serious warmth," more premium than rust or terracotta. I'm
  taking the *depth* directly: the red option's light accent (`#A8202E`) is
  a wine-red, not a stop-sign red. I'm refusing the "eco-inspired... clay,
  terracotta" direction the same roundups also name, because terracotta
  already sits close to this site's *current* orange (`--color-accent-b`,
  `#FF7A45`) and would blur the two roles together.
- **["UI Color Trends to Watch in 2026" (Updivision)](https://updivision.com/blog/post/ui-color-trends-to-watch-in-2026)
  and the dark-mode coverage it's part of:** dark mode is increasingly
  treated as the primary surface rather than an inverted afterthought, with
  bold jewel-tone accents (emerald, teal, cyan) reading as premium against
  a true dark base. I'm taking this directly for the black-and-green
  option: it's designed dark-first, with light treated explicitly as the
  fallback the issue asks for, and the accent leans teal-emerald rather
  than grass-green. I'm refusing the "neon terminal green on pure black"
  cliché the same coverage warns reads as dated rather than premium —
  this option's base is a soft near-black, not `#000`, and its green is
  desaturated toward teal rather than a saturated `#00FF00`.
- **["4 B2B SaaS Color Palettes That Stand Out in 2026" (Tentackles)](https://tentackles.com/blog/b2b-saas-color-palettes-2026-that-stand-out):**
  makes the case that flat, bright blue is *overused* to the point of being
  invisible — "when every SaaS company... uses the same blue-dominant
  palette, nobody stands out" — and recommends emerald-to-teal instead for
  differentiation. I'm taking the critique seriously but refusing its
  remedy for this option specifically, because the issue explicitly asked
  for a blue family (the emerald-to-teal alternative is what the green
  family already does). What I take from the critique instead: the blue
  option below is a deeper, slightly teal-leaning "harbor" blue rather than
  a flat `#2196F3`/`#007AFF` SaaS blue, which is the same move #80's own
  document made when it picked violet over "corporate blue" — this option
  makes the analogous move one register over, rather than landing on the
  generic tone the critique is about.

## Three options, one per family

Each is a direct, no-rename fill of every token role above. Hex values
below are exactly what's baked into the mocks under "The mocks."

### 1. Red-toned — `#181-red`

**Direction in three words:** deep, not loud. Refuses fire-engine red (the
DoorDash/Zomato register #80 already ruled out) and refuses terracotta
(too close to this site's existing orange accent). The primary is a
wine-red closer to a good cabernet label than a stop sign.

| Token | Light | Dark |
|---|---|---|
| `--color-bg` | `#FFF8F6` | `#1A0F0E` |
| `--color-surface` | `#FDEEEC` | `#241715` |
| `--color-text` | `#2B1210` | `#FBEDEA` |
| `--color-text-muted` | `#8A5A54` | `#C79892` |
| `--color-border` | `#F0D5D0` | `#3D2422` |
| `--color-accent-a` | `#A8202E` | `#FF9B90` |
| `--color-accent-b` | `#E8A33D` | `#FFC069` |
| `--color-tab-active-bg` | `#F6DAD5` | `#331F1C` |
| `--color-badge-ink` | `#2B1210` | `#1A0F0E` |
| `--color-danger` | `#C23D18` | `#FF8F5E` |
| `--color-flash-tile-bg` | `#2B1210` (fixed, both themes) | same |
| `--color-vip-gold` / `-ink` | `#F3D27A` / `#2B1210` | `#E0B95A` / `#1A0F0E` |
| `--color-vip-platinum` / `-ink` | `#D8D8DE` / `#2B1210` | `#C9C9D1` / `#1A0F0E` |

**Collision called out (the issue's own example):** `--color-accent-a`
(wine-red) and `--color-danger` (orange-red) are both "red," which is
exactly the pairing the issue asks to keep distinguishable. They're split
by temperature, not just value — accent-a leans magenta/cool, danger leans
orange/warm (compare `#A8202E` against `#C23D18`: danger's blue channel is
roughly half accent-a's) — visible side by side in the checkout mock's
"Remove" button next to the discount line. `--color-accent-b` (the badge
fill) is pulled out of the red family entirely, into amber/gold — with two
reds already in play for accent-a and danger, a third would make the
"Deal" badge, the discount line, and the destructive action read as one
undifferentiated hue group.

### 2. Black-and-green — `#181-green`

**Direction in three words:** dark first, teal-leaning. Designed as a dark
theme from the base color out, with light given as the fallback the issue
asks for rather than as the starting point. The green itself is pulled
toward teal/emerald, deliberately short of Grab's grass-green — see
"Collision," below.

| Token | Dark (primary) | Light (fallback) |
|---|---|---|
| `--color-bg` | `#0B0F0C` | `#F5FBF6` |
| `--color-surface` | `#121712` | `#E9F3EA` |
| `--color-text` | `#EDF5EE` | `#12261A` |
| `--color-text-muted` | `#9FB3A2` | `#4C6B57` |
| `--color-border` | `#243328` | `#CFE3D2` |
| `--color-accent-a` | `#14B8A6` | `#0F766E` |
| `--color-accent-b` | `#FFB84D` | `#C97F1D` |
| `--color-tab-active-bg` | `#1B2A1E` | `#DCEEDF` |
| `--color-badge-ink` | `#0B0F0C` | `#12261A` |
| `--color-danger` | `#FF6B6B` | `#C4213A` |
| `--color-flash-tile-bg` | `#12261A` (fixed, both themes) | same |
| `--color-vip-gold` / `-ink` | `#E0B95A` / `#0B0F0C` | `#F3D27A` / `#12261A` |
| `--color-vip-platinum` / `-ink` | `#C9C9D1` / `#0B0F0C` | `#D8D8DE` / `#12261A` |

**"If it only works as dark, say so":** it does. The dark column is the
option — a genuinely near-black base with a saturated accent popping off
it, the composition the issue's own name for this family ("a dark base
with green accents") describes. The light column is a faithful same-role
fallback (every pair below still clears 4.5:1) but it's a paler mint-on-
cream reading, not the same design idea; nobody should ship the light
column and call it "the black-and-green option."

**Collision called out:** `--color-accent-a` is both the primary accent and
the discount/success color, and in a green-branded UI a green "success"
signal risks reading as just more brand chrome rather than a distinct
state. It's kept legible two ways: `--color-danger` is pulled hard toward
red (not green-adjacent at all) so anything destructive reads unambiguously
different, and the dark theme's accent (`#14B8A6`) is considerably more
saturated than the desaturated near-black base around it, so it still pops
by saturation contrast even sitting on its own brand hue — checked in the
"Covering the accent" critique pass, below. Separately: `#14B8A6` is a
deliberate hue shift *away* from Grab's `#00B14F` (a warmer, more yellow-
green) toward teal — the two are far enough apart that this reads as "an
emerald/teal palette" rather than "Grab's green, darker."

### 3. Blue-toned — `#181-blue`

**Direction in three words:** deep harbor, not SaaS. Refuses the flat,
bright blue (`#2196F3`/`#007AFF` territory) that's become UI wallpaper —
takes a darker, marginally teal-leaning blue instead, the same move #80
made choosing violet over "corporate blue," carried into blue's own range.
This also revives ground #80 already covered and rejected for a different
reason (see "the cobalt alternative," `docs/design/80-two-city-brand-and-
flow.md`): that document's own rejected direction was cobalt blue,
kept in this codebase's history but never shipped. This option isn't a
copy of it (different values throughout, and it fills token roles that
didn't exist when #80 was written — `--color-danger`, `--color-badge-ink`,
the VIP tokens), but the underlying case for a calmer, blue register was
made once already and is worth citing rather than re-arguing from zero.

| Token | Light | Dark |
|---|---|---|
| `--color-bg` | `#F5F8FC` | `#0D1420` |
| `--color-surface` | `#EAF0F8` | `#141D2E` |
| `--color-text` | `#121A2E` | `#EDF1FA` |
| `--color-text-muted` | `#55677E` | `#A7B6CC` |
| `--color-border` | `#D7E3F0` | `#2A3A50` |
| `--color-accent-a` | `#1E5FAE` | `#7FA6F0` |
| `--color-accent-b` | `#E0A233` | `#F0BC5C` |
| `--color-tab-active-bg` | `#DCE7F5` | `#1E2C42` |
| `--color-badge-ink` | `#121A2E` | `#0D1420` |
| `--color-danger` | `#C4213A` | `#FF8A9B` |
| `--color-flash-tile-bg` | `#121A2E` (fixed, both themes) | same |
| `--color-vip-gold` / `-ink` | `#F3D27A` / `#121A2E` | `#E0B95A` / `#0D1420` |
| `--color-vip-platinum` / `-ink` | `#D8D8DE` / `#121A2E` | `#C9C9D1` / `#0D1420` |

**Collision called out:** none of the issue's named examples apply directly
(that section calls out red-vs-danger and green-vs-accent specifically),
but the same principle holds for `--color-accent-b` (amber): it has to
read as a distinct "second" color next to a blue primary rather than a
tint of it, which a warm amber against a cool blue does by hue alone —
visible in the home feed's "Deal" badge next to the flash badge's blue.

## Contrast — every pairing the issue names, plus what `contrast.test.ts` also checks, computed not estimated

Run with `./scripts/contrast <fg> <bg>`, every option, both themes. The
first four rows per option are the issue's own required pairs; the rest
mirror `src/lib/contrast.test.ts`'s coverage so this table checks the same
pairs the real palette is held to, not a subset invented for this issue.

| Pair | Red light | Red dark | Green dark (primary) | Green light (fallback) | Blue light | Blue dark |
|---|---|---|---|---|---|---|
| `--color-text` on `--color-bg` | 16.72 | 16.45 | 17.37 | 15.19 | 16.25 | 16.31 |
| `--color-text` on `--color-surface` | 15.56 | 15.23 | 16.33 | 14.02 | 15.10 | 14.91 |
| `--color-text-muted` on `--color-bg` | 5.45 | 7.45 | 8.68 | 5.64 | 5.43 | 8.97 |
| `--color-text-muted` on `--color-surface` | 5.07 | 6.90 | 8.16 | 5.21 | 5.05 | 8.20 |
| `--color-bg` on `--color-accent-a` (issue AC2 / `.place-order`) | 6.87 | 9.25 | 7.76 | 5.22 | 5.97 | 7.57 |
| `--color-badge-ink` on `--color-accent-b` (issue AC2) | 8.14 | 11.62 | 11.23 | 4.96 | 7.74 | 10.59 |
| `--color-bg` on `--color-danger` (cart "Remove" fill) | 4.06 → fixed to **5.03** | 8.35 | 6.96 | 5.52 | 5.44 | 8.23 |
| `--color-text` on `--color-tab-active-bg` (tab-bar pill) | 13.29 | 13.60 | 13.53 | 13.16 | 13.84 | 12.42 |
| `#ffffff` on `--color-flash-tile-bg` (fixed tile — one value per option, reused in both themes) | 17.55 | 17.55 | 15.93 | 15.93 | 17.31 | 17.31 |
| `--color-vip-gold-ink` on `--color-vip-gold` | 11.96 | 10.06 | 10.35 | 10.86 | 11.80 | 9.89 |
| `--color-vip-platinum-ink` on `--color-vip-platinum` | 12.36 | 11.41 | 11.73 | 11.23 | 12.20 | 11.21 |

Every pair clears 4.5:1. The one shown with an arrow is the one candidate
that didn't on the first try: the red-light danger fill started at
`#D9491F` (4.06, a fail) and was darkened to `#C23D18` (5.03) before
anything else in this document was written — kept in the table rather than
quietly replaced so the check is shown doing its job, not just its answer.

**Correction (revision round, driver review on PR #183):** three cells in
the green columns were wrong on the first pass — a hand-transcription error
copying the script's output into the table, not a re-run with different
inputs. All three are corrected above: green-dark `bg`-on-`accent-a` was
8.47, is **7.76**; green-light the same pair was 5.14, is **5.22** (both
caught by the driver's own recompute); green-light `vip-platinum-ink`-on-
`vip-platinum` was 12.20, is **11.23** (found re-running every cell in this
pass, not flagged by the review — the review's recompute didn't happen to
touch this one). Every corrected value still clears 4.5:1, so no palette
value changed, only what the table says about it. Every cell in this table
was re-run against `./scripts/contrast` for this revision, not just the
three the review named, since a table caught wrong once isn't evidence the
rest is right.

## Rendered mocks and screenshots

Two screens, chosen because between them they reach every token role — the
issue's own example pairing (home feed, checkout), and it isn't a
coincidence that it's the pairing that does:

- **Home feed** (`docs/design/181-home-feed-<option>-<theme>.html`) — the
  location bar, search, a flash-deal reopen bar, cuisine chips, and
  restaurant cards with a "Deal" badge. Exercises `bg`, `surface`, `text`,
  `text-muted`, `border`, `accent-a` (wordmark tail, flash chevron, "Flash"
  chip), `accent-b` + `badge-ink` (the "Deal" badge), `tab-active-bg` (the
  phone tab bar's filled current-tab pill), and `flash-tile-bg` (the
  countdown tile, fixed white digits).
- **Checkout** (`docs/design/181-checkout-<option>-<theme>.html`) — a cart
  line with its swipe-revealed "Remove" shown open, a VIP-applied banner,
  a reference row showing both VIP pills side by side (labelled as a
  reference, since one order is never both tiers at once — the same
  "more than one state in a static frame" convention `docs/design/137-
  home-feed-*.html`'s slide-ref-row already uses), the price breakdown with
  a discount line, and "Place order." Exercises `bg`, `surface`, `text`,
  `text-muted`, `border`, `accent-a` (discount line, total emphasis, the
  primary button), `tab-active-bg`, `danger` (the "Remove" fill), and both
  VIP token pairs.

Each of the three options is rendered for both screens, both themes, both
widths (`./scripts/design-render`, 1280×900 and 375×812) — 24 PNGs total,
committed beside this document:

`181-{home-feed,checkout}-{red,green,blue}-{light,dark}-{wide,narrow}.png`

Structure and copy are byte-identical across every option and theme for a
given screen — only the `:root` token values change — so what differs
between any two screenshots of the same screen is the palette and nothing
else, which is the actual comparison the owner needs to make.

## Critique, after opening the rendered pictures

Rendering caught two real bugs before this section was written, not after:

- **The header wrapped the wordmark to two lines at wide width, every
  option, first render.** The home-feed mock's desktop breakpoint enabled
  the top nav (`Home Cart Tracker`) without hiding the phone-only location
  pill, so all three nav links, the pill, and the wordmark fought for one
  `26rem` row and lost. `Header.astro`'s real desktop layout never shows
  that pill at all (`.city-pill-slot` only flips to `display: flex` inside
  its own phone media query) — the mock had drifted from the component it
  was standing in for. Fixed by hiding `.location-bar` at `481px+` in all
  six home-feed files; confirmed one word, one line, in the re-render of
  every option.
- **The flash-tile countdown digits went nearly invisible in every dark
  render.** The tile used `color: var(--color-bg)` on `background: var(
  --color-flash-tile-bg)` — correct reasoning for the *light* theme, where
  `--color-bg` is pale, but wrong for dark, where `--color-bg` is itself
  near-black, so dark-on-dark nearly disappeared (visible first in
  `181-home-feed-red-dark-narrow.png`: `04:12` was barely legible against
  its own tile). This is the identical failure `global.css`'s own comment
  on `--color-flash-tile-bg` already documents happening once for real
  ("light digits on a light tile... the bug this fixes") — reusing
  `--color-bg` was reintroducing it from the other direction. Fixed by
  switching to a fixed white, the same pairing `contrast.test.ts` actually
  checks (`#ffffff` on `--color-flash-tile-bg`, both themes); re-rendered
  and confirmed legible in all six.
- **Covering `--color-accent-a` with a hand, black-and-green dark
  checkout:** the discount line ("Platinum 10% off," "−$2.37," "You saved
  $6.36") still reads as a distinct line from its bold weight and the tag
  icon alone, not from color — checked deliberately, since a teal accent
  sitting on a near-black, slightly-green base is exactly the case where a
  discount line could quietly become color-only without anyone noticing.
- **Blurring the eyes, home feed, all three options, wide:** the
  composition that survives is location row / search / one flash bar /
  restaurant cards in a column — the flash bar reads as a single distinct
  block rather than competing with the cards, in all three palettes.
- What I'd change if the owner picks an option and this moves to the
  engineer issue: the reference-only VIP pill row in the checkout mock
  (both pills shown at once) is a mock convenience, not something to build
  — the engineer issue should confirm the real checkout only ever shows
  the one tier that actually applies, which it already does today.

## Recommendation

**Per family:**

- **Red-toned:** recommended reading is that this is the strongest fit for
  a food app specifically (warmth, appetite association) but the one most
  likely to be second-guessed against DoorDash/Zomato at a glance — it
  earns that comparison only if the wine-red stays as deep as specified
  here; a brighter red would collapse the distinction #80 already spent
  effort establishing.
- **Black-and-green:** recommended as the most *distinctive* of the three —
  nothing in the real-brand list #80 checked sits here once the hue is
  pulled toward teal — at the cost of being the only option where the
  fallback theme (light) is honestly a weaker version of the design idea
  than the primary (dark).
- **Blue-toned:** recommended as the safest of the three — calm, legible,
  no collision to design around — and, per the research above, also the
  one most likely to read as generic if the "harbor, not SaaS" depth isn't
  respected in implementation.

**Overall, this designer's pick is black-and-green (dark).** It's the only
one of the three that doesn't require re-litigating a comparison #80
already settled (red vs. DoorDash/Zomato, blue vs. "every SaaS app"), it
photographs as the most distinctive across every rendered screenshot, and
the accent still reads as a deliberate accent rather than a wash — the
hand-covering check above found nothing depending on it that shouldn't.
The trade-off is real, though: it's a bigger swing from the current violet
than either alternative, and it's the one option where "ship the light
fallback" would be a visibly weaker decision than "ship the dark primary."

## No ADR

A palette swap within the token-based light/dark mechanism `global.css`
already has is a style change, not a category change — the same test
`80-two-city-brand-and-flow.md` already applied ("would somebody reversing
this need to know why, or only that it happened? Only the latter"). Nothing
here adds a dependency, a service, or a schema change. In any case nothing
in this document changes `global.css` — the follow-up engineer issue that
implements the owner's choice is where that question gets asked again,
against an actual diff.

## For the orchestrator

No event-tracking impact (the #79 rule): this issue proposes colors only,
touches no code, and ships no screen. The follow-up engineer issue that
implements whichever option the owner picks also touches no event contract
— it's a token-value change in `global.css`, not a new element or removed
one — but it's still worth flagging there explicitly, since that issue
*will* touch shipped code.
