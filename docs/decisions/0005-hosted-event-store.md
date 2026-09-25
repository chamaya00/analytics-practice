# ADR 0005: Supabase as the event store, written directly from the browser

Date: 2026-09-25
Status: proposed

## Context

Objective #63 replaces the swipe poll with a food-delivery parody whose
events must reach a store the owner can query with SQL, at roughly zero cost,
with no personal data collected, and with the site still working when the
store is unreachable. Today every event stays in the visitor's
`localStorage` (ADR 0002), so no aggregate exists and there is nothing for a
learner to practise on.

ADR 0001 fixes the site as Astro with `output: 'static'` and no server
adapter, and describes all state as living "entirely in `localStorage`" with
"no backend and no database". An event store changes the second half of
that; whether it also changes the first depends on the write path.

`docs/research/64-hosted-event-store.md` compares keeping `localStorage`,
Supabase with a direct browser insert, a Vercel function in front of Postgres
(Supabase or Neon), PostHog, and Tinybird, and answers the instrumentation
skill's storage questions for the choice.

## Decision

Events are stored in **one append-only Postgres table, `events`, in a
Supabase project on the free plan**, and the browser **inserts into it
directly** over Supabase's Data API with the **publishable key**
(`sb_publishable_…`), one event per request, sent with
`Prefer: return=minimal`. There is **no Vercel function** and no server
adapter: ADR 0001's static-output, no-adapter decision stands, and its
"no backend, no database" wording is amended by this ADR - the site now
sends events to a hosted database it does not run. Only the publishable key
may appear in client code or the build; the secret key never enters this
repository. When the key or URL is absent, the sender does nothing.

The endpoint is public, so these bounds are part of the decision:

1. **Schema constraints.** `id uuid primary key` (client-generated, so a
   retried event is refused rather than counted twice); `visitor_id` and
   `session_id` `uuid not null`; `event_name` with a `CHECK` against the
   contract's event list; `occurred_at` checked to lie between one day before
   and five minutes after `received_at`; `received_at default now()` and not
   insertable by `anon`; `props jsonb` checked to be an object of at most
   1 KB; `variant` checked against the arm names if an experiment ships.
   `anon` gets a column-level `insert` grant and **no** `select`, `update` or
   `delete` grant or policy, so rows are unreadable and unchangeable from the
   outside.
2. **A validated event shape, enforced by policy.** The RLS insert policy for
   `anon` is `with check (public.event_is_valid(event_name, props))`, which
   requires each event's contract properties with the right types and refuses
   any others.
3. **A request size limit.** A `pgrst.db_pre_request` function rejects any
   request whose `content-length` exceeds 4 KB; the `props` check caps each
   row regardless.
4. **A rate limit.** The same pre-request function allows 60 writes per IP per
   5 minutes, keyed on a salted hash of the IP in a non-exposed schema,
   purged after one hour. No IP reaches `events`.
5. **Bot exclusion.** Events are sent only by page JavaScript; the sender
   sends nothing when `navigator.webdriver` is true or the user agent matches
   a bot pattern (the user agent is not stored); and an `events_clean` view
   excludes visitors with humanly impossible sequences or rates, leaving the
   raw table whole.

The event names, per-event properties, and which timestamp each metric
windows on are the analyst's contract (#66), not this ADR's.

## Consequences

**Easy:** the owner and, later, learners query raw rows with ordinary Postgres
SQL; the store itself refuses malformed, oversized, duplicate and
out-of-window events; the build, CI and preview deploys are unchanged and
need no secret; moving to a function later keeps the same table.

**Hard:** the free project has no backups, so the dataset is only as durable
as the project and the owner should export it periodically; it pauses after
a week with no requests, after which inserts fail until it is resumed (the
site must already tolerate an unreachable store, #63). The bounds are
per-row and per-IP: a patient script sending valid-shaped events from many
addresses will get rows in. The anti-spam logic lives in SQL (a migration),
not in the TypeScript the test suite covers, so it needs its own check - the
migration should be committed and reviewed as code.

**Needs a person:** someone must create the Supabase project, run the
migration, and set the project URL and publishable key as Vercel environment
variables. No agent can.

**Flips if:** junk that passes every bound shows up in volume (add a
challenge - a function with Turnstile or BotID, or Supabase anonymous sign-in
with CAPTCHA - superseding the write path here, not the store); or the free
plan starts losing paused data or the 500 MB cap is reached (Neon behind a
function).

## Alternatives rejected

- **Keep events in `localStorage`.** Events never leave the device, so there
  is no aggregate - it fails the objective's first requirement.
- **A Vercel function in front of Postgres (Supabase or Neon).** Changes ADR
  0001's static, no-adapter build and adds a runtime to CI, while its endpoint
  is as public as Supabase's; everything it would validate, Postgres
  constraints and RLS already enforce. Kept as the escalation path if a bot
  challenge becomes necessary.
- **PostHog.** SQL is HogQL over a vendor schema rather than raw rows in an
  owner-designed table, and its public capture key accepts any event shape,
  so the store cannot refuse a malformed event.
- **Tinybird.** Its free plan's 1,000 requests/day may cover browser
  ingestion (its limits page does not say), which would cap the site at a few
  hundred visitors a day; it also brings a second SQL dialect.
- **Firebase / Firestore, Google Analytics 4, Cloudflare D1 behind a Worker.**
  No SQL; no raw rows without an export and more data collected than #63
  allows; and a second hosting platform for the function path, respectively.
