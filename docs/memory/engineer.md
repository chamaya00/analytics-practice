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

When prose in an `.astro` template wraps onto a new source line right before an inline element (`<code>`, `<strong>`), keep the trailing space on the same line as that element rather than after the line break — Astro's HTML compression collapses a newline between a text node and the inline element that follows it, so "kept for\n<strong>up to one hour</strong>" renders as the glued "forup to one hour". A test that only checks each phrase is present somewhere in the built text (`toContain('up to one hour')`) still passes glued, because the surrounding words it globs together aren't part of that assertion — the test has to assert the adjacent words together. #83's round 1 review found four of these on `/about` that the existing built-output test had missed.

Give a component built by a DOM module its own CSS class, never reusing a class name another `*-dom.ts` module already owns, even if the visual role looks similar — `BaseLayout.astro`'s global stylesheet has no scoping between them, so a margin/gap/padding rule written for one leaks straight into the other. #120's flash sheet reused home-dom.ts's `.restaurant-list` for its own scrolling row container and inherited that class's `margin`/`gap` unchanged, doubling its row spacing; every DOM test stayed green (they check the class/testid, not computed layout) and only `./scripts/app-render` showed the gap.

Size an inline icon shared across sites in `em`, not a fixed pixel value, and give it exactly one CSS margin as the only source of the gap to the text beside it — never a flex `gap` layered on top of a literal separator (" · ") already in that text, and never a literal leading space on top of the icon's own margin. A fixed px value renders fine next to one site's small muted text and reads as a speck next to another's large bold text; a second gap source on top of the margin reads as uneven spacing. Both pass every DOM test unchanged (they check for the element/class and `textContent`, not computed size or rendered whitespace) and only a real render shows either. #130's round 1 review caught both on the same icon: a speck beside the tracker's bold countdown, and doubled spacing on home cards and the restaurant page's flex `.restaurant-meta`.
