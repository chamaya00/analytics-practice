# Research: a hosted event store for real visitor analytics

Issue: #64 (child of objective #63). ADR: `docs/decisions/0005-hosted-event-store.md`.

**Decision this serves:** which hosted store the food-delivery parody writes its
events to, and whether the browser writes to it directly or through a Vercel
function - so that the analyst (#66) can write the contract against a real
table and the engineer (#68) can wire the transport.

**Recommendation, in one line:** Supabase (Postgres), written to directly from
the browser with the publishable key, into one insert-only table whose shape is
enforced by column types, `CHECK` constraints, an RLS `WITH CHECK` policy and a
pre-request function. No Vercel function. ADR 0001's static-output,
no-server-adapter stance stands; its "no database" clause does not.

## What in the issue is fixed, and what is a guess

- **Constraints (checked).** Static Astro output with no server adapter is
  recorded in ADR 0001 and `astro.config.mjs`. Objective #63 requires: raw rows
  the owner can query with SQL, roughly zero cost, no personal data collected
  (#63 done-item 4), and a site that still works when the store is unreachable
  (#63 done-item 5). Those are the constraints the comparison is scored on.
- **Guesses.** "Supabase is the default to beat" comes from
  `docs/design/3-swipe-poll.md` line 27, which mapped votes to "a couple of
  Supabase tables" - a sentence written for a different product, never built.
  It is a starting point, not evidence. The framing "direct write vs. Vercel
  function" is also a guess at the option space: it leaves out that the
  analytics product itself (PostHog) could be the store, and that an
  ingestion-first store (Tinybird) exists. Both are carried below.
- **Out of reach of reading.** Actual spam volume on a public insert endpoint
  for this site cannot be known until it is live. The bounds below are sized
  from the funnel, not from measurement; see "What would flip this".

## The first question: do events leave the device at all?

Today they do not. `poll.events` lives in `localStorage` (ADR 0002), so every
number on the results page is one browser's own history. "Keep what is here"
is therefore an option that fails the objective outright - there is no dataset
to practise on - and it is listed in the comparison only so the reader sees it
was considered. Every other option below answers "yes".

## Options compared

Legend: **V** verified in the linked primary source this run; **I** inferred
(the basis is named); **A** assumed.

### 1. Supabase, browser writes directly (recommended)

- **What it does.** Hosted Postgres with an auto-generated REST API
  (PostgREST). The browser POSTs a row with the publishable key. The key maps
  to the `anon` Postgres role, and "only reaches what Row Level Security
  allows" (V, [API keys](https://supabase.com/docs/guides/api/api-keys)). The
  key is described as "Safe to expose online: web page ... source code" (V,
  same page). Legacy `anon`/`service_role` keys are being deprecated "by the
  end of 2026" in favour of `sb_publishable_…`/`sb_secret_…` (V, same page) -
  so #68 should use the publishable format from the start.
- **Cost.** Free plan: 500 MB database, 5 GB egress, "Unlimited API requests",
  2 active projects, no backups, 1-day log retention (V,
  [pricing](https://supabase.com/pricing)). At roughly 300-500 bytes per row
  including index overhead, 500 MB is on the order of 1-1.5 million events
  (I, from Postgres row + UUID + small `jsonb` sizes; not measured).
- **SQL access.** Full Postgres SQL, from the dashboard SQL editor or any
  Postgres client with a connection string. A read-only role can be created
  for learners later (I, standard Postgres; not needed now).
- **What it rules out later.** Nothing structural: moving to a function later
  keeps the same table. The free tier's lack of backups means the dataset is
  only as durable as the project (see Consequences in the ADR).
- **Right pick if** the bounds in the anti-spam section hold at this site's
  traffic, and the project keeps getting at least some traffic each week.
- **The pause.** Free projects "are paused after 1 week of inactivity" (V,
  [pricing](https://supabase.com/pricing)); inactivity is judged on database
  activity including API requests (V,
  [Project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)).
  Every visitor event is such a request, so a site with any weekly traffic
  stays awake (I). If traffic stops, the project pauses and inserts fail -
  which #63 done-item 5 already requires the site to survive.

### 2. A Vercel function in front of a Postgres store (Supabase or Neon)

- **What it does.** The browser POSTs to `/api/events` on the same origin; a
  Vercel function validates and inserts with a server-side secret. Neon is the
  natural Postgres behind it: free plan 0.5 GB per project, 100 CU-hours a
  month, scale-to-zero after 5 minutes that "cannot be turned off", and caps
  that suspend compute rather than delete data (V,
  [Neon pricing](https://neon.com/pricing)) - no week-long pause.
- **Cost.** Vercel Hobby includes the first 1,000,000 function invocations and
  4 hours of Active CPU a month (V,
  [fair use](https://vercel.com/docs/limits/fair-use-guidelines)). Hobby "is
  restricted to non-commercial personal use only" (V, same page); a parody
  with no payments and no ads fits, but that is a constraint the site must
  keep honouring (I).
- **SQL access.** Same as option 1 - it is Postgres.
- **What it rules out later.** Nothing, but it **changes ADR 0001**: a
  function is server code, and in Astro it means either a server adapter
  (`@astrojs/vercel`, which ADR 0001 names as the escape hatch) or a
  framework-independent `api/` directory beside a static build (I; Vercel
  documents `api/` functions for projects without a framework adapter, not
  verified for Astro specifically this run). Either way CI gains a runtime
  the four current checks do not exercise.
- **What it buys that option 1 does not.** A secret key never reaches the
  browser; server-side validation can be written in TypeScript and unit
  tested; the function sees the caller's IP directly and could sit behind
  Vercel's bot tooling. **What it does not buy:** the endpoint is exactly as
  public as a Supabase URL - anyone can `curl` `/api/events` - so the spam
  surface is the same shape, one hop later.
- **Right pick if** the Postgres-side bounds below prove insufficient and a
  challenge (Turnstile, Vercel BotID) has to run server-side, or if Supabase's
  free tier stops being free enough.

### 3. PostHog as the store (the candidate nobody asked for)

- **What it does.** A hosted product-analytics tool whose browser key is
  designed to be public. Events land in a ClickHouse-backed `events` table
  queryable with `SELECT * FROM events` in its SQL editor (V,
  [PostHog SQL](https://posthog.com/docs/data-warehouse/sql)).
- **Cost.** 1M analytics events a month free (V,
  [pricing](https://posthog.com/pricing)); free-tier data retention is one
  year, per secondary sources (not confirmed on a PostHog page this run -
  [userpilot summary](https://userpilot.com/blog/posthog-features/)).
- **Why it loses.** (a) SQL is HogQL, PostHog's dialect over its own schema,
  with event properties in a JSON blob - not raw rows in a table the owner
  designed, and not the dialect a learner will meet elsewhere (I). (b) Its
  ingestion accepts any event name and any properties from the public key; the
  owner cannot make the store refuse a malformed event, which is the heart of
  criterion 3 (I, from how a public capture key works; I found no PostHog
  feature for server-enforced event schemas). (c) One-year retention caps the
  longest comparison the practice exercises can run. (d) The JS SDK's
  autocapture, cookies and session replay default toward collecting more than
  #63 done-item 4 allows, so every default would have to be turned off (I).
  It wins on dashboards, which #63 puts out of scope.

### 4. Tinybird (ClickHouse with an ingestion API)

- **What it does.** An Events API that takes NDJSON appends, callable from a
  browser with an append-scoped token, into typed ClickHouse data sources.
- **Cost.** Free: 10 GB storage, "1k requests per day" (V,
  [pricing](https://www.tinybird.co/pricing)); Events API throttled at 100
  requests/second with HTTP 429 beyond (V,
  [limits](https://www.tinybird.co/docs/forward/pricing/limits)).
- **Why it loses.** Whether browser ingestion counts against the 1,000
  requests/day is **not stated** on the limits page (searched; see below). If
  it does, one event per request caps the site at a few hundred visitors a day,
  and batching in the browser loses events when a tab closes. ClickHouse SQL is
  a second dialect, as with PostHog. The typed schema is a genuine strength
  (I, from memory of its quarantine data sources; not re-verified).

### Discarded, one line each

- **Firebase / Firestore** - no SQL; fails the goal on its first word.
- **Google Analytics 4** - raw rows need the BigQuery export, sets cookies, and
  collects more than #63 allows by default.
- **Cloudflare D1 behind a Worker** - it is option 2 on a second hosting
  platform; it adds a vendor, not a capability.

## Comparison

| | Keep localStorage | **Supabase direct** | Function + Postgres | PostHog | Tinybird |
|---|---|---|---|---|---|
| Events leave the device | no | yes | yes | yes | yes |
| Raw rows, owner-designed table | - | yes | yes | no (vendor schema) | yes |
| SQL dialect | - | Postgres | Postgres | HogQL | ClickHouse |
| Store can refuse a malformed event | - | yes (CHECK + RLS) | yes (code + CHECK) | no | partly |
| Record immutable after write | - | yes (no UPDATE/DELETE policy) | yes | yes | yes |
| Free-tier ceiling | - | 500 MB; pauses after 7 idle days | 0.5 GB Neon; 1M invocations | 1M events/mo; ~1 yr | 10 GB; 1k req/day (scope unclear) |
| Changes ADR 0001 static/no-adapter | no | **no** | **yes** | no | no |

## The write path: settled as direct

**Direct browser insert, with the publishable key, into an insert-only
table.** The function earns its place only through things it can do that
Postgres cannot at this site's scale. Checked one by one:

- *Hiding the key* - buys nothing, because the key is designed to be public and
  RLS is the boundary (V, API keys page); the function's own URL is equally
  public.
- *Validating the event shape* - Postgres does it with types, `CHECK`
  constraints and an RLS `WITH CHECK` expression, and does it in the one place
  a bypass cannot skip.
- *Rate limiting* - Supabase documents a per-IP limit in a pre-request
  function, rejecting IPs that exceed 100 writes in 5 minutes (V,
  [Securing your API](https://supabase.com/docs/guides/api/securing-your-api)).
  It applies only to `POST`/`PUT`/`PATCH`/`DELETE` - which is all an
  insert-only table receives.
- *A bot challenge* - this is the one thing the function does better. It is
  not needed until junk shows up; see "What would flip this".

**Effect on ADR 0001.** Its static-output, no-server-adapter decision is
**unchanged**: `astro.config.mjs` keeps `output: 'static'`, no adapter, and
Vercel keeps serving static files. Its Context and Decision also say state
lives "entirely in `localStorage`" with "no backend and no database"; that
part **is changed** - the site now sends events to a hosted database it does
not run. ADR 0005 records that and amends ADR 0001 on that point only.

## Anti-spam bounds for a public insert endpoint

Each bound names where it is enforced. The analyst (#66) supplies the event
names and per-event properties; the engineer (#68) writes the migration. The
numbers are starting values sized from the funnel (landing → restaurant →
items → cart → checkout → order placed → tracker is ~7 steps, plus tracker
refreshes), not measured (A).

1. **Schema constraints (table `events`).**
   - `id uuid primary key` - generated in the browser per event; a retry of
     the same event hits the primary key and is refused (HTTP 409), which the
     sender treats as success. This is the idempotency key the instrumentation
     skill asks for.
   - `visitor_id uuid not null`, `session_id uuid not null`.
   - `event_name text not null` with a `CHECK (event_name in (...))` listing
     exactly the contract's events.
   - `occurred_at timestamptz not null` with
     `CHECK (occurred_at between received_at - interval '1 day' and received_at + interval '5 minutes')`.
   - `received_at timestamptz not null default now()`, **not** in the `anon`
     column grant, so the client cannot set it. Both timestamps are kept, so
     "when it happened" and "when it arrived" stay separable.
   - `props jsonb not null default '{}'` with
     `CHECK (jsonb_typeof(props) = 'object' and octet_length(props::text) <= 1024)`.
   - `variant text null` with a `CHECK` on the allowed arm names if an
     experiment ships.
   - Column-level `grant insert (id, visitor_id, session_id, event_name, occurred_at, props, variant) on events to anon;`
     and **no** `select`, `update` or `delete` grant or policy for `anon`. The
     table is write-only and append-only from the outside, so a row cannot
     change after it is written, and the public cannot read the dataset. The
     insert must be sent with `Prefer: return=minimal`, since returning the
     row would need a `SELECT` policy (I, from
     [RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
     on `RETURNING` needing select).
2. **A validated event shape, enforced by policy.** An RLS insert policy
   `for insert to anon with check (public.event_is_valid(event_name, props))`,
   where the function checks, per event name, that the required property keys
   are present with the right `jsonb` types and that no other keys are. The
   store refuses anything the contract does not describe, rather than keeping
   it and hoping a query filters it out.
3. **A request size limit.** I found no documented request-body limit for the
   Supabase Data API (see searches). So the size bound is two layers:
   (a) the pre-request function rejects any request whose `content-length`
   header exceeds **4 KB** (request headers are readable there via
   `current_setting('request.headers')`, V, Securing your API; that
   `content-length` is present in them is I), and (b) the `props` `CHECK`
   above caps each row at 1 KB of properties whatever the transport did. The
   client sends one event per request; bulk arrays are not part of the
   contract.
4. **A rate limit.** The documented pre-request per-IP pattern, at **60 writes
   per IP per 5 minutes** (a full funnel with tracker refreshes is well under
   that; A). Because the rate-limit table would hold IP addresses, it stores a
   salted hash of the IP, lives in a non-exposed schema, and is purged of rows
   older than one hour - so no IP enters the dataset (#63 done-item 4).
5. **Excluding bot traffic.** Three layers, cheapest first:
   - *By construction:* events are only sent by the page's JavaScript, so
     crawlers that do not execute JS never write.
   - *At the sender:* the client sends nothing when `navigator.webdriver` is
     true (the standard automation flag; I, it is set by WebDriver-driven
     browsers) or when the user agent matches a short bot pattern
     (`bot|crawler|spider|headless|preview`). The user agent itself is not
     stored.
   - *At query time:* the raw table is kept whole, and an `events_clean` view
     excludes visitors whose rows are impossible for a human - more than N
     events in a second, or `order_placed` without a prior `checkout_started`.
     Exclusion at read time is reversible; deletion is not.
   A pre-request `Origin` check against the site's domains is also cheap and
   stops naive cross-site posting, but any `curl` sets its own `Origin`, so it
   is a filter, not a bound.

**What these do not stop:** a determined person scripting valid-shaped events
from many IPs, slowly. Nothing short of a challenge (Turnstile, BotID,
Supabase anonymous sign-in with CAPTCHA) stops that, and each of those costs
friction or a function. That is the strongest argument against the
recommendation and the main flip condition.

## Instrumentation-skill questions, answered for the recommendation

- **Do events leave the device?** Yes, one POST per event.
- **Can it answer the metric queries?** Yes - Postgres with `group by`,
  windows and `jsonb` operators; no second system.
- **Can a record change after it is written?** Not from outside: no `update`
  or `delete` grant for `anon`. The owner can, with the secret key; that is
  an owner's discipline, not a guarantee.
- **Key that makes a repeat harmless?** Client-generated `id uuid` primary
  key; duplicates are refused.
- **Late or out-of-order events?** Both `occurred_at` (client) and
  `received_at` (server) are stored; the contract says which a metric windows
  on. The `CHECK` refuses events more than a day stale.
- **Old records when a property is added?** Properties live in `props jsonb`,
  where an absent key (`not props ? 'k'`) and an explicit null
  (`props->'k' = 'null'::jsonb`) are distinguishable, so a new property does not turn
  old rows into false nulls.
- **Retention long enough?** Postgres keeps rows until deleted; the ceiling is
  the 500 MB cap, not a time window. The risk is loss, not expiry: the free
  plan has no backups, so the owner should take a periodic `pg_dump` (A: that
  the owner will).

## Searches, including the ones that came back empty

- Supabase free-plan limits and pausing: found (pricing, pausing docs).
- Supabase Data API **request-body size limit**: searched "PostgREST request
  body size limit Supabase maximum payload insert". Found only GitHub issues
  reporting 1 MB errors in the CLI and resets near 32 KB in one third-party
  tool; **no official Supabase limit**. Hence the pre-request and `CHECK`
  bounds above instead of relying on one.
- Supabase **built-in rate limiting for the Data API**: none beyond Auth's; a
  GitHub discussion
  ([#19493](https://github.com/orgs/supabase/discussions/19493)) asks for it,
  and the docs point to pre-request functions instead.
- **People who chose Supabase for public inserts and regretted it**: searched
  "supabase anon key insert spam bots table flooded". Every result was about
  tables left **without RLS** being read or wiped
  (e.g. [Opsily](https://opsily.com/blog/supabase-row-level-security-not-enabled)).
  I found no report of an RLS-constrained insert-only table being flooded.
  That is either a genuinely safe pattern or an under-reported one; I cannot
  tell which, and it should be read as "no evidence", not "evidence of
  safety".
- Whether Tinybird's Events API counts against the free 1k requests/day:
  **not stated** on its limits page.
- PostHog free-tier retention on a PostHog-owned page: not found this run;
  the one-year figure is from a secondary summary.

## Recommendation, the case against it, and what would flip it

**Recommendation:** Supabase, direct browser insert with the publishable key,
under the five bounds above. It is the only option that is at once raw
owner-designed rows, full Postgres SQL, a store that refuses malformed
events, zero cost, and no change to the static build.

**Strongest argument against:** the endpoint is public and the bounds are all
per-row or per-IP. A patient script spreading valid-shaped events across IPs
will get rows into the table that learners analyse, and the only thing that
stops it - a challenge - is exactly what the function path would add.
Second: the free project has no backups and pauses after a quiet week, so the
dataset's durability depends on traffic and on the owner exporting it.

**What would flip it:**
- Junk rows that pass every bound appear in volume (say, more than a few
  percent of `events_clean` after launch) → add a challenge, which means
  option 2 (a function with Turnstile or BotID) or Supabase anonymous sign-in
  with CAPTCHA; the table and its constraints carry over unchanged.
- Supabase's free plan changes so paused projects lose data, or the 500 MB cap
  is reached → Neon behind a function (option 2).
- The objective drops "owner queries raw rows with SQL" in favour of
  dashboards → PostHog becomes the better pick.
