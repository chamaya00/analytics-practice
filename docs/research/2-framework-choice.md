# Framework and hosting choice for the swipe-poll demo

**Decision this research serves:** which framework (if any) and hosting
build path this repository adopts for its first product code — a
client-only, Vercel-hosted teaching site with a swipe-left/right voting
card, an event log, a dogfooding dashboard, and a per-visitor A/B variant
assignment, all persisted only in the visitor's own browser.

## Constraints taken as given

- No backend. No server-rendered personalization, no database, no API
  route that holds state across visitors. Every piece of per-visitor
  state (variant assignment, event log) lives in that visitor's browser.
- Hosting is Vercel (`CLAUDE.md`).
- The audience is explicitly "beginner to senior" — the code itself is
  teaching material, so how much the framework hides matters as much as
  what it does.
- `CLAUDE.md`'s "Publishing gap" note: once a framework is chosen, the
  future CI gate must run the same build Vercel runs, or an ADR must say
  how they differ and what covers the gap.

## Options considered

### Option A — Plain static HTML/CSS/JS, no build step, no framework

What it is: hand-written `.html` files, one `<script type="module">` per
page or a small set of shared modules, no bundler, no package manager,
no `node_modules`. Vercel deploys the repository's static files directly
— on Vercel's dashboard this is the "Other" framework preset, which
[has no default build command; Vercel serves the files as given](https://vercel.com/docs/frameworks) unless one is configured.

**What it costs:**
- No shared layout mechanism. Every page repeats its own `<head>`,
  navigation, and footer by hand, because there is no include/template
  step without a bundler. For a multi-chapter teaching site (beginner
  through senior content) this duplication grows with every new page.
- No component reuse for the interactive pieces (the swipe card, the
  dashboard) beyond copy-pasting `<script>` blocks or writing them as
  hand-rolled Web Components — which is itself a framework-shaped
  decision, just an unlabeled one.
- No dependency management, so no dependency *risk* either — nothing to
  patch, nothing to audit, nothing to go out of date.

**What it rules out later:** content authored as Markdown (lesson pages
written as prose, not HTML) without adding a separate static-site
generator on top later, which would then mean migrating anyway.

**What would have to be true for this to be the right pick:** the site
stays small (a handful of pages) for its whole life, or the teaching
value of "there is no framework, only the platform" outweighs the
duplication cost as it grows. Neither holds well here — an
introduction-to-senior curriculum implies enough pages that hand-copied
layout becomes its own maintenance burden, and the issue's own
deliverables (a card, a log, a dashboard, a variant system) are four
stateful, reusable pieces of UI, which is exactly the shape components
exist for.

### Option B — Astro, static output

What it is: a component-based static site generator. Pages are `.astro`
files (or Markdown/MDX) that render to plain HTML with **zero JavaScript
shipped by default**; interactivity is opted into per-component via
"islands" (a small script or a UI-framework component that hydrates only
that piece of the page). [Astro's own positioning is content-rich sites
with as little JavaScript as possible](https://vercel.com/docs/frameworks/frontend/astro).
[A static Astro site deploys to Vercel with zero configuration](https://vercel.com/docs/frameworks/frontend/astro) — no adapter, no server functions, no `vercel.json` — because
Vercel auto-detects the framework and serves the build output as static
files.

**What it costs:**
- A `package.json`, a `node_modules`, and a build step where none
  existed before — the first dependency this repository takes on
  (`CLAUDE.md`'s framing of this very decision).
- One more concept for a beginner reader: islands/hydration is not
  something a from-scratch learner meets on day one, though nothing in
  the swipe-poll demo requires understanding it to read the page —
  only to touch the interactive components.
- Content collections and islands are Astro-specific idioms; a lesson
  written against them does not transfer verbatim to another framework
  if the project ever migrates.

**What it rules out later:** very little — Astro can add a server
adapter and API routes later (`@astrojs/vercel`, `output: 'server'`) if
the project ever does want a backend, without a rewrite. It does not
lock the project into a UI framework either; islands can be plain
JS/TS, or React/Svelte/Vue components mixed in only where needed.

**What would have to be true for this to be the right pick:** the site
is expected to grow into multiple lesson pages with a shared layout and
navigation, where most of each page is static teaching content and only
a few pieces (the swipe card, the dashboard) are interactive. That is
exactly the shape described in the issue and the parent objective.

### Option C — Vite + React (SPA), considered and not detailed further

What it is: a single-page app bundled by Vite, with React owning the
whole page (including navigation) client-side.

**Why it is not carried into the recommendation:** it ships a client
router and a full SPA runtime for a site that is mostly static reading
material with a few interactive widgets — the opposite of what Astro's
islands model optimizes for. It costs the same first-dependency step as
Astro without buying anything Astro doesn't already offer for this
site's shape (component reuse, a build step, Vercel zero-config), and
it adds a client-side router as a second thing to teach and maintain
that this site does not need — swipe-poll and dashboard pages can each
be their own Astro page. It is a credible choice for a project whose
default state is "one interactive app," which this project is not; it
is a handful of teaching pages plus a few interactive widgets.

## Per-visitor A/B assignment, with no backend

This works identically regardless of which option above is chosen,
because it is plain browser JavaScript with no server involved — the
difference is only where that script lives (a hand-written `<script>`
tag under Option A, or a small shared module imported by an island
under Option B):

1. On page load, read a fixed key from `localStorage`, e.g.
   `localStorage.getItem('poll.variant')`.
2. If it is `null` (first visit from this browser), assign one
   pseudo-randomly — e.g. `Math.random() < 0.5 ? 'a' : 'b'` — and write
   it back with `localStorage.setItem('poll.variant', variant)`.
3. Every subsequent page read in that browser sees the same value, so
   the assignment is stable for that visitor without a cookie, a
   session, or a server round-trip. It resets only if the visitor
   clears site data or opens a different browser/device — which is the
   accepted boundary of "per-visitor" for a client-only, no-account
   site.
4. The event log follows the same pattern: events (a swipe, a vote)
   are appended to a JSON array under another `localStorage` key (e.g.
   `localStorage.getItem('poll.events')`, parsed, pushed to, and
   re-serialized on write), and the dogfooding dashboard reads that same
   key back to render what this browser has done. Nothing here needs a
   database because nothing here is shared across visitors — each
   browser is its own event log.

`localStorage` is synchronous and per-origin, which is exactly the
scope needed: no visitor sees another visitor's variant or events, and
no server ever needs to reconcile the two.

## The publishing gap (`CLAUDE.md`)

For the recommended option (Astro, static output):

- **Build command Vercel runs:** `astro build` (invoked as the
  project's `build` script, so `npm run build` on Vercel's Node
  builder), producing static output in `dist/`. [Vercel auto-detects Astro and requires zero configuration to deploy a static site built this way](https://vercel.com/docs/frameworks/frontend/astro) — no adapter package, no `vercel.json`, no build-command override needed for the plain static case this project needs.
- **Can the future CI gate run the identical command?** Yes. Because
  there is no adapter, no server output target, and no Vercel-specific
  environment variable this build depends on, `npm ci && npm run build`
  in `ci.yml` is the same program Vercel runs, not an approximation of
  it. The gate does not need an ADR to explain a difference, because
  there isn't one to explain — replacing the placeholder gate should
  literally shell out to `npm run build` and treat a non-zero exit as
  failure.

For Option A (no build step), the gap does not need closing at all:
there is no build, so whatever Vercel serves is byte-for-byte what is
in the repository, and CI's job is limited to a linter/test run against
the same files a visitor gets.

## Recommendation

**Astro, with static output (`output: 'static'`, no adapter), deployed
to Vercel with its zero-configuration static detection.** It gives the
teaching site shared layout and reusable components (the swipe card,
the event log, the dashboard) without shipping a client framework's
runtime for content that is mostly static, and its islands model means
a beginner reading the HTML output sees plain markup, while a
senior-track reader can go look at how a specific island hydrates. The
build command Vercel runs (`astro build`) is exactly the command a
future CI gate can run too, closing `CLAUDE.md`'s publishing gap with
no divergence to document.

**The strongest argument against it:** this repository's very first
commit of product code will also be its first `npm install`, its first
`node_modules`, and its first thing that can go out of date or have a
supply-chain issue — for a teaching site whose original scope (one
card, one log, one dashboard, one variant flag) a no-build HTML file
could render just as correctly today. Astro is the right pick for
where this project is *going* (a multi-page curriculum), not strictly
for what issue #1's demo needs on its own; choosing it now is a bet on
the site growing past a handful of pages, made before any page exists
to confirm that bet.
