# First-screen intro, About line, favicon, and LinkedIn preview

Spec for issue #235, serving parent objective #220. This document proposes
copy and an image for all three things the owner delegated on #221's O4 (the
home intro, the About "who built it" line, and the LinkedIn preview image's
content), and says exactly what the favicon and title-string fix should be.
It changes no code — everything below is for the engineer child that follows
this one. No new restaurants, dishes, or photos (owner, 2026-09-28, on #220).

**Open these first**, narrow before wide: `235-home-picker-dark-narrow.png`,
`235-home-feed-dark-narrow.png`, `235-home-flash-sheet-dark-narrow.png`,
`235-home-reopen-bar-dark-narrow.png`, then the four `235-home-*-light-narrow.png`
siblings. The `-wide.png` file beside each one is the same state at 1280px.

## The outcome, the constraints, the guesses

**Outcome (fixed).** A stranger who taps the LinkedIn link and lands on `/`
can tell, without scrolling, that this is a parody, that it's a hands-on
analytics-practice project, that nothing is charged and no food arrives, and
what to do next. The link itself previews with a real image and a real
title instead of a bare URL.

**Constraints (checked against the code, not assumed).**

- `Header.astro` already has a home-only conditional path (`isHome`,
  `.brand-group--home`) that shows a city pill and a wallet-balance slot only
  on `/` at phone width. The intro reuses that same "home only" seam rather
  than inventing a second one.
- `src/styles/global.css`'s type scale and spacing scale are unchanged; the
  intro's own font-size is `--font-size-muted` (already the site's smallest
  body size) and its color is `--color-text-muted` for the body, `--color-text`
  for the lead sentence — both existing tokens, not new ones.
- The flash sheet's own spec (#119) is unchanged: still 88vh, still fixed to
  the viewport bottom, still opens automatically on a first visit with a
  live draw. I did not touch when or how it opens — only where the intro
  sits so it survives the sheet opening over it.
- `about.astro`'s existing intro paragraph, the event-family list, the driver-
  avatar credit, and the wallet paragraph (gated on `PUBLIC_WALLET_ENABLED`)
  are unchanged. The new paragraph is additive, above the list.
- `BaseLayout.astro`'s `<head>` today has only charset, viewport, and
  `<title>`. Nothing here removes or restructures those three.
- No favicon exists anywhere in `public/`, and no committed brand mark other
  than the wordmark's own CSS-drawn tail-curl (`.wordmark-tail`,
  `Header.astro`) is available to build one from — `docs/design/
  72-dontdropthatpromo-identity.md`'s glyph belongs to a superseded identity
  per that document's own header, so it is not a source here.
