# ADR 0003: `happy-dom` as a dev dependency for DOM-rendering tests

Date: 2026-09-17
Status: accepted

## Context

Issue #5's acceptance criteria require tests that render the swipe card and
the dogfooding view and simulate real interaction with them (a click on an
option panel standing in for a swipe, per the design doc). The scaffold from
#4 runs Vitest with its default `node` test environment, which has no `document`
or `window` — there is nothing in the dependency tree today that can render
HTML and dispatch DOM events for a test to assert against.

## Decision

Add `happy-dom` as a devDependency and a `vitest.config.ts` that sets
`test.environment` to `'happy-dom'`. Component tests build the same DOM
structure the production script builds (via the shared rendering functions
in `src/lib/poll-dom.ts`), then interact with it through standard DOM APIs
(`.click()`, `dispatchEvent`).

## Consequences

Tests can render the actual card/view markup and simulate votes as real
click/keyboard events rather than calling internal functions directly,
which is what acceptance criteria 1 and 3 ask for. It is the project's
second `node_modules` dependency category (after Astro itself) and its
first test-only one; `happy-dom` has no runtime dependencies of its own and
only loads in the test environment, never in the built site. It does not
touch what Vercel builds or serves — `astro build` does not run Vitest.

## Alternatives rejected

- **`jsdom`.** Rejected, not wrong: `jsdom` is the more standards-complete
  DOM implementation, but it is materially heavier (more transitive
  dependencies) for a demo that only needs click/keyboard dispatch and
  attribute/text assertions, which `happy-dom` covers. Either would satisfy
  the acceptance criteria; `happy-dom` is Vitest's own documented default
  recommendation for this reason.
- **Astro's experimental Container API to render `.astro` files directly in
  tests.** Rejected: it is still experimental in the Astro version this
  project pins, and it renders server output only, not client-side
  interactivity (clicks, event listeners) — the acceptance criteria need
  the latter, so it would not remove the need for a DOM environment anyway.
