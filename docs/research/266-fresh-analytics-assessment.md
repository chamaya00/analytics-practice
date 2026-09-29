# #266: A fresh senior-analyst assessment of the site's measurement, then a reconciliation with #219

**Decision this serves.** What #264's analyst child rewrites the measurement design around: which parts of today's instrumentation, data model and metrics to keep, change or drop, judged against the decisions `docs/roadmap.md` puts on the table (the north star, the input metrics, directions A-F and the guardrails).

Parent: #264. Issue: #266. Companion: #267 (which vendor or warehouse holds the data). This document is about *what* to measure and model. Where an answer depends on the tooling, it says so and leaves the choice to #267.

## How this document was written, and what it could not avoid

The issue's order is the point, so here it is plainly.

- **Part 1 (the assessment) was written before opening** `docs/measurement/219-analytics-readiness-contract.md`, `docs/measurement/219-launch-queries.sql`, ADR 0012 or ADR 0013, and before searching their contents.
- **Read for Part 1:** every page in `src/pages/`, the screen modules in `src/lib/` that fire or shape events (`tracking.ts`, `tracking-transport.ts`, `acquisition.ts`, `order-store.ts`, `home-dom.ts`, `flash-deal.ts`, `eta.ts`, `menu-dom.ts`, `checkout-dom.ts`, `tracker-dom.ts`, `delivery.ts`, `sign-in-events.ts`, `thanks-voucher.ts`), `src/components/Header.astro`, `docs/roadmap.md`, ADR 0005, ADR 0008, the `instrumentation` skill, and the store's migrations `20260925000000_events.sql` in full plus the `events_clean` definition in `20261002000000_session_started_and_is_internal.sql`.
- **#219's framing leaked in anyway, through three doors.** They are named so a reader can discount for them:
  1. The parent issue #264 names `session_started`, `is_internal`, `events_clean`, M1-M17 and §10's "not logged" list.
  2. `docs/roadmap.md` carries a table of M1-M17 with one-line meanings.
  3. The code comments in `tracking.ts`, `acquisition.ts` and `checkout-dom.ts` cite "#219 contract §4/§6/§8" and ADR 0013.

  None of those gave definitions, queries or reasons. The M-numbers below are used only where the roadmap already uses them, and the assessment's own metric definitions are written from the code.

### What the issue fixed, and what it only guessed

Per `research-craft`:

