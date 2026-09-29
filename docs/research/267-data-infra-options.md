# Research: data infrastructure options, for collection and for warehouse and transform

Issue: #267 (child of objective #264). It feeds the analyst child of #264, which owns the data model and any ADR.

**Decision this serves:** which stack this site runs on for (1) getting events from the browser into storage and (2) modelling them into tables people can query, and what signal should make each layer change.

**Recommendation, in one line:** keep collection exactly as it is (browser to Supabase, ADR 0005). Keep Supabase Postgres as the system of record. Treat #257's daily Parquet snapshot plus DuckDB as the analytical warehouse. Add **dbt Core with the `dbt-duckdb` adapter**, run inside #257's daily export job, as the transform layer. Its models are committed in this repository, where learners can read and run them. None of the other owner-named tools becomes infrastructure. GA4's schema, Snowflake and Databricks are best taught by loading the published snapshot into each learner's *own* free account, not by running them here.

**Status of this document.** The comparison stopped changing well before the end. The last four sources read (MotherDuck, Supabase ETL, Vercel Drains, the dbt v2 adapter list) left the ranking where it was. What is thinner than usual is **verification**. This environment's egress proxy blocked every vendor web page tried: vercel.com, supabase.com, posthog.com, support.google.com, developers.google.com, docs.cloud.google.com, docs.snowflake.com, docs.databricks.com, duckdb.org, getdbt.com and plausible.io. So a claim is **V** only where the vendor publishes its own docs, pricing data or code on GitHub, and that was read this run. Claims about Vercel, GA4, BigQuery, Snowflake and Databricks come from the search index's extract of the vendor page, and are tagged **Vs** (see the legend). With more time, the next thing to read would be those vendors' own pricing and limits pages, from an unblocked network, to turn each Vs into a V.

## Legend

As in `docs/research/64-hosted-event-store.md`, plus one tag this run needed:

- **V**: verified in the linked primary source this run. That means the vendor's own docs, pricing data or code, read from its public GitHub repository, or this repository's own files.
- **Vs**: the linked primary page, read second-hand through the web-search tool's extract because the page itself was blocked. Treat this as weaker than V, and check it before anyone pays for anything.
- **I**: inferred. The basis is named.
- **A**: assumed. The comparison rests on it anyway.

## What in the issue is fixed, and what is a guess

**Constraints (checked):**

- **The build stays static.** Astro builds with `output: 'static'` and no adapter (V, `docs/decisions/0001-framework-choice.md`). There is no backend of the site's own, and the browser inserts directly into Supabase (V, `docs/decisions/0005-hosted-event-store.md`).
- **The #79 rule.** No email, account or wallet field goes into any event (V, `docs/decisions/0008-play-money-wallet-and-sign-in.md`, "Identity and the build").
- **Learners read snapshots, not the live store.** The #257 read path was decided by the owner on 2026-09-29: daily Parquet and CSV snapshots, with DuckDB-WASM on `/data` (V, `docs/roadmap.md`, "Decided (owner, 2026-09-29)").

**A constraint the issue restates more strongly than the code supports.** "The site uses no cookies" is true of cookies. But the site does keep a persistent random visitor id in `localStorage` and a session id in `sessionStorage` (V, `src/lib/tracking-transport.ts` lines 89-93). About's wording is "no cross-site tracking cookie" (V, `src/pages/about.astro` line 110).

- That the site needs no consent banner rests on the data being anonymous and first-party, not on "no cookies". Browser-storage rules in some jurisdictions treat `localStorage` like a cookie (A; no legal source was read this run).
- This does not change the ranking below. It does mean "adds a cookie" is not the only privacy cost worth counting. **"Adds a third party that sees the visitor's IP and user agent"** is the sharper test, and every option is scored on that.

**Guesses:**

- **The owner's list.** GA4, Vercel, Databricks, Snowflake and dbt are where attention already was. Three of them are warehouses, and the site's data is a few MB (V, `docs/roadmap.md` line 331-332: "well under a few MB").
- **The framing "warehouse".** It implies the site needs a hosted analytical database. #257 already moved analytical compute into the learner's browser (DuckDB-WASM on a Parquet file). So the real open question on layer 2 is **where modelling lives and who can see it**, not where the warehouse is hosted.
- **"100x" as the scale to price.** It is a useful stress figure, not a forecast. The traffic numbers below are assumptions.

**Out of reach of reading:** the site's real ad-blocker loss. Nothing in the code reports it (see "Silent loss"). Measuring it takes a change to the event contract, which is the analyst's call, not a document.

## Traffic assumptions every cost below uses

| | Soft launch (A) | 100x (A) |
|---|---|---|
| Visitors per month | 1,000 | 100,000 |
| Page views per month (about 6 per visitor) | 6,000 | 600,000 |
| Events per month (about 20 per visitor) | 20,000 | 2,000,000 (about 67,000 a day) |
| Postgres growth, at about 400 B per row | about 8 MB a month | about 800 MB a month |

The row size comes from #64's 300-500 B per row estimate (I, `docs/research/64-hosted-event-store.md`, "Cost"). Events per visitor come from the funnel of about 7 steps plus tracker refreshes, with `session_started` and the flash sheet on top (A).

## Silent loss, today

Asked for by the issue, and relevant to every collection option:

