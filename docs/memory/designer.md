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
