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

## Owner setup checklist

One-time, ordered, each step paired with what to run to confirm it worked
before moving to the next. `supabase/migrations/` is the source of truth for
every SQL statement below — nothing here duplicates it, only sequences it.

1. **Create the Supabase project** (free plan) at
   [supabase.com](https://supabase.com/dashboard). Confirm: the dashboard's
   Project Settings → API page shows a Project URL
   (`https://<ref>.supabase.co`) and, under API keys, a publishable key
   (`sb_publishable_…`) — both are needed for step 3.
2. **Apply exactly six migrations, in this order**, in the dashboard's SQL
   Editor — paste each file's contents as its own run, and run each file
   **once**:
   1. `20260925000000_events.sql`
   2. `20260926000000_two_city_event_contract.sql`
   3. `20260930000000_rate_limit_search_path.sql` (#222)
   4. `20261001000000_analytics_readiness_event_contract.sql` (#224)
   5. `20261002000000_session_started_and_is_internal.sql` (#225)
   6. `20261003000000_second_pass_readiness.sql` (#273)

   The three wallet migrations (`20260927000000_wallet.sql`,
   `20260928000000_wallet_tip.sql`,
   `20260929000000_wallet_revoke_anon_execute.sql`) are applied only when the
   wallet is switched on, as part of ADR 0008's own owner setup.

   These files are not safe to re-run: file 1 has a bare `create table`,
   `create policy`, `create trigger` and `create view`, and a single-row
   insert into `private.rate_limit_salt`, each of which errors on a second
   run. If one fails partway, stop and ask rather than re-running it.
   Confirm each file with a read-only query, right after it:
   - After file 1: the three tables and the view exist, and the salt has its
     one row.
     ```sql
     select table_schema, table_name from information_schema.tables
     where (table_schema, table_name) in
       (('public', 'events'), ('public', 'events_clean'),
        ('private', 'write_log'), ('private', 'rate_limit_salt'))
     order by 1, 2;
     select count(*) from private.rate_limit_salt;
     ```
     The first lists all four names (`events_clean` is the view); the count
     is `1`.
   - After file 2: returns `true`.
     ```sql
     select pg_get_functiondef('public.event_is_valid(text, jsonb)'::regprocedure)
       like '%location_selected%';
     ```
   - After file 3: `proconfig` includes `extensions` in its `search_path`.
     ```sql
     select proconfig from pg_proc where proname = 'enforce_write_rate_limit';
     ```
   - After file 4: returns `true`.
     ```sql
     select pg_get_functiondef('public.event_is_valid(text, jsonb)'::regprocedure)
       like '%driver_rating_submitted%';
     ```
     Run this one before file 5. File 5 renames that function to
     `event_is_valid_224`, so afterwards the same query returns `false`, and
     `public.event_is_valid_224(text, jsonb)` returns `true` instead.
   - After file 5: the first query lists one row, `is_internal` with
     `boolean`, `NO` and `false`; the second returns `true`.
     ```sql
     select column_name, data_type, is_nullable, column_default
     from information_schema.columns
     where table_schema = 'public' and table_name = 'events'
       and column_name = 'is_internal';
     select pg_get_functiondef('public.event_is_valid(text, jsonb)'::regprocedure)
       like '%session_started%';
     ```
     Run this one before file 6. File 6 renames that function to
     `event_is_valid_225`, so afterwards the same query returns `false`, and
     `public.event_is_valid_225(text, jsonb)` returns `true` instead.
   - After file 6 (step 2.6, contract
     `docs/measurement/270-analytics-readiness-second-pass.md` §13 A4): run
     the three queries below, each on its own, in the SQL Editor. Then tell
     #264 that all three matched, because the client pull request (child B)
     must not merge before that (contract §5.4: the new client's inserts
     name columns and shapes the store would otherwise refuse, and Vercel
     deploys on merge).
     ```sql
     select column_name, data_type, is_nullable, column_default
     from information_schema.columns
     where table_schema = 'public' and table_name = 'events'
       and column_name in ('seq', 'build') order by 1;
     ```
     Expected: two rows, `build` / `text` / `YES` / `null` and
     `seq` / `integer` / `YES` / `null`.
     ```sql
     select pg_get_functiondef('public.event_is_valid(text, jsonb)'::regprocedure) like '%fee_modes%';
     ```
     Expected: `true`.
     ```sql
     select has_table_privilege('anon', 'analytics.orders', 'select'),
            (select count(*) from analytics.orders) >= 0;
     ```
     Expected: `false`, `true`.
3. **Set `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY`** in the
   Vercel project's Environment Variables (Settings → Environment Variables),
   using the two values from step 1, for the Production environment at
   least. Confirm: both names are listed there with the right values: the
   URL from step 1 verbatim, and a key starting `sb_publishable_`.
4. **Redeploy** (Vercel → Deployments → Redeploy on the latest, or push a
   commit) — environment variable changes do not apply to a deployment that
   already ran. Confirm: the new deployment's build log shows `astro build`
   completing with no error, the same as `npm run build` locally (ADR 0001 —
   no adapter, so Vercel runs the identical program).
5. **Confirm an event actually lands.** Open the live site and click through
   any screen that fires a `track()` call (landing the homepage is enough).
   Then, in the SQL Editor:
   ```sql
   select event_name, received_at from public.events order by received_at desc limit 5;
   ```
   A row appears within a few seconds of the click, with `received_at` close
   to now. If nothing appears: check the browser's Network tab for the POST
   to `/rest/v1/events` and its response — a 401 means the publishable key is
   wrong or missing, a 400 means a props shape the store's `event_is_valid`
   rejects (a real bug, not a setup problem), and no request at all means
   step 3's env vars did not make it into the deployed build (redeploy
   again).
6. **Confirm the rate limit's IP hashing is real** — the reason #222 exists.
   From two devices on two different networks (e.g. a phone on cellular data
   and a laptop on office/home wifi — two browser tabs on the same wifi
   share one public IP and will not do this), open the live site on both and
   trigger at least one event on each. Then:
   ```sql
   select ip_hash, count(*) as writes from private.write_log
   group by ip_hash order by writes desc;
   ```
   Expect **two distinct `ip_hash` rows**, one per device/network. One row
   for both means they were hashed as the same source — check which header
   `enforce_write_rate_limit()` is actually reading
   (`20260925000000_events.sql`'s own comment: it prefers
   `cf-connecting-ip`, falling back to the rightmost `x-forwarded-for`
   entry) against what Supabase's edge actually sends on this project, and
   update the trigger if it differs — the migration's comment already flags
   this as "an assumption to confirm on the first real deploy."
7. **Export the raw events, on a schedule (recurring, not one-time).** The
   free plan has no backups and pauses the project after 7 idle days, so the
   export is the only copy.
   - **How.** Dashboard → Table Editor → `events` (schema `public`) →
     Export → Download as CSV. That exports the raw table, including
     `is_internal` rows, which is what you want in a backup. Confirm the
     file's row count equals the store's:
     ```sql
     select count(*) from public.events;
     ```
     (The SQL Editor's results grid caps rows, so do not export from it.)
   - **How often.** At least weekly, and always before any stretch of 7 days
     you will not visit the site or the dashboard (travel, a break), since a
     paused project takes inserts with it.
   - **Where the file goes.** A private folder you control, named
     `events-YYYY-MM-DD.csv`. Never the repository: the rows carry
     `visitor_id` and `session_id`.
   - **Never delete exported rows from the store.** Do not trim, truncate or
     `delete` old events after exporting them. Contract M6c and
     `analytics.visitors` take a browser's first-touch source and first-seen
     time from *all* their rows, so removing old rows moves them forward:
     browsers look newer than they are, and the first-touch conversion by
     source in `docs/measurement/270-metric-queries.sql` (M6c) silently
     changes. (M3 no longer depends on this: it reads a 7-day lookback.) The
     export is a copy, not a transfer.

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
