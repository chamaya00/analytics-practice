# Measurement contract, second pass: shapes, envelope, metric definitions and derived views

Issue: #270 (child of objective #264). Inputs, already decided and not reopened:
`docs/research/266-fresh-analytics-assessment.md` (Part 2, "Recommendation" and
its two verdict tables), `docs/research/267-data-infra-options.md` (collection
and storage unchanged), and the driver's calls D4-D11 and O3-O4 on #265.

**This revises `docs/measurement/219-analytics-readiness-contract.md`; it does
not replace it.** #219 stays the base. It is not edited, and it is not
superseded in full: where this document is silent, #219 governs. This document
states only what changes, and says "unchanged" for everything it keeps. Where a
rule or metric here contradicts #219's text, this document wins from the day it
merges.

**Decision this serves.** What the three engineer children build against, so
the store, the client and the queries can be written without guessing, and so
the roadmap's A-F ranking is read off numbers that mean what their labels say.
It moves no product decision: it makes loss measurable, makes the site's one
randomised treatment readable, and stops four metrics from measuring something
other than their names.

## 1. What changes, at a glance

| # | Change | Where |
|---|---|---|
| 1 | `order_placed` gains `restaurant_slug` (D4) | §3 |
| 2 | `flash_sheet_shown` gains `fee_modes` (D5) | §3 |
| 3 | The row envelope gains `seq` (D6) and `build` (D7), as defaulted columns | §4 |
| 4 | Windows count on `received_at`; ordering inside a browser uses `(occurred_at, seq)` | §6 (R2) |
| 5 | "Returning" uses a 7-day lookback (M3, R6) | §6, §7 |
| 6 | M7 is renamed "tracker return rate" and is no longer a guardrail | §7, §8 |
| 7 | M9's wall-to-order and M11's recovery are measured per browser, within 24 hours | §7 |
| 8 | M5's cohort admits `location_selected` | §7 |
| 9 | M2 is relabelled "tab sessions"; M4's ratios get names | §7 |
| 10 | M18-M20 and guardrail G6 are added. M21 is not (D8) | §7, §8 |
| 11 | Three derived entity views, `orders`, `sessions`, `visitors`, as Postgres views | §9 |

**Nothing else changes.** All 18 of #219's events stay (16 unchanged, 2 with
one added prop). No event is retired. Every shape #219 accepts is still accepted,
indefinitely (§3, and ADR 0014). `variant` stays `null`; no experiment ships;
there is still no exposure event (#219 §1). `drip_claimed` is not added (D8).
`restaurant_opened.entry` is deferred to #204's follow-up (O4). No dbt (D11).

## 2. Units

Unchanged from #219 §1, with names made honest:

- **browser** (`visitor_id`): the unit for the funnel, volume, returning, and
  any metric whose behaviour crosses tabs or hours. Called "browsers" in every
  label. It is not a person: another device, cleared storage, Safari's ITP
  (which deletes script-writable storage after 7 days without interaction) and
  an in-app web view each make a new one.
- **tab session** (`session_id`): one tab's `sessionStorage` lifetime. Kept
  because the flash draw, `session_started` and the sign-in round trip are
  keyed to it. It is not a visit: two tabs are two, and a tab left open for
  three days is one.
- **order** (`order_id`): everything after `order_placed`.
- **(tab session, city)** for the flash sheet, and **(tab session, city,
  restaurant slug)** for M19.
- **(browser, restaurant)** for M20 (new).

A browser that does something five times is one browser. Every metric counts
`distinct`, never rows.

## 3. Events: the shapes the store must accept (AC1)

**Every #219 shape is still accepted.** The strict-superset posture of ADR 0012
and ADR 0013 holds without an end date. The two new shapes are *additional*
accepted shapes: nothing that `event_is_valid` accepts today may become
refused. A reviewer checks this against the unchanged
`two-city-event-contract.migration.test.ts`,
`analytics-readiness-event-contract.migration.test.ts` and
`session-started-*.migration.test.ts`, which must pass untouched against the
new function.

Two events change. Their new shapes are matched by **exact sorted key set**
(ADR 0005 §2), like every other shape, and are alongside the old shapes, not
instead of them.

### 3.1 `order_placed`, new 15-key shape (`restaurant_slug` added)

Fires exactly as in #219 §8: once, when the order is written locally.

| Key (sorted) | Type and bound | Rule |
|---|---|---|
| `amount_minor` | integer | nonzero, §4 bounds of #219 (`USD` 1-100000, `VND` 1-5000000) |
| `applied_voucher_ids` | array of 0-2 distinct strings | each one of the 15 ids in #219 §4 |
| `city` | string | `sf` / `hcmc` / `la` |
| `currency` | string | `USD` / `VND` |
| `delivery_instructions` | string | `leave_at_door` / `hand_to_me` / `meet_downstairs` / `call_on_arrival` |
| `drop_off_preset` | string | `home` / `office` / `front_desk` |
| `item_count` | integer | 1-999 |
| `order_id` | string | uuid, `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` |
| **`restaurant_slug`** | **string** | **1-60 chars, `^[a-z0-9]+(-[a-z0-9]+)*$`. New.** The slug of the restaurant whose cart became this order. |
| `saved_amount_minor` | integer | zero-allowed bounds (`USD` 0-100000, `VND` 0-5000000) |
| `thanks_voucher_amount_minor` | integer | zero-allowed bounds |
| `utensils` | boolean | |
| `vip_level` | string | `none` / `gold` / `platinum` |
| `vip_saved_amount_minor` | integer | zero-allowed bounds |
| `wallet_paid` | boolean | |

- **Accepted `order_placed` key sets after the migration: exactly three.**
  #81's 9-key shape (no `city`, no `restaurant_slug`), #219's 14-key shape (no
  `restaurant_slug`), and this 15-key shape. Any other key set is refused.
- The 15-key shape is the 14-key shape plus one key. Every check that applies
  to the 14-key shape applies to it, unchanged. The `props` size cap (1 KB,
  ADR 0005) is unchanged; a 15-key row is well under it.
- **Cross-field invariants are not store-enforced** (ADR 0007). Client tests
  enforce: `restaurant_slug` is a slug in the catalogue for `city`; the
  #219 §8 invariants for the other fields.
- **Invariant a test can violate:** the `restaurant_slug` on the event equals
  the slug of the cart that `placeOrder` consumed, not the last restaurant
  opened. A browser that holds carts for two restaurants and orders from the
  first must log the first.

### 3.2 `flash_sheet_shown`, new 5-key shape (`fee_modes` added)

Fires exactly as in #219 §8: a session's first home-feed load for a city
draws the flash deal and opens the sheet.