- `og:url`/`og:image` need an absolute URL built from
  `VERCEL_PROJECT_PRODUCTION_URL` at build time (owner's O11, decision log
  #221), and the build must not break when that variable is absent.

**Guesses, named (the three the owner asked me to pick, not ask about — #221's
O4), plus the two I'm settling myself because the issue's own wording left
them ambiguous:**

- The home intro's exact words, the About paragraph's exact words, and the
  preview image's exact crop are all guesses I'm making and recommending, per
  the issue. Said below, no `agent:needs-input` needed for these three.
- **"Four screenshots" for three named states.** The issue's criterion 1 lists
  three states (picker, feed, feed-with-sheet-open) but says "the four
  screenshots." Criterion 2 then asks about a fourth state — the collapsed
  `.reopen-bar` — reusing "the 375px PNG from criterion 1." Reading the two
  together, the fourth screenshot is the reopen-bar state; I built it as its
  own mock rather than leaving it implicit. This document ships four states
  (not three), each in both themes and both widths.
- **What building block the favicon uses.** Nothing in the repo names one.
  I picked the wordmark's own weight-800 "d" (see "Favicon," below) over the
  small CSS-drawn tail-curl, because the curl is a corner decoration with no
  legible shape on its own at 16px — confirmed by looking at
  `.wordmark-tail`'s actual geometry (a 6×6px rounded corner), not by
  assuming.

## The four states, and where the intro survives

Happy path, phone width, first visit:

1. **City picker** (`/`, no stored city). Wordmark, then the intro paragraph,
   then "Choose your city" and the two location cards. Nothing overlays
   anything here — this is the least constrained state, and the baseline the
   other three are checked against.
2. **Feed, after a city is picked.** The wordmark row gains the city pill
   (`San Francisco ▾`) beside it, same as today; the intro sits on its own
   line directly below that row, still inside the header, still above
   `<main>`.
3. **Feed with the flash sheet's first-visit state open.** The sheet is
   `position: fixed`, `height: 88vh`, anchored to the viewport bottom
   (`flash-sheet-dom.ts`, `BaseLayout.astro`'s `.flash-sheet-overlay .sheet`)
   — so exactly the top 12% of a 375×812 viewport (about 97px) is not
   covered by the sheet or its scrim. That strip is where the wordmark
   already lives, so the intro has to fit inside it alongside the wordmark,
   not merely inside a generous "above the fold." I measured this by
   rendering a throwaway mock with an inert box standing in for the sheet
   before building the real one — the first real draft of the intro (four
   sentences, `line-height: 1.35`) clipped its fourth line behind the
   sheet's own header. Fixed by shortening the copy by one clause and
   tightening `line-height` to 1.25 and the header's own top/bottom padding
   to `--space-xs`; `235-home-flash-sheet-dark-narrow.png` and its light
   sibling are the corrected render, not the clipped one.
4. **Feed with the flash sheet's collapsed `.reopen-bar` showing**
   (criterion 2). I built this as a short page — header, one abbreviated
   feed card, footer, reopen-bar, tab bar — sized so the footer link sits
   near the bottom of the initial viewport rather than requiring a scroll
   that `design-render` can't perform. Because a fixed element's position is
   relative to the viewport, "page content exactly fills the viewport" and
   "scrolled all the way to the bottom of a taller page" put the footer link
   at the same spot relative to the reopen-bar either way, so this short
   mock is not a simplification of the real risk, it's the same geometry.
   The render (`235-home-reopen-bar-dark-narrow.png` /
   `-light-narrow.png`) shows a clear ~150px gap between the link and the
   bar — `site-footer`'s existing mobile `padding-bottom` (`calc(56px +
   safe-area + var(--space-xl))`, `BaseLayout.astro`) already clears the
   reopen-bar (`bottom: calc(56px + safe-area)`, own height about 60px)
   without any change. **No fix needed here** — this criterion is satisfied
   by existing behavior, verified rather than patched.

Every state above also shows the search bar, carousel, and tile grid (states
2–4) or the two city cards (state 1) exactly as they render today; nothing
about them changes.

## Directions considered

**Direction A — plain text under the wordmark, inside the header (shipped).**
Two sentences, `--font-size-muted`, no border, no background, no icon. Lives
in the same conditional (`isHome`) that already gates the city pill.

**Direction B — a bordered callout card, first thing inside `#home-root`**
(reusing this site's existing `.demo-disclosure` pattern — icon, border,
tinted surface — already used on the About page and at checkout). I built
and rendered this one too, in the flash-sheet-open state specifically,
because that's the state where space is tightest. It failed there: the
border, padding, and icon add enough height that the card's own text runs
under the sheet's scrim and becomes unreadable, not just tight — confirmed
by rendering it, not estimated. I didn't keep that render (it was a
throwaway check, not a proposal), but the failure is the reason Direction A
is the recommendation, not a coin flip: A is structurally lighter, so it is
the one that survives the hardest of the four states without a rewrite.

Direction A's own risk — that plain small text under a wordmark reads as
throwaway fine print — is why the first sentence is bold (`--color-text`,
full contrast) and states the two facts a skimming reader needs most
("parody," "practicing product analytics"); the rest is the supporting
clause, muted.

## Composition and contrast

The eye lands on the wordmark first, unchanged from today. The intro is the
second thing read, before "Choose your city" or the search bar — it answers
"what is this" before the page asks the visitor to do anything. Nothing
below it changes weight or position; this is one added paragraph, not a new
region.

Both themes, checked with `./scripts/contrast`, not estimated:

- Dark: lead sentence `#edf5ee` on `#0b0f0c` → **17.37:1**. Body clause
  `#9fb3a2` on `#0b0f0c` → **8.68:1**.
- Light: lead sentence `#0b0f0c` on `#f1f4f1` → **17.42:1**. Body clause
  `#56665b` on `#f1f4f1` → **5.50:1**.

Both pairs are existing tokens (`--color-text`, `--color-text-muted`,
`--color-bg`) already in use elsewhere on the page, so no new pair enters
`contrast.test.ts`.

