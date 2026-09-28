# ADR 0013: `session_started`, the `is_internal` column, and `events_clean` excluding the owner by visitor

Date: 2026-09-28
Status: accepted

## Context

`docs/measurement/219-analytics-readiness-contract.md` (#219) decided two
things the store can't hold yet:

- **Acquisition (§6, O10 on #221).** One new event, `session_started`, fired
  once per session. It has four props: `referrer_host`, `utm_source`,
  `utm_medium` and `utm_campaign`. Each is a sentinel (`(none)`, `(self)`,
  `(invalid)`) or a value bounded by a pattern. It never holds a URL, a
  query string, or any other parameter.
- **Owner traffic (§5, O12).** Visiting with `?internal=1` marks a browser
  as the owner's, and every row that browser sends says so. The metrics
  views then leave that browser out.

`event_is_valid` matches each event's `props` key set exactly (ADR 0005 §2),
so a flag carried as a prop would make every shape the deployed client
sends fail to match. `events_clean` has been a pass-through view since #68,
"the seam where exclusion rules land later". ADR 0012 kept every shape the
store accepted and said that `session_started`, the column and the view
belong to this migration.

## Decision

One additive migration,
`supabase/migrations/20261002000000_session_started_and_is_internal.sql`
(#225). No applied migration is edited and no stored row changes.

- **`session_started`.** It is added to the `event_name` CHECK, which is
  dropped and re-added `not valid` as in #85 and #224. Its keys are matched
  exactly:
  - `referrer_host` is `(none)`, `(self)`, `(invalid)`, or a 1-253
    character lowercase host;
  - each `utm_*` is `(none)`, `(invalid)`, or 1-50 characters matching
    `^[a-z0-9][a-z0-9._-]{0,49}$`.

  Neither pattern can contain `/`, `?`, `@`, `:`, `=` or `&`.
- **Strict superset, by construction.** #224's `event_is_valid` is renamed,
  unchanged, to `event_is_valid_224`. A new `event_is_valid` decides
  `session_started` itself and passes every other event name to it. The
  insert policy is bound to the function rather than its name, so it is
  dropped and recreated against the new `event_is_valid`, with the same
  name, role and expression. `event_is_valid_224` keeps its execute grant
  on purpose: the policy check runs as `anon`.
- **`is_internal boolean not null default false`** on `public.events`, with
  `grant insert (is_internal) ... to anon` alongside the existing column
  grant. The default lets a tab still running the old client insert without
  it. It is true/false only. It is never an identifier, a user id, or linked
  to sign-in.
- **`events_clean` excludes by visitor.** It is recreated, still
  `security_invoker = true` and still revoked from `anon` and
  `authenticated`. It now holds every `events` row whose `visitor_id` has
  **no** row with `is_internal = true`. That removes a marked browser's
  earlier, unflagged rows too, because its `visitor_id` doesn't change when
  it is marked. This is the first real exclusion rule in the view.

The client (`src/lib/acquisition.ts`, `src/lib/tracking-transport.ts`) does
the following:

- It reads `utm_source`, `utm_medium`, `utm_campaign` and `internal` by name
  with `URLSearchParams.get()`, and never iterates the query string.
- It keeps only the referrer's host.
- It sets `is_internal` on every row from `localStorage` `parody.internal`,
  read at send time.

The owner's setup checklist in ADR 0005 names this file fifth, with a
read-only confirming query.

## Consequences

- **Excluding the owner is by visitor.** A browser the owner never marked
  (another device, a private window, cleared storage) still counts. The
  owner marks each browser once, and again after clearing storage (§5).
- **The confirming query changes.** A query reading
  `pg_get_functiondef('public.event_is_valid(...)')` now sees only the
  wrapper. #224's shapes are in `event_is_valid_224`, and ADR 0005's
  checklist says so.
- **Two tests prove the superset.**
  `session-started-superset-two-city.migration.test.ts` and
  `session-started-superset-224.migration.test.ts` re-run #81's and #224's
  contract tests unmodified against the new stack.
  - One #224 test asserted that `session_started` is refused "not yet in the
    store". That assertion is the one this decision reverses. It runs with
    Vitest's `fails` flag, matched by its exact title, so it goes red if
    `session_started` is ever refused again.
  - Its other assertion, that `city: 'nyc'` is refused, is proved again in
    `session-started-internal.migration.test.ts`.
- **A later migration that replaces `event_is_valid` has two choices.** It
  wraps this function the same way, or it re-inlines both bodies. Either
  way it re-runs these tests to prove the superset.

## Alternatives rejected

- **Copy #224's whole body into a new `create or replace`**, as #224 did.
  That is 250 lines re-typed, with a transcription error caught only by the
  superset tests. The wrapper leaves the old code byte-for-byte as it was.
- **`is_internal` as a prop.** Every event's exact key match would need a
  second shape, and the flag would ride inside the data it describes.
- **Exclude only the flagged rows.** The owner's rows from before the
  marking would stay in every metric.
- **Revoke execute on `event_is_valid_224` from `public`/`anon`.** The RLS
  check runs as the inserting role. Every insert would fail (#225 attempt
  1's warning).

## References

- ADR 0005 (the store, its policy and owner checklist).
- ADR 0007 (two-city contract; no cross-field checks).
- ADR 0012 (#224's shapes and the strict-superset posture).
- `docs/measurement/219-analytics-readiness-contract.md` §5, §6, §13
  item 7 and §14.
