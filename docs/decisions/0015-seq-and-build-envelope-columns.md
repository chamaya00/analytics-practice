# ADR 0015: `seq` and `build` are defaulted columns on `events`, so loss is measurable and every row names its deploy

Date: 2026-09-29
Status: accepted (the contract is decided here; the store and client children of #264 implement it)

## Context

Loss is silent at every layer, and nothing counts it
(`docs/research/266-fresh-analytics-assessment.md`, Part 1 finding 6).

- The client validator drops a malformed call without a trace.
- The store refuses unknown shapes, and the sender swallows the error.
- A rate-limited write rolls back its own log.
- A phone whose clock runs more than 5 minutes fast sends nothing that lands.

Today the only signal is G4, a cliff on deploy day. Steady partial loss
cannot be seen at all: shared mobile IPs hitting the rate limit, clock skew,
bot-filter false positives.

"Before vs after" a launch is also split by the clock today. Open tabs keep
running the previous bundle after a deploy, so a date boundary mixes both
builds.

The owner approved both fixes as privacy calls on #265:

- D6: a per-tab-session counter, `seq`;
- D7: the deploy's commit id, `build`.

They must ride on every row. `event_is_valid` matches `props` key sets
exactly (ADR 0005 §2), which is why #219 made `is_internal` a column
(ADR 0013).

## Decision

The full specification is
`docs/measurement/270-analytics-readiness-second-pass.md` §5.

- **`seq integer`, nullable, default `null`, `check (seq between 1 and 100000)`,**
  with `grant insert (seq) on public.events to anon`.
  - The client keeps it in `sessionStorage` key `parody.seq`, as
    `{"session_id", "last"}`.
  - It increments it at the top of `track()`, **before** validation. It starts
    at 1 per `session_id`.
  - The number travels with the call through the pre-init queue into the row.
  - `session_started` takes its number from the same counter.
  - If the counter cannot be read or written, the row carries `null`.
- **`build text`, nullable, default `null`,
  `check (build ~ '^[0-9a-f]{40}$' or build = '(unknown)')`,** with
  `grant insert (build) on public.events to anon`.
  - The value is `VERCEL_GIT_COMMIT_SHA` read at `astro build` time,
    lowercased, compiled into the bundle.
  - It is `(unknown)` when the variable is absent or malformed.
  - The client never sends `null`.
- **`null` means "sent by a client from before this pass",** in both columns.
  An old tab omits both columns, and its insert lands. That is R4's "absent is
  not zero", applied to the envelope.
- **`events_clean` is recreated** after the columns are added, with an
  unchanged definition, because a `select *` view does not pick up new
  columns.

## Consequences

- **Loss becomes a number.** M18 is Σ(`max(seq)` − `count(distinct seq)`) ÷
  Σ `max(seq)` per tab session. Guardrail G6 is built on it.
  - It catches every drop after the counter: the validator, the queue cap,
    the byte cap, the store, the rate limit, the clock bound and the network.
  - It cannot see a session's tail, a wholly lost session, or loss before the
    counter. So it is a lower bound, and it is labelled that way.
- **A duplicated tab copies `sessionStorage`,** so duplicate
  (`session_id`, `seq`) pairs are expected. M18 counts distinct values.
- **"Before vs after" splits on code, not time.** G1 becomes exact: its
  coverage is the share of rows with `build` not null. M20's denominator is
  bounded by it.
- **The client must not ship before the migration is applied.** PostgREST
  refuses an insert naming a column it does not know, so every row from the
  new client would be lost. The contract (§5.4) makes the owner's apply step a
  merge gate on the client child.
- **An assumption to confirm once.** Vercel exposes `VERCEL_GIT_COMMIT_SHA`
  at build time. The client child's owner check reads one live row's `build`.
- **`track()` now touches `sessionStorage`.** Before this pass, only the
  sender did. A call made while storage is blocked still proceeds, with
  `seq = null`.

## Alternatives rejected

- **Put either value in `props`.** Exact key matching would make every shape
  an open tab sends fail to match. Both values would also need a second
  shape on all 18 events.
- **`not null` columns with sentinel defaults** (`seq default 0`,
  `build default ''`). A zero or empty string would have to mean both "old
  client" and "counter failed", or "unknown build". A null says "absent", the
  way R4 already reads absence.
- **Assign `seq` in the sender, at send time.** Calls dropped by
  `track()`'s own validator never reach the sender, so client-side contract
  bugs would stay invisible. Those are the bugs #266 most wanted to see.
- **An unbounded `seq`.** One forged row with a huge `seq` would dominate
  M18. At 60 writes per IP per 5 minutes, a real tab cannot approach 100000.
- **Read the build at runtime from a version file.** It adds a request to
  every page load, and a window in which rows carry no build. A
  compile-time constant costs nothing.
- **A `schema_version` column instead of `build`.** The key set already
  identifies a shape, so a version column could only restate it, and could
  disagree with it (#266, "Event taxonomy"). `build` answers a different
  question: which code sent this row.
- **Count refusals in the store** (`private.write_refusals`, fed by a
  skipping BEFORE trigger). It is complementary, not a substitute: it sees
  the store's refusals, including the clock bound, which `seq` cannot. But it
  changes how the store refuses rows, and it has not been proved in PGlite. It
  is deferred to its own engineer issue and ADR.
- **`prior_send_failures` on `session_started`** (#267, Change 2). It is a
  new `session_started` shape and a new privacy call, for the case `seq`
  misses: a whole session lost. It is not adopted in this pass.

## References

- ADR 0005 (the store and its bounds), ADR 0013 (the defaulted-column pattern
  for `is_internal`).
- `docs/measurement/270-analytics-readiness-second-pass.md` §5, §9 (M18),
  §10 (G6) and §14.
- `docs/research/266-fresh-analytics-assessment.md` ("Data quality and
  silent loss"), `docs/research/267-data-infra-options.md` ("Silent loss,
  today"), and decisions D6 and D7 on #265.