Motion: none. The intro is static text, present on first paint, nothing
animates in or out — deliberately, since #119's flash sheet already owns
this screen's one animated entrance and a second one competing with it on a
first visit would be the kind of thing nobody asked for.

## Component spec: the home intro

- One `<p data-testid="home-intro">` inside `Header.astro`'s existing
  `.brand-group`/`isHome` conditional, directly after the wordmark (state 1)
  or after the wordmark+city-pill row (states 2–4). Renders only when
  `isHome` is true — every other page keeps today's header unchanged.
- Content, exact text:

  > **A parody delivery app for practicing product analytics.** Every tap
  > fires a real, anonymous event — nothing's charged, no food arrives. Pick
  > a city and place a fake order.

  The first sentence is wrapped in its own `<strong>` (full-contrast
  `--color-text`); the rest is the paragraph's own text at
  `--color-text-muted`.
- Styling: `font-size: var(--font-size-muted)`, `line-height: 1.25`,
  `margin: 2px 0 0`, `max-width: 30rem` (stops it stretching full-width on
  desktop, where the header has much more room than the wordmark needs).
- States: none. It does not change on interaction, does not dismiss, and
  does not depend on which city is picked or whether a flash draw is live —
  it is the same two sentences in all four states above. No first-visit-only
  flag, no localStorage key: the simplest version that satisfies the
  criteria, and one this repo doesn't have to test a decay/expiry path for.
