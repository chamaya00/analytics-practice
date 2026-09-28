# Light mode for the black-and-green palette: three treatments

Spec for issue #199. This document proposes options. The owner picks one, and
a later engineer child builds it. Nothing here changes `src/`.

Dark mode is fixed: it is today's `:root` in `src/styles/global.css`,
unchanged, and every mock labelled `dark` below is drawn from those values.

**Open these first:** `199-home-feed-islands-narrow.png`,
`199-home-feed-controls-narrow.png`, `199-home-feed-daylight-narrow.png`,
then the three `199-checkout-*-narrow.png`. Each is a phone screenshot, and
each one sits beside `199-*-dark-narrow.png` (today's app) for comparison.

## The outcome, the constraints, the guesses

**Outcome (fixed).** When the phone or OS is set to light, the site shows a
light-background version of the black-and-green palette. When it is set to
dark, the site looks exactly as it does today. The OS setting chooses
between them.

**Constraints (checked, not assumed).**

- Dark values are frozen. Every token in today's `:root` keeps its value in
  dark mode, and so does every component rule that consumes one. A light
  treatment may add tokens, but each new token's dark value has to equal
  what that role renders as today. That is how all four new tokens below are
  built.
- `src/styles/theme.build.test.ts` asserts `expect(css).not.toContain
  ('prefers-color-scheme')` ("there is only one theme"). The engineer child
  has to replace that assertion. It is the one test this proposal makes
  false by design. See "For the engineer child".
- Two token roles are pinned by `contrast.test.ts` and by code comments, and
  both break the moment the page goes light:
  - Every accent fill carries `--color-bg` as its ink (`.place-order`,
    `.flash-tag`, `.cart-badge`, `.reopen-bar`, the flash sheet header).
    With a near-white `--color-bg`, that ink is near-white. White on
    `#14b8a6` is **2.49:1**, a fail.
  - `--color-danger` also carries `--color-bg`. Near-white on `#ff6b6b` is
    **2.65:1**.
- Teal `#14b8a6` on white is **2.49:1**, so it fails as text (4.5:1) and as
  a non-text mark (3:1). Amber `#ffb84d` on white is **1.72:1**. Neither
  can sit directly on a light page as text or as a line.
- `--color-accent-b` is used as text in one place, contrary to the
  `global.css` comment that says it is "badge fill only, never
  text-on-background": `.voucher-expiry` on the Offers screen. On a light
  surface that text needs its own value.

**Guesses (the issue's and mine, named).**

- *"Components" is the issue's word, and it does not say where the line
  falls.* I drew it in two different places, and that difference is what
  separates treatment A from treatment B:
  - A: everything with a fill is a component.
  - B: only the things you act on.
- *"White background."* The owner said white. Every light treatment here
  uses a near-white with a faint green temperature (`#f8faf8`; `#f1f4f1` in
  C), not `#ffffff`. Pure white next to near-black `#121712` cards looks
  like a missing stylesheet. A little temperature makes the white read as a
  chosen ground. The owner can overrule this in one line of CSS, so I am
  not raising it as a question.
- *A and C keep the teal CTA from dark mode; B makes it black.* This is a
  deliberate difference between the treatments, not a slip. See each one.
- *Sheets and dialogs* follow each treatment's component rule. They are
  specified below but not drawn: the issue's criteria ask for the home feed
  and checkout.

## What is there now

I ran `./scripts/app-render /` and `./scripts/app-render /checkout`, seeded
with `docs/design/shots/138-home-sf-seed.js` and `130-checkout-seed.js`.
Both needed `npm ci` first, and a headless browser on `PATH`. The
container's Playwright Chromium (`/opt/pw-browsers/chromium-1194`) was
symlinked into a scratch directory; no script was edited.

Today the home feed reads as one dark plane. The surface `#121712` is
1.06:1 against the page `#0b0f0c`, so the search field, chips and
tile bodies are separated from the page by their hairline borders, not by
their fills. The eye goes to the photos first. The only colour outside the
photos is the teal active dot and the amber "Deal".

Checkout is a column of outlined pills, a table of numbers and one teal
slab (Place order), which is correctly where the eye ends up.

The palette works because the page is dark and the photos are the light.
Invert the page and the photos lose that frame, so every light treatment
here gives the photo a dark or neutral frame of its own.

## Looking outside

The egress proxy refused page fetches for all three sources (medium.com,
uber.com, superdesign.dev, getdesign.md and daverupert.com were blocked).
The claims below come from search-result summaries of those pages plus
general knowledge of the products. They are cited as that and nothing more.

- **Uber's Base design system**
  ([breakdown](https://superdesign.dev/blog/uber-design-system),
  [token summary](https://oh-my-design.kr/design-systems/uber)). A white
  page and a black primary button. Black and white handle nearly every
  role, and one restrained accent carries state.
  - *Taking:* black as the colour of *action*. In treatment B the CTA and
    the selected chip are black, so selection differs by fill as well as by
    colour.
  - *Refusing:* pure `#000` on pure `#fff`, and the idea that the brand
    colour disappears. The teal stays, as the signal for success and for
    what is selected.
- **Deliveroo's 2024 accessible colour system**
  ([Deliveroo Design, "Brightening up accessibility"](https://medium.com/deliveroo-design/brightening-up-accessibility-with-a-new-colour-system-5921915641ed)).
  Deliveroo is the nearest real brand to our teal. As summarised, their
  bright teal action fill now carries a *deep teal ink* instead of white,
  and the brand hue survives as a fill rather than as small text.
  - *Taking:* the rule exactly. Bright `#14b8a6` appears on a light page
    only as a fill, with near-black ink (7.76:1). Any teal that is text or
    a thin line on the light page is the deep `#0f766e` (5.22:1 on
    `#f8faf8`).
  - *Refusing:* the teal-washed light surfaces a teal brand drifts into on
    white. That is Deliveroo's look, and #80 and #181 both avoided landing
    on a real delivery brand. On the light page, teal stays scarce.
- **Revolut's dual canvas, and the "inverted surface" token pair**
  ([Revolut design analysis](https://getdesign.md/design-md/revolut/preview),
  [Dave Rupert, "Inverted themes with light-dark()", 2026](https://daverupert.com/2026/04/inverted-light-dark/),
  [helmdeck PR #109](https://github.com/yesvus/helmdeck/pull/109)).
  Revolut alternates near-black and off-white canvases and uses an inverted
  (black-fill) variant on light backgrounds. The token write-ups describe
  modelling "the opposite of the page" as a *scope*: an element that
  re-enters the dark theme, not a second set of hand-picked colours.
  - *Taking:* the mechanism behind treatment A. A dark component on a light
    page is today's dark palette re-declared on that element (an "island").
    It is not a parallel set of new tokens.
  - *Refusing:* Revolut's full-bleed black *sections*. A food feed made of
    alternating black and white bands would compete with the photos, which
    are the actual content.

## Direction, in one sentence each

- **A. Dark islands:** *print on paper*. The dark-mode components, untouched,
  laid on a white page. Must not look like a dark app with white gutters.
- **B. Black controls:** *ink for action*. Light content, and black only on
  what you tap or have chosen. Must not look like Uber with a teal logo.
- **C. Daylight:** *quiet and bright*. White cards on a pale ground, dark
  text, teal as a signal. Must not look like the mint-on-cream #181
  fallback (C has no tinted surfaces).

The three differ in structure, not only in palette:

- In A the page is the gaps between dark objects.
- In B the page and its content are light, and black marks the controls.
- In C nothing is dark except text.

## The token model

### Why today's tokens are not enough

`--color-surface` and `--color-text` are paired implicitly. Text inside a
card inherits `--color-text`, which is also the page's text colour. That is
fine while page and card are both dark. A light page with dark cards needs
two inks at once: dark ink on the page, light ink in the card.

The obvious answer is a parallel set (`--color-surface-text`,
`--color-surface-text-muted`, `--color-surface-border`,
`--color-surface-accent`, ...), but it has two problems:

- It means rewriting every consumer inside every component, about 270
  `var(--color-*)` uses in `BaseLayout.astro`.
- It still misses nested cases. `.cart-row > .cart-line` sets
  `background: var(--color-bg)`, and that has to mean black when the row
  sits inside a dark component.

### The island: a scope, not a token set

An **island** is any element that stays dark in light mode. It re-declares
today's dark values for the page-dependent tokens on itself:

- `--color-bg` `#0b0f0c`, `--color-surface` `#121712`
- `--color-text` `#edf5ee`, `--color-text-muted` `#9fb3a2`
- `--color-border` `#243328`, `--color-accent-a` `#14b8a6`
- `--color-tab-active-bg` `#1b2a1e`, `--color-danger` `#ff6b6b`
- `--color-accent-b-text` `#ffb84d`

It also sets `color-scheme: dark` and `color: var(--color-text)`. Every
existing consumer inside it then resolves to exactly what it resolves to
today in dark mode. Every island contrast pair is therefore a pair
`contrast.test.ts` already checks.

The page carries the light values. Text that sits on the page (the
wordmark, "Near you", "Checkout", field labels, the breakdown, the total)
uses the page ink, and text inside an island uses the island ink. No
component rule changes to get this.

### New tokens

Every new token's dark value equals what that role renders as today, so
dark mode is unchanged by construction.

| New token | Dark value (= today) | Why it has to exist |
|---|---|---|
| `--color-cta` | `#14b8a6` (today's `.place-order` fill, `--color-accent-a`) | The primary action's fill, separated from "the accent". In B it is black, and it cannot be `--color-accent-a` because the accent stays teal for selection and success. |
| `--color-cta-ink` | `#0b0f0c` (today's `.place-order` ink, `--color-bg`) | The CTA's label. Today's ink is `--color-bg`, which turns near-white in light mode and would put white on teal (2.49:1). |
| `--color-accent-b-text` | `#ffb84d` (today's `.voucher-expiry` colour) | Amber as *text* (`.voucher-expiry`). The fill `#ffb84d` stays for badges, but as text on a light surface it is 1.72:1, so text needs its own dark amber. |
| `--color-indicator` | `#243328` (today's `.carousel-dot-mark`, via `--color-border`) | Inactive carousel dots. They borrow the hairline colour today. On light pages a hairline-grey dot is 1.15–1.34:1 and nearly invisible. A dot is a button, so it needs 3:1 ([critique](#critique-after-looking-at-the-pictures)). |

## What sits on the page and what is a component

| Element | Dark (today) | A. Dark islands | B. Black controls | C. Daylight |
|---|---|---|---|---|
| Wordmark, teal swoosh | page | page (deep-teal swoosh) | page | page |
| City pill | surface | **island** | **island** | light surface |
| Search field | surface | **island** | **island** | light surface |
| Ad carousel photo | photo | photo, **inside an island card with its caption** | photo | photo |
| Carousel caption ("Mission Taqueria") | page | **island** (card ink) | page | page |
| Carousel dots | page | page | page | page |
| Cuisine chips | surface | **island** | light surface | light surface |
| "Near you" title | page | page | page | page |
| Restaurant tiles | surface | **island** | light surface | light surface |
| Checkout title, labels, breakdown, total | page | page | page | page |
| Checkout chips, unselected | surface | **island** | light surface | light surface |
| Checkout chips, selected | teal outline | **island** teal outline | **black fill** (CTA pair) | deep-teal outline |
| Offers row | page | page | page | page |
| Demo disclosure | surface | **island** | light surface | light surface |
| Place order | teal fill | teal fill (`--color-cta`) | **black fill** | teal fill |
| Phone tab bar | surface | **island** | **island** | light surface |
| Cart row (swipe, Remove) | page-bg row | **island** | light | light |
| Flash sheet, remove-confirm dialog, rating sheet | page-bg sheet | **island** | light sheet | light sheet |
| Deal badge, VIP pills, flash countdown tile | own fixed pairs | unchanged | unchanged | unchanged |
| Ad label and pause disc (photo scrims) | fixed literal | unchanged | unchanged | unchanged |

## A. Dark islands (the owner's lean)

**Composition.** On the phone, the eye lands on the ad card first: a photo
and its caption now form one black object with rounded corners. Then it
drops to the two black tiles.

The page is white space between dark objects: it sets them apart like
prints on a table. Around the black search slab and the chip row it is only
gutter.

At wide width the column is a stack of black objects on a white field,
which reads more like an editorial layout than an app. The CTA is the only
bright block on checkout. Every chip, the disclosure and the tab bar are
black, so the eye goes from black to the teal slab, which is right.

**The one structural addition.** Only A adds this, and only in light mode.
The carousel's photo and caption become one card: the slide gets the
island fill, the caption strip gets `var(--space-md)` side padding, and
the photo's bottom corners go square.

Without this, "Mission Taqueria" would sit on the white page under a photo
that belongs to a black card, and the ad would be the only component that
is not an island. Dark mode keeps today's caption-on-page, because the
change is scoped to the light rule.

**Teal.** Two teals are on screen at once. That is the cost of this
treatment, and I kept it on purpose.
- Bright `#14b8a6` appears inside islands: selected chips, the disclosure
  link, "Flash" tags, the cart badge. It also appears as the CTA fill.
- Deep `#0f766e` appears on the page: the swoosh, the active dot, "Free",
  the discount row, "You saved", the Offers summary.

The rule is the Deliveroo rule: bright teal only on dark or as a fill,
deep teal for text and lines on white. You can see both side by side on
checkout.

**Amber.** Unchanged. "Deal" sits on the photo with `#0b0f0c` ink
(11.23:1). The Offers expiry line is inside a voucher island, so it stays
`#ffb84d` on `#121712` (10.56:1).

| Token | Dark (today, unchanged) | A: page | A: island (= dark) | Reason for the page value |
|---|---|---|---|---|
| `color-scheme` | `dark` | `light` | `dark` | Native controls follow the ground they sit on. |
| `--color-bg` | `#0b0f0c` | `#f8faf8` | `#0b0f0c` | A near-white with a green temperature. |
| `--color-surface` | `#121712` | `#eef2ef` | `#121712` | A sentinel: no page element should render it. A light-grey card in A means a component was left off the island list. That is a visible miss, not an illegible one. |
| `--color-text` | `#edf5ee` | `#0b0f0c` | `#edf5ee` | Page ink is dark mode's page colour, so the two modes are exact opposites. |
| `--color-text-muted` | `#9fb3a2` | `#56665b` | `#9fb3a2` | The same green-grey family, darkened to 5.81:1. |
| `--color-border` | `#243328` | `#d3dcd5` | `#243328` | The header rule and breakdown dividers on the page. |
| `--color-accent-a` | `#14b8a6` | `#0f766e` | `#14b8a6` | Deep teal: text and lines on white. |
| `--color-accent-b` | `#ffb84d` | `#ffb84d` | `#ffb84d` | Only ever a fill with dark ink, so it needs no light variant. |
| `--color-tab-active-bg` | `#1b2a1e` | `#dcefe9` | `#1b2a1e` | The tab bar is an island, so this page value is a fallback only. |
| `--color-badge-ink` | `#0b0f0c` | `#0b0f0c` | `#0b0f0c` | Unchanged. |
| `--color-danger` | `#ff6b6b` | `#c4213a` | `#ff6b6b` | Every Remove sits in an island. This page value keeps near-white ink legible (5.52:1) if one ever doesn't. |
| `--color-flash-tile-bg` | `#12261a` | `#12261a` | `#12261a` | Fixed, in both modes. |
| `--color-vip-gold` / `-ink` | `#e0b95a` / `#0b0f0c` | same | same | A self-contained fill-and-ink pair. |
| `--color-vip-platinum` / `-ink` | `#c9c9d1` / `#0b0f0c` | same | same | A self-contained fill-and-ink pair. |
| `--color-accent-b-text` *(new)* | `#ffb84d` | `#8a5300` | `#ffb84d` | Amber text on the page, if ever needed (6.03:1). |
| `--color-cta` *(new)* | `#14b8a6` | `#14b8a6` | — | The CTA is identical to dark mode. |
| `--color-cta-ink` *(new)* | `#0b0f0c` | `#0b0f0c` | — | Near-black ink on the bright fill (7.76:1). |
| `--color-indicator` *(new)* | `#243328` | `#7d8c82` | — | Inactive dots, 3.37:1 on the page. |

## B. Black controls (hybrid)

**Composition.** The eye lands on the photo, since it is the only large
colour field. Then it goes to the black search slab above it.

The frame is black: the city pill, the search field and the tab bar dock.
Content is light: tiles, the caption, the disclosure. Content cards are
fills (`#eef2ef`) one step off the page, with the existing hairline.

On checkout the three selected chips are black among light ones and the CTA
is black, so "what have I chosen" and "what do I press" read in the same
colour. Selection is visible with the teal covered, because it is a change
of fill. That is a genuine accessibility gain over dark mode's
colour-and-weight-only selection.

**The one rule that is not a token.** It is light-mode only:
`.chip.selected` takes `--color-cta` as its fill and `--color-cta-ink` as
its label. In dark mode the selected chip stays today's teal outline.

**Teal.** Only the deep teal `#0f766e` appears, and it is rare: the swoosh,
the active dot, the "Flash" tag (a fill with near-white ink, 5.22:1), and
the checkout's money lines ("Free", discount, "You saved", the Offers
summary).

This is the treatment where teal is closest to being a pure signal. The
price is that light mode no longer has a bright teal CTA. Its primary
colour is black, while dark mode's is teal.

**Amber.** "Deal" is unchanged. Voucher expiry on a light voucher card is
`#8a5300` (5.60:1 on `#eef2ef`).

| Token | Dark (today, unchanged) | B: page | B: island (= dark) | Reason for the page value |
|---|---|---|---|---|
| `color-scheme` | `dark` | `light` | `dark` | — |
| `--color-bg` | `#0b0f0c` | `#f8faf8` | `#0b0f0c` | Same page as A, so A and B compare structure alone. |
| `--color-surface` | `#121712` | `#eef2ef` | `#121712` | Real content cards here: one fill step off the page. |
| `--color-text` | `#edf5ee` | `#0b0f0c` | `#edf5ee` | 18.40 on page, 17.08 on card. |
| `--color-text-muted` | `#9fb3a2` | `#56665b` | `#9fb3a2` | 5.81 on page, 5.39 on card. |
| `--color-border` | `#243328` | `#d3dcd5` | `#243328` | Card and divider hairlines. |
| `--color-accent-a` | `#14b8a6` | `#0f766e` | `#14b8a6` | Deep teal: 5.22 on page, 4.84 on card. |
| `--color-accent-b` | `#ffb84d` | `#ffb84d` | `#ffb84d` | Fill only. |
| `--color-tab-active-bg` | `#1b2a1e` | `#dcefe9` | `#1b2a1e` | The tab bar is an island. This page value is a fallback. |
| `--color-badge-ink` | `#0b0f0c` | `#0b0f0c` | `#0b0f0c` | Unchanged. |
| `--color-danger` | `#ff6b6b` | `#c4213a` | `#ff6b6b` | Cart rows are light here. Near-white ink on `#c4213a` is 5.52. |
| `--color-flash-tile-bg` | `#12261a` | `#12261a` | `#12261a` | Fixed. |
| `--color-vip-gold` / `-ink` | `#e0b95a` / `#0b0f0c` | same | same | Self-contained pair. |
| `--color-vip-platinum` / `-ink` | `#c9c9d1` / `#0b0f0c` | same | same | Self-contained pair. |
| `--color-accent-b-text` *(new)* | `#ffb84d` | `#8a5300` | `#ffb84d` | Voucher expiry on a light card. |
| `--color-cta` *(new)* | `#14b8a6` | `#0b0f0c` | — | Black primary action. |
| `--color-cta-ink` *(new)* | `#0b0f0c` | `#ffffff` | — | 19.30:1. |
| `--color-indicator` *(new)* | `#243328` | `#7d8c82` | — | 3.37:1. |

## C. Daylight (conventional all-light)

**Composition.** The eye lands on the photo, then on the teal CTA on
checkout. C has no islands. Depth runs the other way from dark mode:

- the ground is a pale grey-green `#f1f4f1`
- cards, chips, the search field and the tab bar are white `#ffffff`, so
  cards rise by getting *lighter* (the iOS grouped-list pattern)

Chips are white pills. The selected chip is a deep-teal outline with teal
label text, the same idea as dark mode.

It is the calmest of the three, and it is honestly the midpoint: it reads
like many other apps. It is here so the owner is choosing A or B *over*
the conventional answer, not choosing between two versions of the lean.

**Teal and amber.** Bright teal is the CTA fill only (near-black ink,
7.76:1). Deep teal is everything else. Amber is the badge fill; voucher
expiry is `#8a5300`.

| Token | Dark (today, unchanged) | C | Reason |
|---|---|---|---|
| `color-scheme` | `dark` | `light` | — |
| `--color-bg` | `#0b0f0c` | `#f1f4f1` | A grey ground, so white cards read as raised. |
| `--color-surface` | `#121712` | `#ffffff` | Elevation by lightness. |
| `--color-text` | `#edf5ee` | `#0b0f0c` | 17.42 on ground, 19.30 on card. |
| `--color-text-muted` | `#9fb3a2` | `#56665b` | 5.50 on ground, 6.09 on card. |
| `--color-border` | `#243328` | `#dfe5e0` | Lighter than A and B, because cards already separate by fill. |
| `--color-accent-a` | `#14b8a6` | `#0f766e` | Deep teal: 4.94 on ground, 5.47 on card. |
| `--color-accent-b` | `#ffb84d` | `#ffb84d` | Fill only. |
| `--color-tab-active-bg` | `#1b2a1e` | `#d7ede8` | A teal-tinted pill: 15.78 with page ink. |
| `--color-badge-ink` | `#0b0f0c` | `#0b0f0c` | — |
| `--color-danger` | `#ff6b6b` | `#c4213a` | Ground-coloured ink on it: 5.23. |
| `--color-flash-tile-bg` | `#12261a` | `#12261a` | Fixed. |
| `--color-vip-gold` / `-ink` | `#e0b95a` / `#0b0f0c` | same | — |
| `--color-vip-platinum` / `-ink` | `#c9c9d1` / `#0b0f0c` | same | — |
| `--color-accent-b-text` *(new)* | `#ffb84d` | `#8a5300` | 5.71 on ground, 6.33 on card. |
| `--color-cta` *(new)* | `#14b8a6` | `#14b8a6` | The brand fill, kept as a fill. |
| `--color-cta-ink` *(new)* | `#0b0f0c` | `#0b0f0c` | 7.76. |
| `--color-indicator` *(new)* | `#243328` | `#7d8c82` | 3.19 on ground. |

## Contrast, computed

Every value below is the output of `./scripts/contrast <fg> <bg>`, run for
this document. "Island" means dark-mode values, so the dark column is also
every island pair in A and B.

- The floor is 4.5 for text.
- It is 3.0 for non-text UI (the swoosh, dots, focus rings, selected-chip
  borders).

| Pair (fg on bg) | Dark and islands | A/B page | B card | C |
|---|---|---|---|---|
| `text` on `bg` | 17.37 | 18.40 | — | 17.42 |
| `text` on `surface` | 16.33 | (sentinel in A) 17.08 | 17.08 | 19.30 |
| `text-muted` on `bg` | 8.68 | 5.81 | — | 5.50 |
| `text-muted` on `surface` | 8.16 | 5.39 | 5.39 | 6.09 |
| `accent-a` on `bg` (text, swoosh, active dot, focus ring) | 7.76 | 5.22 | — | 4.94 |
| `accent-a` on `surface` (selected-chip label and border, fee text) | 7.29 | 4.84 | 4.84 | 5.47 |
| `bg` on `accent-a` (Flash tag, cart badge, reopen bar, sheet header) | 7.76 | 5.22 | 5.22 | 4.94 |
| `cta-ink` on `cta` (Place order; B also the selected chip) | 7.76 | A: 7.76 / B: 19.30 | — | 7.76 |
| `badge-ink` on `accent-b` (Deal) | 11.23 | 11.23 | 11.23 | 11.23 |
| `accent-b-text` on `surface` / `bg` (voucher expiry) | 10.56 | 6.03 (page) | 5.60 | 6.33 / 5.71 |
| `bg` on `danger` (Remove, confirm) | 6.96 | 5.52 | 5.52 | 5.23 |
| `text` on `tab-active-bg` | 13.53 | 16.15 (fallback) | — | 15.78 |
| `#ffffff` on `flash-tile-bg` | 15.93 | 15.93 | 15.93 | 15.93 |
| `vip-gold-ink` on `vip-gold` | 10.35 | 10.35 | 10.35 | 10.35 |
| `vip-platinum-ink` on `vip-platinum` | 11.73 | 11.73 | 11.73 | 11.73 |
| `indicator` on `bg` (inactive dot) | **1.45** (today, frozen) | 3.37 | — | 3.19 |
| Island edge `#121712` on page `#f8faf8` | — | 17.30 | — | — |

**Below the floor, and why they stay:**

- **CTA edge on the light page:** `#14b8a6` on `#f8faf8` is 2.37 (A), and on
  `#f1f4f1` it is 2.25 (C). WCAG 1.4.11 asks 3:1 of the visual information
  *needed to identify* a component. The Place order button is identified
  by its label, which is 7.76:1. Teal fills on light pages carry this
  everywhere (Deliveroo is the reference). B does not have the issue: its
  black CTA is 18.40 against the page.
- **White card on the C ground:** 1.11. Cards are identified by their
  photo and text, not their edge. This is why C's border is kept rather
  than removed.
- **Dark mode's inactive dot, `#243328` on `#0b0f0c`, is 1.45 today.**
  Fixing it would change dark mode, which the owner froze. It is recorded
  here as an existing gap, not fixed. The new `--color-indicator` token is
  where a future fix would land.

**Checked because they fail, which is why the rules exist:**

- `#14b8a6` on `#ffffff` = 2.49 (why bright teal is never text on white)
- `#ffffff` on `#14b8a6` = 2.49 (why the CTA ink is not white)
- `#ffb84d` on `#ffffff` = 1.72 (why amber text gets `--color-accent-b-text`)
- `#f8faf8` on `#ff6b6b` = 2.65 (why danger changes on the light page)
- `#56665b` on `#e0b95a` = 3.27 (light muted ink on gold still fails, so
  `contrast.test.ts`'s "full ink only on VIP fills" rule holds in both modes)

## States

- **Selected (chips).**
  - Dark and A: teal outline plus teal label, weight 800.
  - B: black fill plus white label. It is the only treatment where
    selection is carried by fill, so it survives colour-blindness and a
    covered accent.
  - C: deep-teal outline plus label.
- **Focus.** It stays today's 2px `--color-accent-a` outline.
  - One trap for islands. An outline is painted *outside* the element, on
    the page, but its colour resolves on the island, to bright
    `#14b8a6`. That is 2.37:1 against white.
  - Islands therefore draw their focus ring *inset*:
    `outline-offset: -2px`, which gives `#14b8a6` on `#121712` = 7.29.
  - Page elements and the CTA keep the outside ring in deep teal (5.22 A/B,
    4.94 C).
- **Pressed.** Unchanged (`transform: scale(...)` rules). Nothing here is
  colour-driven.
- **Loading (a photo not yet arrived).** `.carousel-slide-media` and tile
  photos show `--color-surface` behind the image. That is a dark block in
  A (inside the island), and a light block in B and C.
- **Empty (for example "Your cart is empty").** Page text plus a
  `.reset-button`/Browse button. The button is an island in A, and a light
  surface button in B and C.
- **After a destructive action.** Remove opens the confirm dialog.
  - In A the dialog is an island: black sheet, `#ff6b6b` Remove with
    `#0b0f0c` ink (6.96).
  - In B and C it is a light dialog: `#c4213a` Remove with near-white ink
    (5.52 / 5.23).
  - The scrim stays `rgba(0,0,0,0.6)` in all three. On a white page that
    reads as a normal modal dim, and there is no reason to lighten it.
- **Sheets (flash deal, rating), not drawn.**
  - A: island. They look exactly like today.
  - B and C: `--color-bg` sheet, the flash header on a deep-teal fill with
    near-white ink (5.22 / 4.94), the countdown tile on fixed
    `#12261a` (15.93).
- **Switching mode.** An OS switch repaints at once, with no transition.
  Nothing animates, so reduced motion has nothing to remove.

## The mocks

All the mocks sit beside this document. They are self-contained, have no
build step, and nothing imports them.

- **Home feed** (`199-home-feed-<slug>.html`): the header (wordmark, the
  centred city pill at narrow width, the desktop nav at wide), search, the
  ad carousel with its Ad label, pause disc, caption and dots, the cuisine
  chips, and the "Near you" tiles with a Deal badge and a Flash tag.
- **Checkout** (`199-checkout-<slug>.html`): the title, drop-off and
  instruction chips (selected and unselected), the utensils toggle, the
  Offers row, the breakdown (struck fee, "Free", discount row, "You
  saved"), the total, the demo disclosure and Place order. Below them is a
  labelled reference strip showing the cart row's Remove, both VIP pills
  and an amber expiry line. That strip is visible in the wide render.
- **Slugs:** `dark` (today, the reference), `islands` (A), `controls` (B),
  `daylight` (C).

Within a screen, the four files are byte-identical except for
`<html data-t="...">` and the `<title>`. The token blocks are the tables
above, verbatim, and the islands are drawn with the mechanism the engineer
would use (`.isl-a` / `.isl-b` re-declaring dark values under
`:where(...)`).

Rendered with `./scripts/design-render` at 1280×900 and 375×812: 16 PNGs,
`199-{home-feed,checkout}-{dark,islands,controls,daylight}-{wide,narrow}.png`.

## Critique, after looking at the pictures

What rendering found, and what I changed:

1. **Island text was the wrong grey, in every A and B render.** The island
   rule re-set `color: var(--color-text)` at a higher specificity
   (`html[data-t] .isl-a`) than the components' own `color`. The search
   placeholder and chip labels rendered in full white instead of muted
   ink, so the chips shouted.
   - *Fix:* the island rule now sits inside `:where(...)` at zero
     specificity, so a component's own `color` wins. I re-rendered and
     confirmed the muted labels.
   - This goes straight into the engineer note: it is the first thing an
     implementation would get wrong.
2. **In B's first pass, selected chips were dark pills with a teal outline
   next to dark pills with white labels.** The *unselected* chips looked
   brighter than the selected ones, and selection was colour-only.
   - *Fix:* only the selected chip is black (the CTA pair), and the others
     are light. Covering the teal no longer hides the choice.
   - The same weakness exists in dark mode and A. I left it there, because
     it is today's dark design and A's islands are dark mode by definition.
3. **Inactive carousel dots nearly vanished on the light grounds.** Their
   contrast was 1.34 in A and B and 1.15 in C, because the dots borrow
   `--color-border`.
   - *Fix:* I added `--color-indicator` (`#7d8c82`, 3.37 / 3.19). In the
     C narrow render the row reads as seven dots again.
4. **Two teals in A (kept).** On A's checkout the deep-teal money lines sit
   a few centimetres from bright-teal chip labels and the bright CTA. I
   tried the page accent inside islands too: deep teal on `#121712` is
   3.32, so that fails.
   - I tried bright everywhere: that fails on white.
   - So the split stays. It follows one rule (bright on dark or as a fill,
     deep on white), and at reading distance the two read as one hue.
5. **Blurring the eyes.**
   - A resolves into five black shapes on white (search, card, chip row,
     two tiles) plus a black dock. It has a composition, but a busy one.
   - B resolves into a black band top and bottom with light content
     between, which is the calmest composition of the three.
   - C resolves into the photo and nothing else.
6. **The one element I would remove: A's black search slab.** It is the
   heaviest thing above the carousel, and at narrow width it competes with
   the ad card for first look. It stays because the owner named the search
   field as a component to keep dark. If A is chosen, this is the first
   thing I would revisit.
7. **Narrow before wide.** Nothing clips at 375. The two-line wordmark and
   the centred pill hold. The chip row fades out as it does today. The
   checkout CTA clears the tab bar.

## Recommendation

**A, Dark islands**, with B as the answer if A's checkout feels too heavy
once it is on a real phone.

Reasons:

- A is the only treatment that keeps the current colour scheme *as a
  thing*, not as a set of hues. In light mode every card, chip, sheet and
  CTA looks exactly as it does in dark mode. The page underneath is the
  only thing that changes. That is the most literal reading of both halves
  of the owner's brief.
- It is also the cheapest to *keep* correct. Every island pair is a dark
  pair `contrast.test.ts` already checks. A new component designed in
  dark mode is automatically right in light mode once it is added to the
  island list, and the sentinel surface makes a forgotten one visible.
  B and C both need every future component checked twice.
- The trade is weight. A's light mode is still roughly half dark, and it
  carries two teals. A person who chose light mode for less darkness gets
  a lighter page, not a light app. B is the better answer to *that*
  person: it is lighter, calmer, and its selection state is more
  accessible. But its primary colour becomes black instead of teal, which
  moves further from "keep the current colour scheme" than A does.

## The question for the owner

**Which light-mode treatment should the engineer build: A (Dark islands:
components stay exactly as in dark mode, page goes white; my
recommendation), B (Black controls: only search, pill, tab bar, selected
chips and the CTA stay black, content goes light), or C (Daylight: fully
light)?**

## For the engineer child

- **Mechanism.** Dark stays as today's `:root`, byte-for-byte. Light mode
  is one `@media (prefers-color-scheme: light)` block that re-declares the
  page values on `:root` (including `color-scheme: light`). For A or B the
  same block also carries the island rule:
  - `:where(<island selectors>) { color-scheme: dark; <dark values>;
    color: var(--color-text); }`
  - Keep it at zero specificity (critique 1).
  - `color` has to be re-set because body's inherited colour was computed
    from the page ink.
- **Alternative.** CSS `light-dark()` does the same with `color-scheme:
  light dark` on `:root` and `color-scheme: dark` on islands. The Dave
  Rupert article above is exactly this pattern, and support is Baseline
  2024. The explicit media query is recommended because the issue names
  `prefers-color-scheme` and the build tests read declared values.
- **Tests that change.**
  - `src/styles/theme.build.test.ts` asserts
    `expect(css).not.toContain('prefers-color-scheme')` under "the site is
    always dark". That assertion is replaced with one that the light block
    exists and declares the chosen page values.
  - The `:root` dark-value assertions in the same file stay as they are.
  - `contrast.test.ts` gains the light pairs from the table above.
  - Its "white on accent-b fails" and "muted on gold fails" checks hold in
    both modes.
- **New tokens, dark value = today.**
  - Add `--color-cta` and `--color-cta-ink`, and move every *primary
    action* fill onto them: `.place-order`, `.cart-summary-bar`,
    `.order-placed-cta`, `.tracker-action-primary`, `.footer-apply`.
  - Add `--color-accent-b-text` for `.voucher-expiry`.
  - Add `--color-indicator` for `.carousel-dot-mark`.
  - In dark mode each resolves to today's value, so nothing moves.
- **Accent fills that stay on the accent.** These keep
  `--color-accent-a` with `--color-bg` ink: `.flash-tag`, `.cart-badge`,
  `.reopen-bar`, the flash `.sheet-header`, `.checkbox`, the quantity
  stepper buttons, and the stepper dots.
  - In A they are inside islands, so the bright teal and black ink stay.
  - In B and C they are deep teal with near-white ink (5.22 / 4.94).
- **Island list for A.** Every element whose background is
  `--color-surface` today:
  - the city pill, `.home-search`, `.carousel-slide-media` and the whole
    slide, `.cuisine-chip`
  - `.tile-card`, `.restaurant-card`, `.location-card`
  - `.chip`, `.demo-disclosure`, `.voucher-row`, `.footer-bar`
  - `.quantity-stepper`, `.add-button`, `.reset-button`
  - the tracker cards, rows, history and VIP card, the tab bar
  - Plus the overlays whose background is `--color-bg`: `.cart-row`,
    `.confirm-dialog`, `.flash-sheet-overlay .sheet`, the rating sheet and
    `.tracker-tip-panel`.
  - A light-grey card anywhere in A is one you missed.
- **Island list for B.** The city pill, `.home-search`, the tab bar,
  `.add-button` and `.quantity-stepper`. The CTA uses `--color-cta`.
- **Light-only rules, not tokens.**
  - A: the carousel slide becomes one card (slide fill, caption side
    padding, photo corners).
  - B: `.chip.selected` uses the CTA pair.
  - A and B: islands draw focus inset (`outline-offset: -2px`).
- **Literals that stay as they are.** These are fixed on purpose, so an
  engineer should not "fix" them:
  - `.carousel-ad-label` and `.carousel-pause-mark` (`rgba(0,0,0,0.72)`
    plus white, over photos)
  - the first-order banner's teal gradient
  - the sheet scrims and shadows
  - the flash countdown tile

## For the orchestrator

There is no event-tracking impact (the #79 rule). The engineer child
changes colour values and adds one media block. It adds or removes no
element and wires no `track()` call, and no event goes quiet.

There is no ADR either. Adding a light theme under the OS setting reverses
#194's "always dark" call, which is recorded in `global.css`'s own comment
and in `theme.build.test.ts`. The engineer child should update that
comment when it lands.
