# ADR 0001: Adopt Astro, static output, for the swipe-poll demo site

Date: 2026-09-17
Status: proposed

## Context

This repository has no framework yet (`CLAUDE.md`). The first product work
(#1) is a client-only, Vercel-hosted teaching site: a swipe-left/right voting
card, an event log, a dogfooding dashboard, and a per-visitor A/B variant
assignment, all persisted only in the visitor's own browser, with no backend
and no database. `docs/research/2-framework-choice.md` was written to answer
which framework, if any, this repository should take on to build that — the
first dependency this repository would ever add.

That research considered three options: plain static HTML/CSS/JS with no
build step, Astro with static output, and a Vite+React SPA. It recommends
Astro. This ADR records that decision. It does not itself complete the
scaffold: see the "Implementation status" note below and the pull request
this ADR ships in for why.

## Decision

Adopt **Astro, with static output (`output: 'static'`, no server adapter)**,
deployed to Vercel via Vercel's zero-configuration static detection for
Astro. Pages are `.astro` files with a shared layout; the four interactive
pieces (swipe card, event log, dogfooding dashboard, variant assignment) are
islands hydrated with plain TypeScript, with no UI framework (React, Svelte,
etc.) added on top unless a later issue needs one. Per-visitor state
(variant assignment, event log) lives entirely in `localStorage`, per
`docs/research/2-framework-choice.md`'s "Per-visitor A/B assignment, with no
backend" section — nothing here needs a server or a database.

Toolchain: `astro check` for typecheck, ESLint for lint, Vitest for test,
`astro build` for build — the framework's own real equivalents of the four
commands `CLAUDE.md`'s Commands section names, per this issue's acceptance
criterion 1.

## Consequences

**What this makes easy:** a shared layout and navigation for a multi-chapter
teaching site without hand-copying `<head>`/nav/footer markup on every page;
component reuse for the four stateful interactive pieces; content authored
as Markdown/MDX later without a second migration. Islands mean a
beginner reading the page's HTML output sees plain markup, and a
senior-track reader can go look at how a specific island hydrates.

**What this makes hard / rules out later:** nothing structural — Astro can
add a server adapter and API routes later (`@astrojs/vercel`, `output:
'server'`) without a rewrite if the project ever does want a backend, and
islands can be plain TypeScript or a UI framework mixed in only where
needed.

**What this costs:** a `package.json`, a `node_modules`, and a build step
where none existed before — this repository's first dependency, its first
`npm install`, and its first thing that can go out of date or carry a
supply-chain issue. Islands/hydration is one more concept for a
from-scratch beginner reader, though understanding it is only needed to
touch the interactive components, not to read a page.

**Publishing gap (`CLAUDE.md`):** Vercel auto-detects Astro and runs
`npm run build` (`astro build`) with no adapter and no `vercel.json` for a
plain static site — there is no server output target and no
Vercel-specific environment variable this build depends on. So the local
build command and the command Vercel runs are the same program, not an
approximation of it: once `ci.yml` is replaced, its build step should
literally be `npm ci && npm run build`, and there is no divergence left to
document or cover.

**Implementation status:** the scaffold this ADR describes has **not** been
generated in this pull request. Every command that would install or run it
(`npm`, `npx`) was refused by this environment's Bash tool with "This
command requires approval," with no interactive approver available to grant
it in this headless run — see the pull request body for the exact commands
tried and what to do about it. This ADR records the decision so the next
attempt does not have to re-research it; it does not claim the four commands
in the Decision section have been run.

## Alternatives rejected

- **Plain static HTML/CSS/JS, no build step.** Rejected because the site's
  own deliverables (a card, a log, a dashboard, a variant system) are four
  stateful, reusable pieces of UI — exactly the shape components exist for —
  and an introduction-to-senior curriculum implies enough pages that
  hand-copied layout becomes its own maintenance burden. It would have
  avoided this repository's first dependency, but only by pushing the
  duplication cost onto every page added after this one.
- **Vite + React (SPA).** Rejected because it ships a client router and a
  full SPA runtime for a site that is mostly static reading material with a
  few interactive widgets — the opposite of what Astro's islands model
  optimizes for — while costing the same first-dependency step as Astro
  without buying anything Astro does not already offer for this site's
  shape.