| Key (sorted) | Type and bound | Rule |
|---|---|---|
| `amount_minor` | integer | `200`-`600` when `USD`, `10000`-`30000` when `VND` |
| `city` | string | `sf` / `hcmc` / `la` |
| `currency` | string | `USD` / `VND` |
| **`fee_modes`** | **array of strings** | **Length 5 or 6, and equal to the length of `restaurant_slugs`. Each element is `free` or `reduced`. Not required to be distinct. New.** |
| `restaurant_slugs` | array of strings | length 5 or 6, distinct, each 1-60 chars matching the slug pattern |

- **`fee_modes[i]` is the delivery-fee treatment of `restaurant_slugs[i]`**,
  both in draw order. The order is the only join between the two arrays, so
  the client must never sort, dedupe or reorder either one independently.
  Source: `FlashRestaurantDraw.feeMode` in `src/lib/flash-deal.ts`.
- **Accepted `flash_sheet_shown` key sets after the migration: exactly two.**
  The existing 4-key shape (`restaurant_slugs` of length 2, 5 or 6, as today)
  and this 5-key shape. The 5-key shape does **not** accept length 2: no
  client ever sent 2.
- **The equal-length rule is a store check**, the one exception to ADR 0007's
  "the store checks shapes and bounds, not cross-field invariants". ADR 0007
  refused to reject a primary-metric row over currency-against-city because
  such a row can still be counted and excluded (G5). A `fee_modes` array of
  the wrong length cannot be: every position after the first mismatch pairs a
  slug with someone else's treatment, silently, in the only randomised
  analysis the site has. Refusing it (and seeing G1 or G4) is the better
  failure. ADR 0014 records this.
- **Invariants a test can violate:** the array lengths are equal for every
  seed; a 6-restaurant draw logs 6 modes; for a seeded draw with modes
  `[free, reduced, reduced, free, free]` the event carries exactly that
  order; the event is still at most one per (`session_id`, `city`).

### 3.3 Every other event: unchanged

`session_started`, `location_selected`, `home_viewed`, `restaurant_opened`,
`cart_viewed`, `checkout_viewed`, `flash_sheet_closed`, `tracker_viewed`,
`order_delivered`, `rating_submitted`, `driver_rating_submitted`, `tip_sent`,
`sign_in_prompt_shown`, `sign_in_started`, `sign_in_completed`,
`wallet_short_shown` are **unchanged**: same firing rule, same key set, same
bounds and invariants as #219 §8. That is 16 events. Together with §3.1 and
§3.2, 18.

`restaurant_opened.entry` is **not** added (O4). `drip_claimed` is **not**
added (D8).

### 3.4 Not logged, on purpose (additions to #219 §10)

#219 §10 stands. Added here so the question is not reopened:

- **`drip_claimed`.** Not in this pass (D8). It is conditional on direction A
  being shortlisted, and its reconstructability caveat (claims, plus order
  subtotals, plus tips, approximate a signed-in browser's balance) is the
  closest any proposal comes to the #79 rule's spirit. A later readiness pass
  adds it, with `{}` props.
- **`payment_path`.** Withdrawn by #266. `wallet_paid = false` under a live
  wallet means only "the infrastructure did not answer", and `build` separates
  wallet-on from wallet-off periods.
- **`restaurant_opened.entry` and a carousel event.** Deferred to #204's
  follow-up (O4). An ad slide's tap leaves the site; it needs its own
  outbound-click record, which is that follow-up's design.
- **The order total and the drawn delivery time.** Unchanged reasoning from
  #266: the total is the debit amount (a wallet field under #79), and delivery
  is certain.
- **A device or browser class, delivery-failure counts (#267's Change 2), and
  refusal counting.** Not decided here. #267 suggests a
  `prior_send_failures` prop and #266 a `private.write_refusals` table; each is
  its own decision with its own child if the driver wants it. Neither is a
  precondition for anything below.

## 4. The row envelope: `seq` and `build` (AC2)

Two new store columns, defaulted so that every request an old tab sends still
inserts. Neither is repeated in `props`, and neither changes any `props` key
set. This follows ADR 0013's reason for `is_internal`: exact key-set matching
means a new prop would refuse every shape already-open tabs send, and refusals
are silent (ADR 0005).

| | `seq` | `build` |
|---|---|---|
| Column | `seq integer not null default 0` | `build text not null default 'unknown'` |
| Meaning | This tab session's nth call to `track()`. Loss is a gap in it. | Which deploy's code produced the row. |
| Bounds (store CHECK) | `seq between 0 and 100000` | `build ~ '^([0-9a-f]{12}\|dev\|unknown)$'` |
| Insert grant | `grant insert (seq) on public.events to anon` | `grant insert (build) on public.events to anon` |
| Value an old tab's insert gets | `0` (the default). **Real values start at 1**, so `0` means "sent by a client with no counter", never "the zeroth event". | `'unknown'` (the default) |
| Exposed in `events_clean` | yes, after the view is recreated (a `select *` view does not pick up a new column) | yes |

### 4.1 When `seq` is set (client)

- **Storage.** `sessionStorage` key `parody.seq`, value the JSON object
  `{"session_id": "<uuid>", "n": <integer>}`. `n` is the last value handed
  out. If the stored `session_id` differs from the current `getSessionId()`, or
  the value is missing or unparseable, the counter restarts: `n = 0`.
- **Increment.** `track()` increments `n` and writes it back, then attaches
  `seq = n` to the row. It does this **first thing after the two guards that
  mean nothing can be sent at all** (fetch or storage unavailable, or a bot
  user agent), and **before** `isValidEventProps` and the 1 KB check. So a
  call the client validator or size check drops still consumes a number and
  leaves a gap. Client-side contract bugs therefore show up in production as
  loss (G6), instead of vanishing.
- **Starts at 1 per `session_id`.** The first call in a fresh tab is `seq = 1`.
  On a page that fires `session_started` first (#219 §6), that event is `seq =
  1`.
- **Survives reloads and same-tab navigation**, including the OAuth round trip,
  because it lives in `sessionStorage` (the same lifetime as `session_id`).
- **Storage failure.** If `sessionStorage` cannot be read or written, no event
  is sent at all (unchanged: `getSessionId` fails first). `seq` never sends a
  guessed value.
- **The counter is never reset by a send failure.** The network result is
  irrelevant to the counter: a swallowed 4xx or 5xx is exactly the loss `seq`
  exists to see.

### 4.2 Where `seq` under-reads or breaks, stated

- **Loss after the last event of a session is invisible.** A tail with no later
  row has no gap to show. `seq` under-counts loss by construction.
- **A duplicated tab copies `sessionStorage`, counter included.** Two tabs then
  share one `session_id` and draw the same `seq` values. `(session_id, seq)` is
  therefore **not unique** in the data, so it must never be a key. The loss
  query (M18) works on distinct `seq` values and can miss a lost row whose
  twin landed from the other tab. This biases loss down.
- **An old tab sends `seq = 0`.** M18 ignores `seq = 0` rows.
- **Loss before the counter is invisible:** the bot guard and the storage
  guard drop without consuming a number. Both send nothing by design.

### 4.3 Where `build` comes from (client)

- **Source.** The commit the deploy was built from: Vercel's system
  environment variable `VERCEL_GIT_COMMIT_SHA`, read at build time in
  `astro.config.mjs` and injected as a compile-time constant (for example
  `vite.define`). No runtime lookup and no network call. The engineer child
  chooses the mechanism; the source and the format below are the contract.
- **Format.** The first 12 characters of that SHA, lowercase hex:
  `^[0-9a-f]{12}$`. When the variable is unset (local dev, CI, an
  unconfigured preview), the value is the literal `dev`. `unknown` is never
  sent by a client: it is the store's default for a client that predates the
  column.
- **Constant per page load.** Every row a page load sends carries the same
  `build`. A tab left open across a deploy keeps sending the old build, which
  is the point: "before and after" splits on the code that produced the event.
- **Not a version number and not a prop.** It carries no visitor information;
  it is the same for everyone on that deploy.

### 4.4 One deploy, or the fields lie

`seq`, `build`, `order_placed.restaurant_slug` and
`flash_sheet_shown.fee_modes` **ship in one client deploy.** The reason is a
reading rule, not tidiness: metrics M19 and M20 need to tell "the client that
knows the restaurant/treatment" from "an older one", and they do it with
`build <> 'unknown'` (§6, R4'). A deploy that ships some of the four and not
the others makes that test wrong for the rows in between.

### 4.5 Migration order is a hard constraint

PostgREST refuses an insert that names a column the table doesn't have. **A
client that sends `seq` and `build` before the owner has applied the migration
has every event refused, silently and for everyone.** So the client child is
not deployable until the store child's migration is merged **and** the owner
has applied it and the confirming SQL (§10.1) has passed. G4 (§8) is the
tripwire if that ordering is missed.

### 4.6 Invariants: the tests the engineer children must write

Each is something a test can violate. E1-E7 are the client child's (§10.2);
E8-E9 are the store child's (§10.1).

- **E1.** Within one `session_id`, the `seq` values a fresh client sends are
  exactly `1, 2, 3, ...`, one per `track()` call that reaches the counter,
  with no repeats and no skips, whatever the network does.
- **E2.** A `track()` call whose props fail client validation sends no row
  **and** the next call's `seq` is exactly one higher than the call before the
  dropped one (a gap of one is visible).
- **E3.** After a reload (a new sender built over the same `sessionStorage`),
  the next `seq` is the stored `n + 1`, not 1.
- **E4.** After `sessionStorage` is replaced by one with a different
  `session_id`, the next `seq` is 1.
- **E5.** The first row a fresh tab sends is `session_started` with `seq = 1`.
- **E6.** `seq` and `build` never appear in `props`, and adding them changes no
  event's `props` key set.
- **E7.** Every row from one page load has the same `build`, and it matches
  `^([0-9a-f]{12}|dev)$`.
- **E8.** *(store)* An insert with neither column lands, with `seq = 0` and
  `build = 'unknown'`. An insert with `seq = -1`, `seq = 100001`,
  `build = 'ABC'`, `build = ''` or a 13-character hex string is refused. An
  insert setting `seq` or `build` to null is refused.
- **E9.** *(store)* The events an old tab sends, with the columns absent, still
  land for **every** event name and every accepted shape (the existing
  superset tests, unmodified).

## 5. Privacy (#79) check for this revision

- No email, account id, auth user id or wallet field is added to any event or
  column.
- `restaurant_slug` (D4): a public catalogue slug, already in every URL. The
  caveat, that with catalogue fees an order total is nearly reconstructable,
  and a wallet-paid total equals the debit, stays with the driver's D4. No
  account key is added, so events still don't identify an account.
- `fee_modes` (D5): what the site drew, not the visitor.
- `seq` (D6): a counter, restarting each tab session. It adds no linkage
  beyond `session_id`, which already exists.
- `build` (D7): the deploy, the same for every visitor.
- **D10 (About's wording, not the join).** The owner can join events to
  accounts: `order_id` is both `order_placed.props.order_id` and the key of
  `private.wallet_debits`. The join is not broken in this pass. About must
  therefore stop implying it cannot happen, and say it truthfully: events are
  **"never joined by us, and never published"** to accounts (§10.2 gives the
  exact edit). If the owner later wants the site *unable* to join, that is its
  own objective.
- **D9 (snapshots).** `order_id` and other uuid-valued props are re-keyed in
  #257's published snapshots (§9.4).

## 6. Rules every query follows (revised)

Relative to #219 §11. R1, R3, R5, R7 and R8 are **unchanged**.

- **R1 Source.** Unchanged. Read from `public.events_clean`, never
  `public.events`.
- **R2 Time. Changed.** Window on **`received_at`**, not `occurred_at`.
  - A day is `(received_at at time zone 'UTC')::date`. Windows are half-open
    `[start, end)`.
  - **Old reading:** `occurred_at`, which the device clock stamps at send time
    (`buildEventRow`), so it adds only clock skew to `received_at`. It also
    made a day revisable for 24 hours (#219's "read yesterday's numbers the day
    after"). `received_at` is the server's clock and is final at midnight UTC,
    so a day reproduces exactly from any later snapshot. **That 24-hour caveat
    is withdrawn.**
  - **Ordering** of events inside one browser or tab session uses
    `(occurred_at, seq)`, not `received_at`, because arrival order is not
    action order. `seq = 0` rows sort by `occurred_at` alone. Durations that
    cross tabs (M9's and M11's 24 hours) are measured on `received_at`, the
    one clock every row shares.
  - The claim "the two columns differ by seconds" is inferred from the code
    and must be confirmed on real rows by the queries child (§10.3).
- **R3 City of a row.** Unchanged.
- **R4 Shape boundary.** Unchanged, and extended with **R4'**: M19 and M20
  read a prop only the new client sends, so they count only rows from that
  client. For the event that carries the prop, that is key presence
  (`props ? 'fee_modes'`, `props ? 'restaurant_slug'`). For an event that
  doesn't carry it (M20's `restaurant_opened` denominator), it is
  `build <> 'unknown'` on the row. That substitution is sound only because
  of §4.4.
- **R5 Session day.** Unchanged in form: the UTC day of the **minimum
  `received_at`** across the `session_id`'s rows (was `occurred_at`).
- **R6 Prior activity. Changed.** Was "first seen: the UTC day of a visitor's
  minimum `occurred_at`, unwindowed". Now: **a browser is *returning on day D*
  if it has at least one `events_clean` row whose `received_at` UTC day is in
  `[D - 7, D - 1]`.** First-seen day is still available as a column (§9.3) for
  cohorting, but no M-number uses it unwindowed.
  - **Old reading:** it rose mechanically as the store aged, and under-read on
    Safari, where ITP resets a browser after 7 idle days.
  - **New limit:** for the first 7 days after the store's first row, the
    lookback is truncated, so M3 under-reads. Label those days.
- **R7 Order cohorts.** Unchanged in form: the cohort is `order_placed` rows
  with `received_at` in the window; later events count whenever they arrived.
- **R8 Source of a session.** Unchanged.

## 7. Metrics M1-M20 (AC3)

One row per metric. **Kind** is *rate* (numerator ÷ denominator) or *count*
(explicitly no denominator). **Window** is always on `received_at` (R2), half-open
`[start, end)`, and is a UTC day D or a window W unless a row says a different
horizon. Numbers are not renumbered (O3): a changed metric is redefined in
place, and its **old → new** line is in the last column.

| # | Name | Kind | Numerator | Denominator | Unit | Window | Old → new |
|---|---|---|---|---|---|---|---|
| **M1** | Browsers by day | count | `count(distinct visitor_id)` with a row on D | none, by design | browser | day D | **Window:** `occurred_at` → `received_at`. Label: "visitors" → "browsers". |
| **M2** | Tab sessions by day | count | `count(distinct session_id)` whose session day (R5) is D | none, by design | tab session | day D | **Relabelled** "sessions by day" → "tab sessions by day", a diagnostic. It is not a visit count and no A-F decision reads it. Window on `received_at`. |
| **M3** | Returning browsers | rate | browsers active on D that are returning on D (R6: some row in `[D-7, D-1]`) | browsers active on D (= M1(D)) | browser | day D | **Was:** first-seen day before D, unwindowed. **Now:** a 7-day lookback. It no longer drifts with the store's age and survives ITP. First 7 store days are truncated (R6). |
| **M4** | Home-to-order funnel | rate | Step counts S1-S5, as #219 (distinct browsers in C(W) with ≥1 of that step's event in W, any order; S3 needs `item_count ≥ 1`). **Home-to-order conversion** = \|S5\| | **\|S1\|** (browsers with `home_viewed` in W). **Checkout-to-order conversion** = \|S5\| | \|S4\| | browser | window W | **Naming only.** S5/S1 was "checkout conversion" and "the primary metric"; it is now **home-to-order conversion**, the primary metric, and the value is unchanged. S5/S4 is added as **checkout-to-order conversion**. Step ratios may exceed 1 (unnested), as #219 says. Window on `received_at`. |
| **M5** | Funnel by city | rate | \|S5(c)\|, pairs in C(W, c) with ≥1 `order_placed` whose row city (R3) is c | \|S1(c)\| = \|C(W, c)\| | (browser, city) pair | window W | **Cohort widened:** C(W, c) is pairs with ≥1 `home_viewed` **or** ≥1 `location_selected` whose `city = c` in W. **Was:** `home_viewed` only, which misses a visitor who switched city from the header pill (the pill re-renders the feed without a page load). Steps S2-S5 unchanged. |
| **M6** | Acquisition by source | rate | **M6a:** sessions with day D and source s. **M6b:** sessions in W with source s and ≥1 `order_placed` on the same `session_id`. **M6c:** browsers whose earliest `session_started` is in W, source s, with ≥1 `order_placed` at any time | **M6a:** all sessions with day D (incl. `(unknown)`). **M6b:** all sessions in W with source s. **M6c:** all browsers in that cohort | **M6a/M6b:** tab session. **M6c:** browser | day D / window W | **Kept** (R8 source rule). Window on `received_at`. **Added caveat:** on iOS a page opened in another app's embedded web view may not share `localStorage` with Safari, so one person can be two browsers and M6c under-credits the referring app. Assumed, not verified (#266). M6c is the decision read; M6a and M6b are diagnostics. |
| **M7** | Tracker return rate | rate | `count(distinct order_id)` with `order_delivered` | `count(distinct order_id)` with `order_placed` (cohort per R7) | order | window W | **Renamed** "completion rate" → "tracker return rate", and **removed from the guardrail list**. Delivery is certain by construction (`pickDeliveryMs` draws at or before half the ETA and nothing cancels), and `order_delivered` fires only when the visitor reopens `/tracker/`. So M7 measures return-to-tracker, an engagement metric. The formula is unchanged. |
| **M8** | Rating rates | rate | Restaurant: `count(distinct order_id)` with `rating_submitted`. Driver: with `driver_rating_submitted` | `count(distinct order_id)` with `order_delivered` | order | window W | Unchanged. Window on `received_at`. |
| **M9** | Sign-in wall | rate | See below | See below | tab session (start, pass); **browser (wall-to-order)** | window W | **Wall-to-order changed** from session-level to browser-level with a 24-hour horizon (below). Start rate and pass rate unchanged. |
| **M10** | Wallet-paid share | rate | `count(distinct order_id)` with `wallet_paid = true` | `count(distinct order_id)` over `order_placed` rows that have the `wallet_paid` key (R4) | order | window W | Unchanged. With `build`, wallet-on and wallet-off periods are separable exactly. |
| **M11** | Short-balance recovery | rate | Browsers in the base set with ≥1 `order_placed` whose `received_at` is later than, and within 24 hours of, the browser's first such `wallet_short_shown` | Browsers with ≥1 `wallet_short_shown` where `surface = 'checkout'` in W | **browser** | window W (base event) | **Was:** sessions, with an `order_placed` later in the same session. **Now:** browser-level, an order within 24 hours. A drip window can be up to 9 hours (ADR 0008), so recovery usually happens in a later tab, which the old reading counted as "not recovered". The base-event browsers are in W; the recovering order may fall after W ends. |
| **M12** | Tip rate | rate | `count(distinct order_id)` with `tip_sent` | `count(distinct order_id)` with `order_placed` where `wallet_paid = true` and with `order_delivered` | order | window W | Unchanged. Window on `received_at`. |
| **M13** | VIP mix | rate | For each level v: `count(distinct order_id)` with `vip_level = v` | `count(distinct order_id)` over `order_placed` rows that have `vip_level` (R4) | order | window W | Unchanged. |
| **M14** | Thanks-voucher use | rate | `count(distinct order_id)` with `thanks_voucher_amount_minor > 0` | `count(distinct order_id)` over rows with the key (R4) | order | window W | Unchanged. |
| **M15** | Voucher attachment | rate | `count(distinct order_id)` with `jsonb_array_length(applied_voucher_ids) > 0` | `count(distinct order_id)` over `order_placed` | order | window W | Unchanged. |
| **M16** | Flash view-to-action | rate | `count(distinct (session_id, city))` with `flash_sheet_closed`, `outcome = 'restaurant_tapped'` | `count(distinct (session_id, city))` with `flash_sheet_shown` | (tab session, city) | window W | Unchanged. M19 splits it by treatment. |
| **M17** | Location switch rate | rate | `count(distinct visitor_id)` with `location_selected` where `is_switch` | `count(distinct visitor_id)` with `location_selected` | browser | window W | Unchanged. |
| **M18** | Loss rate | rate | `sum(gap)` over rows, where `gap = seq - previous_distinct_seq - 1` within the `session_id` (the first distinct `seq` in a session has `previous = 0`), attributed to the day of the later row's `received_at`; `seq > 0` rows only | `count(distinct (session_id, seq))` + `sum(gap)`, same rows | row (a call to `track()`) | day D | **New.** Also guardrail G6. Reads only new-envelope rows, and under-reads (§4.2). Report the row count beside it. |
| **M19** | Flash tap-through by fee mode and amount | rate | Exposures (below) whose `flash_sheet_closed` in the same `session_id` and `city` has `outcome = 'restaurant_tapped'` and `restaurant_slug` = that slug | `flash_sheet_shown` exposures, one per drawn restaurant | (tab session, city, restaurant slug) | window W | **New.** Sliced by `fee_modes[i]` and by `amount_minor`. Rows with the `fee_modes` key only (R4'). |
| **M20** | Restaurant conversion | rate | Browsers with `order_placed` where `restaurant_slug = r`, restricted to the denominator set | Browsers with `restaurant_opened` where `restaurant_slug = r` and `build <> 'unknown'` | (browser, restaurant) | window W | **New.** Numerator counts only `order_placed` rows with the `restaurant_slug` key, and only browsers in the denominator (so it can't exceed 1). |

**Twenty rows above; M21 does not exist (D8).**

**M9 in full.** Base sets: P_t = tab sessions in W with ≥1 `sign_in_prompt_shown`
where `surface = 'checkout'`; P_b = browsers in W with the same event.

- **Start rate** = tab sessions in P_t with ≥1 `sign_in_started`
  (`surface = 'checkout'`) ÷ |P_t|. Unchanged.
- **Pass rate** = tab sessions in P_t with ≥1 `sign_in_completed`
  (`surface = 'checkout'`, `outcome = 'success'`) ÷ |P_t|. Unchanged.
- **Wall-to-order** = browsers in P_b with ≥1 `order_placed` whose `received_at` is
  later than, and within 24 hours of, the browser's first such
  `sign_in_prompt_shown` ÷ |P_b|. **Was:** tab sessions with an `order_placed`
  later in the same session. **Now** browser-level, because ordering after a
  wait crosses tabs.
- The `surface = 'tip'` variants stay tab-session-level and replace
  `order_placed` with `tip_sent`, unchanged: a tip follows a tap in the same
  tab.

**M19's exposure, precisely.** For each `flash_sheet_shown` row with the
`fee_modes` key, one exposure per index i: `(session_id, city, slug =
restaurant_slugs[i], fee_mode = fee_modes[i], amount_minor)`, using the array
position, not a sort. A tap is a `flash_sheet_closed` row with the same
`session_id` and `city`, `outcome = 'restaurant_tapped'` and `restaurant_slug`
equal to the exposure's slug. A draw with no `flash_sheet_closed` (silent
abandonment) is all non-taps. Read it as a **tap share between slots**, not an
independent rate per slot: a sheet has at most one tap, so the slots compete.
Fee mode is randomised 50/50 per restaurant within the draw (`drawFlashDeal`),
so the comparison of `free` against `reduced` is unbiased, but confidence
intervals must be clustered by draw. At launch volume it will be inconclusive
(#266, "Experiment readiness"); that is a result, not a failure.

## 8. Guardrails, ship/stop, and failure cases

### 8.1 Guardrails

**The roadmap's "must not get worse" list becomes:** home-to-order conversion
(M4's S5/S1), the loss rate (G6, M18), and the #79 privacy rule. **M7 is gone
from it** (it is a return-to-tracker rate, §7). "Checkout conversion" as a
guardrail is renamed to match M4's naming. No other change to that list.

The deploy-day guardrails G1-G5 of #219 §12 are **unchanged**, with two edits:

- **G1 (new-shape coverage) becomes exact:** the share of a day's rows with
  `build <> 'unknown'`, alongside #219's share of `order_placed` rows carrying
  `city`. It should pass 95% within three days of the client deploy.
- **G4 (no cliff on deploy day)** compares M1 and M4's S1 on the deploy day
  with the three days before, with days counted on `received_at`.
- **G6 (new). Loss rate must not rise on a deploy.** M18 for the deploy day and
  each of the next three days must not exceed the trailing seven-day M18 by
  more than **2 percentage points**, and must not exceed **5%** in absolute
  terms. **Both numbers are provisional:** no baseline exists until the client
  child has been live for a week, so the 5% and 2-point figures are a starting
  rule, chosen so that an obvious break trips it. The first week's
  measured M18 replaces them by a one-line amendment to this section. A day
  with fewer than 200 `seq > 0` rows is reported as a count, not judged. What
  it means if G6 trips: the deploy is losing events (a client contract bug, the
  rate limit behind shared IPs, or clock skew), and every rate is read through
  that loss.

### 8.2 Ship / stop

**Read the new metrics only when all hold:** #219 §12's conditions 1-5; the
store migration is applied and its confirming SQL passed (§10.1); the client
child is deployed **after** that; G1 ≥ 95% for a full day; and at least one
full UTC day of `seq > 0` rows exists (for M18).

**Stop, fix, and publish no number if:** G4 fires, G2 breaks, G5 is non-zero,
an internal browser's rows appear in `events_clean`, or (new) rows with
`build = 'unknown'` **keep arriving at the same rate** three days after the
client deploy (the deploy did not reach users, or the new shape is refused
and only old tabs get through).

### 8.3 Failure cases

Unchanged from #219 §12, plus:

- **The migration is not applied when the client deploys.** Every insert
  is refused (unknown column). Silent to the visitor. G4 is the only signal
  (§4.5).
- **A duplicate `order_id`.** The primary key stops exact retries, not a
  second `track()` call. Every order-unit metric counts `distinct order_id`;
  the `orders` view keeps the earliest row and exposes the count (§9.1).
- **A `seq` gap that is not loss:** a duplicated tab (§4.2) can only *hide*
  loss, never invent it. An old tab's `seq = 0` rows are excluded, not counted
  as gaps.
- **Post-order events without an order:** a `tracker_viewed`, `order_delivered`,
  rating or tip whose `order_placed` was lost or refused. They are orphans.
  `orders` omits them (its grain is a placed order), and the queries child
  reports the orphan count as a data-quality number.

### 8.4 Whether any of this can be read yet

**No.** Until the store migration is applied and the client is deployed, none
of M18-M20 or the new columns exist, and the views cannot be read. M1-M17 can
be computed on the existing 18 events, redefined as above, over the rows that
exist. The store does take events off the device (ADR 0005), so an aggregate
is possible once §8.2's conditions hold. At launch volumes the honest
statement for every comparison remains "inconclusive", and for M19 and M20 it
will be for some time.

## 9. Derived entity views (AC4)

Three Postgres views in `public`, defined in a migration as **plain SQL over
`public.events_clean`**: ANSI-leaning `select`, CTEs, window functions,
`distinct on`, `jsonb` operators, and nothing that only Postgres has beyond
those, so a dbt model can later be a copy of the body unchanged (D11). They
are the entities #266 recommended (S1): events remain the only written truth,
and nothing a browser can send changes.

**For all three views:**

- `create view ... with (security_invoker = true)`, then `revoke all on
  <view> from anon` and from `authenticated` (guarded by the same `pg_roles`
  check `events_clean` uses). Supabase grants default privileges on new
  relations in `public`. Neither the site nor a learner reads these views
  directly; the owner reads them in the SQL editor, and #257 publishes copies
  (§9.4).
- They are created **after** `events_clean` is recreated with the new columns.
  Because they depend on it, any later migration that drops and recreates
  `events_clean` must drop these first (ADR 0016 records this).
- Every timestamp is `received_at` (R2) unless the column says otherwise. Every
  city is R3's coalesce. Old-client rows never make a row disappear: a prop
  that isn't there is `null`, never `false` or `0` (R4).
- **Nothing in any view is an email, account id, wallet field, IP or
  `is_internal`.** `events_clean` already excludes internal browsers.
- Names: `public.orders`, `public.sessions`, `public.visitors`.

### 9.1 `orders`: one row per `order_id`

**Grain.** One row per distinct `order_placed.props->>'order_id'`. A post-order
event with no `order_placed` never produces a row.

**Duplicates.** If `order_placed` appears more than once for an `order_id`, keep
the row with the earliest `(received_at, id)`, and expose the row count.

**Post-order events.** For `order_delivered`, `rating_submitted`,
`driver_rating_submitted` and `tip_sent`, join the **earliest** row per
`(order_id, event_name)` by `(received_at, id)`. They join on `order_id` only:
never on `session_id` or `visitor_id`, because they often arrive in another
tab. `tracker_viewed` contributes a count.

```sql
-- shape of the CTEs (the migration writes them out in full)
with placed as (
  select distinct on (props->>'order_id') props->>'order_id' as order_id, e.*
  from public.events_clean e
  where event_name = 'order_placed'
  order by props->>'order_id', received_at, id
),
dup as (
  select props->>'order_id' as order_id, count(*) as n
  from public.events_clean where event_name = 'order_placed' group by 1
),
post as (
  select distinct on (props->>'order_id', event_name)
         props->>'order_id' as order_id, event_name, received_at, props
  from public.events_clean
  where event_name in ('order_delivered','rating_submitted','driver_rating_submitted','tip_sent')
  order by props->>'order_id', event_name, received_at, id
)
```

| Column | Type | Rule |
|---|---|---|
| `order_id` | text | `props->>'order_id'` (a uuid string) |
| `visitor_id`, `session_id` | uuid | from the kept `order_placed` row |
| `placed_at` | timestamptz | the kept row's `received_at` |
| `placed_day` | date | `(received_at at time zone 'UTC')::date` |
| `build` | text | the kept row's `build` (`'unknown'` for older clients) |
| `placed_rows` | integer | `count(*)` of `order_placed` rows for this `order_id`. Greater than 1 is a client bug worth investigating. |
| `city` | text | `coalesce(props->>'city', case props->>'currency' when 'VND' then 'hcmc' when 'USD' then 'sf' end)` |
| `currency` | text | `props->>'currency'` |
| `restaurant_slug` | text | `props->>'restaurant_slug'`; **null** for rows from clients before this contract |
| `amount_minor` | bigint | `(props->>'amount_minor')::bigint` |
| `item_count` | integer | `(props->>'item_count')::int` |
| `applied_voucher_ids` | jsonb | `props->'applied_voucher_ids'` |
| `voucher_count` | integer | `jsonb_array_length(props->'applied_voucher_ids')` |
| `saved_amount_minor` | bigint | `(props->>'saved_amount_minor')::bigint` |
| `thanks_voucher_amount_minor` | bigint | cast of the prop; **null** if the key is absent (the 9-key shape) |
| `vip_level` | text | `props->>'vip_level'`; null if absent |
| `vip_saved_amount_minor` | bigint | cast; null if absent |
| `wallet_paid` | boolean | `(props->>'wallet_paid')::boolean`; **null if absent** |
| `delivery_instructions`, `drop_off_preset` | text | the props |
| `utensils` | boolean | the prop |
| `order_number` | integer | `row_number() over (partition by visitor_id order by placed_at, order_id)`: this browser's nth order, so first order is `order_number = 1` |
| `delivered_at` | timestamptz | earliest `order_delivered` row's `received_at`; null if none |
| `tracker_views` | integer | `count(distinct (props->>'view_number')::int)` over this order's `tracker_viewed` rows; **0** if none |
| `restaurant_stars` | integer | earliest `rating_submitted` row's `stars`; null if none |
| `restaurant_tags` | jsonb | that row's `tags`; null if none |
| `driver_stars` | integer | earliest `driver_rating_submitted` row's `stars`; null if none |
| `tip_amount_minor` | bigint | earliest `tip_sent` row's `tip_amount_minor`; null if none |

**Missing events are nulls, never guesses.** A rating with no delivered row
still shows: the view does not require `delivered_at` to expose `restaurant_stars`.
An order with no `tracker_viewed` has `tracker_views = 0`.

### 9.2 `sessions`: one row per tab session

**Grain.** One row per `session_id` present in `events_clean`. This is the tab
session (M2, M6, M9-start/pass, M16), **not** a 30-minute visit. The
`visits` column gives the visit reading as a teaching column.

**Owner of a session.** `visitor_id` is the one on the session's earliest row
by `(received_at, id)`. A session split across two `visitor_id`s (storage
cleared mid-tab) is one session with its first browser.

| Column | Type | Rule |
|---|---|---|
| `session_id` | uuid | the key |
| `visitor_id` | uuid | earliest row's `visitor_id` by `(received_at, id)` |
| `first_at`, `last_at` | timestamptz | `min` / `max(received_at)` |
| `session_day` | date | R5: UTC day of `first_at` |
| `events` | integer | `count(*)` |
| `build` | text | earliest row's `build` |
| `session_started_rows` | integer | `count(*) filter (where event_name = 'session_started')`. 0 or ≥ 2 is a G2 breach; 0 is an older client or a lost send. |
| `source` | text | R8 on the earliest `session_started` row by `(received_at, id)` (`case` from #219 §11 R8, unchanged); `'(unknown)'` if the session has none |
| `referrer_host`, `utm_medium`, `utm_campaign` | text | that row's props; null if none |
| `reached_home` | boolean | `bool_or(event_name = 'home_viewed')` |
| `reached_restaurant` | boolean | `bool_or(event_name = 'restaurant_opened')` |
| `reached_cart` | boolean | `bool_or(event_name = 'cart_viewed' and (props->>'item_count')::int >= 1)` |
| `reached_checkout` | boolean | `bool_or(event_name = 'checkout_viewed')` |
| `orders` | integer | `count(distinct props->>'order_id') filter (where event_name = 'order_placed')` |
| `max_seq` | integer | `max(seq)`; 0 if every row has `seq = 0` |
| `seq_lost` | integer | `greatest(max(seq) - count(distinct seq) filter (where seq > 0), 0)` over `seq > 0` rows. 0 when there are none. |
| `visits` | integer | `1 + count of rows whose gap to the previous row (ordered by received_at, id) in this session exceeds 30 minutes`. 30 minutes is GA4's and Amplitude's default; it is a teaching column and no M-number reads it. |

The `reached_*` flags are booleans, not nested funnel steps; a session that
enters mid-funnel can have `reached_checkout` and not `reached_home`, matching
M4's "unnested" reading.

### 9.3 `visitors`: one row per browser

**Grain.** One row per `visitor_id` present in `events_clean`.

| Column | Type | Rule |
|---|---|---|
| `visitor_id` | uuid | the key |
| `first_seen_at`, `last_seen_at` | timestamptz | `min` / `max(received_at)` |
| `first_seen_day` | date | UTC day of `first_seen_at` |
| `active_days` | integer | `count(distinct (received_at at time zone 'UTC')::date)` |
| `sessions` | integer | `count(distinct session_id)` |
| `returned_within_7d` | boolean | true if any row falls on a UTC day `d` with `first_seen_day < d <= first_seen_day + 7`. Null for browsers first seen fewer than 7 days before the newest row in `events_clean`, because they cannot yet be judged (R7's maturing rule). |
| `first_touch_source`, `first_touch_medium`, `first_touch_campaign` | text | M6c exactly: R8's source from the browser's earliest `session_started` row by `(received_at, id)`, all time; `'(unknown)'` when there is none |
| `first_external_source` | text | R8's source from the earliest `session_started` whose `referrer_host` is not `(self)`, not `accounts.google.com`, not `appleid.apple.com`, and does not end in `.supabase.co` (the sign-in round trip is not an acquisition source, #219 §12); `'(unknown)'` if none. A teaching column; M6c does not read it. |
| `first_order_at` | timestamptz | earliest `orders.placed_at` for this browser; null if none |
| `orders` | integer | `count(*)` of this browser's rows in `orders` |
| `last_build` | text | `build` of the latest row |

### 9.4 What #257 publishes, and the D9 re-keying

Written here as a requirement on #257, not built by #264.

- **Views to publish:** `learner.events` (over `events_clean`), `learner.orders`,
  `learner.sessions`, `learner.visitors` (these three are `public.orders`,
  `public.sessions`, `public.visitors` above), and the dimension files below.
- **Dimension files**, exported from code with `valid_from` and `valid_to`
  per version: `dim_cities`, `dim_restaurants` (with `launched_at`, from
  `src/lib/restaurants.ts` and `catalogue-*.ts`), `dim_menu_items`,
  `dim_vouchers`, `dim_drivers`. Sources: `restaurants.ts`, `catalogue-*.ts`,
  `vouchers.ts`, `drivers.ts`. `dim_restaurants` is the one this contract
  depends on: M20 and direction E need it.
- **D9 re-keying (a requirement on #257).** The per-run salt that re-keys
  every uuid *column* must also re-key **every uuid-valued value inside
  `props`**, in `learner.events`, and every uuid column in the three entity
  views above, with the same salt in the same run, so joins between the raw
  and the entity tables still work. The named cases: `props->>'order_id'` on
  `order_placed`, `tracker_viewed`, `order_delivered`, `rating_submitted`,
  `driver_rating_submitted` and `tip_sent`; and `orders.order_id`,
  `orders.visitor_id`, `orders.session_id`, `sessions.session_id`,
  `sessions.visitor_id`, `visitors.visitor_id`. The alternative D9 allows,
  publishing `order_id` only through a view that re-keys it, is equally
  acceptable; either way **no raw uuid a visitor's own `localStorage` holds
  (`parody.orders`, `parody.visitorId`) may appear in a snapshot.** A test on
  #257's side searches every published file for the raw ids of a seeded
  browser and finds none.
- **Never publish:** `is_internal`, `received_at` below minute precision (as
  #266), and anything from `private.*`, `auth.*` or the wallet. `seq` and
  `build` are safe to publish: they are a counter and a deploy id.

## 10. Requirements on the implementing children (AC6)

**Exactly three engineer children, in this order.** Store, then client (which
cannot be deployed before the store is applied, §4.5), then queries and docs
(which needs seeded rows, so it needs the store's PGlite fixtures, not a live
deploy). Each child's list is its own acceptance criteria; the driver copies
them onto the child issue.

### 10.1 Child 1 — store (migration, accept-tests, views, apply step)

Two additive files under `supabase/migrations/`, no applied migration edited,
no stored row changed:

- `20261003000000_second_pass_shapes_and_envelope.sql`: `seq`, `build`, the
  two new shapes, the recreated `events_clean`.
- `20261004000000_derived_entity_views.sql`: the three views. A separate file,
  so a view bug can't roll back the columns.

Criteria:

- **S1.** Given the migration on a PGlite database built from all earlier
  migrations, when every accepting fixture in the existing superset and
  contract tests runs **unmodified**, then it is still accepted. (§3, AC1.)
- **S2.** Given §3.1's table, when a 15-key `order_placed` with a valid
  `restaurant_slug` is inserted, then it lands; and each of these is refused:
  the slug missing, empty, 61 characters, uppercase, containing `/`, a number;
  a 16th key; a 15-key set with any one of the other 14 keys removed. The 9-key and 14-key shapes still land. The test cites §3.1 by
  section.
- **S3.** Given §3.2's table, when a 5-key `flash_sheet_shown` with five
  `fee_modes` for five slugs and one with six for six is inserted, then each
  lands; each of these is refused: `fee_modes` length 5 with 6 slugs (and the
  reverse), a value `'FREE'`, `'paid'`, `null` or a number, length 2, a
  duplicated slug, `fee_modes` not an array. The 4-key shape, including
  2 slugs, still lands. The test cites §3.2 by section.
- **S4.** Given E8 and E9, when a row is inserted with `seq` and `build`
  absent, present and valid, and present and invalid, then the results are
  exactly those §4.6 lists. The `anon` role can insert both columns and still
  cannot select, update or delete.
- **S5.** Given the views, when a seeded fixture (built by inserting rows
  through the real `insert` path) contains: two `order_placed` rows for one
  `order_id`, an order with no post-order events, a `rating_submitted` with no
  `order_delivered`, an orphan `tracker_viewed`, a 9-key old-shape order, a
  15-key order, a browser marked `is_internal`, and a session with
  `seq` values `1,2,4`, then each view returns the rows and nulls §9 specifies
  (the duplicate keeps the earliest and `placed_rows = 2`; the old-shape order
  has null `restaurant_slug` and `wallet_paid`; the orphan produces no row;
  the internal browser appears in none; that session has `seq_lost = 1`). The
  view SQL contains no function that a later dbt model couldn't express
  (no `security definer`, no procedural code).
- **S6.** Given a dropped-and-recreated `events_clean`, when the migration runs
  on a database that already has the views, then either it drops the views
  first, or the test proves the ordering in §9 works from an empty database.
- **S7.** Given the owner's apply step, when the PR is read, then it names the
  two files in order, with a **read-only confirming SQL** that returns a
  pass/fail row for each of: `seq` and `build` columns exist with their
  defaults; `has_column_privilege('anon', 'public.events', 'seq', 'INSERT')`
  and for `build` are true; `select` on either is false; a check that the function accepts the two new shapes, by calling
  `public.event_is_valid('order_placed', '<15-key json>'::jsonb)` and the
  same for `flash_sheet_shown` (a `select`, so nothing is written); the
  three views exist and `anon` has no privilege on them. ADR 0005's owner
  checklist gets the new files as items six and seven.

### 10.2 Child 2 — client (`track()`, `seq`, `build`, About)

Depends on Child 1 **merged and applied**.

- **C1.** Given a cart for restaurant X and another for Y, when the visitor
  places the order for X, then the sent `order_placed` has exactly §3.1's 15
  keys and `restaurant_slug = 'X'`; the exact object is also inserted into a
  PGlite store built from Child 1's migration and lands (same object, not a
  lookalike).
- **C2.** Given a seeded flash draw with modes `[free, reduced, reduced, free,
  free, reduced]`, when the sheet opens, then `flash_sheet_shown` has exactly
  §3.2's 5 keys, `fee_modes` in that order, and the same lands in PGlite. A
  5-restaurant seed logs 5 modes.
- **C3.** Given E1-E7 (§4.6), when tests drive the real sender, then each holds.
  `seq` is set inside `track()` before validation (E2), persists in
  `sessionStorage` key `parody.seq` (E3), and resets for a new `session_id`
  (E4).
- **C4.** Given `VERCEL_GIT_COMMIT_SHA` set to a 40-character hex string at
  build, when the row is built, then `build` is its first 12 characters; unset,
  `dev`. A test asserts the format against E7's pattern and that one page load
  sends one value.
- **C5.** Given `tracking.ts`'s validator, when it is mirrored to §3.1 and §3.2,
  then it accepts the new shapes and rejects the old ones (the client never
  sends an old shape again), with a test for each.
- **C6.** Given `about.astro` and `about-page.test.ts`, when the page is read,
  then:
  - the `order_placed` line says the event now records **which restaurant**
    the order was from;
  - the `flash_sheet_shown` line says it records **whether each restaurant on
    the deal was free-delivery or reduced-fee**;
  - a new line says every event carries **a counter** (how many events this
    tab has sent) **and a build id** (which version of the site sent it),
    "never anything about you";
  - the wallet paragraph reads that the balance is stored per account and is
    "never in the events above, **never joined by us, and never published**"
    to your account, replacing "never joined to the random browser ID" (D10).
    The paragraph must not claim the join is impossible.
  - Each line is asserted by its own test.
- **C7.** Given the four fields ship together (§4.4), when the client child is
  one PR, then no `order_placed.restaurant_slug`, `fee_modes`, `seq` or `build`
  is behind a separate flag or a later PR.

### 10.3 Child 3 — queries and docs

Depends on Child 1 merged. It needs only PGlite, not the deployed client.

- **Q1.** Given `docs/measurement/264-queries.sql`, when it is read, then it has
  one named, read-only, commented query per metric, **M1 through M20 (twenty
  queries)**, each implementing §7 exactly, on `received_at`, from
  `events_clean` or the views, with the window in a `params` CTE as
  `219-launch-queries.sql` does. `219-launch-queries.sql` is left in place as
  history with a one-line header pointing to the new file.
- **Q2.** Given a migration-style test (PGlite, rows inserted through the real
  path), when each query runs against a seeded fixture with hand-computed
  expected values, then the output is shown in the PR description, and the test
  asserts every number. The fixture must include the traps: an old-shape order
  (R4), a duplicate `order_id`, a pill-switch (`location_selected` with no
  `home_viewed`, M5), a wall prompt on day 1 with an order at hour 20 in a
  different `session_id` (M9), a short-balance block recovered at hour 20
  (M11) and one at hour 26 (not recovered), a session with `seq` `1,2,4` (M18
  = 1/4), a 6-restaurant `fee_modes` draw with one tap (M19), and two
  restaurants with different opens and orders (M20, never above 1).
- **Q3.** Given M3, when the fixture's browser appears on days 1 and 9, then it
  is returning on day 9 only if it has a row in days 2-8; a browser seen on day
  1 and day 9 with nothing between is **not** returning on day 9.
- **Q4.** Given R2's claim that `received_at - occurred_at` is seconds, when the
  child ships, then it also ships the one read-only query that measures it
  (`percentile_disc` of the difference, over rows with `seq > 0`), with a
  comment saying what a large value would mean, so the owner runs it on real
  rows. It states this as inferred until run.
- **Q5.** Given `docs/roadmap.md`, when it is read, then: the "What we can
  measure" table lists M1-M20 with M7 renamed "tracker return rate", M4's
  primary metric renamed "home-to-order conversion", M2 as "tab sessions" and
  M18-M20 present; the guardrail sentence reads "home-to-order conversion,
  loss rate (M18), and the #79 rule" with no mention of completion or M7; every
  "M1-M17" becomes "M1-M20"; and the queries link points to
  `264-queries.sql`. A test or a grep in the PR shows no stale "M1-M17" or
  "completion (M7)" remains.

## 11. What this document decides that reviewers may want to reverse

- **`seq` default is 0, not null.** Chosen so window functions and `not null`
  stay simple and "sent by a client with no counter" is one explicit value;
  real values start at 1, so the two never collide. The alternative, a
  nullable column, is equally readable and is the reversal.
- **`build` is 12 hex characters or `dev`.** Long enough to be unique in this
  repository's lifetime, short enough to read in a `group by`.
- **G6's 5% and 2-point figures** are provisional (§8.1).
- **The equal-length store check on `fee_modes`** is a deliberate exception to
  ADR 0007 (§3.2).
- **The tip variants of M9 stay tab-session-level.** #266 named only
  wall-to-order.
- **Two migration files rather than one** (§10.1).