- **The decision** is above.
- **The constraints**, all checked:
  - The #79 rule (ADR 0008): no email, account id, auth user id or wallet field in any event. [ADR 0008](../decisions/0008-play-money-wallet-and-sign-in.md), "Identity and the build".
  - The store is write-only for browsers and silently drops shapes it does not know. [ADR 0005](../decisions/0005-hosted-event-store.md) §1-§2.
  - The site has no server of its own. ADR 0001.
  - Migrations are additive, and the store keeps accepting every old shape (#264, "For the orchestrator").
- **The guesses:**
  - That the answer is "events-only vs entity and dimension tables". This is one axis of several.
  - That M1-M17's *definitions* are the weak point. Some are, but the larger problems sit upstream of any definition: what `session_id` and "delivered" actually mean in this code.
  - That experiments are a matter of filling in `variant`. At soft-launch traffic the binding constraint is the number of units, not the column.

---

## Part 1: Assessment (written before reading #219)

Seven findings drive most of what follows. Each is verified against code or a primary source unless marked.

1. **Every order is delivered, by construction.** `pickDeliveryMs` draws a delivery time at or before half the ETA ([`order-store.ts` `pickDeliveryMs`](../../src/lib/order-store.ts)). `isDelivered` is a pure function of time. No code path cancels an order: the only "cancel" controls in `tracker-dom.ts` close the tip panel or keep a cart. So `order_delivered` does not measure fulfilment. It fires only when the visitor opens `/tracker/` after the delivery time: `checkDelivery` is called from `tracker-dom.ts` and nowhere else ([`delivery.ts`](../../src/lib/delivery.ts)). **Any "completion rate" built on it measures return-to-tracker, not fulfilment.** The roadmap uses completion as a guardrail, and a guardrail that cannot fail for the reason it names is not guarding anything.
2. **`order_placed` does not say which restaurant.** Its 14 keys ([`checkout-dom.ts`](../../src/lib/checkout-dom.ts), `writeOrderAndTrack`; [`tracking.ts`](../../src/lib/tracking.ts), the `order_placed` case) carry city, amounts, vouchers and checkout choices, and no `restaurant_slug`. Carts are per restaurant, and a browser can hold several carts. So restaurant-level conversion can only be guessed from the last `restaurant_opened` in the session. That is an inference, and an ambiguous one.
3. **The site already runs a randomised experiment, and logs it with its treatment missing.**
   - Each tab-session draws, per city ([`flash-deal.ts`](../../src/lib/flash-deal.ts), `drawFlashDeal`):
     - an amount, at random from five steps;
     - 5 or 6 restaurants, at random;
     - for each of those, a fee mode (`free` or `reduced`), at 50/50.
   - The draw is shown to everyone on their first home view in that tab and city (`home-dom.ts`, `isNewDraw`).
   - `flash_sheet_shown` logs the amount and the slugs, but **not the per-restaurant fee mode**. The one fully randomised treatment on the site cannot be read, for want of one array.
4. **`session_id` is a tab, not a visit.** It lives in `sessionStorage` with no timeout ([`order-store.ts`](../../src/lib/order-store.ts) `getSessionId`). Per MDN, "opening a page in a new tab or window creates a new session", while "duplicating a tab copies the tab's sessionStorage" ([MDN, `Window.sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)). So:
   - a visitor who opens two tabs has two sessions;
   - a phone tab left open for three days is one session.

   Neither matches the 30-minute-inactivity convention that GA4 and Amplitude use ([GA4 session docs via Google Analytics Help](https://support.google.com/analytics/answer/12798876?hl=en); [Amplitude, "Track sessions"](https://amplitude.com/docs/data/sources/instrument-track-sessions)).
5. **`visitor_id` is a browser, and on Safari a short-lived one.** It is a random uuid in `localStorage` (`getVisitorId`). WebKit's ITP deletes "all of a website's script-writable storage after seven days of Safari use without user interaction on the site", LocalStorage included ([WebKit, "Full Third-Party Cookie Blocking and More"](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). A Safari visitor who returns after eight idle days comes back as a new visitor. The older, general version of this problem, users clearing their own storage, was measured by comScore: 31% of US users cleared first-party cookies in a month, overstating unique visitors by up to 2.5x ([comScore, 2007](https://www.comscore.com/Insights/Press-Releases/2007/04/comScore-Cookie-Deletion-Report)). That number is old and PC-only, and is cited for direction, not size.
6. **Loss is silent at every layer, and no layer counts it.**
   - The client validator drops a malformed call without a trace (`track()` in `tracking.ts`).
   - The store's RLS check refuses unknown shapes, and the client swallows the error (`tracking-transport.ts`, `.catch(() => {})`).
   - The per-IP rate limit raises an exception. That rolls back its own `write_log` insert, so a refused write leaves no row anywhere (`20260925000000_events.sql`, `enforce_write_rate_limit`).
   - `occurred_at` comes from the device clock, and the store refuses any row more than 5 minutes ahead of `received_at` (ADR 0005 §1). A phone whose clock runs 6 minutes fast sends nothing that lands.
   - The bot filter's `/bot/i` pattern matches phones whose user agent names a CUBOT device, for example `CUBOT KING KONG` ([user-agents.net](https://user-agents.net/string/mozilla-5-0-linux-android-7-0-cubot-king-kong-applewebkit-537-36-khtml-like-gecko-chrome-80-0-3987-132-mobile-safari-537-36)). Chrome has sent the fixed model `K` since Chrome 110-114 ([Privacy Sandbox, "Prepare for Chrome's user-agent reduction"](https://privacysandbox.google.com/blog/user-agent-reduction-android-model-and-version)), so this now affects only other browsers on those phones. It is small, and it is exactly the kind of small that nobody would ever see.
   - A paused free project refuses every insert until the owner resumes it ([Supabase, "Project Pausing"](https://supabase.com/docs/guides/platform/free-project-pausing)).
7. **The #79 rule holds by policy, not by construction, for the owner.** The `orderId` is created before the wallet debit and is the debit's idempotency key (ADR 0008, "Source of truth"). The same uuid is `order_placed.order_id`. So `private.wallet_debits.order_id = events.props->>'order_id'` joins an event stream to an account, for anyone who can read `private`. About says the balance is "never joined to the random browser ID". That is a promise the owner keeps, not an impossibility. Learners are not exposed by it: `private` is never published. But see the snapshot note under "Storage model".

### Questions worth answering

A senior analyst joining this product would want to answer these, in this order, because each one gates a roadmap decision:

| # | Question | The decision it gates |
|---|---|---|
| Q1 | Where does the loop leak, per browser: home → restaurant → cart → checkout → order? | D, and the order of A-F generally (M4 is the roadmap's primary metric). |
| Q2 | Does anyone come back within a week, and after what: an order, a drip, a thanks voucher? | North star; A (Pro needs repeat users); B (referral needs returning users). |
| Q3 | Which sources bring browsers that order? | B, E and the LinkedIn launch itself. |
| Q4 | What does the sign-in step cost in orders, separated from the wallet being dark or unreachable? | D. |
| Q5 | Do the incentives change behaviour causally: the flash deal's amount and fee mode, vouchers, the thanks voucher? | C (a promo slot vs an ad slot), and F (whether the site can learn anything causal today). |
| Q6 | Which restaurants and cities convert, and did a content launch move anything outside its own city? | E, and C's promo slides. |
| Q7 | Is the data trustworthy enough to act on: loss, bots, the owner's own traffic, clock skew? | Every one of the above. |
| Q8 | Can an experiment reach a readable result at this traffic, and on which unit? | F. |

**Recommendation.** Treat Q7 as a prerequisite, not a footnote. Every other number is read through it, and today it cannot be answered at all (finding 6).

**Rejected alternative: engagement-depth questions** (time on page, scroll depth, dwell on menus). This was live: it is what most analytics setups start with, and the carousel and menus invite it. It lost because no A-F decision turns on it. The instrumentation skill's test, "would knowing this change what somebody does next", comes back empty.

**Rejected alternative: "Is the product fun?" as a rating-led question.** Ratings exist, but in a parody they rate simulated food. They measure engagement with the rating sheet, not satisfaction, and no direction targets them.

### What to log

What fires today, read from the code, not from any contract: `session_started`, `location_selected`, `home_viewed`, `restaurant_opened`, `cart_viewed`, `checkout_viewed`, `flash_sheet_shown`, `flash_sheet_closed`, `order_placed`, `tracker_viewed`, `order_delivered`, `rating_submitted`, `driver_rating_submitted`, `tip_sent`, `sign_in_prompt_shown`, `sign_in_started`, `sign_in_completed` and `wallet_short_shown` (`EventName` in `tracking.ts`, and the `track(` call sites).

**Recommendation: keep all 18, add the minimum below, retire nothing.** The screen-view events are the funnel's spine, and the funnel is the primary metric. The outcome events are what the flows exist to produce. The skill's rule applies: "when only one thing can be logged, log the outcome". The additions, each tied to the question it answers:

| Addition | Where | Answers | Why it is the cheapest route |
|---|---|---|---|
| `restaurant_slug` | `order_placed` props | Q1, Q6; E; C's promo slides | The order already knows its restaurant (`placeOrder`'s `restaurantSlug`). Guessing it from the session's last menu view is ambiguous with several carts. |
| `fee_modes` (array, parallel to `restaurant_slugs`) | `flash_sheet_shown` props | Q5; F | The draw already holds it (`FlashRestaurantDraw.feeMode`). Without it the site's only randomised treatment cannot be analysed. |
| `seq` (an integer counter per `session_id`, starting at 1) | envelope column | Q7 | The only way to *measure* loss from the data itself. See "Data quality". |
| `build` (the deploy's commit id, set at build time) | envelope column | Q6; judging any launch | "Before vs after" should split on which code produced an event, not on the clock. Open tabs keep running the old build after a deploy. |
| `drip_claimed` (props: `city`, `surface`) | new event | Q2; A | The drip is the site's own come-back mechanic, and nothing records that anyone uses it. |
| `payment_path` (enum: `wallet`, `wallet_off`, `wallet_unreachable`) | `order_placed` props, beside `wallet_paid` | Q4; D | `wallet_paid = false` today conflates a dark wallet with ADR 0008's D1 fallback. The two mean opposite things for D. |

Every addition puts new data into the store, so each is a **privacy call**. The table under "New data about visitors" gives the field, why it does not break the #79 rule, and the flag.

**Not logged, on purpose, with the reason** (the skill: "an omission that was decided reads completely differently from one that was overlooked"):

- **Add-to-cart taps.** `cart_viewed` with `item_count > 0` answers "did they build a basket", and no direction turns on the step between. Revisit only if E becomes "bigger menus" and needs item-level demand.
- **Search text and cuisine-chip taps.** Search is free text, and the site logs none. Chip taps serve no decision.
- **Carousel slides.** #204 is redesigning the slot, so wiring now means wiring twice (O4 on #265; the #79 rule). Named for C below.
- **Displayed ETA.** It is a deterministic hash of `visitor_id` and slug ([`eta.ts`](../../src/lib/eta.ts)), so the owner can recompute it in SQL. That makes it a second natural experiment (does a shorter promised ETA get more opens?), but no roadmap decision asks that question.
- **The drawn delivery time.** It would make actual delivery time derivable. No decision needs it, because finding 1 makes delivery certain.
- **The order total.** When the wallet pays, the total *is* the debit amount, a wallet field under #79. `amount_minor` (the subtotal) stays the order-value measure. Play-money totals are not the roadmap's business metric anyway: revenue per 1,000 visitors is about real money, from ads or Pro.
- **A device or browser class on `session_started`.** Tempting, both for mobile-vs-desktop conversion and for estimating how much ITP (finding 5) biases retention. It lost because no A-F decision needs it, and each new coarse attribute makes a row more recognisable at launch volumes. Recorded here so it is not re-proposed without a decision.
- **Opening the Offers screen, the order-placed page, order history, "Order again", the thanks voucher's unlock, VIP level-ups.** Their outcomes are already in `order_placed`: applied vouchers, the thanks voucher amount, `vip_level`. The steps in between serve no named decision.

**Rejected alternative: log every interaction (autocapture) and decide later.** This was live: it is the default in PostHog and Heap, and it would answer questions nobody has thought of yet. It lost on three counts:

- The store's design point is that it refuses shapes it does not know (ADR 0005 §2), and autocapture's shapes are open-ended.
- The 60-writes-per-5-minutes limit would be exhausted by one active browser (see "Data quality").
- It is the skill's first named failure: "logging what is easy to capture".

### Event taxonomy and naming

**Recommendation: keep the existing convention, write it down, and apply it to new events.** Every event is `object_action`, past tense, snake_case (`order_placed`, `flash_sheet_closed`). That is Segment's object-action framework ([Twilio Segment, "Data Collection Best Practices"](https://www.twilio.com/docs/segment/protocols/tracking-plan/best-practices)) with snake_case event names instead of Segment's Title Case. The rules for any new event:

1. `object_action`, past tense, and one event per outcome, not per control.
2. Props are snake_case. Amounts are integer `*_minor` plus a `currency`. Enums are closed, and the store checks them.
3. A prop that exists on one event means the same thing on every event (`city`, `surface`, `order_id`).
4. Post-order events (`tracker_viewed`, `rating_submitted`, `driver_rating_submitted`, `tip_sent`) join to their order by `order_id`. They do not repeat the order's context, such as city.

**Two naming wrinkles, both kept:**

- `rating_submitted` is the restaurant rating, beside `driver_rating_submitted`.
- `wallet_short_shown` fires on the tip surface too.

Renaming costs a contract revision, a cut-over date and a two-name union in every historical query (O3 on #265), and buys only readability. A view can alias it: `learner.events` could expose a `restaurant_rating_submitted` alias if learners trip on it.

**Rejected alternative: Segment's Title Case with spaces ("Order Placed").** It is the most widely copied convention. It lost because it would rename all 18 events for no analytic gain, and SQL identifiers with spaces are hostile to the beginners this site teaches.

**Rejected alternative: one generic `screen_viewed` event with a `screen` prop,** replacing the five `*_viewed` events. It is live because it shrinks the event list and makes "all page views" one filter. It lost because each view carries different props, and the store validates props per event name (`event_is_valid`). Folding them together would either weaken validation to "any of five shapes", or move the per-screen check into a prop-dependent branch that is harder to test.

**Rejected alternative: a `schema_version` column.** Additive shapes differ by key set, and the store checks exact key sets, so the key set already identifies the version. A version column would restate it and could disagree with it.

### Storage model

The model is in question, so there are four candidates, one discarded option, and a tooling dependency stated at the end.

**S0. What is here: one append-only `events` table, JSON `props`, and an `events_clean` view.** It is immutable (`anon` has no update or delete grant), idempotent (a client `id` primary key), validated per event, and queryable with plain Postgres. Its weaknesses are three:

- Every entity question (an order, a session, a visitor's first touch) is re-derived in each query, and each query can derive it differently.
- Catalogue attributes (restaurant cuisine, price level, launch date) live only in TypeScript.
- JSON access is noisy for beginners.

**S1. Events stay the only written truth. Entities are derived views, and dimensions are exported from code.** *Recommended.*

- **Derived views over `events_clean`:**
  - `orders`: one row per `order_id`. It takes `order_placed`'s props, then left-joins the first `order_delivered`, `rating_submitted`, `driver_rating_submitted` and `tip_sent`.
  - `sessions`: analytic sessions (see "Identity and sessions").
  - `visitors`: first seen, first-touch source from the earliest external `session_started`, and first order.
- **Dimensions** (`dim_cities`, `dim_restaurants`, `dim_menu_items`, `dim_vouchers`, `dim_drivers`) are generated from `src/lib/restaurants.ts`, `catalogue-*.ts`, `vouchers.ts` and `drivers.ts`, with `valid_from` and `valid_to` per version. The roadmap already sketches this ("Catalogue dimensions may not need a database table at all").
- **Costs:** view SQL, and a code-to-file export step. No new write path, no new RLS, and nothing new a browser can send.
- **What it rules out:** state the browser knows but never logs cannot appear in a view. That is why `restaurant_slug` has to go on `order_placed`.
- **What would have to be true for it to be right:** every fact an entity needs is emitted as an event at the moment it happens. Today that holds, except for `restaurant_slug`.

**S2. Browser-written entity tables beside `events`,** for example an insert-only `orders` or `order_lines` table. This was live: it gives typed columns and item-level lines that the 1 KB `props` cap would squeeze, and the roadmap anticipates `learner.orders`. It lost for now:

- It is a second write per order. A partial failure (the event lands, the order row does not) creates two truths about one order.
- Each table needs its own validator, RLS policy and rate-limit accounting.
- `anon` cannot update, so an order's later state (delivered, rated, tipped) is still events. The table would hold only what `order_placed` already holds.

It becomes right if and only if item-level basket analysis becomes a decision, for example E choosing to grow menus. Even then the cheaper first step is a bounded `item_ids` array on `order_placed`.

**S3, the candidate nobody asked for: formally adopt the Activity Schema.** Its spec defines one time-series stream per entity, with `activity_id`, `ts`, `customer`, `activity` and `feature_json` ([ActivitySchema 2.0 spec](https://github.com/ActivitySchema/ActivitySchema/blob/main/2.0.md)). **The site's `events` table already is one**, under other column names. The finding cuts both ways:

- **It validates S1.** Spec 2.0 dropped its own "enrichment tables" because "there's no real benefit to maintaining an activity schema-specific approach" over ordinary dimension joins. That is S1's dimensions.
- **Adopting it literally loses.** Renaming columns buys nothing and costs history.
- **One idea is worth taking:** a derived `activity_occurrence` (this browser's nth `order_placed`, and so on) in the learner view. It makes "first order" and "repeat order" one-line filters for beginners.

The critique found: a single stream per entity fits poorly where facts relate two entities at once, and practitioners comparing it with modular dimensional modelling note the stream multiplies activity definitions ([sqlpatterns, "Modular Dimensional Data Modeling"](https://sqlpatterns.com/p/modular-dimensional-data-modeling)). Neither bites here: there is one entity (the browser), and 18 activities.

**S4 (discarded).** Typed per-event tables, Snowplow's "shredded" layout ([Snowplow, "Introduction to Snowplow entities"](https://docs.snowplow.io/docs/fundamentals/entities/)). Eighteen tables, each with grants, RLS and validators, for rows under 1 KB that `event_is_valid` already type-checks.

**A note on learners' snapshots, found while reading the roadmap.**

- The export design re-keys "every uuid column in every table" with a per-run salt, so that "against the ids in a visitor's own browser, nothing matches" (`docs/roadmap.md`, "Re-keying").
- `order_id` is a uuid inside `props`, not a column. As worded, it would be published raw.
- A visitor's own `parody.orders` in `localStorage` holds their order ids. That lets them find their rows, and through `visitor_id`, all their rows in that snapshot.
- The fix is to re-key uuid-valued props too, or to publish `order_id` only through a view that re-keys it.
- This is #257's design, not #264's build. It is flagged here as a **privacy call** because it changes what learners can see.

**Depends on #267.** Whether S1's views live as Postgres views, as dbt models, or in a warehouse is #267's call. S1 is written so that any of those can hold it: plain SQL over one immutable table and a handful of dimension files.

### Identity and sessions

**Visitor identity. Recommendation: keep the anonymous `visitor_id`, call it what it is ("browser"), and define every retention metric inside a 7-day horizon.** Finding 5 means a retention window longer than 7 days measures ITP as much as behaviour on Safari. The north star is weekly, so it survives.

**Rejected alternative: link browsers into people through sign-in.** For example, a hashed auth user id as a person key on events. This was live: it would fix cross-device and ITP churn for the signed-in minority, and ADR 0008 left "linking the two" to the analytics-readiness objective. It lost outright, because it puts an account-derived identifier into events, which the #79 rule forbids (#264: "A proposal to join events to accounts is out of scope and comes to the owner").

**Rejected alternative: a first-party cookie set by a server,** which ITP treats differently from script-written storage. It lost because the site has no server (ADR 0001), and adding one to lengthen an id's life is a category change bought for a metric.

**Sessions. Recommendation: stop treating `session_id` as the analytic session.** Keep sending it unchanged, and read it as a tab id. It remains the right key for per-tab things: `session_started`'s acquisition, the flash draw, the sign-in round trip. Define the analytic session in SQL instead: a new session starts at a browser's first event, or after 30 minutes with no event (GA4's default and Amplitude's recommended default, cited above). No client change, and nothing new stored.

```sql
-- Sketch: analytic sessions over one browser's events, ordered by server time.
select *, sum(case when gap is null or gap > interval '30 minutes' then 1 else 0 end)
          over (partition by visitor_id order by received_at, seq) as session_number
from (select *, received_at - lag(received_at) over (partition by visitor_id order by received_at, seq) as gap
      from events_clean) e;
```

**Rejected alternative: move `session_id` to `localStorage` with a 30-minute inactivity expiry, GA-style.** It is live and conventional. It lost because it changes the meaning of a column that historical rows were written under, which would need a cut-over date for every session metric. It would also break the per-tab uses above, and it gives nothing the SQL definition does not.

**Rejected alternative: count sessions as `session_started` events.** That makes the tab the unit. It overcounts multi-tab visits, undercounts long-lived mobile tabs, and makes "sessions per day" a browser-behaviour artefact.

**The owner's traffic.** `events_clean` drops every row of any browser that ever sent `is_internal = true` (the `20261002` migration). That is right for the owner's own devices, *once each is marked*. It is silent for any device the owner never visited with `?internal=1`. Recommendation: keep it, and add a manual check to the launch runbook ("mark every device you own before sharing the link"). This is a process fix, not a data one.

### Data quality and silent loss

**Recommendation: make loss measurable before making anything else precise.** Three changes, in order of value:

1. **A per-session sequence number (`seq`) on every row.** Gaps within a `session_id` count lost events, and the size of each gap is the number lost. This is the standard method: "Trustworthy Experimentation Under Telemetry Loss" ([arXiv 1903.12470](https://arxiv.org/pdf/1903.12470)) describes exactly this counter, a sequence number persisted on the client where "a gap in sn indicates that a client event has been lost". The quote comes from a search extract, because arXiv was not fetchable from here. Snowplow's `client_session` entity carries an `eventIndex` for the same purpose ([Snowplow iglu schema](https://github.com/snowplow/iglu-central/blob/master/schemas/com.snowplowanalytics.snowplow/client_session/jsonschema/1-0-1); [Snowplow session docs](https://docs.snowplow.io/docs/sources/web-trackers/tracking-events/session/)), and GA4 sends a per-session sequence number too (secondary source, in the same search).
   - It catches every loss after the counter increments: the validator, the store, the rate limit, the clock bound, the network.
   - It misses loss before the counter, and the last events of a session (a tail with no later event has no gap to show).
   - It is one integer.
   - The counter increments in `track()` *before* validation. So a call the client validator drops also leaves a gap, and client-side contract bugs become visible in production.
2. **Count the store's refusals.** Today a rate-limited write rolls back its own log, and an RLS refusal leaves nothing. A `private.write_refusals (day, reason, event_name, count)` table, fed by a BEFORE trigger that *skips* a refused row (`return null`) instead of raising, would let the owner see refusals at all.
   - Postgres documents that WITH CHECK expressions "are enforced after BEFORE triggers are fired" ([PostgreSQL, CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html)). So a trigger that validates first can log and skip before RLS would have raised.
   - **Inferred, not tested.** An engineer should prove it in PGlite (ADR 0006) behind its own issue, because it changes how refusals behave.
   - It stores no payload and no IP, only counts.
3. **Window counts on `received_at`, and order events within a session by `(occurred_at, seq)`.** `occurred_at` is stamped by the device clock at send time (`buildEventRow` in `tracking-transport.ts`), so it adds only clock skew over `received_at`. `received_at` is the server's clock, so a day counted by `received_at` is final at midnight UTC and reproduces exactly from any later snapshot. The roadmap's worry that "yesterday can still gain a few late rows" is a consequence of windowing on event time. **Inferred** from the code: the gap between the two should be seconds. The analyst should confirm it on real rows (`percentile_disc` of `received_at - occurred_at`).

**Named risks, sized as far as the evidence allows:**

- **The rate limit and shared IPs.**
  - The limit is 60 writes per IP per 5 minutes (ADR 0005 §4).
  - One browser's full loop (home, menu, cart, checkout, order, tracker, rating, tip) is about 12-15 events. So about four browsers doing the loop at once behind one address exhaust it. That count is inferred from the call sites.
  - Mobile carriers put many subscribers behind one public IPv4 address. A recent measurement study found carrier-grade NAT at all 14 European mobile providers it tested. That finding came through a search extract that did not make clear which of two arXiv papers it came from ([2403.08507](https://arxiv.org/pdf/2403.08507), [2605.10812](https://arxiv.org/pdf/2605.10812)), and neither was read in full. It is treated as direction, not size.
  - A LinkedIn launch read on phones is where this bites. With `seq`, it shows up as gaps clustered in time. Without it, it is invisible.
- **The clock bound.** It is invisible today. `seq` would show it as sessions with no rows at all, which is unhelpful. The refusal count (change 2) would show it directly.
- **The bot filter's false positives** (finding 6) and its false negatives. Headless browsers that spoof a normal user agent pass straight through. `events_clean` has no rate- or sequence-based exclusion yet, although ADR 0005 §5 anticipates one.
- **The project pausing.** Covered by the roadmap's daily export job, which queries the store every day.

**Searched for, not found:** any report of EasyPrivacy or uBlock Origin blocking `*.supabase.co/rest/v1` requests. Nothing either way ([uBlock privacy wiki](https://github.com/gorhill/uBlock/wiki/Privacy-stuff) says nothing specific). This is the assumption most worth testing with one ad-blocked browser before launch. If it is blocked, the site's audience of analysts, who skew towards blockers, is undercounted in a way no event can reveal.

**Rejected alternative: server-side collection (a function in front of the store)** to escape ad blockers and client loss. It was live: it is the standard answer to client-side loss. It lost because ADR 0001 and ADR 0005 both chose no server, and ADR 0005 names this exact path as its escalation "if a bot challenge becomes necessary". Loss has not been measured yet, so there is nothing to justify escalating.

### Metric definitions

**Recommendation: rebuild the metrics on four rules, then define them.**

1. **The unit is the browser (`visitor_id`), named "browsers" in every label.** Rates are per browser within a window, not per session. This makes them immune to tab semantics (finding 4) and to `checkout_viewed` firing twice on a sign-in return (ADR 0008, "Existing events").
2. **Windows are at most 7 days for anything that needs a browser to come back** (finding 5). Counts window on `received_at` (see "Data quality").
3. **An order is a distinct `order_id` from `order_placed`.** Never count raw rows: the primary key stops exact retries, but not a second `track()` call.
4. **Report the count beside every rate,** as the roadmap already requires.

The definitions that follow from them. Names are descriptive, and the analyst numbers them:

- **North star: weekly ordering browsers.** Distinct browsers with at least one `order_placed` in the ISO week. It is "placed", not "completed", because completion is certain (finding 1).
- **Checkout conversion (the primary input):** of browsers with `checkout_viewed` in the window, the share with an `order_placed` within 24 hours of their first `checkout_viewed`. The funnel version runs the same browser-level logic over `home_viewed` → `restaurant_opened` → `cart_viewed` (with `item_count > 0`) → `checkout_viewed` → `order_placed`. A step counts only if it follows the previous step for that browser within the window.
- **Returning share:** of browsers first seen in week *w*, the share with an event on a later calendar day within 7 days of first seen. An "ever returned" definition would be at the mercy of ITP and of how long the store has run.
- **Orders per returning browser:** `order_placed` count ÷ returning browsers, same window.
- **First-touch source:** the `referrer_host` and `utm_*` of a browser's earliest `session_started` whose `referrer_host` is not `(self)`.
- **Tracker return rate** (it replaces any "completion" guardrail): of orders placed, the share with an `order_delivered`. Named for what it measures. It is an engagement metric, not a fulfilment one, and it should not be a guardrail.
- **Rating rate:** of orders with `order_delivered`, the share with `rating_submitted`. That is the correct denominator, because the prompt appears only in the Delivered state.
- **Sign-in funnel (D):** per browser in the window: `sign_in_prompt_shown` → `sign_in_started` → `sign_in_completed` with outcome `success` → `order_placed` within 1 hour. `payment_path` separates the D1 fallback.
- **Short-balance block rate (A):** browsers with `wallet_short_shown` at the checkout surface ÷ browsers with `sign_in_completed` success or `payment_path = 'wallet'`. **Recovery** is the share of those with `order_placed` within 24 hours.
- **Loss rate (data quality):** `sum(gap sizes) ÷ (rows + sum(gap sizes))` per day, from `seq`.

**Guardrails.**

- Checkout conversion.
- The short-balance block rate.
- Loss rate: a launch that raises it is breaking the measurement, whatever else it does.
- The #79 rule.

Completion (finding 1) is dropped as a guardrail.

**Rejected alternative: session-based conversion** ("sessions with an order ÷ sessions"). It is the GA default, and learners will expect it. It lost because a session here is a tab, so the denominator is a browser-behaviour artefact. Even with SQL sessions, a visitor who browses Tuesday and orders Wednesday counts as one failure and one success.

**Rejected alternative: keep "completion" as a guardrail and fix it with a server-side delivery job.** `delivery.ts` imagines one. It lost because the product guarantees delivery, so a truthful completion metric is a constant.

### Experiment readiness

**Recommendation: don't build F's assignment plumbing yet. Make the one experiment the site already runs readable, and write down the traffic threshold at which F starts.**

- **The binding constraint is units, not columns.** Detecting a lift from 20% to 25% (two-sided α = 0.05, power 0.8) needs about 1,090 browsers per arm: (1.96 + 0.84)² × (0.16 + 0.1875) ÷ 0.05² ≈ 1,091, which agrees with the roadmap's "roughly 1,100". A more realistic lift, 20% to 22%, needs about 6,500 per arm. Kohavi's rule of thumb is that below "tens of thousands of users … the statistics just don't work out" for most metrics (as quoted in [GrowthBook's summary of Kohavi and Sonnet](https://www.growthbook.io/blog/lessons-learned-from-ronny-kohavi-and-luke-sonnet-running-trustworthy-experiments), secondary). The threshold for starting F is therefore: weekly browsers reaching checkout × 4 weeks ≥ 2 × the per-arm n for the smallest lift worth acting on.
- **The flash draw is an experiment with a much larger unit count.** Every tab-session gets a draw per city on its first home view. The outcome is `flash_sheet_closed.outcome` and the restaurant tapped, which join to later orders by session. The randomisation happens in the browser with `Math.random`, and each draw is logged at assignment, before the sheet renders: the exposure point the instrumentation skill asks for. So `fee_modes` is the one missing field that turns it into a readable, per-restaurant, 50/50 experiment on "free vs reduced delivery", which is precisely C's "promo vs ad" question in miniature.
- **When F is built, the plumbing the roadmap describes is right,** and four details matter:
  1. **The store accepts no arm at all today.** The first migration checks `variant is null`, and ADR 0005 §1 says the check will list the arm names. Every experiment is therefore a migration before it is a client change.
  2. **Exposure is one event per browser per experiment,** fired at assignment and guarded in `localStorage`. The skill's "re-render and remount" and "firing on read" traps apply.
  3. **ITP resets reassign returning Safari browsers.** That is dilution (a new unit), not contamination, because the arm is a pure hash of the new id.
  4. **The sample-ratio-mismatch check needs exposure counts per arm.** Fabijan et al. treat SRM as "a symptom for a variety of data quality issues" ([KDD 2019](https://dl.acm.org/doi/pdf/10.1145/3292500.3330722)). With `seq` in place, an SRM can be told apart from arm-specific loss.

**Rejected alternative: build F now and run a sequential or Bayesian test to "get around" low traffic.** It is live, because some vendors sell it as the fix for small sites. It lost because neither method creates power. Both change when the analyst is allowed to stop, and at this volume the honest readout is still "inconclusive".

**Rejected alternative: randomise by tab-session for conversion experiments** to get more units. It lost because a browser with two tabs could see both arms, and ordering happens over days (finding 4). The unit must be the browser for anything measured at the order. The flash draw gets away with per-session units only because its outcome, the sheet's close, happens inside that session.

### Roadmap directions A-F: what data would decide each one

| Direction | Data that would decide it | Can today's site produce it? | Cheapest change that closes the gap, or "log nothing" and why |
|---|---|---|---|
| **A. Pro mode (#200)** | How often signed-in browsers come back for coins: drip claims per week, and short-balance blocks and recovery. Willingness to pay needs a price. | **Partly.** `wallet_short_shown` and `order_placed.payment_path`-to-be cover blocks and recovery. Drip claims are not logged. Willingness to pay: no. | **Add `drip_claimed {city, surface}`** (privacy call below). Log nothing for willingness to pay: a "fake door" Pro button is a product change (the #79 rule), and it would contradict "no payment is ever taken" on a site whose premise is honesty with its visitors. |
| **B. Social (#201)** | Share propensity, and how referred browsers convert. | **Partly.** `session_started.referrer_host` and `utm_*` show word of mouth that arrives. No share action exists. | **Log nothing now.** An event for a button that does not exist logs nothing. Zero-code step: the owner tags every link they post with `utm_source`, `utm_medium` and `utm_campaign` (already captured), so organic sharing is separable from the owner's own posts. |
| **C. Real ad in the carousel (#204)** | Taps per slide, by slide type (ad vs promo), and orders downstream of promo-slide taps. The guardrail: home → restaurant click-through. | **No** for slide taps. **Yes** for the guardrail (browser-level `home_viewed` → `restaurant_opened`). Downstream orders need `restaurant_slug` on `order_placed`. | **After #204 merges:** one `carousel_slide_tapped {city, slide_index, slide_type, restaurant_slug or 'none'}` (O4 on #265). **Now:** `restaurant_slug` on `order_placed`, so a promo slide's restaurant can be followed to orders. |
| **D. Lighter sign-in** | Per browser: prompt → start → success → order, with the dark wallet and D1 fallback separated out. | **Mostly.** All three sign-in events exist. `wallet_paid = false` conflates "wallet off" and "unreachable". `checkout_viewed` double-fires on return, which browser-level counting absorbs. | **`payment_path` on `order_placed`** (privacy call below), and browser-level metric definitions. |
| **E. More content** | Conversion by city *and restaurant*, before vs after a content launch, split by the build that produced each event. | **Partly.** By city yes. By restaurant no (finding 2). Before vs after by the clock only. | **`restaurant_slug` on `order_placed`**, a `build` column, and `dim_restaurants` with `launched_at` exported from code (S1). |
| **F. A/B testing (#259)** | Units per week on the candidate unit, baseline rates, a loss rate, and an SRM check. | **Baselines yes. Loss no. Arms no:** the store refuses non-null `variant`. The flash draw is randomised but unreadable without `fee_modes`. | **`fee_modes` on `flash_sheet_shown`** and **`seq`** now. Defer assignment, exposure and the `variant` migration until the threshold under "Experiment readiness" is met. |

### New data about visitors: privacy calls

Every recommendation above that puts new data into the store, with the field, why it does not break the #79 rule (ADR 0008), and the flag for the driver. None puts an email, account id, auth user id or any wallet field into an event or a learner-visible table.

| Field | What it is | Why it does not break #79 | Flag |
|---|---|---|---|
| `order_placed.restaurant_slug` | A catalogue slug, already public in every URL. | Not account data. **Caveat:** with the catalogue's fees, it makes an order's total nearly reconstructable, and a wallet-paid total equals the debit amount. The rule names fields, and no account key is added, so the debit stays unjoinable in events. Learners never see `private`. | **Privacy call** (O2 on #265). |
| `flash_sheet_shown.fee_modes` | `free` or `reduced` per drawn restaurant. | It describes what the site drew, not the visitor. | **Privacy call** (O2), for completeness. |
| envelope `seq` | A per-tab counter, restarting at 1 each session. | A counter, not an identifier. It adds no cross-session linkage beyond `session_id`, which already exists. | **Privacy call** (O2). |
| envelope `build` | The deploy's commit id, the same for every visitor on that build. | Describes the site, not the visitor. | **Privacy call** (O2), for completeness. |
| `drip_claimed {city, surface}` | That a coin drip was claimed, where, and in which city. | No balance, amount or account id, following `wallet_short_shown`'s precedent. **Caveat:** it is wallet-adjacent behaviour, and it reveals that this browser is signed in. `sign_in_completed` already reveals that. | **Privacy call** (O2). The driver should decide whether "an event about the wallet with no wallet field" is inside the rule's spirit. |
| `order_placed.payment_path` | `wallet`, `wallet_off` or `wallet_unreachable`. | No amount, no balance. `wallet_paid` already carries its `wallet` bit. | **Privacy call** (O2). |
| Snapshot re-keying of `props.order_id` (#257) | Re-key uuid-valued props in published snapshots, not only uuid columns. | It *removes* exposure: as worded, the design would publish raw order ids that a visitor can match to their own browser. | **Privacy call** (O2), for #257's design. |
| Owner-side join via `order_id` (finding 7) | No change proposed. | It is the existing state: the owner *can* join events to accounts through `private.wallet_debits`. | **Privacy call** (O2): decide whether About's "never joined to the random browser ID" should say "never joined *by us*", or whether ADR 0008 should break the join (for example, a debit key derived from `order_id` with a secret salt). |

### What learners should see (model level)

The parent asks for a decision at the model level, and #257 builds it.

- **Publish:**
  - `learner.events` over `events_clean`, with re-keyed `visitor_id`, `session_id` and `id`, plus uuid-valued props re-keyed.
  - `learner.orders`, `learner.sessions` and `learner.visitors` as the S1 derived views.
  - `dim_*` files exported from code.
- **Never publish:** wallet tables, `auth.*`, `private.*`, `is_internal`, and `received_at`'s sub-second precision.
  - **Inferred:** at launch volumes, an exact arrival time lets a visitor pick out their own row. Truncating it to the minute keeps `received_at` useful for windowing.
- **Keep `id` (re-keyed).** The roadmap drops it. It is the natural deduplication key, and learners should learn to use one.

### Verified, inferred, assumed

- **Verified** (read in code or a primary source): findings 1-7; the event list; the store's bounds; the ITP cap; sessionStorage semantics; the WITH CHECK ordering; the sample-size arithmetic.
- **Inferred:**
  - About 12-15 events per full loop, from the call sites.
  - `received_at - occurred_at` is seconds, from `buildEventRow`.
  - A skipping BEFORE trigger can log refusals, from the Postgres docs, not yet run.
  - Exact arrival times would make rows self-identifying at small volume.
- **Assumed** (load-bearing, and neither of the above):
  - **Launch traffic is small:** hundreds to low thousands of browsers a week. Every "defer F" call rests on it.
  - **Ad blockers do not block `*.supabase.co`.** Not found either way.
  - **Most traffic is mobile**, from LinkedIn. It makes CGNAT and ITP the dominant biases.

### Searches, including the empty ones

- ITP storage cap: found. It is primary (WebKit), and criticised at the time as hurting PWAs ([iTnews](https://www.itnews.com.au/news/apple-cops-flak-for-deleting-local-browser-storage-after-7-days-539833)).
- sessionStorage per tab: found (MDN).
- Session conventions: found (GA4, Amplitude). **Empty:** a substantive published critique of 30-minute sessionization beyond "it is a convention".
- Sequence numbers for loss: found. Microsoft's paper, plus Snowplow's `eventIndex`, independently.
- Activity Schema: found (spec). The critique is thin: one practitioner comparison, and no published failure report.
- Kohavi on traffic thresholds: found, but only through secondary quotes. **Not found:** the primary text in reach from here.
- Fabijan's SRM taxonomy: found (ACM).
- CGNAT prevalence: found for Europe's mobile carriers. **Empty:** a US mobile-carrier equivalent.
- **Empty:** any EasyPrivacy or uBlock rule for `supabase.co`.
- Several primary pages (webkit.org, MDN, Google support, arXiv) were blocked for direct fetching from this environment, so their quotes come through search-result extracts. They are linked to the primary page so a reader can check.

### Interim recommendation (before reading #219)

Adopt S1 (events as the only written truth, derived entity views, code-exported dimensions). Add `restaurant_slug`, `fee_modes`, `seq`, `build`, `drip_claimed` and `payment_path`, each as a privacy call. Redefine the metrics per browser, within 7 days, windowed on `received_at`. Drop completion as a guardrail. Defer F's plumbing behind a written traffic threshold, and read the flash draw as the site's first experiment now.