- **The sender swallows every failure.** It is `fetchImpl(...).catch(() => {})` with `keepalive: true` (V, `src/lib/tracking-transport.ts` lines 95-105). Nothing counts a blocked, refused or failed write, so every loss rate in this document is unmeasured for this site.
- **Supabase is not on the two blocker lists read.**
  - `supabase.co` and `/rest/v1` do not appear in EasyPrivacy's general list (V, [easyprivacy_general.txt](https://github.com/easylist/easylist/blob/master/easyprivacy/easyprivacy_general.txt)).
  - Neither appears in the part of its tracking-servers list that the fetch tool returned (I, [easyprivacy_trackingservers.txt](https://github.com/easylist/easylist/blob/master/easyprivacy/easyprivacy_trackingservers.txt)). That file is large and the read was truncated, so this absence is weaker than the first.
  - Neither was found in Disconnect's list (I, [services.json](https://github.com/disconnectme/disconnect-tracking-protection/blob/master/services.json), same truncation caveat).
  - So ad-blocker loss on the current path is probably small (I, from those lists being what uBlock Origin and Firefox's protection draw on).
- **The loss that did happen was a country, not a blocker.** On 2026-02-24 Indian ISPs were ordered to block DNS for `*.supabase.co`, and it was lifted on 2026-03-04 (Vs, [TechCrunch](https://www.techcrunch.com/2026/02/27/india-disrupts-access-to-popular-developer-platform-supabase-with-blocking-order/)). This site would have lost every Indian visitor's events for 8 days and reported nothing (I, from the swallowed error above).
- **Broad ad-blocker use,** for scale:
  - GWI puts it at 29.5% of internet users globally, 37% on desktop and 15% on mobile (Vs, via [GWI](https://www.gwi.com/blog/ad-blockers) as summarised by search; GWI's own report was not read).
  - Plausible, which sells a GA alternative, measured 58% of a tech-savvy audience blocking GA (Vs, [Plausible](https://plausible.io/blog/google-analytics-adblockers-missing-data)). Read that as a vendor with an interest in a high number.

## Options, layer 1: collection and logging

### Supabase direct insert (the baseline, and recommended to keep)

- **What it does.** One `POST` per event to `/rest/v1/events` with the publishable key. It lands in an insert-only table whose shape the store enforces (V, ADR 0005).
- **Cost now.**
  - The Free plan has a 500 MB database, 5 GB egress and 1-day log retention, and "After 1 week of inactivity" pausing. It has no automatic backups (V, [Supabase pricing data](https://github.com/supabase/supabase/blob/master/packages/shared-data/pricing.ts)).
  - At about 8 MB a month, soft launch fits for years (I, from the table above).
- **Cost at 100x.**
  - About 800 MB a month outgrows 500 MB in under a month (I).
  - Pro includes an "8 GB disk size per project", "then $0.125 per GB", and 250 GB egress (V, same file).
  - Pro costs $25 a month per organisation, with $10 of compute credits (Vs, [pricing](https://supabase.com/pricing) via search; the price is not in the data file).
  - 8 GB holds about 10 months of events at 100x (I).
- **Static fit.** Full. No adapter and no function (V, ADR 0005).
- **Privacy and consent.** It is a hosted processor that sees each request's IP. The IP is used only for a salted, hourly-purged rate-limit hash and never reaches `events` (V, `supabase/migrations/20260925000000_events.sql` lines 201-232). No third-party script is loaded.
- **Ad-blocker loss.** Probably small, but unmeasured; see "Silent loss".
- **How learners get the data.** Through #257's snapshots only. The store stays write-only for browsers (V, `docs/roadmap.md` "Before learners can do this").
- **Learning value.** Learners get a raw event table the owner designed, the contract's validation visible in SQL, and ordinary Postgres. It is the most transferable of all the options, because it is what an analyst's "events" table looks like before a vendor reshapes it (I).
- **Ops and lock-in.** One vendor for events, auth and wallet. The migrations are plain SQL, and Postgres moves anywhere (I). The single point of failure is real, as the India block showed.
- **Right pick while** loss stays small and junk stays out. See "What would flip this".

### Google Analytics 4 (collection), with its BigQuery export

- **What it does on each layer.**
  - Collection: the `gtag.js` script sends GA4's own event model.
  - Warehouse: a daily export writes one row per event into BigQuery, with parameters nested in `event_params`. Reading them needs `UNNEST` (Vs, [BigQuery Export](https://support.google.com/analytics/answer/9358801); the schema description is from the search extract of [the GA4 sample dataset page](https://developers.google.com/analytics/bigquery/web-ecommerce-demo-dataset)).
- **Cost now.**
  - GA4 is free.
  - The BigQuery sandbox gives 10 GB of storage and 1 TB of queries a month, with no card (Vs, [BigQuery sandbox](https://docs.cloud.google.com/bigquery/docs/sandbox)).
  - **But every sandbox table expires after 60 days.** GA4's daily export works into the sandbox, but only keeps 60 days (Vs, same page; confirmed by a [Google developer-forum thread](https://discuss.google.dev/t/ga4-data-not-retained-for-more-than-60-days/148622)).
  - That is shorter than the M3 "returning visitor" rule needs, because M3 reads first-seen from all history (V, ADR 0005 step 7). So keeping history means enabling billing (I).
- **Cost at 100x.**
  - GA4 is still free.
  - The standard export's limit is 1 million events a day (Vs, [BigQuery Export](https://support.google.com/analytics/answer/9358801)). 100x is about 67,000 a day, well under it (I).
  - BigQuery's free tier is 10 GiB of storage and 1 TiB of queries a month, then $6.25 per TB queried (Vs, [BigQuery pricing](https://cloud.google.com/bigquery/pricing)). At 100x, a few GB a month would pass the free storage within months, at cents per GB (I; GA4 rows are wider than ours because of nesting, and that width was not measured).
- **Static fit.** Yes. It is one script tag, with no server.
- **Privacy and consent. This is the heaviest cost of any option.**
  - GA4 sets `_ga` and `_ga_<id>` cookies with a two-year default expiry (Vs, via [Optimize Smart](https://optimizesmart.com/blog/understanding-google-analytics-4-cookies-_ga-cookie/); Google's cookie page was blocked).
  - Consent Mode v2 has been required for EEA traffic since March 2024, and a banner is still needed alongside it (Vs, [consent settings](https://support.google.com/analytics/answer/14275483), with the "banner still required" point from secondary guides).
  - It loads a third-party script that sends IP and user agent to Google (I).
  - It would break About's "no cross-site tracking cookie" line and need a banner. Both are costs this issue counts.
- **Ad-blocker loss. The highest of any option.**
  - Google Analytics is blocked by the default lists in uBlock Origin and Brave (I; the GA domain lines were in the truncated part of the EasyPrivacy read).
  - Plausible measured 58% for a technical audience (Vs, vendor with an interest, above).
  - Consent denial in the EEA adds to the loss (I).
- **How learners get the data.** Only through BigQuery. A public dataset or a service account would be needed, which is a second publishing path beside #257's (I).
- **Learning value.** High for the **schema**: GA4's nested BigQuery export is what many marketing and product analysts query. But learners can already practise on `bigquery-public-data.ga4_obfuscated_sample_ecommerce`, a free sample from the Google Merchandise Store covering 2020-11-01 to 2021-01-31 (Vs, [GA4 sample dataset](https://developers.google.com/analytics/bigquery/web-ecommerce-demo-dataset)). **The skill is available without this site running GA4** (I).
- **What it rules out.**
  - An owner-designed table; the event model is Google's.
  - A store that refuses malformed events. GA4 accepts any event name, and web streams have no event-name cap (Vs, [collection limits](https://support.google.com/analytics/answer/9267744) via search).
  - Parameters over 100 characters, or more than 25 per event (Vs, same page).
- **Right pick if** the owner decides that learners must practise on GA4 data *from this site*, and accepts a consent banner. See "What would flip this".

### Vercel's built-in offerings

**Web Analytics, including custom events:**

- **What it does.** Automatic page views, plus `track()` custom events. Collection goes through a first-party path, `/_vercel/insights/script.js` (V, that path appears in [EasyPrivacy general](https://github.com/easylist/easylist/blob/master/easyprivacy/easyprivacy_general.txt)).
- **Cost now.**
  - Hobby includes 50,000 events a month. When they run out, collection pauses; Hobby cannot buy more (Vs, [Web Analytics pricing](https://vercel.com/docs/analytics/limits-and-pricing)).
  - **Custom events are Pro and Enterprise only** (Vs, [custom events](https://vercel.com/docs/analytics/custom-events)). So on Hobby this site could log page views and nothing from its contract.
- **Cost at 100x.**
  - Pro includes 100,000 events, then $3 per 100,000 (Vs, [pricing](https://vercel.com/docs/analytics/limits-and-pricing)).
  - 600,000 page views plus 2 million custom events is about $75 a month in events, plus the Pro seat (I, from those rates). The seat is about $20 a month (Vs, secondary).
- **Static fit.** Full. It is built for this host.
- **Privacy.** No cookies. Visitors are identified by a hash of the request, and the session is discarded after 24 hours (Vs, [privacy and compliance](https://vercel.com/docs/analytics/privacy-policy)). The same-origin path means no third-party script (I). **It cannot follow a visitor past 24 hours**, so returning-visitor metrics are impossible (I, from that).
- **Ad-blocker loss.** Its script path is on EasyPrivacy (V, above). A first-party path does not save it, so it loses more to blockers than the Supabase write does (I).
- **Shape limits.**
  - Custom events allow a limited number of keys per event (Pro: 2; Web Analytics Plus: 8). That source may be out of date (Vs, [custom events](https://vercel.com/docs/analytics/custom-events) via search).
  - Names, keys and values are capped at 255 characters, and nested objects are not allowed (Vs, same).
  - `order_placed` alone carries more properties than 8 (V, About's description of it, `src/pages/about.astro` lines 73-79).
- **How learners get the data.** Only through dashboard CSV export, capped at 250 rows per panel (Vs, [CSV export](https://vercel.com/changelog/csv-export-in-web-analytics)). Or through **Drains**, which are Pro and Enterprise only and cost $0.50 per GB (Vs, [Drains changelog](https://vercel.com/changelog/export-more-data-with-vercel-drains)). A drain POSTs to an HTTP endpoint, which a static site with no backend does not have (I).
- **Learning value.** Low. It is a dashboard of aggregates, with no SQL and no raw rows (I).

**Speed Insights:**

- Real-user Web Vitals. Hobby includes 10,000 data points a month for one project (Vs, [Speed Insights pricing](https://vercel.com/docs/speed-insights/limits-and-pricing)). Its script path `/_vercel/speed-insights/script.js` is on EasyPrivacy (V, same list).
- It answers a performance question, not a product one. It would be a new thing About must list (I).
- Worth a later look as a guardrail metric; not part of either layer.

**Runtime logs and log drains:**

- Runtime logs cover functions. This site has none, so there is nothing to log (I, from ADR 0001).
- Hobby keeps runtime logs for one hour (Vs, [runtime logs](https://vercel.com/docs/logs/runtime)).
- Drains are Pro and Enterprise only (Vs, above).
- The one thing a log could offer is an **unblockable server-side page-request count**, to measure blocker loss against. The per-path Observability breakdown is an Observability Plus feature, on Pro (Vs, [Observability](https://vercel.com/docs/observability) via search). So a loss meter from Vercel means a paid plan (I).

**Right pick if** the site moved to Vercel Pro for another reason and only wanted page-view trends. For this site's contract it is not a candidate.

### PostHog (beyond the owner's five)

- **What it does on each layer.**
  - Collection: an SDK with autocapture.
  - Warehouse: a ClickHouse-backed events table queried in HogQL (I, from #64's reading of [PostHog SQL docs](https://posthog.com/docs/data-warehouse/sql); not re-read this run).
  - **Batch exports**, to Postgres, S3, BigQuery, Snowflake, Databricks and Redshift, are available on the Free plan (V, [batch exports](https://github.com/PostHog/posthog.com/blob/master/contents/docs/cdp/batch-exports/index.mdx)).
  - The Postgres export writes `uuid, event, properties, elements, set, set_once, person_properties, distinct_id, team_id, ip, site_url, timestamp` (V, [Postgres export](https://github.com/PostHog/posthog.com/blob/master/contents/docs/cdp/batch-exports/postgres.mdx)). **Note the `ip` column.**
- **Cost now.** 1 million events a month free, with one-year retention on the Free plan (Vs, [pricing](https://posthog.com/pricing) via secondary summaries).
- **Cost at 100x.** Anonymous events are $0.00005 each after the first million (Vs, [product analytics pricing](https://posthog.com/product-analytics/pricing)), so about $50 a month. Batch-export rows are free to 1 million, then $0.000015 a row (Vs, secondary), about $15. Roughly **$65 a month** in total (I).
- **Static fit.** Yes. A same-origin proxy is three `vercel.json` rewrites, with no function (V, [PostHog on Vercel](https://github.com/PostHog/posthog.com/blob/master/contents/docs/advanced/proxy/vercel.mdx)).
- **Privacy.** `cookieless_mode: "always"` stores nothing on the device and counts through server-side hashing, but it has to be enabled in project settings first (V, [data collection](https://github.com/PostHog/posthog.com/blob/master/contents/docs/privacy/data-collection.mdx)). It is still a third party receiving IP and user agent (I).
- **Ad-blocker loss.**
  - EasyPrivacy blocks `||posthog.$script` (V, [EasyPrivacy general](https://github.com/easylist/easylist/blob/master/easyprivacy/easyprivacy_general.txt)).
  - PostHog says a reverse proxy "typically increases event capture by 10-30%" (V, [proxy docs](https://github.com/PostHog/posthog.com/blob/master/contents/docs/advanced/proxy.mdx); that is the vendor's own figure).
- **How learners get the data.** Through a batch export into Supabase, then #257 (I). That makes it two stores.
- **Learning value.** Medium to high. Product-analytics UIs (funnels, retention, feature flags, experiments) are what many product analysts use daily (I). HogQL is a dialect learners will not meet elsewhere (I, #64).
- **Why it loses here.** These are the same reasons ADR 0005 recorded:
  - the store cannot refuse a malformed event (I, #64);
  - it needs a second store to publish from;
  - the public capture key accepts any shape.
- **Right pick if** the roadmap needs session replay, feature flags or a no-code experiment UI. Even then, add it *alongside* the Supabase write, not instead of it.

### Discarded on layer 1, one line each

- **Snowplow.** Since 2024 its core is under the Snowplow Limited Use License, which does not allow production use without a commercial licence (Vs, [SLULA FAQ](https://docs.snowplow.io/docs/resources/limited-use-license-faq/)). Its typed, schema-validated events are the best teaching model for tracking plans, which is a reason to *cite* it in the curriculum, not to run it (I).
- **RudderStack and Segment.** They are routers, not stores: each still needs a destination, and each adds a vendor. The free tiers are 250,000 events a month for RudderStack and 1,000 visitors a month for Segment (Vs, secondary: [costbench](https://costbench.com/software/customer-data-platform/rudderstack-cdp/free-plan/), [Capterra](https://www.capterra.com/p/150621/Segment/pricing/)). Segment's free tier is under the soft-launch assumption.
- **Amplitude and Mixpanel.** Same shape as PostHog: a vendor schema and a third-party script. They were not researched further, because PostHog already represents the category and loses on the same grounds (I).
- **A same-origin Vercel rewrite in front of Supabase** (the PostHog proxy trick, applied to our own store).
  - It would hide `supabase.co` from blockers.
  - But it would put Vercel's egress in front of the per-IP rate limit. The limit reads `cf-connecting-ip` and then the rightmost `x-forwarded-for` (V, `supabase/migrations/20260925000000_events.sql` lines 201-214).
  - Vercel appends its own egress to `x-forwarded-for` on external rewrites (Vs, a third-party report found by search, [overslash PR #689](https://github.com/overfolder/overslash/pull/689)).
  - So every visitor would share a handful of rate-limit buckets (I), and at 60 writes per 5 minutes (V, same file, line 232) the site would lock itself out. It only becomes viable behind a function, which is ADR 0005's existing escalation path.
- **ClickHouse and Tinybird.** Discarded in #64 on free-tier request limits and a second dialect (V, `docs/research/64-hosted-event-store.md`). Nothing read this run changes that.
- **Plausible and Umami.** Aggregates, not raw rows (I).

## Options, layer 2: warehouse and transform

### Supabase Postgres plus SQL views and hand-written queries (the baseline)

- **What it does.**
  - The `events` table and the `events_clean` view (V, ADR 0005).
  - M1-M17 as hand-written SQL in `docs/measurement/219-launch-queries.sql`, run against seeded PGlite rows in `supabase/migrations/launch-queries.migration.test.ts` (V, files present).
  - #257 adds a `learner` schema of views, the privacy allow-list, and a DuckDB export (V, `docs/roadmap.md` "How it works with the Supabase store").
- **Cost.** As layer 1. The export job runs on GitHub Actions, which is free on standard runners in public repositories (V, [GitHub Actions billing](https://github.com/github/docs/blob/main/content/billing/concepts/product-billing/github-actions.md)). This repository is public (V, `docs/memory/researcher.md`).
- **What it lacks.** Shared logic lives only inside each query, and a sessionisation rule written into 17 queries is 17 copies (I). There is no lineage, no column documentation beyond the contract, and no tests on derived tables.
- **Learning value.** Plain SQL is the single most-required analyst skill (Vs, secondary: [a 2,585-posting analysis](https://dev.to/gnana_6392e836fd500a957dc/data-analyst-skills-companies-want-in-2026-2500-posting-analysis-2518), one author, method not checked). But it teaches nothing about how a team keeps that SQL correct (I).

### dbt Core with `dbt-duckdb`, inside #257's export job (recommended)

- **What it does.**
  - The daily Action already runs the DuckDB CLI against Supabase through a select-only role (V, `docs/roadmap.md` lines 318-323).
  - dbt-duckdb can attach a Postgres database as a source (V, [dbt-duckdb README](https://github.com/duckdb/dbt-duckdb/blob/master/README.md)). Its "external" materialisation writes models to Parquet, CSV or JSON files (V, same).
  - So one `dbt build` reads `learner.*` and builds staging and mart models, such as sessions, the order funnel and first-seen visitors. It tests them and writes each as Parquet beside the raw learner tables that #257 already publishes (I, combining the two).
  - **The privacy boundary stays where #257 put it.** It is the Postgres `learner` views, reviewed as migrations. dbt only ever sees what those views expose (I).
- **Cost.** $0 at both scales. dbt Core is Apache 2.0 (V, [LICENSE](https://github.com/dbt-labs/dbt-core/blob/main/LICENSE)), and it runs on the Action's free minutes (V, above). Compute scales with the snapshot, not with a warehouse bill (I).
- **Static fit.** Full. It runs in CI, not in the site. The visitor's bundle is unchanged (I).
- **Privacy.** No new processor and no new outbound destination from the site (I).
- **Blocker loss.** Not applicable; it inherits layer 1's.
- **How learners get the data.**
  - The marts are published as Parquet files beside the raw tables (I).
  - A learner can clone the repository and run the same dbt project on their own laptop against a downloaded snapshot. dbt-duckdb reads external Parquet directly (V, README). They need no credentials (I).
  - **This is the learning loop no other option offers.**
- **Learning value. The highest of any option, and the reason to adopt it.**
  - dbt shows up in data-engineer postings at about 24%, and is named among the highest-paying additions for analysts (Vs, secondary: [a 6,877-posting analysis](https://dev.to/gnana_6392e836fd500a957dc/data-engineer-skills-companies-want-in-2026-6877-posting-analysis-44p9) and the analyst analysis above; one author, method not checked).
  - Models, tests and docs committed in the repository are something a learner can read, change in a fork, and submit as a Discussion (I).
- **Ops and lock-in.**
  - It is a Python toolchain in CI. That is **a first dependency from a new ecosystem**, which is the owner's to approve (V, house rules, "What a revert does not undo" item 5).
  - **Version risk.** dbt Core v2 (the Fusion engine, released 2026-06-01) ships a built-in DuckDB adapter (V, [DuckDB's post](https://github.com/duckdb/duckdb-web/blob/main/_posts/2026-09-22-dbt-fusion.md)). Its Postgres adapter is "not yet supported" (V, [dbt-adapters #1992](https://github.com/dbt-labs/dbt-adapters/issues/1992)).
  - The DuckDB post does not say whether v2's DuckDB adapter supports attaching Postgres or the external materialisation this design needs (V, same post, by omission). **So pin dbt-core 1.x plus dbt-duckdb** (I).
  - dbt Labs merged with Fivetran, completed 2026-06-01, and states that dbt Core stays Apache 2.0 and maintained (Vs, [Fivetran press](https://www.fivetran.com/press/fivetran-dbt-labs-complete-merger-to-create-the-data-infrastructure-for-trusted-ai-agents)).
- **Right pick if** the analyst's model has at least one derived table, or logic shared across M-queries (sessions, first-seen, funnel steps). If it stays events-only, dbt waits; see the triggers.

### dbt Core with `dbt-postgres`, building marts inside Supabase (runner-up)

- The same models, materialised as tables or views in an `analytics` schema in Supabase.
- **What it buys.** The owner queries marts in the Supabase SQL editor next to the raw rows (I).
- **Why it is second.**
  - The Action would need a credential that can create objects in the database, instead of #257's select-only `snapshot_reader` (I). That widens a repository secret.
  - dbt v2 has no Postgres adapter (V, dbt-adapters #1992).
  - The marts would need their own grants to reach `learner` (I).
- **Right pick if** the owner's own day-to-day querying of modelled tables in the SQL editor matters more than keeping the Action read-only.

### BigQuery (via GA4's export, or loaded from our snapshot)

- **Cost.** See GA4: the free tier, or the sandbox's 60-day expiry (Vs).
- **Learning value.** High, through the GA4 schema and BigQuery SQL. But learners can load the published Parquet snapshot into their *own* sandbox for free (I, from sandbox limits being per learner). The site does not have to run BigQuery for learners to learn it.
- **Why it loses as infrastructure here.**
  - It needs a Google Cloud project and billing to keep more than 60 days (Vs).
  - It is a second place for the owner to look.
  - Its best case at this site's size is what DuckDB on Parquet already does for $0 (I).

### Snowflake plus dbt

- **What it does.** A warehouse. It would load our Parquet from a stage, and dbt would run there. It would not do collection (I).
- **Cost now.** There is no free tier: a 30-day trial with $400 of credits, then the account expires (Vs, [trial accounts](https://docs.snowflake.com/en/user-guide/admin-trial-account)). After that:
  - Compute is billed per second, with a 60-second minimum on each resume. Storage is about $23 per TB per month (Vs, secondary: [costbench](https://costbench.com/software/data-warehousing/snowflake/)).
  - A credit costs about $2-4 (Vs, same secondary source).
  - An X-Small warehouse uses 1 credit per hour (A; the primary page was blocked and the search extract did not state it).
  - A daily 5-minute load and build, plus some ad-hoc owner queries: **roughly $10-30 a month** (I, from those rates).
- **Cost at 100x.** About the same, because at these sizes the bill is compute time, not data (I).
- **Static fit.** It sits after #257's export, in the Action. It needs a Snowflake secret in the repository (I).
- **Privacy.** A new processor holding every event (I).
- **How learners get the data.** Not directly; the published snapshot stays the channel (I).
- **Learning value.**
  - High on the job market: Snowflake appears in about 31% of data-engineer postings (Vs, secondary, one author).
  - But a learner can load the snapshot into their own 30-day trial (I), which teaches the same thing without the owner paying.
- **Lock-in.** High: proprietary compute and billing (I).
- **Right pick if** the owner wants the site to *demonstrate* a Snowflake deployment as curriculum, and accepts a recurring bill for it.

### Databricks plus dbt

- **What it does.** A lakehouse. SQL warehouses, and dbt through its v2 adapter (V, dbt-adapters #1992 lists databricks among the supported adapters).
- **Cost now.** **Free Edition** is $0 (Vs, [Free Edition limitations](https://docs.databricks.com/aws/en/getting-started/free-edition-limitations)), but:
  - it is "meant for non-commercial use";
  - it is serverless only, with per-account quotas;
  - going over quota shuts compute down "for the rest of the day (and in extreme cases, the rest of the month)";
  - "outbound internet access is restricted to a limited set of trusted domains".
  - That last point probably rules out pulling from Supabase from inside Databricks (I). Pushing from the Action instead is unverified (A).
- **Cost at 100x.** It would move to paid serverless SQL, priced per DBU. This was not verified this run (A: comparable to Snowflake's order of magnitude).
- **Static fit, privacy and learner access.** As Snowflake.
- **Learning value.**
  - High for data engineers: about 29% of postings (Vs, secondary, one author).
  - Free Edition is exactly where a learner can load our snapshot themselves at no cost (I).
- **Lock-in.** High (I). Databricks also now sells Postgres, as Lakebase, after buying Neon in 2025 (Vs, [SiliconANGLE](https://siliconangle.com/2025/06/11/following-neon-acquisition-databricks-launches-serverless-lakebase-database/)). That is not a reason to move a working Supabase store (I).
- **Right pick if**, as with Snowflake, the owner wants it on show and the non-commercial and quota terms fit.

### MotherDuck plus dbt (beyond the owner's five)

- **What it does.** Hosted DuckDB. dbt-duckdb connects with an `md:` path (V, [dbt-duckdb README](https://github.com/duckdb/dbt-duckdb/blob/master/README.md)). It is the same SQL dialect as the recommended stack.
- **Cost.** The free tier is 10 GB of storage and 10 hours of compute a month. **The next plan is $250 a month**, having risen from $25 through 2025-2026 (Vs, [pricing](https://motherduck.com/product/pricing/) and [a secondary summary](https://layerbase.com/blog/motherduck-pricing-changes-2026)).
- **What it adds over the recommendation.** A shared, always-on database the owner could query in a browser. It could also host learners' queries (I).
- **Why it loses.** It is a new vendor and account, for something #257's static Parquet files already provide. And there is a 10x price cliff if the free tier is outgrown (I).
- **Right pick if** learners' queries need to be shared or saved server-side, which #257 did not ask for.

### SQLMesh (beyond the owner's five)

- **What it does.** An alternative to dbt, with plans, virtual environments and column-level lineage. It is open source (A; its licence file was not read this run).
- **Governance.** Fivetran acquired Tobiko Data in September 2025 (Vs, [Fivetran press](https://www.fivetran.com/press/fivetran-acquires-tobiko-data-to-power-the-next-generation-of-advanced-ai-ready-data-transformation)), then contributed SQLMesh to the Linux Foundation (Vs, [Techzine](https://www.techzine.eu/news/analytics/139955/fivetran-donates-sqlmesh-to-the-linux-foundation/)).
- **Cost.** $0.
- **Why it loses.** Learning value: dbt is the name in job postings, and SQLMesh is not among the tools those analyses list (Vs, secondary). Technically it would serve equally well (I).
- **Right pick if** dbt Core 1.x stops being maintained before dbt v2 covers what this design needs. SQLMesh reads dbt projects, which would soften a switch (A; not verified this run).

### Supabase ETL into Analytics Buckets (the candidate nobody asked for)

- **What it does.** Change-data-capture from Postgres into Apache Iceberg tables on S3 (Analytics Buckets) or into BigQuery (Vs, [Supabase ETL](https://supabase.com/blog/introducing-supabase-etl)).
- **Cost.**
  - Analytics Buckets are alpha: "free to use during the alpha phase", with egress still charged (V, [Analytics Buckets pricing](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/storage/analytics/pricing.mdx)). Alpha means "possible breaking updates" (V, [introduction](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/storage/analytics/introduction.mdx)).
  - The replication pipelines are usage-priced on Pro and above only (V, [pricing data](https://github.com/supabase/supabase/blob/master/packages/shared-data/pricing.ts)). They cost $25 per connector a month plus $15 per GB of change data (Vs, Supabase ETL blog via search).
  - So the floor is Pro ($25) plus one connector ($25): about **$50 a month** (I).
- **What it would buy.** Live, columnar, open-format copies with no export job. Iceberg is also a skill worth seeing (I).
- **Why it loses now.** It fails the "about zero cost" constraint, it is alpha, and it would replace a daily export job that #257 has already designed and that costs nothing (I).
- **Right pick if** the site is on Supabase Pro anyway (the 100x storage trigger below), and #257's daily lag becomes a real complaint.

## Comparison, layer 1: collection

| | **Supabase direct (today)** | GA4 | Vercel Web Analytics | PostHog (cookieless, proxied) |
|---|---|---|---|---|
| Static, no adapter | yes | yes | yes | yes (rewrites only) |
| Cost now | $0 | $0 | $0 page views only; **custom events need Pro** | $0 |
| Cost at 100x | $25 a month (Pro, for storage) | $0 (+ BigQuery cents) | about $95 a month (Pro + events) | about $65 a month |
| Cookie or banner | no cookie, no banner | **cookies + banner (EEA)** | no cookie | no cookie (cookieless mode) |
| Third party sees IP and UA | Supabase (processor) | Google | Vercel (already the host) | PostHog |
| Blocker loss | not on the lists read (low, unmeasured) | highest | script on EasyPrivacy | script on EasyPrivacy; proxy recovers "10-30%" |
| Store refuses malformed events | **yes** | no | no | no |
| Raw rows, owner SQL | **yes, Postgres** | via BigQuery only | no | HogQL, or export |
| Learner export | #257 snapshots | a second path | none | export into Supabase, then #257 |
| Learning value | raw event table, contract in SQL | GA4 UI and schema (but the free sample dataset exists) | low | product-analytics UI |
| Ops and lock-in | one vendor, portable SQL | Google's model | Vercel only | vendor schema |

## Comparison, layer 2: warehouse and transform

| | Supabase + views (baseline) | **+ dbt-duckdb in the #257 Action** | + dbt-postgres in Supabase | BigQuery | Snowflake + dbt | Databricks + dbt | MotherDuck + dbt | SQLMesh | Supabase ETL, Iceberg |
|---|---|---|---|---|---|---|---|---|---|
| Static fit | yes | yes (CI only) | yes (CI only) | yes | yes (CI) | yes (CI) | yes (CI) | yes (CI) | yes |
| Cost now | $0 | $0 | $0 | $0, **60-day expiry** | trial, then about $10-30 a month | $0 (non-commercial, quotas) | $0 | $0 | about $50 a month |
| Cost at 100x | $25 a month | $25 a month (Supabase Pro) | $25 a month | cents | about $10-30 a month | paid per DBU (unverified) | **$250 a month cliff** | $0 | about $50+ a month |
| New account or paid plan | no | **no** | no | yes | yes | yes | yes | no | yes (Pro) |
| Privacy boundary stays in the `learner` views | yes | **yes** | needs a write role | copies all rows out | copies out | copies out | copies out | yes | copies out |
| Owner raw SQL | yes | yes (+ DuckDB on marts) | yes, marts too | yes | yes | yes | yes | yes | yes |
| Learner access | #257 | #257 + marts + runnable repo | #257 | own sandbox | not direct | not direct | possible | #257 | not direct |
| Learning value | SQL | **SQL + dbt, readable in the repo** | SQL + dbt | BigQuery, GA4 schema | Snowflake | Databricks | DuckDB | SQLMesh | Iceberg |
| Lock-in | low | low | low | medium | high | high | medium | low | medium, alpha |

## Instrumentation-skill questions for the collection candidates

The `instrumentation` skill's storage questions. For Supabase these carry over unchanged from ADR 0005.

| Question | Supabase (today) | GA4 → BigQuery | Vercel Web Analytics | PostHog |
|---|---|---|---|---|
| Events leave the device? | yes | yes (unless consent is denied) | yes | yes |
| Answers the metric queries? | yes, SQL | yes in BigQuery; the UI is aggregated | no, dashboard only (I) | yes, HogQL |
| A row can change after writing? | not from outside (V, ADR 0005) | Google may rewrite a day's export for late events (A) | not applicable | not applicable (A) |
| Key that makes a repeat harmless? | client uuid primary key (V, ADR 0005) | none the site controls (I) | none (I) | event `uuid` (V, export schema); dedupe on it is not verified (A) |
| Late or out-of-order events? | both timestamps kept (V, ADR 0005) | event time and export day both kept (A) | not exposed (I) | `timestamp` only in the export (V, export schema) |
| A new property on old rows? | absent and null are distinguishable in `jsonb` (V, ADR 0005) | a missing key in `event_params` means absent (I) | not applicable | `properties` JSON, same as ours (I) |
| Retention long enough? | until 500 MB, or 8 GB on Pro (V) | 60 days in the sandbox (Vs); longer with billing | per plan reporting window (Vs) | 1 year on Free (Vs) |

The first row is what decides whether measurement is possible. Every candidate passes it, so the ranking is decided further down. Only Supabase answers **yes** to "refuses malformed events" and "idempotency key", and those two rows are what M1-M17's counts depend on (I).

## Recommended stack for now

| Layer | Now | Change from today |
|---|---|---|
| Collection | browser → Supabase `events`, direct insert (ADR 0005) | **none** |
| Storage, the system of record | Supabase Postgres, Free plan | none |
| Analytical copy and learner warehouse | #257's daily Parquet and CSV snapshots, DuckDB CLI in the Action, DuckDB-WASM on `/data` | none beyond #257's own plan |
| Transform | **dbt Core 1.x (pinned) + dbt-duckdb, run by #257's daily Action.** Sources: `learner.*`. Models in this repository, marts published as Parquet | **new** |
| Loss reporting | nothing today | **suggested to the analyst**: count delivery failures |

## Each recommended change, per AC4

### Change 1: dbt Core plus dbt-duckdb as the transform layer, inside #257's export

- **ADRs.**
  - ADR 0001 is **unchanged**: the site build and bundle are untouched, and dbt runs only in CI.
  - ADR 0005 is **unchanged**: the write path, table and bounds stay the same.
  - ADR 0008 is **unchanged**: dbt reads only the `learner` views, which already exclude accounts, the wallet and `auth.users` (V, `docs/roadmap.md` lines 315-317). A dbt test that fails if any model exposes a column outside the allow-list would make that mechanical (I).
  - **It still needs a new ADR**, because it adds a first dependency from a new ecosystem (Python, in CI) and decides where modelled tables live. Per this issue, that ADR belongs to the analyst child of #264, or to #257's ADR child if that lands first. This document does not write it.
- **Accounts and paid plans.** None. The house rules still ask the owner to approve the first Python dependency on the pull request that adds it (V, house rules item 5). The Action itself touches `.github/`, which #257 already lists as owner-reviewed (V, #257 "Likely children" item 2).
- **What it does to #257.**
  - The export step becomes `dbt build`, then the existing upload.
  - The mart models are published as extra tables in the same dated folder and `latest.json`.
  - #257 already has to port M1-M17 to DuckDB's dialect (V, `docs/roadmap.md` lines 371-373). They would be ported once, as dbt models or analyses, instead of as strings in the `/data` page.
  - The re-keying salt must be applied **before** the marts are built, or the marts must be re-keyed with the same salt, so that joins between raw tables and marts still work (I, from #257's one-salt-per-run design).

### Change 2 (suggested to the analyst, not decided here): report delivery failures

- **What.** Count failed or refused sends in `localStorage`, and attach the count to the next event that succeeds. For example, a numeric `prior_send_failures` on `session_started` (I, from the swallowed `.catch` at `tracking-transport.ts` line 105).
- **Limits.** It cannot see a visitor who is blocked on every send (I). A whole-country DNS block like India's, or a total block, stays invisible. A per-country or per-day drop against a trailing baseline is the only signal for that (I).
- **ADRs.** A contract change. It needs an ADR 0012-style event-shape revision, and possibly an `event_is_valid` migration, in the analyst's own child (I). ADR 0001, 0005 and 0008 are unchanged.
- **Accounts and paid plans.** None.
- **What it does to #257.** Nothing, except one more property in the dictionary.

## Per-layer switch triggers

| Layer | Stay while | Switch when | To |
|---|---|---|---|
| Collection | junk rows passing every bound stay under a few percent of `events_clean`, **and** measured delivery loss stays low | junk above a few percent (ADR 0005's trigger), **or** delivery failures above 5% of sessions for two weeks, **or** a country-level block recurs | a Vercel function with a challenge in front of the same table: ADR 0005's escalation, which changes ADR 0001 |
| Collection, a complement | the roadmap asks nothing needing replay, flags or an experiment UI | #259 (A/B) needs flags or a no-code experiment UI | PostHog in cookieless mode, alongside the Supabase write, never instead of it |
| Storage | database size under about 400 MB of 500 MB | about 400 MB (at 100x, within weeks), or the owner wants backups | Supabase Pro, $25 a month: the cheapest step. **Owner's hands** |
| Analytical copy | snapshot under about 50 MB | over 50 MB (#257's own rule) | monthly Parquet partitions (#257) |
| Learner file hosting | snapshot egress under 5 GB a month | over 5 GB a month from downloads (at 100x: about 100 learners pulling a 200 MB snapshot, I) | Cloudflare R2, which has no egress fees and a free 10 GB (Vs, [R2](https://www.cloudflare.com/products/r2/)), or #257's option 4 (Hugging Face). **Owner's hands**: a new account |
| Transform | the model is events-only, with no shared derived logic | **the first derived table or shared definition** (sessions, orders, first-seen), which the analyst child is likely to propose | dbt, as Change 1 |
| Transform version | dbt-core 1.x is maintained | 1.x loses support before dbt v2's DuckDB adapter covers Postgres attach and external Parquet | SQLMesh (now a Linux Foundation project) or dbt v2 |
| Warehouse | a learner-facing query runs in seconds on DuckDB-WASM | a query the roadmap needs cannot run in a browser tab, or the owner wants live (not daily) modelled data | Supabase ETL to Analytics Buckets (on Pro) or BigQuery. Not Snowflake or Databricks, whose value here is curricular |

## Where the owner-named tools *do* belong: in the curriculum, not the infrastructure

This is a finding more than an option. #257 publishes Parquet, and Parquet loads into every warehouse named here:

- BigQuery's sandbox is free with no card (Vs);
- Snowflake's trial is 30 days and $400 (Vs);
- Databricks Free Edition is $0 (Vs);
- MotherDuck's free tier is $0 (Vs).

So **"load this week's snapshot into the warehouse your target job uses, and rebuild M3 there"** is an exercise for every learner, at no cost to the owner (I). GA4's schema is taught by the public sample dataset (Vs). dbt is the one tool whose value depends on this site running it, because the models *are* the teaching material (I). That asymmetry is the whole recommendation.

## Searches, including the ones that came back empty

- **Vendor pages directly.** Blocked by the egress proxy for every vendor domain listed at the top. GitHub was reachable, so vendor docs repositories were used where they exist: `supabase/supabase`, `PostHog/posthog.com`, `duckdb/*`, `dbt-labs/*`, `easylist/easylist`, `disconnectme/*` and `github/docs`. Vercel, Google, Snowflake, Databricks and MotherDuck publish no docs repository that was found.
- **`supabase.co` on blocker lists.**
  - Searched: "supabase.co blocked by ad blocker uBlock Origin EasyPrivacy rest/v1".
  - Found only dashboard-UI reports and the magic-link redirect issue ([supabase/auth-js #792](https://github.com/supabase/auth-js/issues/792)). Also the India DNS block.
  - No blocker list entry and **no published measurement** of loss on Supabase writes.
- **EasyPrivacy tracking-servers list and Disconnect.** Both were read truncated. The absence of `supabase` is therefore an inference, not a verification.
- **A primary measurement of GA4 blocker loss** not produced by a competing vendor: none found. Plausible's is the most cited, and Plausible sells the alternative.
- **Vercel Web Analytics' Hobby reporting window:** not stated in any extract read.
- **Snowflake X-Small credit rate and Databricks serverless DBU price** on a primary page: not reached.
- **dbt v2's DuckDB adapter.** Whether it supports attaching Postgres and external materialisation: not stated in DuckDB's announcement.
- **The dbt v2 Postgres adapter timeline:** none found. The issue is open with `triage:product`.
- **People who chose dbt for a small project and regretted it.** Found one:
  - [a $500K migration report](https://medium.com/@reliabledataengineering/we-spent-500k-on-dbt-now-everything-takes-longer-2be4f00103d3), whose regret was scale (1,847 models).
  - Also the "you don't need dbt, you need better SQL" line of criticism.
  - No report was found of regret at a size like this site's, which is either safe ground or unexamined ground.
- **Critics of dbt's direction.** Found: the ELv2 licence on Fusion, and [Tobiko's "Is dbt Fusion the death of dbt Core?"](https://www.tobikodata.com/blog/dbt-fusion-death-of-dbt-core), written by a competitor that is now a Fivetran sibling. This is why dbt-core 1.x is pinned above.
- **Job-market data.** Only single-author posting analyses on dev.to were found, with the method not checked. No independent survey was read.

## Recommendation, the case against it, and what would flip it

**Recommendation.**

- Keep collection and storage as they are: Supabase direct insert, Supabase Postgres.
- Treat #257's Parquet plus DuckDB as the analytical warehouse.
- Adopt dbt Core 1.x with dbt-duckdb inside #257's daily export as soon as the analyst's model has a derived table.
- Teach GA4, BigQuery, Snowflake and Databricks as exercises on the published snapshot, not as infrastructure.

**It needs no new account and no paid plan now.**

**The strongest argument against it, which I went looking for:**

- **The job market rewards the named warehouses, and this stack does not show them.** Snowflake (31%), Databricks (29%) and dbt (24%) are the common tools in data-engineer postings. dbt, Snowflake and Looker are the analyst CV additions with the biggest pay effect (Vs, secondary). And GA4 is likely the first analytics tool many product and marketing analysts touch (I).
- A site whose premise is transferable skills, but which runs on Postgres and DuckDB, asks learners to take on trust that the SQL transfers.
- Beside that, three other costs:
  - dbt adds a Python toolchain and a second place logic lives, for a data set of a few MB. Its critics' "better SQL" argument applies with full force at 17 queries.
  - The single-vendor dependence on Supabase already cost a country's events for 8 days in 2026, and the site could not tell.

**What would flip it:**

- **The owner decides learners must see GA4 data from this very site, and accepts a consent banner.** Add GA4 as a *second* collection stream beside Supabase, never instead of it. Publish its BigQuery export as a GA4-schema snapshot. This changes About, and adds cookies and a new outbound destination (owner's hands: a Google Cloud project with billing, to escape the 60-day expiry).
- **The owner wants a hosted warehouse on show as part of the curriculum**, and accepts about $10-30 a month or the non-commercial terms. Snowflake or Databricks after the Action, fed from the same Parquet. The layers above stay as they are.
- **The analyst's model stays events-only**, with no shared derived logic. dbt is not worth its toolchain yet. Keep hand-written SQL, and wait for the transform trigger.
- **dbt-core 1.x support lapses before dbt v2 covers this design.** Use SQLMesh.
- **Measured delivery loss passes the collection trigger.** Put a function in front of the same table (ADR 0005's escalation). That is the one route here that changes ADR 0001.
