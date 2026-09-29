# Roadmap: what to build next, and how the data should decide

**Status:** agreed with the owner for the soft launch (2026-09-29), tracked on
#253. The build order of the candidate directions is **not decided yet**, on
purpose: learners are invited to read the site's data and argue for one. What
is decided (where learners collaborate, and how they get the data) is marked
"Decided" below, and "Objectives to file from this page" at the end lists the
work it turns into.

## Why this page exists

Dontdropthatpromo is a parody food-delivery app. Every screen fires a real
event at a hosted Postgres store (ADR 0005, `docs/decisions/0005-hosted-event-store.md`),
so there is a real aggregate to read, not a simulated one. This roadmap uses
that data the way a product team does:

1. **Discover.** Read the funnel, retention and feature numbers. Find where
   people drop off, and what brings them back.
2. **Ideate and prioritise.** Weigh the candidate directions below against
   that evidence, and recommend an order.
3. **Design.** The chosen direction gets a spec and mocks (see `docs/design/`
   for every earlier one) before any code.
4. **Ship and measure.** Once it launches, read the same metrics again. Did the
   feature move the metric it was chosen to move, and did it break anything
   else?

Every step leaves a public trail in this repository: issues, specs, pull
requests, and decision records. You can follow any feature from "someone had
an idea" to "here is what the numbers did".

## The product today

The whole loop, in three cities (San Francisco, Los Angeles, Ho Chi Minh City):

- **Home feed:** a promo carousel, restaurant tiles, and a timed flash-deal
  sheet with 5-6 random restaurants.
- **Menu → cart → checkout:** checkout has vouchers and offers, and asks you to
  sign in (Google or Apple) only when you press Place order.
- **Play-money wallet:** every account gets a starting balance plus a drip of
  coins three times a day. No real payment is ever taken.
- **Tracker:** a simulated delivery with a driver, then rating the restaurant
  and the driver, tipping, VIP levels (Gold, Platinum), and a thanks voucher
  for the next order.

## What we can measure

The event contracts are `docs/measurement/219-analytics-readiness-contract.md`
and its second pass, `docs/measurement/270-analytics-readiness-second-pass.md`
(§9 defines M1-M20). The queries are `docs/measurement/270-metric-queries.sql`,
one per metric. It supersedes `219-launch-queries.sql`, which is kept as
history. Days and windows are on `received_at`, the server's clock.

| Area | Metric | What it tells you |
|---|---|---|
| Traffic | M1 browsers per day, M2 tab sessions per day (a diagnostic: a tab is not a visit) | Volume. Never compare cities or sources on raw counts. |
| Retention | M3 returning browsers (seen in the previous 7 days) | Does anyone come back? |
| Conversion | **M4 home-to-order funnel** (the primary metric is home-to-order conversion; checkout-to-order conversion is its last step), M5 the same funnel by city | Where people drop off. |
| Acquisition | M6 by source (e.g. LinkedIn), including first-touch conversion | Which channel brings people who order. |
| Fulfilment | M7 tracker return rate (an engagement metric, not a guardrail), M8 rating rates | Do people come back to the tracker and finish the loop? |
| Sign-in and wallet | M9 sign-in wall, M10 wallet-paid share, M11 short-balance recovery | What the sign-in step and the wallet cost in orders. |
| Engagement features | M12 tips, M13 VIP mix, M14 thanks voucher, M15 vouchers, M16 flash deal, M17 city switching | Whether each feature gets used. |
| Data quality and treatments | M18 loss rate (guardrail G6), M19 flash tap-through by fee mode and amount, M20 restaurant conversion | Whether events are being dropped, and which flash treatment and restaurant convert. |

**Not measured, on purpose.** The contract's §10 lists these: carousel slides,
scrolling, add-to-cart taps, opening the wallet sheet, and more. For each one
it says why. Part of the exercise is deciding whether a direction below needs
one of them.

**No A/B tests yet.** Every event has `variant = null`. Until an experiment
ships, a launched feature is judged **before against after**, with the
guardrails in the contract's §12. See "How we will judge a launch" below.

## North star and target metrics

