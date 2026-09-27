# ADR 0011: canvas-confetti draws the rating sheet's win burst

Date: 2026-09-27
Status: accepted

## Context

#163's rating sheet (parent #162, `docs/design/162-rating-win-tips-rewards-
vip.md`, "The animation") ends in a win screen that plays a short confetti
burst from a stamp, and a still frame under `prefers-reduced-motion`. The
owner pre-approved a small confetti library for this under O1, on the
condition that whichever one is added carries its own ADR in this pull
request — this is that ADR.

The design doc names the library and its API directly (`confetti.create(canvas,
{ resize: true })`, `disableForReducedMotion`), drawn on a canvas the sheet
itself owns rather than the library's default full-page canvas — the first
render drew particles over the reward ticket before that was specified (the
doc's own "Critique" section). This is the first canvas-based animation
dependency this project uses; npm is already this project's ecosystem, so
this is a new package, not a new category.

## Decision

`canvas-confetti` is pinned as a direct (non-dev) dependency at exactly
`1.9.4` — no `^` — since #163's win screen imports it at runtime and a version
bump can change what the burst looks like without anyone deciding that on
purpose. It ships no bundled type declarations; `src/lib/canvas-confetti.d.ts`
declares only the surface `rating-sheet-dom.ts` actually calls
(`confetti.create`), rather than pulling in a separate `@types/*` package for
one method.

It is loaded by dynamic `import()` inside `rating-sheet-dom.ts`'s `renderWin`,
the first (and only) time a win plays for a given sheet, and only when
`prefers-reduced-motion: reduce` does not match — under reduced motion, the
module is never imported, no canvas is created, and the stamp/heading/summary
appear in their final positions at once. `disableForReducedMotion: true` is
also set on the burst call itself, as the design doc's second guard.

`confetti.create(canvas, { resize: true })` scopes every burst to a
`<canvas>` the sheet creates and positions behind its own content (a negative
`z-index` within the sheet's own stacking context — BaseLayout.astro,
`.rating-sheet-confetti`), never the library's default full-page canvas.
Nothing is fetched from a CDN; the package is bundled by Astro's build like
any other dependency.

**Licence and size, quoted from the package actually installed**
(`node_modules/canvas-confetti/package.json`, `node_modules/canvas-confetti/
LICENSE`):

- **Licence: ISC.** "Permission to use, copy, modify, and/or distribute this
  software for any purpose with or without fee is hereby granted..." —
  functionally equivalent to MIT, no attribution requirement beyond keeping
  the licence notice in the package itself (which npm does).
- **Size.** The ESM build actually imported, `dist/confetti.module.mjs`, is
  24,924 bytes unminified/uncompressed (`ls -la` / `wc -c`). **Gzip could not
  be measured in this environment**: every `gzip`/`node -e` invocation tried
  here was refused by the sandbox (a configuration limit of this run, not of
  the package), the same gap #162's own design doc left ("I could not measure
  it here"). The unminified figure is the one fact this ADR can stand behind;
  a bundle-size check against the built `dist/` (`npm run build`) is the
  criterion this pull request actually verifies (#163 AC3: no new host in
  `dist/`'s references), which does not require the gzip number either.

## Consequences

The win screen's bundle cost is paid only by a visitor who actually reaches
Delivered and has motion enabled — every other page, and every reduced-motion
visitor, never triggers the `import()` at all. Bumping the pinned version is a
deliberate, re-rendered decision (the same reasoning ADR 0010 gives for the
driver avatar packages), not routine maintenance, since a version bump can
change the burst's particle shapes or default easing.

Regenerating nothing is needed here — unlike ADR 0010's avatars, this library
runs entirely at request time in the visitor's own browser; there is no build
step to keep in sync with it.

## Alternatives rejected

- **CSS-only confetti (animated pseudo-elements/`@keyframes`).** Rejected in
  #162's own design pass: physics-y, uneven particle motion (`gravity`,
  `startVelocity`, per-particle `spread`) is exactly what a hand-rolled CSS
  animation is worst at, and the "warm, earned, brief" direction depends on
  the burst reading as thrown rather than looped.
- **The library's default full-page canvas.** Rejected directly by the design
  doc's own critique: the first render drew particles over the reward ticket
  and the VIP nudge text before a sheet-owned, behind-content canvas was
  specified.
- **A heavier animation library (e.g. `lottie-web`, `party-js`).** Not
  seriously considered: the owner's pre-approval (O1) was for "a small
  confetti library" specifically, and canvas-confetti is the one #162's
  design doc measured its critique passes against.
