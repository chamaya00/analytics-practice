# ADR 0006: `@electric-sql/pglite` as a dev dependency for testing the store migration

Date: 2026-09-25

Status: accepted

## Context

ADR 0005's anti-spam bounds — schema constraints, the validated-shape RLS
policy, and the rate limit — live in SQL
(`supabase/migrations/20260925000000_events.sql`), because the store's Data
API endpoint is public and every one of those bounds has to hold against a
request that never goes through this repository's TypeScript. ADR 0005's own
Consequences note that this logic "needs its own check" separate from the
TypeScript suite, and issue #68's acceptance criteria require that check to
show "a malformed, oversized, or too-frequent insert being refused by the
database itself, not just by client-side code."

That requires a real Postgres to run the migration against and try to break.
`.github/workflows/ci.yml` calls a generic reusable Node workflow with no
database service, and no agent role may edit workflow files to add one
(`.claude/skills/house-rules/`) — so whatever runs this check has to run
inside `npm run test`, on a machine that may have no system Postgres
available or startable without privileges this repository cannot assume.

## Decision

Add `@electric-sql/pglite` as a devDependency and a Vitest test,
`supabase/migrations/events.migration.test.ts`, that applies the migration
to a fresh in-process instance and asserts specific inserts are refused:
an unlisted `event_name`, an oversized `props`, a non-null `variant`, an
`order_placed` with a `handling_instructions` or `promo_code` value outside
the enum, and a 61st write in five minutes from one IP. `pglite` is a WASM
build of the real Postgres server (not a JavaScript reimplementation of SQL
semantics) linked into the Node process — no server to start, no port to
bind, no service to add to CI, and the same binary constraints
(`CHECK`, RLS, a `SECURITY DEFINER` trigger) run exactly as they would
against Supabase's own Postgres.

## Consequences

**Easy:** the migration's bounds are proved against a real Postgres engine
in the same `npm run test` CI already runs, with no infrastructure change;
writing this test caught two real bugs in the first draft of the migration
— a GUC name PostgREST cannot actually set (`request.header.x-forwarded-for`
has hyphens, invalid in a configuration parameter name; PostgREST exposes
headers as one JSON-valued `request.headers` GUC instead) and a missing
`security definer` on the rate-limit trigger (`anon` has no grant on the
`private` schema the trigger writes to) — exactly the kind of mistake a
check that only reads the SQL as text would not catch.

**Hard:** `pglite` is the project's first devDependency in the "database
engine" category, and its Postgres version and bundled extensions can drift
from whatever Supabase runs in production; this test proves the migration's
logic, not that it is the migration Supabase will accept verbatim — running
it against the real project once created (out of scope for #68, a person's
step per ADR 0005) is still the final check.

## Alternatives rejected

- **A live Postgres started via `pg_ctlcluster`/`initdb` in CI.** Requires
  either a `services:` block in the workflow (off limits to every agent
  role) or shell commands with privileges this repository cannot assume the
  runner grants; also unverifiable locally in this environment, where those
  commands are refused outright.
- **`pg-mem`, an in-memory JS reimplementation of a Postgres subset.**
  Rejected on the criterion's own wording: it is "client-side code"
  emulating SQL, not the database itself, and its RLS and trigger support
  does not cover what this migration needs to prove.
- **Testing only the shape logic in TypeScript, skipping a SQL-level
  check.** This is the exact gap ADR 0005 and issue #68 both call out —
  `isValidEventProps` in `src/lib/tracking.ts` already mirrors the contract
  client-side, but a request that skips this repository's code entirely
  would sail past it.