- **North star: weekly browsers who place an order.** That is distinct
  browsers with an `order_placed` received in the ISO week. It combines the
  three things a direction can move: reach (M1, M6), conversion (M4), and
  coming back (M3).
- **Input metrics a direction can target:**
  - home-to-order conversion (M4);
  - returning share (M3);
  - first-touch conversion by source (M6c);
  - orders per returning visitor.
- **Business metric**, for the directions that earn money: revenue per 1,000
  visitors. This is new, and needs its own events (see each direction).
- **Guardrails**, which must not get worse: home-to-order conversion (M4), the
  loss rate (G6, M18), and the privacy rule that no email, account or wallet
  field ever enters an event (ADR 0008, the #79 rule).

## Candidate directions

Six candidates. The first three are the owner's own ideas, already written up
as issues. D and E were added in drafting because the existing data speaks to
them directly, and the owner kept them. F, an A/B testing system, is the owner's addition. Each one says what it would target and what the current data
can and cannot tell you about it.

### A. Pro mode: a paid monthly subscription (#200)

- **What:** real money buys double coin drips plus a monthly coin bonus, worth
  4-5x a free account's coins.
- **Targets:** revenue, and retention among committed users.
- **What the data can show now:**
  - How many visitors come back often enough to want more coins (M3).
  - How often a short balance blocks an order, and whether people recover (M11).
  - Whether VIP levels show a group of heavy users (M13).
- **What it can't show:** willingness to pay. Nothing on the site asks for
  money today.
- **Cost:** high. It needs a payment provider, a server-side webhook, a new
  decision record (the site has no server of its own today), and new copy,
  because "no payment is ever taken" stops being true.
- **Question for learners:** if M11's short-balance rate is near zero, is
  anyone short of coins? What would that mean for Pro's demand?

### B. Social: referrals, a friends list, and sending an order to a friend (#201)

- **What:** give-X-get-X coins when a referred friend orders. Friend
  requests. An order sent to a friend, who gets an email.
- **Targets:** acquisition (new visitors from referrals) and retention.
- **What the data can show now:**
  - The size of the pool that could refer: visitors who completed an order.
  - The share of traffic that is already word of mouth (M6, sources other than
    LinkedIn).
  - How much of the traffic comes back at all (M3). A referral loop needs
    people who return.
- **What it can't show:** whether anyone would share. No share action exists.
- **Cost:** high. Email needs a sender and a server, Apple's private relay
  needs extra setup, and a referral payout needs a server-side record of a
  first order.
- **Question for learners:** how many completed orders a week does a referral
  loop need before it adds visitors you would notice in M1?

### C. Real ads in the promo carousel (#204)

- **What:** one carousel slide becomes a real, labelled affiliate ad (for
  example, an analytics course), in place of an in-house mock ad.
- **Targets:** revenue. Guardrail: the home feed's click-through into a
  restaurant must not drop.
- **What the data can show now:** home-page reach (M4 step 1) and the drop
  from home to a restaurant, which is the ad's audience and what it competes
  with.
- **What it can't show:** carousel impressions or taps. Neither is logged (§10).
  The research in `docs/research/204-affiliate-partners.md` expects about
  0.01-0.15 sales a month at soft-launch traffic.
- **Cost:** low. One static image slot, no script and no cookie. Research and a
  design spec are done.
- **Question for learners:** with that expected revenue, is the carousel slot
  worth more as an ad or as a promo that drives orders? What would you need to
  log to answer that?

### D. A lighter sign-in step (added in drafting)

- **What:** let people place their first order before signing in, for example
  with a guest wallet, and ask for an account at a later moment such as tipping
  or the second order.
- **Targets:** home-to-order conversion (M4), the primary metric.
- **What the data can show now:** almost everything. M9 measures, for each
  tab session that saw the sign-in sheet, the share that started signing in
  and the share that finished, and, for each browser that saw it, the share
  that ordered within 24 hours. M4 shows how big the
  checkout-to-order drop is next to every other step.
- **Cost:** medium. It touches the wallet's rules (ADR 0008), but needs no new
  server.
- **Question for learners:** if M9 shows most people who see the sign-in sheet
  never order, how many extra orders a week would removing it be worth, and
  what does it put at risk?

### E. More content: a fourth city or bigger menus (added in drafting)

- **What:** use the existing content procedure (`docs/content-run.md`) to add
  another city, or more restaurants in the current three.
- **Targets:** reach (M1, M6) and conversion in the new market (M5).
- **What the data can show now:** conversion by city (M5), and how often
  visitors switch city (M17). Los Angeles, added last, is a before-and-after
  case study already.
- **Cost:** low. The procedure is written down and has been run once.
- **Question for learners:** did adding Los Angeles move anything other than
  LA's own row in M5?

### F. An A/B testing system (added at the owner's request)

- **What:** the ability to run a real experiment instead of a before-and-after
  comparison. It has five parts:
  - **Assignment.** A visitor is put in an arm by a deterministic hash of
    `visitor_id` and the experiment's name, so they stay in the same arm
    across visits. No server is needed.
  - **An exposure event**, fired when the arm is decided, before the first
    screen that differs between arms, whether or not the person does
    anything. The contract's §1 already requires this, and ADR 0002 set the
    same rule for the site's first poll.
  - **The `variant` column**, which every event already carries and which is
    `null` today. It gets filled in.
  - **A contract revision per experiment**, naming the decision, the primary
    metric, guardrails, sample size and the stop date before it starts.
  - **Analysis queries:** a sample-ratio-mismatch check, the difference
    between arms with a confidence interval, and guardrail reads.
- **Targets:** none directly. This is infrastructure that makes every other
  direction's result trustworthy. Before-and-after comparisons get confused by
  whatever else changed that week: a new traffic source, a city launch, a
  weekend.
- **What the data can show now:** whether an experiment is even possible yet.
  Take M4's home-to-order conversion as the baseline. At 20%, detecting a lift to
  25% at the usual 5% significance and 80% power needs roughly 1,100 visitors
  per arm. Compare that with M1's daily visitors and you have the number of
  days a test would take.
- **Cost:** medium. It is client code and SQL, with no new server. Each
  experiment then costs a contract revision.
- **Question for learners:** at launch traffic, which direction's metric could
  be tested in under a month, and which would take a year? Should the system be
  built before or after traffic grows?

## The learner exercise

Recommend an order for A-F, and defend it with the data.

1. **Pull the numbers.** Start with M4 (the funnel), M3 (retention), M6
   (sources), M9 (sign-in) and M11 (short balance).
2. **Size each direction.** Use a simple score such as RICE: Reach × Impact ×
   Confidence ÷ Effort. Take Reach from the data, not from a guess. Say which
   metric each direction would move, and by roughly how much.
3. **State your confidence honestly.** The launch is small. Say how many
   visitors or orders your conclusion rests on, and what result next month
   would change your mind.
4. **Name what's missing.** If a direction can't be judged without a new event,
   name the event and the decision it would serve. That is how this project
   adds tracking (the contract's §10 is the model).
5. **Pick one to go first,** with the metric it should move and the guardrail
   it must not break.

Post your recommendation in this repository's GitHub Discussions (see
"Where learners collaborate" below). The direction that goes first gets built
in public, and its results are published against your predictions.

## How we will judge a launch

- **Before it ships:** write down the target metric, the expected change, the
  guardrails, and the date the "after" window closes.
- **Measure before against after**, over windows of equal length, with the
  owner's own traffic excluded (`events_clean`). Split by city and source, so a
  change in who is visiting isn't mistaken for the feature working.
- **Report the counts behind every rate.** 3 orders out of 20 visitors is not
  a 15% conversion rate anyone should act on.
- **Tracking comes after the feature (the #79 rule).** A direction ships the
  product first. Its events arrive in a follow-up readiness pass, so some
  numbers for a new feature start a little after launch.
- **Later:** once traffic can support it, the first A/B test adds an exposure
  event and its own contract revision (see the contract's §1).

## Where learners collaborate (decided: GitHub Discussions)

What it needs: lightweight for the owner, open to anyone, threaded, able to
show SQL and charts, and a place where mentors can reply to a specific
analysis.

| Option | For | Against |
|---|---|---|
| **GitHub Discussions on this repo** (recommended home) | Free, nothing to host, and already next to the roadmap, specs and code. Markdown, SQL code blocks and images. Categories (e.g. "Recommendations", "Analyses", "Ask a mentor"), upvotes, and a marked answer. A thread can link to the issue or PR that acts on it. | Needs a GitHub account, which some beginners don't have. Less discoverable than Reddit. |
| **A subreddit** (e.g. r/dontdropthatpromo) | Familiar, anonymous, voting pushes good analyses up, and people can find it outside LinkedIn. | A brand-new subreddit looks empty and needs moderating. Subreddits like r/analytics and r/datascience limit self-promotion. Reddit posts are far from the repo, so decisions don't link back to them. |
| **Discord** | Real-time, good for mentoring and office hours. | Hard to search, answers get lost in scrollback, and moderation is heavier. Better as a second channel once there is a community. |
| **LinkedIn comments only** | No extra step for anyone who saw the post. | Not threaded enough to collaborate on, and gone from view in a week. |

**Decided (owner, 2026-09-29):** GitHub Discussions on this repository is the
home for questions, collaboration and submitted recommendations. LinkedIn and,
where their rules allow, posts on r/analytics or r/ProductManagement link to
it. A subreddit or Discord only if the board outgrows itself.

Suggested categories: **Announcements** (new snapshots, roadmap decisions),
**Q&A** (questions about the data, with a marked answer), **Analyses** (show
your work), **Recommendations** (one post per recommendation, using the form template below), and **Ask a
mentor**.

## Before learners can do this: getting the data to them

The store is write-only for browsers: the public key can insert events and
cannot read them (ADR 0005). Learners need a read path. Every option below keeps
the site static with no server of its own, and serves the same anonymised
rows: `events_clean` (the owner's traffic already removed).

| Option | How it works | For | Against |
|---|---|---|---|
| **1. Published snapshot files** | A scheduled job (a GitHub Action holding a read-only secret, or the owner by hand) exports `events_clean` to CSV and Parquet, daily or weekly. A **Data** tab on the site links the files, a data dictionary and the schema. | Simplest possible. Dated snapshots let anyone re-run an analysis on exactly the data it used. | Up to a day stale. The Action touches `.github/`, a protected path. |
| **2. Snapshot + SQL in the browser** | Option 1, plus DuckDB-WASM on the Data tab: learners write SQL against the Parquet file in the page, with the M1-M17 queries preloaded as examples. | Nothing to install, and SQL practice is the whole point. Runs entirely in the visitor's browser. | A few MB of WASM, loaded only on that tab. Some design and engineering work. |
| **3. A read-only view on the Data API** | A `public` view over `events_clean`, with `select` granted to the public key. The Data tab reads it live. | Live data, no export job. | Opens a read path onto the store: rate limits and egress are now the owner's problem, and it changes ADR 0005's write-only rule. Row-level access is harder to take back than a file. |
| **4. Mirror to a dataset host** | The snapshot is also published as a Kaggle or Hugging Face dataset. | Learners use their own tools (notebooks, pandas, Kaggle's own discussion board). | A second place to keep in sync. |

**Decided (owner, 2026-09-29):** option 1 (downloadable snapshots) and
option 2 (SQL in the browser on a Data tab). Option 4 stays possible later;
option 3 is not planned.

### How it works with the Supabase store

```
Supabase Postgres                 GitHub Action (daily)              Supabase Storage (public bucket)         Site: /data
learner schema: one view    ──►   list the learner views,     ──►   snapshots/2026-10-05/events.parquet  ──►  Download links
per published table               filter to before today,           snapshots/2026-10-05/<table>.parquet       DuckDB-WASM SQL console,
(events, and each new table)      re-key ids with one salt,         snapshots/2026-10-05/*.csv                 every table loaded,
select-only for one role          write Parquet + CSV + manifest    snapshots/latest.json                      M1-M17 preloaded
```

**It is built for several tables from the start.** The site will log to more
than the one `events` table, so the pipeline treats "the tables learners may
see" as a list the database owns, not something hard-coded in the job.

1. **In the database: a `learner` schema, one view per published table.**
   - Each table learners may see gets a view in `learner`: `learner.events`
     over `events_clean`, and one per new table as it is added (for example
     `learner.orders` or `learner.dim_restaurants`).
   - **The view is the allow-list and the privacy filter.** It picks the
     columns that are safe to publish and drops the rest. `learner.events`
     keeps `visitor_id`, `session_id`, `event_name`, `occurred_at`, `props`
     and `variant`, and drops `id` (the client's retry key), `received_at`
     and `is_internal` (always false once the owner's traffic is removed).
   - **Every view exposes one timestamp column, `ts`:** `occurred_at` for event
     tables, `created_at` for dimension tables. The job filters on it without
     knowing anything else about the table.
   - A login role, `snapshot_reader`, gets `usage` on the `learner` schema and
     `select` on its views, and nothing else. It cannot read the raw tables,
     the wallet or `auth.users`, and cannot write. It is not the service-role
     key.
   - **Publishing a new table is one migration:** add its view and grant. The
     job, the bucket and the Data tab pick it up with no change.
   - **Never published:** wallet tables, `auth.users`, and anything keyed by an
     account's user id. The #79 rule keeps accounts and events apart, and a
     published table must not join them.
2. **The export job: a scheduled GitHub Action, once a day.**
   - It connects as `snapshot_reader` through Supabase's connection pooler,
     because Actions runners need an IPv4 address. The connection string is a
     repository secret.
   - It runs the DuckDB CLI with DuckDB's `postgres` extension. It lists the
     views in `learner`, and for each one writes a Parquet and a CSV file. It
     uses the same engine the browser will run.
   - **What each snapshot holds: all history up to the start of today (UTC).**
     Every row with `ts` before 00:00 UTC on the export day. There is no
     cut-off date to choose: a learner states the window they analysed. The
     store accepts an event up to a day after it happened (the contract's
     rule R2), so yesterday can still gain a few late rows in the next
     snapshot. The Data tab says so.
   - **Full history, not a rolling window.** At soft-launch volume every table
     together should be well under a few MB. If a snapshot passes about 50 MB
     (the point where a browser tab starts to struggle), switch to one file
     per month per table. DuckDB reads a folder of files as one table, so
     queries don't change.
   - **Re-keying, with one salt for the whole run.** Each run makes a random
     salt and replaces every uuid column in every table with
     `md5(value || salt)`, then discards the salt. Because every table shares
     the salt, joins still work: `events.visitor_id` matches
     `orders.visitor_id` in the same snapshot. Across snapshots, and against
     the ids in a visitor's own browser, nothing matches. Non-uuid keys, such
     as a restaurant's slug, stay as they are.
   - It uploads the files and a `latest.json` manifest, using Supabase
     Storage's S3 access keys, which can only touch storage. The manifest
     lists, per table: the row count, the earliest and latest `ts`, and a
     checksum.
   - **A side benefit:** a daily query keeps the free project from pausing
     after 7 idle days (ADR 0005). It is **not** a backup: the published files
     are re-keyed, and raw rows never leave the database this way. The owner's
     manual export (ADR 0005, checklist step 7) still stands.
3. **Where the files live: a public Supabase Storage bucket, `snapshots`.**
   - It sends CORS headers and supports range requests, which DuckDB-WASM
     needs to read Parquet from another origin. GitHub release assets don't
     allow cross-origin fetches.
   - The files are **not committed to git**: anything in a public repo's
     history stays there, so a snapshot could never be taken back. A bucket
     object can be deleted.
   - Each day's snapshot gets a dated folder. Keep the last 30, so an analysis
     posted two weeks ago can still be re-run on exactly the data it used.
4. **The Data tab (`/data`), a static Astro page.**
   - The snapshot date, and for each table: row count, earliest and latest
     timestamp, taken from `latest.json`. A picker for older dated snapshots.
   - Download links per table (CSV and Parquet), and a data dictionary per
     table: the event contract for `events`, and each new table's own
     contract.
   - A SQL console. DuckDB-WASM is loaded **only on this page and only when
     the console opens** (a few MB), and registers every table in the chosen
     snapshot under its own name, so `select * from orders join events ...`
     just works. Queries run in the learner's own browser, so the store takes
     no load.
   - M1-M17 preloaded as examples. They are written for Postgres, so they need
     porting to DuckDB's dialect (JSON access, time zones, date truncation),
     with a Vitest test that runs each port against a fixture file.
   - Results shown as a table, with a "download results as CSV" button.
   - **Nothing typed in the console is ever logged.** It is free text, and the
     site logs no free text. Whether the Data tab gets any events at all is a
     question for the readiness pass that follows (the #79 rule).

**Catalogue dimensions may not need a database table at all.** Restaurants,
menu items, vouchers and drivers are defined in code (`src/lib/catalogue-*.ts`
and friends). The export job can write those out as dimension files straight
from the repository, with a `created_at` kept in the code beside each row
(for example, the day a city or restaurant launched). Only data the site *creates at runtime* needs a table in the store.

**Dimensions that change.** A snapshot shows each dimension as it is at export
time. If a dimension's rows can be edited (a restaurant's price or rating),
an analysis of last month would join to this month's values. Keep dimension
tables append-only, with `valid_from` and `valid_to` on each version of a row,
so an analysis can join to the version that was true when the event happened.

**Every analysis states its timeframe.** A submission names the snapshot date
it used and the window it analysed (for example "snapshot 2026-10-20, events
from 2026-10-06 to 2026-10-19"). The Recommendations category in Discussions
gets a form template (`.github/DISCUSSION_TEMPLATE/`) with those two fields
required, beside the recommendation, the metrics used and the counts behind
them.

**Owner-only steps:** set the `snapshot_reader` password, the storage
bucket and its S3 keys; add the two repository secrets; enable Discussions in
the repository settings.

**What this must settle first:**

- **A decision record.** Publishing event rows changes a category: the About
  page currently tells visitors their events go to a store only the owner
  reads.
- **About page copy** saying that anonymised event rows are published.
- **Re-keyed ids** (designed above). ADR 0005's checklist step 7 keeps raw
  exports out of the repository precisely because the rows carry
  `visitor_id` and `session_id`. Published snapshots only ever carry the
  re-keyed ids, and the ADR records that.
- **Small numbers.** At launch traffic, a single row can be recognisable to
  the person who made it ("the one HCMC order from LinkedIn at 9:03 was mine").
  Nothing in a row identifies a person, but the About page should say so
  plainly.
- **A table contract for each new table,** like the event contract: what each
  column means, which timestamp is `ts`, and why each column is safe to
  publish.

## Objectives to file from this page

Each is a `backlog` issue, indexed on #253. Run `/objective` on one when the
owner is ready, using the sections above as its brief. In rough order:

1. **Learner data access: snapshots and the Data tab (#257).** Needed before the
   LinkedIn post invites anyone to analyse the data. Likely children:
   - an ADR (publishing re-keyed rows, amending ADR 0005 step 7) plus the
     migration for the `learner` schema, `learner.events` and the
     `snapshot_reader` role;
   - the daily export Action (DuckDB, one salt per run, all history before
     today, `latest.json`, 30 dated folders in the `snapshots` bucket);
   - a designer spec for `/data`;
   - an engineer child for `/data`: downloads, dictionary, the DuckDB-WASM
     console with M1-M17 ported, and the About page copy.

   Owner-only steps: the role's password, the bucket and its S3 keys, and the
   two repository secrets.
2. **Discussions setup (#258).** Small, and possibly done by hand: enable
   Discussions, create the five categories, and add the Recommendations form
   template (`.github/DISCUSSION_TEMPLATE/`) with the snapshot date and the
   analysis window as required fields.
3. **A/B testing system (F, #259).** Assignment, exposure event, the `variant`
   column, per-experiment contract revisions, SRM and interval queries.
4. **The direction learners' analysis puts first** (A #200, B #201, C #204,
   D #260, E #261), filed once the
   recommendations are in. Its analytics-readiness pass follows it (the #79
   rule), and each new table it adds gets a view in `learner` and a table
   contract.
