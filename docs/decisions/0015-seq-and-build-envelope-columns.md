# ADR 0015: `seq` and `build` are defaulted envelope columns

Date: 2026-09-29
Status: accepted

## Context

Loss is silent at every layer (`docs/research/266-fresh-analytics-assessment.md`,
finding 6): the client validator, the store's RLS check, the per-IP rate limit
(which rolls back its own log), the clock bound and a paused project all drop
a row and leave nothing. Today loss can be seen only as a whole-shape cliff
(G4). Separately, "before versus after" a launch is split by the clock, but a
tab left open across a deploy keeps running the old code.

The owner approved a per-tab counter and a deploy id as privacy calls (D6, D7
on #265). `event_is_valid` matches each event's `props` by exact key set
(ADR 0005 §2), so a new prop would refuse every shape an already-open tab
sends. ADR 0013 settled this for `is_internal`: a flag that rides on every
event belongs in a defaulted column.

## Decision

Two new columns on `public.events`, in the same additive migration as ADR
0014's shapes.

- **`seq integer not null default 0`**, `check (seq between 0 and 100000)`.
  The tab session's nth call to `track()`. Real values start at 1; `0` means
  "sent by a client with no counter". The client increments it in `track()`
  before client validation, so a call the validator drops leaves a gap. It
  persists in `sessionStorage` key `parody.seq` and restarts at 1 for a new
  `session_id`.
- **`build text not null default 'unknown'`**,
  `check (build ~ '^([0-9a-f]{12}|dev|unknown)$')`. The first 12 hex characters
  of `VERCEL_GIT_COMMIT_SHA`, injected at build time, or `dev` when unset.
  `unknown` is the default an old client's insert gets; no client sends it.
- **Grants.** `grant insert (seq, build) on public.events to anon`, beside the
  existing column grant. `anon` still cannot select, update or delete.
- **`events_clean` is recreated** (still `security_invoker = true`, revoked
  from `anon` and `authenticated`), because a `select *` view does not pick up
  new columns. Its exclusion rule is unchanged.
- **Neither column is in `props`.** No event's key set changes because of them.
- **Deploy order is a hard constraint.** PostgREST refuses an insert naming an
  unknown column, so the client that sends these columns must not deploy until
  the owner has applied the migration.

## Consequences

- Loss becomes measurable from the data itself: a gap in `seq` within a
  `session_id` counts lost calls (M18, guardrail G6). It under-reads: the last
  events of a session leave no gap, and calls before the counter (a bot, no
  storage) send nothing by design.
- `(session_id, seq)` is not unique. Duplicating a tab copies
  `sessionStorage`, counter included, so two tabs can share both. M18 works on
  distinct values and can only under-count loss there, never invent it.
- "Before and after" splits on the code that produced the row. `build <>
  'unknown'` identifies the new client exactly, which is what lets M19 and M20
  avoid mixing old and new shapes (contract R4'). That only holds because
  `seq`, `build`, `restaurant_slug` and `fee_modes` ship in one client deploy.
- Old tabs still insert: `seq = 0`, `build = 'unknown'`. Their rows are
  excluded from M18 and included everywhere else.
- Every window is now counted on `received_at`, and events within a browser
  are ordered by `(occurred_at, seq)`.
- A later migration that replaces `event_is_valid` re-runs the superset tests
  (ADR 0013). A later migration that recreates `events_clean` must first drop
  the derived views that depend on it (ADR 0016).

## Alternatives rejected

- **`seq` and `build` as props.** Every shape's exact key match would need a
  second form, and the fields would ride inside the data they describe
  (ADR 0013's reason for `is_internal`).
- **A nullable `seq` with no default.** Equally readable, but window functions
  and `not null` are simpler with a sentinel that can't collide with a real
  value. This is the reversal if the owner prefers null.
- **Count refusals in the store instead** (a `private.write_refusals` table
  fed by a skipping trigger, #266). Live, and it sees what the store refuses,
  but not what never reaches it, and it changes how refusals behave, which
  needs its own spike (#266 marks it inferred, not tested). Not this pass.
- **A version number or git tag for `build`.** Nothing in this repository
  maintains one; the commit is already there at build time.
- **A server-side sequence.** There is no server (ADR 0001), and the store
  can't number rows it never receives.

## References

ADR 0001, ADR 0005, ADR 0012, ADR 0013, ADR 0014,
`docs/measurement/264-second-pass-measurement-contract.md` §4 and §8.1, and
`docs/research/266-fresh-analytics-assessment.md` ("Data quality and silent
loss").