- Must never: wrap to a fourth line in the flash-sheet-open state at 375px
  (see "The four states" above for why that's the binding constraint), or
  carry any fact not already listed in `about.astro`'s own privacy copy.

## Component spec: the About "who built it" paragraph

One `<p data-testid="about-builder-credit">`, placed as the **first**
paragraph in `about.astro`, directly after `<h1>What we log, and why</h1>`
and before the existing "Every screen in this app fires a real event…"
paragraph — above the `<ul>` event-family list either way, which is what
criterion 3 requires; first felt right because "who built this and why"
belongs before the reader gets into event-by-event detail. Exact text:

> Dontdropthatpromo is a solo project by Charles Amaya, built as a hands-on
> way to practice product analytics — the querying, event design, and
> metric judgment the job actually needs, against a real dataset instead of
> a toy one. [Find me on LinkedIn](https://www.linkedin.com/in/charlesamaya).

Two sentences. The link text is "Find me on LinkedIn"; its `href` is exactly
`https://www.linkedin.com/in/charlesamaya`, the URL the issue names. That URL
appears above, before `about.astro`'s first event-family list item, which
reads "A random ID for this browser" — satisfying criterion 3's own grep.

## Preview image, favicon, and title convention (criterion 4)

**Preview image.** Source: a crop of `./scripts/app-render /
<out-dir>`'s existing **wide** (1280×900) screenshot of `/`, San Francisco,
after a city is picked — the feed state, not the bare picker, because the
carousel's teal first-order banner is the most colorful, most
recognizably-a-delivery-app element on the site and the picker alone is two
plain cards on a flat ground. Crop a 1200×630 region (LinkedIn's own
preferred ratio, 1.91:1) from that screenshot, top-anchored, centered
horizontally, so it captures the wordmark, the intro, the search bar, and
the full carousel banner — keeping the wordmark and the carousel's own text
inside the centre safe zone the way link-preview services crop or letterbox
at the edges. No new illustration and nothing hotlinked: it is a crop of the
app's own built output. Destination: `public/og-image.png` (Astro serves
`public/` at the site root, so `/og-image.png`).

**Absolute URL.** `og:url` and `og:image` are built at build time as
`https://${VERCEL_PROJECT_PRODUCTION_URL}/og-image.png` (and the page's own
path for `og:url`). When that variable is absent — a local build, or CI,
neither of which sets it — **both meta tags are omitted entirely**, not
emitted with a relative or empty URL: LinkedIn requires an absolute URL, so
a missing tag previews as a bare link (today's behavior) while a
present-but-wrong one previews as broken, which is worse. This is the one
place this document asks the engineer to write a conditional rather than a
fixed value.

**Favicon.** Source mark: the letter **"d"**, set in the wordmark's own
weight (800, `system-ui` stack, matching `.wordmark-strong`), `--color-bg`
ink on a solid `--color-accent-a` fill — the same pairing `.place-order`
already uses (`--color-cta-ink` on `--color-cta`, both equal to
`--color-bg`/`--color-accent-a` today), so no new contrast pair to check.
One master `public/favicon.svg` (32×32 viewBox), generated once (an image
editor or any local SVG-to-raster tool — this is a static asset checked into
`public/`, not a build-time dependency, so it adds nothing to `package.json`
and needs no ADR) into:

- `public/favicon.svg` — referenced as `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`, the primary modern reference.
- `public/favicon.ico` (16/32/48 multi-size) — what a browser requests by default at `/favicon.ico`.
- `public/favicon-32x32.png`, `public/favicon-16x16.png` — `<link rel="icon" sizes="...">` fallbacks.
- `public/apple-touch-icon.png` (180×180) — `<link rel="apple-touch-icon">`.

**Title convention.** Every page but home already reads `"<Page> —
Dontdropthatpromo"` (`about.astro`, `cart.astro`, etc.) — unchanged. Home
(`index.astro`) is today's lowercase outlier, `title="dontdropthatpromo"`.
Fix: **`title="Dontdropthatpromo"`** — the proper-noun capitalization used
as the suffix everywhere else, with no "Home —" prefix, since home has no
distinguishing page name and a bare brand-name title is the reading a site's
root page conventionally gets. This is also the string LinkedIn shows as the
preview's own title line.

**Not required by this issue, but needed for the preview to have any text at
all** (flagged for the engineer, not a new acceptance criterion): a
site-wide `<meta name="description">` and matching `og:description`. I
recommend reusing the intro's own first sentence plus clause: "A parody
delivery app for practicing product analytics — every tap fires a real,
anonymous event. Nothing's charged and no food arrives." `og:title` should
read the page's own `title` prop; `og:type` is `"website"`.

## `data-testid`s for the engineer

- `home-intro` — the intro `<p>` in `Header.astro`.
- `about-builder-credit` — the About page's new "who built it" `<p>`.

No others: the favicon and preview-image references are `<link>`/`<meta>`
tags, not visible or interactive elements, per the issue's own note.

## What I looked at outside this repository

- **Mercury's open, no-email-gate product sandbox** (via
  [Eleken's fintech design guide](https://www.eleken.co/blog-posts/modern-fintech-design-guide)):
  the pattern I'm taking from it is that the disclosure lives *in* the
  product, at the point of use, rather than as a gate in front of it — it's
  the argument for Direction A over a modal or an interstitial "you are
  about to enter a demo" screen, which I didn't build a mock for because
  this reference is what ruled it out before I did.
- **[LinkedIn/OG image sizing](https://screenhance.com/blog/og-image-size-guide)**:
  1200×630, safe-zone guidance (keep text and logos out of the outer
  crop/pad margin) — directly why the preview crop is top-anchored and
  centered rather than an arbitrary slice.
- **2026 favicon/monogram trend pieces** (e.g.
  [WeAndTheColor's 2026 logo trend report](https://weandthecolor.com/best-logo-design-trends-of-2026-whats-working-whats-tired-and-whats-next/209969)):
  taking "crisp edges, a reduced form that reads at favicon size, paired
  with the brand's own geometric type" — refusing the "fully custom
  mascot/illustration" thread in the same pieces, which the issue's own
  scope line ("no new illustration") already rules out.

## Critique pass, against the renders

- Read narrow before wide, per the method. The clipped fourth line in state
  3 (above) is the thing this step exists to catch — it is invisible in the
  HTML source and only showed up in the actual screenshot.
- Covered the accent with a hand (mentally: read the four renders with the
  intro's bold lead sentence removed) — the page still reads as "a delivery
  app" from the wordmark and carousel alone, which is correct: the intro
  should add context, not carry the whole page's identity.
- The one thing I'd remove: the intro's trailing period after "fake order."
  in a two-sentence paragraph, but this is a two-line diff and not worth a
  second criterion — noted, not acted on.
- Blurred-eyes check: the wordmark and the carousel's teal banner are what
  survive at both widths; the intro sits quietly between them, which is the
  intended weight — supporting text, not a headline.

## For the engineer that follows

- Wire `home-intro` and `about-builder-credit` exactly as specced — this
  objective's sibling analytics-readiness objective (#219) wires events
  later and needs these hooks stable now.
- The og:image/og:url conditional (VERCEL_PROJECT_PRODUCTION_URL present or
  absent) is the one piece of real logic this spec asks for; everything
  else is markup and copy.
- Generating the favicon files is a one-time asset step, not a dependency
  add — do it locally and commit the binaries.
