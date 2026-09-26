# Lessons for the engineer in this repository

<!--
One line per lesson, specific to this repository, stated as a rule with the
reason attached. Hard cap of 40 non-blank lines, enforced by the guard.

Past the cap, rewrite rather than append: merge two lessons that say the same
thing, drop the one that has stopped being relevant, tighten what survives.

Delete any lesson that has graduated into a test, a lint rule, or a type.
-->

Give a new component class its CSS in `BaseLayout.astro`'s `<style is:global>` block, not in the page's own `.astro` file, when the markup is created by a DOM module (`*-dom.ts`) rather than written in the template. Astro only attaches its scoped `data-astro-cid-*` attribute to elements present in the template at compile time, so a class a script creates at runtime never matches a scoped selector and silently gets no styling at all — it renders with browser defaults, unit tests pass (they check for the class/testid, not computed style), and only a real render shows the gap. #82's round 1 review caught this: several home-feed/restaurant-page classes had never had a CSS rule anywhere, so cards and rows fell back to unstyled defaults despite every acceptance test being green.

When a DOM module sets an `<img>`'s `width`/`height` as HTML attributes (to reserve layout space and avoid shift), also give that class `width: 100%; height: auto` in CSS — the attributes alone fix the image at that intrinsic pixel size regardless of its container, which overflows a narrow viewport the moment the container is smaller than the attribute value. Unit tests don't lay out CSS so they stay green; #82's round 2 review caught it as a sideways-scrolling page only a real render showed.
