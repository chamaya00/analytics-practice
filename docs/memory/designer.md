# Lessons for the designer in this repository

<!--
One line per lesson, specific to this repository, stated as a rule with the
reason attached. Hard cap of 40 non-blank lines, enforced by the guard.

Past the cap, rewrite rather than append: merge two lessons that say the same
thing, drop the one that has stopped being relevant, tighten what survives.

Delete any lesson that has graduated into a test, a lint rule, or a type.
-->

- `scripts/design-render`'s screenshot is viewport-sized (1280×900 /
  375×812), not full-page — content below the fold at that width is
  silently absent from the PNG rather than scrolled-to. Verified by
  rendering a page taller than the viewport and confirming only one
  viewport's worth of content appeared. A mock with more content than fits
  one viewport (e.g. several named states stacked for comparison) needs its
  most important state placed first, or tightened spacing, rather than
  assuming everything the file contains will show up in the render.
- A mock reusing this site's fixed bottom tab bar (`Header.astro`'s phone
  nav) has to include the tab bar itself, not just its bottom padding — a
  first pass that left it out judged "does the CTA clear the fold" against a
  page shorter than the real one, and passed for the wrong reason.
- In a self-contained mock with two `@media` blocks touching the same
  selector (one hiding a phone-only element above a breakpoint, one styling
  it unconditionally elsewhere in the file), CSS source order decides the
  tie at equal specificity — the override has to come *after* the rule it
  overrides, or the later unconditional rule silently wins at every width.
- Unicode icon glyphs (e.g. `ⓘ`) aren't guaranteed to render in
  `design-render`'s headless-Chromium font set — one rendered as an empty
  box. Use a small inline SVG for any icon a mock depends on, not a
  character and a hope.
- `display: flex`'s `gap` applies to Flexbox's own anonymous items too,
  including the ones it wraps around a bare text run and each `<wbr>` — a
  weight-split wordmark (`text` + `<wbr>` + `text`) given `display: flex`
  for no reason of its own rendered as visibly separated fragments, not one
  word, and shipped that way because nothing re-rendered it after the edit.
  Give such text plain inline flow instead.
