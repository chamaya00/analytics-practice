# Measurement contract, second pass: two new props, two envelope columns, M1-M20, and the derived entity views

Issue: #270 (child of objective #264). Decision log: #265 (D4-D11). Inputs:
`docs/research/266-fresh-analytics-assessment.md` (Part 2 and its
Recommendation) and `docs/research/267-data-infra-options.md`.

**This is a revision of `docs/measurement/219-analytics-readiness-contract.md`,
not a replacement.** #219 stays the base. Build against #219 as amended here.
This document states only what changes, and names every part of #219 it
keeps, so nothing has to be inferred from silence. It is a new file rather
than an edit to #219 for the reason #219 gave about #81: #219 is cited by
section from ADR 0012, ADR 0013, two migrations, `tracking.ts` and the launch
queries, and editing it in place would leave those citations quoting text
that no longer says what they quote.

Reads as fixed: ADR 0005 (the store), ADR 0007 (the store checks shapes, not
business invariants), ADR 0008 (the #79 rule), ADR 0012, ADR 0013, the
code on the default branch, and the decisions listed in #270's "Inputs,
already decided". Those decisions are not reopened here.

Decisions this document records, each with its own ADR in the same diff:

- ADR 0014: the two event-shape changes.
- ADR 0015: the `seq` and `build` envelope columns.
- ADR 0016: the metric redefinitions, M18-M20, G6, and the derived views.

## 1. The decision this serves

**Which of the roadmap's directions A-F to build first, read from numbers a
skeptical reader can trust.** In practice: where the home-to-order loop leaks
(per browser, per city and now per restaurant), whether browsers come back
within a week, which sources bring browsers that order, what the sign-in wall
and a short balance cost in orders, whether free delivery beats reduced
delivery in the flash sheet, and how much of the log is silently lost.

#219 served "does the launch work". Most of #219 serves both decisions, which
is why most of this document says *kept*.

**The primary metric is M4's home-to-order conversion.** It is distinct
browsers with an `order_placed`, divided by distinct browsers with a
`home_viewed`, both counted in window W on `received_at` (§9).

## 2. What changes, at a glance

**Changed:**

1. **Two props, both privacy calls approved on #265.**
   - `order_placed` gains `restaurant_slug` (D4).
   - `flash_sheet_shown` gains `fee_modes` (D5).
2. **Two envelope columns** on `public.events`, also approved on #265.
   - `seq` is a per-tab-session counter (D6).
   - `build` is the deploy's commit id (D7).
3. **Windows move to `received_at`** (R2). `occurred_at` is kept for ordering
   events within one browser.
4. **"Returning" gets a 7-day lookback** (R6 and M3).
5. **Metric changes, all redefined in place with no renumbering (O3):**
   - M2 is relabelled "tab sessions".
   - M4's ratios are named.
   - M5's cohort admits `location_selected`.
   - M7 becomes "tracker return rate" and leaves the guardrail list.
   - M9's wall-to-order and M11's recovery are measured per browser, within
     24 hours.
6. **New metrics:** M18 (loss rate), M19 (flash tap-through by treatment) and
   M20 (restaurant conversion). **M21 is not added** (D8).
7. **New guardrail:** G6, the loss rate.
8. **Three derived views:** `analytics.orders`, `analytics.sessions` and
   `analytics.visitors`. They are Postgres views in a migration, written in
   plain SQL, and there is no dbt in this pass (D11). §11 also names what #257
   should publish.

**Kept from #219, unchanged unless a section below says otherwise:**

- §1 (units), with the per-metric units now restated in §9;
- §3 (screens);
- §4 (money, city, the city/currency invariant, the 15 voucher ids);
- §5 (the row envelope, what a session is, and `is_internal`);
- §6 (acquisition and `session_started`);
- §7 (sign-in across the OAuth round trip);
- §8, every event row except the two in §4 below;
- §9 (the #79 check), extended in §7 below;
- §10 (not logged), extended in §6 below;
- rules R1, R3, R4, R5, R7 and R8 (R5 and R7 read R2's column, §8);
- guardrails G1-G5;
- §13's strict-superset posture;
- §14's requirements, where they apply to shapes this pass does not touch.

**Nothing is retired.** No event stops firing, and no shape stops being
accepted.

## 3. Units, and the one randomised treatment

- **No experiment arm ships.** `variant` stays `null` on every row, as in
  #219 §1. Nothing in this pass assigns a person to an arm.
- **The site already randomises one thing: the flash draw.** Each tab session
  draws once per city (`drawFlashDeal`, `src/lib/flash-deal.ts`). That makes
  it an experiment in fact, so its two units are stated here:
  - **Assignment units.**
    - The fee mode is drawn per restaurant slot: each of the 5-6 slots is
      independently `free` or `reduced`, 50/50.
    - The amount is drawn per sheet, one per (tab session, city).
  - **Exposure event.** `flash_sheet_shown`. It fires on the draw that
    `ensureFlashDraw` reports as new (`isNewDraw`). In `home-dom.ts`, the
    `track` call runs in the same synchronous task as the feed's first
    render and immediately before `openSheet()`, so it is logged before the
    browser paints anything that differs by draw. It fires whether or not the
    person then taps anything.
  - **Counting units.** M19a counts slots. M19b counts sheets.
  - **Who is outside it.** A tab session that never reaches a home feed has
    no draw. It is outside M19 altogether. It is not a comparison group.
- **Counting units for everything else,** fixed per metric in §9:
  - **browser** (`visitor_id`, labelled "browser" from now on, because that
    is what it identifies);
  - **tab session** (`session_id`);
  - **order** (`order_id`);
  - pairs built from these: (browser, city), (tab session, city), and
    (browser, restaurant).
- **Five actions by one unit are one observation.** Every browser, session
  and order count is `distinct`. Rows are never counted.

## 4. Events (AC1)

### 4.1 Every event, and what this pass does to it

**The store keeps accepting every shape it accepts today.** That covers every
#219 shape, and every #81 shape #219 kept. Open tabs keep sending old shapes
after a deploy, and a refused row is lost silently (ADR 0005). Retiring a
shape would be a new decision, and this pass makes none.

| # | Event | This pass | Notes |
|---|---|---|---|
| 1 | `session_started` | unchanged | |
| 2 | `location_selected` | unchanged | M5 now reads it as cohort entry (§9). |
| 3 | `home_viewed` | unchanged | |
| 4 | `restaurant_opened` | unchanged | `entry` is deferred to #204's follow-up (O4). |
| 5 | `cart_viewed` | unchanged | |
| 6 | `checkout_viewed` | unchanged | |
| 7 | `flash_sheet_shown` | **changed**: a new 5-key shape adds `fee_modes` (§4.3) | The 4-key shape (2, 5 or 6 slugs) is still accepted. |
| 8 | `flash_sheet_closed` | unchanged | |
| 9 | `order_placed` | **changed**: a new 15-key shape adds `restaurant_slug` (§4.2) | The 9-key (#81) and 14-key (#219) shapes are still accepted. |
| 10 | `tracker_viewed` | unchanged | |
| 11 | `order_delivered` | unchanged | M7 is renamed, not the event. |
| 12 | `rating_submitted` | unchanged | |
| 13 | `driver_rating_submitted` | unchanged | |
| 14 | `tip_sent` | unchanged | |
| 15 | `sign_in_prompt_shown` | unchanged | |
| 16 | `sign_in_started` | unchanged | |
| 17 | `sign_in_completed` | unchanged | |
| 18 | `wallet_short_shown` | unchanged | |

**The event-name CHECK does not change,** because no event name is added.
Every shape marked "unchanged" keeps #219 §8's key set, types, bounds, firing
rule and invariant exactly.

**From the client's release onwards, the client sends only the new shapes of
rows 7 and 9.** Its validator in `tracking.ts` accepts only those, the same
posture as #219 §14.

### 4.2 `order_placed`, 15-key shape (new)

**When it fires:** unchanged from #219 §8. It fires once, when the order is
written locally (`writeOrderAndTrack` in `checkout-dom.ts`).

**Sorted key set, matched exactly:**

```
['amount_minor', 'applied_voucher_ids', 'city', 'currency', 'delivery_instructions',
 'drop_off_preset', 'item_count', 'order_id', 'restaurant_slug', 'saved_amount_minor',
 'thanks_voucher_amount_minor', 'utensils', 'vip_level', 'vip_saved_amount_minor',
 'wallet_paid']
```

| Key | JSON type | Accepted values | Unchanged from #219's 14-key shape? |
|---|---|---|---|
| `amount_minor` | number, integer | #219 §4 nonzero bound for `currency` (USD 1-100000, VND 1-5000000) | yes |
| `applied_voucher_ids` | array | 0-2 distinct strings, each one of #219 §4's 15 ids | yes |
| `city` | string | `sf`, `hcmc`, `la` | yes |
| `currency` | string | `USD`, `VND` | yes |
| `delivery_instructions` | string | `leave_at_door`, `hand_to_me`, `meet_downstairs`, `call_on_arrival` | yes |
| `drop_off_preset` | string | `home`, `office`, `front_desk` | yes |
| `item_count` | number, integer | 1-999 | yes |
| `order_id` | string | uuid, matching `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` | yes |
| **`restaurant_slug`** | **string** | **1-60 characters, matching `^[a-z0-9]+(-[a-z0-9]+)*$`** | **new** |
| `saved_amount_minor` | number, integer | §4 zero-allowed bound (USD 0-100000, VND 0-5000000) | yes |
| `thanks_voucher_amount_minor` | number, integer | §4 zero-allowed bound | yes |
| `utensils` | boolean | `true`, `false` | yes |
| `vip_level` | string | `none`, `gold`, `platinum` | yes |
| `vip_saved_amount_minor` | number, integer | §4 zero-allowed bound | yes |
| `wallet_paid` | boolean | `true`, `false` | yes |

**The value of `restaurant_slug`.** It is the checkout's own
`restaurantSlug`: the slug of the cart being ordered, the same value
`placeOrder` already receives. It is never inferred from a menu view.

**Client-tested invariants.** The store does not check these (ADR 0007):

- every §8 invariant of #219's `order_placed` still holds;
- `cityForRestaurantSlug(restaurant_slug) = city`;
- `restaurant_slug` equals the `restaurant_slug` of the `restaurant_opened`
  that the cart's restaurant page fires.

### 4.3 `flash_sheet_shown`, 5-key shape (new)

**When it fires:** unchanged from #219 §8. It fires when a tab session's
first home-feed load for a city draws the flash deal (`isNewDraw`), and at
most once per (`session_id`, `city`).

**Sorted key set, matched exactly:**

```
['amount_minor', 'city', 'currency', 'fee_modes', 'restaurant_slugs']
```

| Key | JSON type | Accepted values | Unchanged? |
|---|---|---|---|
| `amount_minor` | number, integer | `200`-`600` when `USD`, `10000`-`30000` when `VND` | yes |
| `city` | string | `sf`, `hcmc`, `la` | yes |
| `currency` | string | `USD`, `VND` | yes |
| **`fee_modes`** | **array** | **Each element is a string, `free` or `reduced`. The array's length equals `restaurant_slugs`' length. Repeats are allowed.** | **new** |
| `restaurant_slugs` | array | **5 or 6** distinct strings, each 1-60 characters, matching `^[a-z0-9]+(-[a-z0-9]+)*$`. A length of 2 is **not** accepted in this shape. | yes, minus the legacy length 2 |

**The value of `fee_modes`.** It is
`draw.restaurants.map((r) => r.feeMode)`, taken from the same `draw` object
as `restaurant_slugs`, so `fee_modes[i]` is the fee mode drawn for
`restaurant_slugs[i]`. Both arrays are in drawn order, and neither is
truncated.

**Why the store checks the length match.** It checks that the two arrays have
equal length, although it checks no other cross-field rule on this event. The
two arrays are one structure (slot *i*'s restaurant and slot *i*'s treatment),
and a row whose arrays do not align cannot be read at all. The client's
validator drops the same rows first, so the store's check costs no extra
loss. ADR 0014 records why this is not a breach of ADR 0007. The store already
checks structure-coupled fields, such as `flash_sheet_closed.restaurant_slug`
against its `outcome`.

### 4.4 The `event_is_valid` rule, for the migration

This is normative: the store must accept exactly this. Let `prev` be the
validator that is live before this migration.

- **`order_placed` is accepted when either of these holds:**
  - `prev('order_placed', props)` is true (the 9-key or 14-key shape, exactly
    as today); **or**
  - all of the following hold:
    - the sorted keys equal §4.2's 15-key list;
    - `jsonb_typeof(props->'restaurant_slug') = 'string'`;
    - its length is 1-60;
    - it matches the slug pattern;
    - `prev('order_placed', props - 'restaurant_slug')` is true. Given the
      key check, the remainder is exactly the 14-key shape, so every shared
      field is checked by the same code as today.
- **`flash_sheet_shown` is accepted when either of these holds:**
  - `prev('flash_sheet_shown', props)` is true (the 4-key shape, 2, 5 or 6
    slugs, exactly as today); **or**
  - all of the following hold:
    - the sorted keys equal §4.3's 5-key list;
    - `prev('flash_sheet_shown', props - 'fee_modes')` is true;
    - `jsonb_array_length(props->'restaurant_slugs') in (5, 6)`;
    - `jsonb_typeof(props->'fee_modes') = 'array'`;
    - `jsonb_array_length(props->'fee_modes') = jsonb_array_length(props->'restaurant_slugs')`;
    - every element `e` of `fee_modes` has `jsonb_typeof(e) = 'string'`, and
      `e #>> '{}'` is `free` or `reduced`.
- **Every other event name** is `prev(event_name, props)`, unchanged.
- **Null never passes.** Each new branch is wrapped in `coalesce(..., false)`,
  so a missing or mistyped value refuses the row.

**Recommended construction.** Follow ADR 0013's wrapper:

1. Rename today's `public.event_is_valid` to `public.event_is_valid_225`,
   keeping its body, owner and execute grant.
2. Create a new `public.event_is_valid` that decides the two new shapes and
   passes everything else to `event_is_valid_225`.
3. Drop and recreate the insert policy `events_insert_anon` against the new
   function, with the same name, role and expression.

`event_is_valid_225` keeps its execute grant because the RLS check runs as
`anon` (ADR 0013, "Alternatives rejected").

**Refusals the store child's tests must show:**

- a 15-key `order_placed` whose `restaurant_slug` is `""`, 61 characters long,
  `Pho_Place`, or a number;
- a 10-key `order_placed`: the 9-key shape plus `restaurant_slug`;
- a 16-key `order_placed`: the 15-key shape plus `extra`;
- a 5-key `flash_sheet_shown` with 2 slugs;
- a 5-key `flash_sheet_shown` with 6 slugs and 5 `fee_modes`;
- a 5-key `flash_sheet_shown` with a `fee_modes` element `half`, or `true`;
- a 5-key `flash_sheet_shown` with duplicate slugs.

## 5. Row envelope: `seq` and `build` (AC2)

### 5.1 The columns

Both are new columns on `public.events`. Neither goes in `props`: exact
key-set matching would make every shape an open tab sends fail to match
(#219 §5's reason for `is_internal`, recorded in `docs/memory/analyst.md`).

| Column | Type | Nullable | Default: what an old tab's insert gets | CHECK | anon grant |
|---|---|---|---|---|---|
| `seq` | `integer` | yes | `null` | `seq between 1 and 100000` (a null passes, as every Postgres CHECK does) | `grant insert (seq) on public.events to anon` |
| `build` | `text` | yes | `null` | `build ~ '^[0-9a-f]{40}$' or build = '(unknown)'` (a null passes) | `grant insert (build) on public.events to anon` |

**What a null means.** In both columns, `null` means *sent by a client from
before this pass*. That is R4's "absent means older client", applied to the
envelope. It never means zero, and never means "unknown build".

- A tab still running the previous client sends neither key. Its insert lands
  with both columns `null`.
- The new client **always** sends `build`, and never sends it as `null`.
- The new client sends `seq` as `null` only when its counter could not be
  read or written (§5.2).

**`events_clean` must be recreated after the columns are added.** A
`select e.*` view does not pick up a new column until it is recreated
(ADR 0013 did the same). The definition is unchanged:

- it is still `security_invoker = true`;
- it still excludes every visitor with any `is_internal` row;
- it is still revoked from `anon` and `authenticated`.

### 5.2 `seq`: a per-tab-session counter

**What it is.** An integer that numbers every event the client *tries* to
log in one tab session, 1, 2, 3 and so on. Gaps between the numbers that
arrive are events that did not arrive.

**Where it lives.** In `sessionStorage` key `parody.seq`, as the JSON
`{"session_id": "<uuid>", "last": <integer>}`.

- It persists across reloads and same-tab navigations, including the OAuth
  round trip, exactly like `parody.sessionId` (#219 §5).
- It ends when the tab closes.

**When it is set.** At the very top of `track()`, **before**
`isValidEventProps` runs. For every call:

1. Read the current `session_id` with `getSessionId(sessionStorage)`. This
   creates one if absent, exactly as the sender would.
2. Read `parody.seq`. If it is absent, cannot be parsed, has a `session_id`
   different from the current one, or has a `last` that is not an integer from
   0 to 100000, take `last = 0`. **So `seq` starts at 1 per `session_id`.**
3. If `last` is 100000, go to step 5. Otherwise `next = last + 1`, and write
   `{"session_id": <current>, "last": next}` back to `parody.seq`.
4. That call carries `seq = next`. The value is fixed at this moment and
   travels with the call:
   - through the #245 queue, if no sender is set yet;
   - into `buildEventRow`, which copies it into the row's `seq` field.

   The sender never assigns, recomputes or changes `seq`.
5. **If step 1, 2 or 3 throws** (storage blocked, or a quota error), or
   `last` is already 100000, that call carries `seq = null`, and its row still
   sends if the sender can build it. The counter is not reset, so the numbers
   already issued in that session never repeat.

**`session_started` is numbered by the same counter.** It is sent by
`startSessionOnce` without passing through `track()`, so it takes its number
from the same counter at the moment `startSessionOnce` hands it to `send`.

- On a tab's first page load, page scripts call `track()` before the
  initialiser runs (#245), so their calls take the lower numbers.
  `session_started` **is not necessarily `seq = 1`**, and no test may assert
  that it is.

**Why "before validation" matters.** A call dropped by any of the following
still consumed a number, so it shows up as a gap:

- the client validator;
- the 50-call queue cap;
- the 1 KB byte cap;
- the store's refusal;
- the rate limit;
- the clock bound;
- the network.

Loss after the counter becomes measurable in production, including the
client's own contract bugs (#266, "Data quality", item 1).

**What `seq` cannot see:**

- loss before the counter, such as a tab whose `sessionStorage` is blocked
  (it sends nothing at all);
- the tail of a session: an event with no later event in that session leaves
  no gap behind it;
- a session whose every row was lost.

M18 reads accordingly (§9).

**A duplicated tab copies `sessionStorage`.** That includes `parody.sessionId`
and `parody.seq` (MDN, cited in #266 finding 4). Two tabs then continue one
counter and can issue the same `seq`, so duplicate (`session_id`, `seq`)
pairs are expected in the data. They are not a client bug. M18 counts
`distinct seq`, so duplicates are never counted twice, and the loss read is a
slight under-count in that case.

### 5.3 `build`: which deploy produced the row

**Source.** Vercel's system environment variable `VERCEL_GIT_COMMIT_SHA`,
read at `astro build` time, never at runtime.

**Format.** The full 40-character commit SHA, lowercased, matching
`^[0-9a-f]{40}$`. If the variable is absent at build time, or is not 40
hexadecimal characters after lowercasing, the value is the literal
`(unknown)`. That happens in local development, in CI, and on a build where
Vercel's system variables are not exposed. The parentheses follow #219 §6's
sentinel convention: `(unknown)` can never equal a real SHA.

**How it reaches the row.**

- It is a constant compiled into the client bundle, for example through
  `vite.define` in `astro.config.mjs`, because Astro exposes only `PUBLIC_`
  variables to client code.
- `buildEventRow` puts it on every row.
- Every row one bundle sends carries the same value.

**Assumption, checked by the owner after the first deploy.** Vercel exposes
`VERCEL_GIT_COMMIT_SHA` to the build step. That is the default ("Automatically
expose System Environment Variables"), but it was not verified from here. The
client child's owner check (§13) confirms it on live rows.

**What it is for.**

- "Before vs after" a change splits on the code that produced each row, not
  on the clock. Open tabs keep running the old bundle after a deploy.
- It makes G1 exact.
- It gives M20 a clean denominator.

It describes the site, and is identical for every visitor on that deploy
(D7).

### 5.4 Old tabs, and the order the two children ship in

- **Store first is safe.** After the store migration, an old tab's insert
  omits `seq` and `build`, and lands with both `null`. Its #219 shapes are
  still accepted (§4.1).
- **Client first is not.** Suppose the new client is live before the owner
  has applied the migration:
  - every insert names two columns PostgREST does not know, and is refused;
  - every 15-key `order_placed` and every 5-key `flash_sheet_shown` is
    refused by today's validator.

  That is every event from every new page load, lost silently.
- **So the client child's pull request merges only after the owner has
  applied the store migration** and the confirming SQL (§13, store child)
  shows it. This is a merge gate, not a suggestion. Vercel deploys on merge.

### 5.5 Invariants a test can violate

Each is listed again, with where it is tested, in §14.

- **Q1.** In one tab, three `track()` calls with the second call invalid
  produce exactly two rows, with `seq` 1 and 3, and no row with `seq` 2.
- **Q2.** Seed `parody.seq = {"session_id": "<other uuid>", "last": 7}`. The
  next call's row has `seq = 1`.
- **Q3.** After a simulated reload (a fresh module instance over the same
  `sessionStorage`), the next call's `seq` is the previous `last + 1`.
- **Q4.** Calls made before `setTrack` keep the `seq` they were given at
  call time, after the queue flushes. `session_started` gets a `seq` that
  differs from every other row of that load.
- **Q5.** No two rows built from one `sessionStorage` share a `seq`.
- **Q6.** When `sessionStorage.setItem` throws, the call's row carries
  `seq: null`, and the send still happens.
- **Q7 (store).** An insert that omits `seq` lands with `seq is null`.
  - `seq` values 1 and 100000 are accepted.
  - `seq` values 0, −1 and 100001 are refused.
- **B1.** Two events from one page load carry equal `build` values.
- **B2.** When built with `VERCEL_GIT_COMMIT_SHA` set to a 40-hex value
  containing upper-case letters, rows carry that value lowercased. When built
  with it unset, rows carry `(unknown)`.
  - Neither case ever sends `null`.
- **B3 (store).** An insert that omits `build` lands with `build is null`.
  - A 40-hex value is accepted, and so is `(unknown)`.
  - These are refused: a 39-hex value, a 41-hex value, a value with upper-case
    hex, `abc`, and `unknown` without parentheses.

## 6. Not logged, and why (additions to #219 §10)

#219 §10 stands in full. This pass adds these decided omissions:

- **`drip_claimed`.** Not in this pass (D8). It is conditional on direction A
  being shortlisted, and A is not. Its reconstructability caveat (claims plus
  subtotals plus tips roughly gives a balance) is the closest any proposal
  came to the #79 rule's spirit. **M21 is not added** for the same reason.
- **`restaurant_opened.entry`** (`carousel`/`tile`/`flash_sheet`/`other`).
  Deferred to #204's follow-up (O4). The carousel slot is still being
  designed, and readiness follows the product (the #79 rule). An ad slide's
  tap leaves the site and opens no restaurant, so it needs its own record,
  which #204's follow-up designs.
- **`payment_path` on `order_placed`.** Withdrawn by #266 Part 2.
  - While the wallet is live, `wallet_paid = false` already means "the
    infrastructure did not answer".
  - Wallet-on and wallet-off periods now split exactly by `build`.
- **A per-slide carousel event.** Withdrawn in favour of `entry` above.
- **A device or browser class on `session_started`.** No A-F decision needs
  it. Each coarse attribute also makes a row more recognisable at launch
  volume (#266, "What to log").
- **`prior_send_failures` on `session_started`** (#267, Change 2).
  - Not adopted. `seq` already measures failed sends from the data, whenever
    a later event in the session lands.
  - A new prop would be a new `session_started` shape and a new privacy call,
    for the one case (a whole session lost) that neither design can see
    reliably.
- **A refusal-count table** (`private.write_refusals`, #266 "Data quality",
  item 2). Deferred.
  - It changes how the store refuses rows. It has to be proved in PGlite first,
    behind its own engineer issue.
  - If that spike succeeds, it gets its own ADR.
- **An analytic "visit" (a 30-minute inactivity session).** Not built in this
  pass.
  - No M-number reads it.
  - #266 Part 2 made it a teaching asset, not a metric basis.
  - When #257 (or dbt, once approved) builds it, it is named `visits`, so that
    "session" keeps meaning `session_id` everywhere (§11, ADR 0016).
- **The order total, delivery fee and service fee.** Still not logged, as in
  #219 §10. With `restaurant_slug` and the catalogue's fees, a total becomes
  roughly reconstructable. That is D4's accepted caveat: no account key is
  added, so the debit stays unjoinable in events.

## 7. The #79 rule, checked for this pass

**The rule.** No email, account id, auth user id, wallet balance, debit or
typed amount appears in any event (ADR 0008). Every new field passes:

| Field | What it holds | Why it passes | Decided |
|---|---|---|---|
| `order_placed.restaurant_slug` | A public catalogue slug, already in every menu URL | It is not account data, and no account key is added | D4 |
| `flash_sheet_shown.fee_modes` | `free`/`reduced` per drawn slot | It describes the site's draw, not the visitor | D5 |
| `seq` | A per-tab counter that restarts at 1 in every tab session | A counter, not an identifier. It links nothing that `session_id` does not already link | D6 |
| `build` | The deploy's commit SHA | It is the same for every visitor on that deploy | D7 |

**The derived views join nothing new.** `analytics.*` reads only
`public.events_clean` and other `analytics` views. None depends on a relation
in `private`, `auth` or any wallet table. The store child tests this
(§14, S6).

**D10: About's wording.** About says the wallet balance is "never joined to
the random browser ID". The owner *can* make that join, through
`order_id = private.wallet_debits.order_id` (#266 finding 7). About must
therefore say that events and accounts are **"never joined by us, and never
published"**. The join itself is not broken in this pass. The client child
carries the wording (§13).

**D9: re-keying in #257's snapshots.** §11.4 gives it.

## 8. Rules every query follows (changes to #219 §11)

| Rule | This pass | Old reading | New reading |
|---|---|---|---|
| R1 Source | kept | Read `public.events_clean`, never `public.events`. | Unchanged. The `analytics` views also read only `events_clean`. |
| **R2 Time** | **changed** | Window on `occurred_at`. A day is `(occurred_at at time zone 'UTC')::date`. A day can still change for 24 hours after it ends. | See the text below the table. |
| R3 City of a row | kept | `coalesce(props->>'city', case props->>'currency' when 'VND' then 'hcmc' when 'USD' then 'sf' end)`. | Unchanged. It is still correct: no pre-#219 client can produce an LA basket. |
| R4 Shape boundary | kept | A metric reading a new prop counts only rows that have the key, in numerator and denominator. | Unchanged. It now also covers `restaurant_slug` and `fee_modes`. The envelope's version of it is a `null` `seq`/`build` (§5.1). |
| R5 Session day | kept, on R2's column | UTC day of the session's minimum `occurred_at`. | UTC day of the session's minimum `received_at` (`analytics.sessions.session_day`). |
| **R6 First seen, now the lookback** | **changed** | A visitor's first-seen day is the UTC day of their minimum `occurred_at` over all rows, unwindowed. M3 compares it with D. | A browser is **returning on D** when it has at least one row whose UTC `received_at` day is in **[D−7, D−1]**. M3 no longer reads all history. `analytics.visitors.first_seen_at` still exists, for M6c and for learners. |
| R7 Order cohorts | kept, on R2's column | Cohort from `order_placed.occurred_at` in W. Later events count whenever they happened. | Cohort from `analytics.orders.placed_at` (the canonical `order_placed` row's `received_at`) in W. Later events count whenever they happened, so recent cohorts are still maturing. |
| R8 Source of a session | kept | The earliest `session_started` by `occurred_at`, then `id`. #219's `case` expression. `(unknown)` when there is none. | Unchanged. It is `analytics.sessions.source`. |

**R2, the new reading.**

- **Windows and days use `received_at`.**
  - A day is `(received_at at time zone 'UTC')::date`.
  - Windows are half-open, `[start, end)`, on `received_at`.
  - `received_at` is the server's clock and is set on insert, so a day is
    final at 00:00 UTC the next day.
- **Order within one browser or one session uses `occurred_at`, then `seq`,
  then `id`.** So does the elapsed time between two events of one browser
  (the 24-hour horizons in M9 and M11). Both ends come from the same device
  clock, so the device's skew cancels out.
- **Why the change.** This client stamps `occurred_at` at send time
  (`buildEventRow`), so the only thing it adds over `received_at` is device
  clock error. Windowing on it moves a phone's events into the wrong UTC day
  whenever its clock is off, and leaves every day revisable for 24 hours
  (#266 Part 2, "Where the assessment holds", item 1).

**Rule for every M-query: report the counts beside every rate.** A rate
query outputs its numerator and its denominator as well as the rate, as
#219's queries already do and as the roadmap requires. An empty window
returns no rows or nulls, never a made-up zero.

## 9. Metrics M1-M20 (AC3)

These rules hold for every row of the table:

- W is a half-open window on `received_at` (R2).
- "Cohort W" means R7: orders whose `analytics.orders.placed_at` is in W.
- Every count is `distinct` on the unit named.
- The Old → new column states the previous reading of every metric this pass
  changes. "R2 only" means the definition is unchanged except that the window
  column moves from `occurred_at` to `received_at`.

| M | Name | Numerator ÷ denominator (or "count") | Unit | Window | Old → new |
|---|---|---|---|---|---|
| M1 | **Browsers by day** | **Count.** `count(distinct visitor_id)` over rows with UTC `received_at` day D. No denominator, by design. | browser | day D | Old: "visitors by day", on `occurred_at` days. New: labelled "browsers", on `received_at` days. |
| M2 | **Tab sessions by day** (a diagnostic) | **Count.** `analytics.sessions` rows with `session_day = D`. No denominator, by design. | tab session | session day D (R5) | Old: "sessions by day", day of the minimum `occurred_at`, read as visits. New: relabelled "tab sessions", a diagnostic only (a tab is not a visit), day of the minimum `received_at`. |
| M3 | **Returning browsers** | Returning(D) ÷ M1(D). Returning(D) = browsers active on D with at least one row on a UTC `received_at` day in [D−7, D−1] (R6). | browser | day D, plus a 7-day lookback | Old: active on D with a first-seen day before D, over all history. New: a 7-day lookback. |
| M4 | **Home-to-order funnel.** The primary metric is **home-to-order conversion** | S1 = browsers with ≥ 1 `home_viewed` in W. S2-S5 = members of S1 with ≥ 1 `restaurant_opened`, `cart_viewed` with `item_count ≥ 1`, `checkout_viewed`, or `order_placed` in W, in any order. **Home-to-order conversion = \|S5\| ÷ \|S1\|.** Step conversion = \|Sk\| ÷ \|Sk−1\|. **Checkout-to-order conversion** is that ratio for k = 5: \|S5\| ÷ \|S4\|. | browser | W | Old: \|S5\| ÷ \|S1\|, which the roadmap called "checkout conversion", on `occurred_at`. New: that ratio is named **home-to-order conversion**. \|S5\| ÷ \|S4\| is named **checkout-to-order conversion**. `received_at`. |
| M5 | **Funnel by city** | For each city c: \|S5(c)\| ÷ \|S1(c)\|. S1(c) = (browser, c) pairs with ≥ 1 `home_viewed` whose `city = c` **or** ≥ 1 `location_selected` whose `city = c`, in W. Steps 2-5 as in M4, counted only on rows whose row city (R3) is c. | (browser, city) pair | W | Old: cohort from `home_viewed` only, which missed city switches from the header pill (they fire no `home_viewed`). New: the cohort also admits `location_selected`. |
| M6 | **Acquisition by source** (a, b, c) | a: sessions with session day D and source s (R8) ÷ all sessions with session day D. `(unknown)` stays in the base. b: sessions with source s and session day in W that have ≥ 1 `order_placed` in the same session ÷ those sessions. c: browsers whose first-touch `session_started` (`analytics.visitors.first_touch_at`) is in W, by first-touch source s, with ≥ 1 order ever ÷ those browsers. | a and b: tab session. c: browser | D or W | R2 only. The in-app-browser caveat is added: a LinkedIn in-app view and Safari can be two browsers (#266 Part 2, "What neither caught"). |
| M7 | **Tracker return rate** (it is no longer a guardrail) | Orders in cohort W with `delivery_seen_at` not null ÷ orders in cohort W. | order | cohort W | Old: "completion rate", listed as a roadmap guardrail. New: renamed. Every order is delivered by construction, so the ratio measures return to the tracker (#266 finding 1). It is an engagement metric, and it is off every guardrail list. |
| M8 | **Rating rates** | Restaurant: orders in cohort W with `delivery_seen_at` and `restaurant_rated_at` not null ÷ orders in cohort W with `delivery_seen_at` not null. Driver: the same, with `driver_rated_at`. | order | cohort W | R2 only. |
| M9 | **Sign-in wall** | Per surface (`checkout` or `tip`). **Start:** sessions in P with ≥ 1 `sign_in_started` for that surface ÷ \|P\|. **Pass:** sessions in P with ≥ 1 `sign_in_completed` for that surface with `outcome = success` ÷ \|P\|. **Wall-to-order:** browsers in P_b with ≥ 1 `order_placed` (tip surface: `tip_sent`) whose `occurred_at` is in (t0, t0 + 24 h] ÷ \|P_b\|. Definitions of P, P_b and t0 are below the table. | start and pass: tab session. Wall-to-order: browser | W | Old: wall-to-order counted sessions in P with an `order_placed` later in the same session. New: counted per browser, within 24 hours. Start and pass are unchanged apart from R2. |
| M10 | **Wallet-paid share** | Orders in cohort W with `wallet_paid = true` ÷ orders in cohort W with `wallet_paid` not null (R4). | order | cohort W | R2 only. |
| M11 | **Short-balance recovery** | Browsers in B with ≥ 1 `order_placed` whose `occurred_at` is in (t0, t0 + 24 h] ÷ \|B\|. Definitions of B and t0 are below the table. | browser | W | Old: sessions with a checkout `wallet_short_shown`, recovered by an `order_placed` later in the same session. New: per browser, within 24 hours. A drip window can be 9 hours, and recovery usually happens in a later tab. |
| M12 | **Tip rate** | Orders in cohort W with `tipped_at` not null ÷ orders in cohort W with `wallet_paid = true` and `delivery_seen_at` not null. | order | cohort W | R2 only. |
| M13 | **VIP mix** | For each level v: orders in cohort W with `vip_level = v` ÷ orders in cohort W with `vip_level` not null (R4). | order | cohort W | R2 only. |
| M14 | **Thanks-voucher use** | Orders in cohort W with `thanks_voucher_amount_minor > 0` ÷ orders in cohort W with `thanks_voucher_amount_minor` not null (R4). | order | cohort W | R2 only. |
| M15 | **Voucher attachment** | Orders in cohort W with `applied_voucher_count > 0` ÷ orders in cohort W. | order | cohort W | R2 only. |
| M16 | **Flash view-to-action** | (session, city) pairs with ≥ 1 `flash_sheet_closed` with `outcome = restaurant_tapped` ÷ (session, city) pairs with a `flash_sheet_shown` whose `received_at` is in W. | (tab session, city) pair | W | R2 only. M19 splits it by treatment. |
| M17 | **Location switch rate** | Browsers with ≥ 1 `location_selected` with `is_switch = true` in W ÷ browsers with ≥ 1 `location_selected` in W. | browser | W | R2 only. |
| M18 | **Loss rate** (new, and guardrail G6) | Σ `seq_lost` ÷ Σ `seq_max`, over `analytics.sessions` rows with `session_day = D` and `seq_max` not null. Report Σ `seq_max`, Σ `seq_lost` and the session count beside it. | event slot: one `seq` value issued in a tab session | session day D (R5) | New. |
| M19 | **Flash tap-through by treatment** (new) | **a, by fee mode:** tapped slots with fee mode m ÷ shown slots with fee mode m, over `flash_sheet_shown` rows that carry `fee_modes` (R4). **b, by amount:** sheets with a `restaurant_tapped` close ÷ sheets shown, for each `amount_minor`. Both are also split by city. | a: slot (tab session, city, restaurant). b: (tab session, city) pair | W on `flash_sheet_shown.received_at` | New. |
| M20 | **Restaurant conversion** (new) | For each restaurant r: browsers in R(r) with ≥ 1 `order_placed` whose `restaurant_slug = r`, received in W ÷ \|R(r)\|. R(r) = browsers with ≥ 1 `restaurant_opened` for r, received in W, **with `build` not null**. | (browser, restaurant) pair | W | New. |

That is 20 rows, one per metric.

**Definitions the table relies on, precise enough to query:**

- **M3's first week.** M3 under-reads for the first 7 days of the store's
  life, because there is no full lookback yet. Label it that way. A browser
  that Safari's ITP resets after 7 idle days is new to both definitions. The
  7-day horizon exists so that ITP stops dominating the reading (#266
  finding 5).
- **M4 and M5 steps are unordered.** A step ratio above 1 is a reading, not a
  bug: a browser can enter mid-funnel, for example with a saved cart. That is
  #219's reasoning, and #266 Part 2 upholds it.
- **M9's sets.**
  - P (per surface) = tab sessions whose first `sign_in_prompt_shown` for that
    surface, by (`occurred_at`, `seq`, `id`), has its `received_at` in W.
  - P_b (per surface) = browsers with ≥ 1 `sign_in_prompt_shown` for that
    surface whose `received_at` is in W.
  - t0 = the `occurred_at` of that browser's earliest such row in W.
  - Read wall-to-order at least 24 hours after W ends. Until then, the last
    day's browsers are still maturing.
- **M11's sets.**
  - B = browsers with ≥ 1 `wallet_short_shown` with `surface = 'checkout'`
    whose `received_at` is in W.
  - t0 = the `occurred_at` of that browser's earliest such row in W.
  - Read it at least 24 hours after W ends.
- **M18, step by step.**
  - For each tab session with any non-null `seq`:
    - `seq_max` = its largest `seq`;
    - `seq_distinct` = its count of distinct `seq` values;
    - `seq_lost` = `seq_max − seq_distinct`.

    All three are `analytics.sessions` columns.
  - Only rows with a non-null `seq` enter. A tab that ran an old bundle for
    its first pages and the new one after contributes only its new-bundle
    rows. Those start at 1, because the old bundle never wrote `parody.seq`.
  - Tail loss and whole-session loss are invisible (§5.2), so M18 is a
    **lower bound** on loss. Label it that way.
- **M19's slots.**
  - Take each `flash_sheet_shown` row f that carries `fee_modes` and was
    received in W. Slot i of f is
    (`f.session_id`, `f.props->>'city'`, `restaurant_slugs[i]`,
    `fee_modes[i]`, `amount_minor`).
  - A slot is **tapped** when a `flash_sheet_closed` row exists, at any time,
    with the same `session_id` and `city`,
    `outcome = 'restaurant_tapped'` and `restaurant_slug` equal to the slot's
    slug.
  - If a (session, city) has more than one `flash_sheet_shown` (a G2-style
    breach of #219 §8's invariant), use the earliest by
    (`occurred_at`, `seq`, `id`).
  - **Read M19a as a comparison between modes, never as a sum.**
    - A sheet has at most one tap, so the slots in one sheet compete, and they
      are not independent observations.
    - Its confidence interval must cluster by sheet.
    - As a size guide only: telling a 10% slot tap-through from 15% needs
      roughly 680 slots per mode, before that clustering. That is
      (1.96 + 0.84)² × (0.09 + 0.1275) ÷ 0.05². Five or six slots per sheet
      make it a few hundred sheets, and more once clustered.
  - M19b uses every `flash_sheet_shown` row, of either shape, because
    `amount_minor` has been on both.
- **M20's boundary.**
  - `restaurant_slug` ships in the same client release as `build`. So "the
    `restaurant_opened` row has `build` not null" is exactly "sent by a
    client that also sends `restaurant_slug` on its orders". That is R4
    applied to a denominator whose own event gained no key.
  - Report each restaurant's counts beside its rate. A restaurant with a
    handful of browsers is not a finding.

**North star wording.** The roadmap's north star says "weekly visitors who
*complete* an order". Every order completes by construction (M7's rename), so
it should read "weekly browsers who **place** an order". That is distinct
browsers with an `order_placed` whose `received_at` is in the ISO week. This
is wording, not a new M-number. The queries-and-docs child carries it.

## 10. Guardrails, ship and stop, and failure cases

### Guardrails: what must not move, and what it means if it does

- **G1-G5 are kept,** with their thresholds and meanings as in #219 §12,
  on R2's column.
- **G1 is made exact by `build`.** For this pass, new-client coverage is the
  share of rows per UTC `received_at` day whose `build` is not null. It must
  pass 95% within three days of the client deploy. #219's `order_placed`
  city-key coverage still applies to its own shapes.
- **G6 (new): the loss rate, M18.** Two parts:
  - **Level.** On any session day with Σ `seq_max` ≥ 200, M18 is ≤ 5%. Below
    200 slots, report it and do not judge it.
  - **Deploy.** A deploy's first full UTC day is the first day on which more
    than half of the rows carry the new `build`. On that day, M18 is no more
    than 2 percentage points above its mean over the 7 days before.
  - **Precondition.** Among rows with `build` not null, the share with `seq`
    null is ≤ 1%. Above that, the counter itself is failing and M18 cannot be
    read.
  - **If G6 breaks,** something between `track()` and the store is dropping
    events: the client validator disagreeing with the store, a refused shape,
    the rate limit behind shared IPs, or clock skew. Every rate that day is
    read over a thinned sample, and a launch that raises G6 is breaking the
    measurement, whatever else it does.
- **The launch guardrails the roadmap lists** become three:
  - M4's home-to-order conversion;
  - G6, the loss rate;
  - the #79 rule.

  **M7 is off the list.** It could not fail for the reason it named.

**The claim this pass makes, and where it could be wrong.**

- The claim: old-shape and new-shape rows are comparable under R3 and R4.
- M18, M19a and M20 read only rows from the new client, so they describe that
  subset until G1-by-build passes 95%. Label them "new client only" until
  then.
- The R2 change moves every historical day boundary from device time to
  server time. A day's count computed before and after this change can differ
  by the rows whose device clock put them on the other side of midnight UTC.
  That difference is the correction, not a regression.

### Ship and stop

**Read this pass's new-field metrics (M18, M19a, M20) only when all of these
hold:**

1. The owner has applied the store migration and its confirming SQL passes
   (§13).
2. The client child has merged **after** step 1, and is deployed.
3. A row from the live site carries the deploy's 40-character commit in
   `build`, not `(unknown)`.
4. G1-by-build is ≥ 95% for a full day.
5. G2 and G6 hold.

**Stop, fix, and do not publish a number if any of these happens:**

- G4 fires;
- G6 breaks, or its precondition fails;
- live rows carry `build = '(unknown)'`;
- G2 breaks either threshold;
- G5 is non-zero;
- an internal visitor's rows appear in `events_clean` or in any `analytics`
  view.

### Failure cases

- **An old tab after the migration.** It sends #219 shapes with no `seq` or
  `build`. The store accepts them, with both columns `null`. They count
  everywhere #219 counted them. They are outside M18, M19a and M20's
  denominators by definition, not by accident.
- **The new client before the migration.** Every row is refused (§5.4). G4
  would show it, after the fact. The merge gate exists so that it never
  happens.
- **The counter cannot persist** (storage blocked or full). The row sends with
  `seq = null`. It still counts in every other metric, and it is outside M18.
  G6's precondition catches it if it is common.
- **A duplicated tab.** Duplicate (`session_id`, `seq`) pairs appear. M18
  counts distinct `seq`, so they inflate nothing, and loss is slightly
  under-read.
- **A duplicate `order_placed` for one `order_id`.** This is a client
  guard bug, or a forged row. `analytics.orders` keeps one row (the earliest
  by `received_at`, then `id`), and `placed_rows` shows the count. Order-unit
  metrics are unaffected.
- **Post-order events with no `order_placed`.** The `order_placed` was lost,
  or was sent before tracking was configured. They are not in
  `analytics.orders`, whose grain is an `order_placed`. Order metrics never
  count them, and they still count in browser metrics.
- **A person who never signs in.** Unchanged from #219: they are counted in
  every browser and funnel metric, and they are outside M9-M12's bases.
- **A tab session with no flash draw.** It is outside M19. It is not a
  comparison group.
- **Forged rows.** A script can post valid shapes (ADR 0005's accepted
  limit). `seq`'s bound of 100000 caps how far one forged row can move M18.
  G6's volume floor keeps a small day from being read.

## 11. Derived entity views (AC4)

### 11.1 Where they live, and the rules for all three

- **Schema `analytics`.** It is created by the store migration. Supabase's
  Data API exposes `public` by default, not a new schema, so a missed revoke
  cannot publish these views to the browser.
- **Each view:**
  - is created `with (security_invoker = true)`;
  - is followed by `revoke all on analytics.<view> from anon`, and, guarded
    by `if exists (select 1 from pg_roles where rolname = 'authenticated')`,
    `revoke all ... from authenticated`, as `events_clean` does;
  - is granted to no one.

  `anon` and `authenticated` get **no** `usage` on schema `analytics`.
- **Source.** Only `public.events_clean` and other `analytics` views. So R1,
  and with it the owner-traffic exclusion, holds for every view without
  anyone remembering it.
- **Plain SQL, so it lifts into dbt unchanged (D11).**
  - Use CTEs and `row_number()`, not Postgres-only `distinct on`.
  - Test key presence as `props->'key' is not null`, not `props ? 'key'`. No
    prop value is ever JSON `null`, because the validator refuses it.
  - Confine JSON access to `->`, `->>`, `jsonb_array_length` and
    `jsonb_array_elements`.
  - A port to DuckDB (#257) then touches only the JSON access.
- **"First" always means the earliest by (`received_at`, `id`),** so every
  view is deterministic.
- **Timestamps are `received_at` unless a column says otherwise,** per R2.
- **Dropping `events_clean` later.** A later migration that drops and
  recreates `events_clean` must first drop these views, or use `cascade` and
  recreate them. ADR 0016 records this.

### 11.2 `analytics.orders`

**Grain.** One row per `order_id` that has at least one `order_placed` row in
`events_clean`.

**Built from:**

- `placed` = the `order_placed` rows of `events_clean`, with two window
  columns:
  - `rn = row_number() over (partition by props->>'order_id' order by received_at, id)`;
  - `n = count(*) over (partition by props->>'order_id')`.
- `p` = `placed where rn = 1`, the canonical row.
- For each post-order event E (`order_delivered`, `rating_submitted`,
  `driver_rating_submitted`, `tip_sent`): `first_E` = that event's rows with
  `row_number() over (partition by props->>'order_id' order by received_at, id) = 1`.
  Each is left-joined on `first_E.props->>'order_id' = p.props->>'order_id'`.

| Column | Type | SQL-level rule |
|---|---|---|
| `order_id` | uuid | `(p.props->>'order_id')::uuid` |
| `visitor_id` | uuid | `p.visitor_id` |
| `session_id` | uuid | `p.session_id` |
| `placed_at` | timestamptz | `p.received_at`. This is R7's cohort column. |
| `placed_occurred_at` | timestamptz | `p.occurred_at` (device time, for ordering within the browser) |
| `placed_day` | date | `(p.received_at at time zone 'UTC')::date` |
| `build` | text | `p.build`. `null` means the row came from a client before this pass. |
| `props_shape` | text | `case when p.props->'restaurant_slug' is not null then '#270' when p.props->'city' is not null then '#219' else '#81' end` |
| `placed_rows` | integer | `n`. It is normally 1. More than 1 means duplicate `order_placed` rows, collapsed here to the earliest. |
| `city` | text | R3: `coalesce(p.props->>'city', case p.props->>'currency' when 'VND' then 'hcmc' when 'USD' then 'sf' end)` |
| `currency` | text | `p.props->>'currency'` |
| `restaurant_slug` | text | `p.props->>'restaurant_slug'`. `null` when the key is absent (an older client). **Never inferred** from menu views. |
| `amount_minor` | bigint | `(p.props->>'amount_minor')::bigint` (the subtotal) |
| `item_count` | integer | `(p.props->>'item_count')::int` |
| `applied_voucher_ids` | jsonb | `p.props->'applied_voucher_ids'` |
| `applied_voucher_count` | integer | `jsonb_array_length(p.props->'applied_voucher_ids')` |
| `saved_amount_minor` | bigint | `(p.props->>'saved_amount_minor')::bigint` |
| `thanks_voucher_amount_minor` | bigint | `(p.props->>'thanks_voucher_amount_minor')::bigint`. `null` for `#81` rows (R4). |
| `vip_level` | text | `p.props->>'vip_level'`. `null` for `#81` rows. |
| `vip_saved_amount_minor` | bigint | `(p.props->>'vip_saved_amount_minor')::bigint`. `null` for `#81` rows. |
| `wallet_paid` | boolean | `(p.props->>'wallet_paid')::boolean`. `null` for `#81` rows. |
| `drop_off_preset` | text | `p.props->>'drop_off_preset'` |
| `delivery_instructions` | text | `p.props->>'delivery_instructions'` |
| `utensils` | boolean | `(p.props->>'utensils')::boolean` |
| `delivery_seen_at` | timestamptz | `first_order_delivered.received_at`. `null` means the tracker was never opened after the delivery time. **It does not mean "not delivered".** Every order is delivered by construction (#266 finding 1). |
| `restaurant_rated_at` | timestamptz | `first_rating_submitted.received_at`, or `null` |
| `restaurant_stars` | integer | `(first_rating_submitted.props->>'stars')::int`, or `null` |
| `driver_rated_at` | timestamptz | `first_driver_rating_submitted.received_at`, or `null` |
| `driver_stars` | integer | `(first_driver_rating_submitted.props->>'stars')::int`, or `null` |
| `tipped_at` | timestamptz | `first_tip_sent.received_at`, or `null` |
| `tip_amount_minor` | bigint | `(first_tip_sent.props->>'tip_amount_minor')::bigint`, or `null`, in the order's `currency` |

**Handling the awkward cases:**

- **Duplicate `order_id`s.** Collapsed to the earliest row. `placed_rows`
  counts them. A duplicate from a different browser (forged or colliding)
  still yields one row, attributed to the earliest row's browser.
- **Missing post-order events.** The column is `null`, never zero and never
  `false`.
- **Duplicate post-order events.** The earliest is used, and later ones are
  ignored.
- **Orphaned post-order events** (no `order_placed` in `events_clean`). They
  are excluded, because the grain is an order that was placed.
- **Rows from older clients.**
  - `#81` rows: `city` from R3, and the four #219 fields `null`.
  - `#81` and `#219` rows: `restaurant_slug` `null`, and `build` `null`.
  - `props_shape` says which shape the row is.

### 11.3 `analytics.sessions`

**Grain.** One row per `session_id` (a tab session, #219 §5) with at least
one row in `events_clean`. **A session here is a tab**, which is what every
session-unit metric counts (M2, M6a, M6b, M9's start and pass rates, M16,
M18). The 30-minute analytic "visit" is not this view (§6).

**Built from:**

- `e` = all `events_clean` rows, grouped by `session_id`;
- `first_row` = each session's first row by (`received_at`, `id`);
- `ss` = each session's first `session_started` row, by
  `row_number() over (partition by session_id order by occurred_at, id) = 1`
  (R8's ordering).

| Column | Type | SQL-level rule |
|---|---|---|
| `session_id` | uuid | the group key |
| `visitor_id` | uuid | `first_row.visitor_id` |
| `visitor_ids` | integer | `count(distinct visitor_id)`. It is normally 1. More than 1 means the browser's `localStorage` was cleared mid-tab. |
| `started_at` | timestamptz | `min(received_at)` |
| `session_day` | date | `(min(received_at) at time zone 'UTC')::date` (R5) |
| `last_received_at` | timestamptz | `max(received_at)` |
| `event_rows` | integer | `count(*)` |
| `session_started_rows` | integer | `count(*) filter (where event_name = 'session_started')` (G2 reads it) |
| `source` | text | R8: `case when ss.props->>'utm_source' not in ('(none)','(invalid)') then ss.props->>'utm_source' when ss.props->>'referrer_host' = '(self)' then '(self)' when ss.props->>'referrer_host' = '(invalid)' then '(invalid)' when ss.props->>'referrer_host' <> '(none)' then ss.props->>'referrer_host' else '(direct)' end`, and `'(unknown)'` when there is no `ss` row |
| `referrer_host` | text | `coalesce(ss.props->>'referrer_host', '(unknown)')` |
| `utm_source` | text | `coalesce(ss.props->>'utm_source', '(unknown)')` |
| `utm_medium` | text | `coalesce(ss.props->>'utm_medium', '(unknown)')` |
| `utm_campaign` | text | `coalesce(ss.props->>'utm_campaign', '(unknown)')` |
| `ordered` | boolean | `bool_or(event_name = 'order_placed')` (M6b) |
| `orders` | integer | `count(distinct props->>'order_id') filter (where event_name = 'order_placed')` |
| `seq_max` | integer | `max(seq)`. `null` when no row carries `seq`. |
| `seq_distinct` | integer | `case when max(seq) is null then null else count(distinct seq) end` |
| `seq_lost` | integer | `max(seq) - count(distinct seq)`. `null` when `seq_max` is `null`. |

**Handling the awkward cases:**

- **Rows from older clients.**
  - A session from before `session_started` shipped has
    `session_started_rows = 0`, and `(unknown)` in the five source columns.
    It stays in every denominator (R8).
  - A session with no `seq` has the three `seq` columns `null`, and is outside
    M18.
- **More than one `session_started`.** This is a G2 breach. The earliest by
  (`occurred_at`, `id`) is used, and `session_started_rows` shows the count.
- **A session that spans midnight UTC** belongs to the day it started (R5).

### 11.4 `analytics.visitors`

**Grain.** One row per `visitor_id` (a browser) with at least one row in
`events_clean`.

**Built from:**

- `e` = all `events_clean` rows, grouped by `visitor_id`;
- `ft` = each browser's first `session_started` row, by
  `row_number() over (partition by visitor_id order by occurred_at, id) = 1`;
- `o` = `analytics.orders`, grouped by `visitor_id`;
- `fo` = each browser's first `analytics.orders` row, by
  `row_number() over (partition by visitor_id order by placed_at, order_id) = 1`.

| Column | Type | SQL-level rule |
|---|---|---|
| `visitor_id` | uuid | the group key |
| `first_seen_at` | timestamptz | `min(e.received_at)` |
| `first_seen_day` | date | `(min(e.received_at) at time zone 'UTC')::date` |
| `last_seen_at` | timestamptz | `max(e.received_at)` |
| `active_days` | integer | `count(distinct (e.received_at at time zone 'UTC')::date)` |
| `sessions` | integer | `count(distinct e.session_id)` |
| `first_touch_session_id` | uuid | `ft.session_id`, or `null` |
| `first_touch_at` | timestamptz | `ft.received_at`, or `null`. M6c's cohort windows on this. |
| `first_touch_source` | text | R8's expression applied to `ft.props`, or `'(unknown)'` when there is no `ft` row |
| `first_touch_referrer_host` | text | `coalesce(ft.props->>'referrer_host', '(unknown)')` |
| `first_touch_utm_source` | text | `coalesce(ft.props->>'utm_source', '(unknown)')` |
| `first_touch_utm_medium` | text | `coalesce(ft.props->>'utm_medium', '(unknown)')` |
| `first_touch_utm_campaign` | text | `coalesce(ft.props->>'utm_campaign', '(unknown)')` |
| `orders` | integer | `coalesce(count of o rows, 0)` |
| `first_order_id` | uuid | `fo.order_id`, or `null` |
| `first_order_at` | timestamptz | `fo.placed_at`, or `null` |

**Handling the awkward cases:**

- **A browser with no `session_started`** (from an older client) has a
  first-touch source of `(unknown)`, and is outside M6c's cohort, whose
  `first_touch_at` is `null`. It still counts in M1 and M3.
- **A browser whose `order_placed` rows were all lost** has `orders = 0`,
  even if post-order events landed. That is the orphan rule of §11.2.
- **All history is read.** Deleting exported rows (ADR 0005 step 7) would move
  `first_seen_at` and first touch forward. The rule "never delete exported
  rows" now rests on M6c and this view, rather than on M3.

### 11.5 What #257 should publish (its design is amended by D9)

**Publish these as `learner` views, one per table (the roadmap's design):**

- **`learner.events`,** over `events_clean`, with these amendments to the
  roadmap's allow-list:
  - **Add `seq` and `build`.** Both were approved (D6, D7), and M18 and M20
    cannot be reproduced without them.
  - **Add `received_at`, truncated to the minute** (`date_trunc('minute', received_at)`),
    and make it the view's `ts`.
    - R2 windows on it, so learners cannot reproduce any M-number without it.
    - A snapshot filtered on `received_at` before today is final. That
      removes the roadmap's "yesterday can still gain a few late rows"
      caveat.
    - Minute precision stops an exact arrival time from picking out one
      person's row at launch volume (#266, "What learners should see").
  - **Truncate `occurred_at` to the minute as well.** `seq` keeps order within
    a session, so no ordering is lost.
  - **Keep `id`, re-keyed.** It is the deduplication key, and learners should
    learn to use one (#266).
  - **Still drop `is_internal`.**
- **`learner.orders`, `learner.sessions` and `learner.visitors`,** over the
  three `analytics` views, with every timestamp column truncated to the
  minute.

**Re-keying (D9).** One salt per export run, exactly as the roadmap's design
says, applied to:

- **every uuid-typed column in every published table:**
  - `id`, `visitor_id` and `session_id`;
  - `order_id`, `first_touch_session_id` and `first_order_id`;
- **and every uuid-valued prop inside `props`.**
  - In the 18 events that means one key, `order_id`, on six events:
    `order_placed`, `tracker_viewed`, `order_delivered`, `rating_submitted`,
    `driver_rating_submitted` and `tip_sent`.
  - `props->>'order_id'` is replaced with the same salted hash as
    `learner.orders.order_id`, so the join still works inside one snapshot.
- **#257's test must be violable.** No string value anywhere in a published
  file, in columns or inside `props`, matches the uuid pattern
  `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`. A salted
  md5 is 32 hex characters with no hyphens, so any un-re-keyed uuid fails
  that test.

**Dimension files, exported from code with `valid_from` and `valid_to` per
version** (the roadmap's "Dimensions that change"):

- `dim_cities`: `sf`, `hcmc` and `la`, with currency and launch date. M5.
- `dim_restaurants`: slug, city, cuisine, delivery fee and launch date. M20,
  and direction E.
- `dim_vouchers`: the 15 ids, with city and kind. M15.

**Not published in this pass,** because no M-number or A-F decision reads
them yet: `dim_menu_items` and `dim_drivers`. They are one export step each,
once a decision needs them.

**Never published:**

- `is_internal`;
- anything in `private` or `auth`;
- any wallet table;
- a sub-minute timestamp.

## 12. Whether any of this can be read yet

**No, not the new parts.** Today:

- no row carries `seq`, `build`, `restaurant_slug` or `fee_modes`;
- the store would refuse the last two;
- the `analytics` views do not exist.

A per-restaurant, per-fee-mode or loss number on any page before §10's ship
conditions hold would be an artefact of an empty column, not a result.

**What changes when the queries-and-docs child merges.** The query-time
redefinitions (R2, M3, M5, M7's name, M9, M11, M4's names) read the rows
already in the store correctly, because they use only columns every
historical row has. They are readable on the live store as soon as that
child merges, on whatever data the live project holds.

**What has to exist before M18, M19a or M20 is read,** in order:

1. the store migration, applied by the owner;
2. the client release, merged after it;
3. a full day at G1-by-build ≥ 95%.

Events do leave the device (ADR 0005), so an aggregate is possible. Until
those three hold, the honest statement for the new metrics is "not measured
yet".

## 13. Requirements on the implementing children (AC6)

Exactly three engineer children, in this order. Each depends on the one
before it being **merged**, and the client additionally on the owner's apply
step (§5.4).

### Child A, the store: an additive migration, PGlite tests, the views, and the owner's apply step

**Scope.**

- One new migration,
  `supabase/migrations/20261003000000_second_pass_readiness.sql`. No applied
  migration is edited, and no stored row changes. It holds:
  - §4.4's validator, built with the wrapper pattern;
  - the recreated insert policy;
  - §5.1's two columns, with their CHECKs and grants;
  - the recreated `events_clean`;
  - schema `analytics` and the three views of §11, with their revokes.
- PGlite tests beside it (ADR 0006).
- ADR 0005's owner checklist gains the file as step 2.6, with its confirming
  SQL.

**Criteria:**

1. **Given** the migration applied after every earlier one, **when** the
   #81, #224 and #225 contract suites
   (`two-city-event-contract`, `analytics-readiness-event-contract` and
   `session-started-internal`) are re-run **unmodified** against the new
   stack, **then** every fixture gives the same answer as before (the strict
   superset).
   - **And** the client-exact 15-key `order_placed` and 5-key
     `flash_sheet_shown` payloads of §4.2 and §4.3 are accepted.
   - **And** every refusal listed in §4.4 is refused.
   - Checks: `second-pass-superset.migration.test.ts` and
     `second-pass-shapes.migration.test.ts`. The shapes test cites §4.2, §4.3
     and §4.4 by section.
2. **Given** the migration, **when** rows are inserted without `seq` or
   `build`, and with the boundary values of §5.5 Q7 and B3, **then**
   - the omitted columns are `null`;
   - each boundary value is accepted or refused exactly as listed;
   - `events_clean` exposes both columns.
   - Check: `second-pass-envelope.migration.test.ts`.
3. **Given** the seeded rows of §14 S5, **when** each `analytics` view is
   selected, **then** it returns exactly the expected rows and columns of
   §11.2-§11.4. Those rows include:
   - a duplicate `order_id`;
   - an orphan `order_delivered`;
   - a `#81` order;
   - a session with no `session_started`;
   - a duplicated-tab `seq` pair;
   - an internal browser.

   **And** as `anon`, `select` on each view fails with a permission error.
   **And** no view depends on `private`, `auth` or a wallet relation
   (`information_schema.view_table_usage`).
   - Check: `second-pass-views.migration.test.ts`.
4. **Given** the merged migration, **when** the owner follows ADR 0005's new
   step 2.6 in the Supabase SQL Editor, **then** the confirming SQL shows all
   three of these, and the parent issue is told so before child B's pull
   request merges:

   ```sql
   select column_name, data_type, is_nullable, column_default
   from information_schema.columns
   where table_schema = 'public' and table_name = 'events'
     and column_name in ('seq', 'build') order by 1;
   -- two rows: build/text/YES/null, seq/integer/YES/null

   select pg_get_functiondef('public.event_is_valid(text, jsonb)'::regprocedure) like '%fee_modes%';
   -- true

   select has_table_privilege('anon', 'analytics.orders', 'select'),
          (select count(*) from analytics.orders) >= 0;
   -- false, true
   ```

   - Check: the SQL and its expected output are in ADR 0005 step 2.6, and
     the owner's run is recorded on #264.

### Child B, the client: `track()` shapes, `seq`, `build`, and About

**Prerequisite.** Child A is merged **and** criterion A4's owner step is
confirmed on #264. Before that, this pull request stays open (§5.4).

**Criteria:**

1. **Given** a checkout for restaurant `r`, and a home feed whose seeded draw
   has 6 restaurants with fee modes, **when** an order is placed and the
   sheet opens, **then**:
   - `order_placed` carries exactly §4.2's 15 keys, with
     `restaurant_slug = r`;
   - `flash_sheet_shown` carries exactly §4.3's 5 keys, with
     `fee_modes[i]` equal to `draw.restaurants[i].feeMode` for all 6;
   - a PGlite test inserts **those same objects** and the store accepts them.
   - Checks: unit tests in `checkout-dom.test.ts` and `home-dom.test.ts`,
     plus `second-pass-client-payloads.migration.test.ts`.
2. **Given** one tab's `sessionStorage`, **when** the sequences of §5.5 are
   performed, **then** invariants Q1-Q6 hold.
   - Check: `tracking-seq.test.ts`.
3. **Given** a build with and without `VERCEL_GIT_COMMIT_SHA`, **when** two
   events are sent, **then** invariants B1 and B2 hold.
   - Check: `tracking-build.test.ts`.
   - **Owner check after deploy:**
     `select build, count(*) from public.events where received_at > now() - interval '1 hour' group by 1;`
     shows the deployed commit's 40-character SHA, not `(unknown)`.
4. **Given** the built About page, **when** it is read, **then**:
   - it says the order records which restaurant it was from;
   - it says the flash sheet records whether each restaurant's delivery was
     drawn free or reduced;
   - it says every event carries a counter numbering it within the browsing
     session, so lost events can be counted, and which version of the site
     sent it;
   - the wallet paragraph says events and accounts are "never joined by us,
     and never published" (D10), in place of "never joined to the random
     browser ID".
   - Check: `about-page.test.ts` asserts each line. A person confirms it on
     the deployed `/about`.

### Child C, queries and docs: M1-M20 run against seeded rows, and the roadmap

**Prerequisite.** Child B is merged.

**Scope.**

- A new query file, `docs/measurement/270-metric-queries.sql`, with one
  `-- name: Mn` block per metric, M1-M20, implementing §8 and §9 exactly.
  - Order-unit metrics read `analytics.orders`.
  - M2, M6a, M6b and M18 read `analytics.sessions`.
  - M6c reads `analytics.visitors`.
  - The rest read `events_clean`.
- `219-launch-queries.sql` gains a header line saying it is superseded, and
  is otherwise kept as history. Its test stays green.

**Criteria:**

1. **Given** the seeded rows of §14 C-Q1, with every migration applied,
   **when** each of the 20 queries runs, **then** it returns the exact
   expected output, asserted per query. Numerator and denominator counts
   appear beside every rate, and the pull request body shows the output.
   - Check: `supabase/migrations/metric-queries-270.migration.test.ts`.
2. **Given** the same seed, **when** M3, M9, M11 and M20 run, **then** each
   boundary case in §14 C-Q2 lands on the documented side.
   - Check: the same file, one `it` per boundary.
3. **Given** `docs/roadmap.md`, **when** it is read, **then**:
   - its metric table has the M1-M20 names of §9 (M1 "browsers", M2 "tab
     sessions", M4's primary metric named "home-to-order conversion", M7
     "tracker return rate", and M18-M20 added);
   - its guardrails are M4's home-to-order conversion, G6 and the #79 rule,
     with **no** M7;
   - its north star says "place an order";
   - it cites `270-metric-queries.sql`.

   **And** ADR 0005 step 7's reason names M6c and `analytics.visitors`
   instead of M3.
   - Check:
     `grep -n "M7" docs/roadmap.md` shows no guardrail line, and
     `grep -c "home-to-order" docs/roadmap.md` is at least 1.
     A reviewer reads the table against §9.

## 14. Tests the engineer children must write

Every invariant in §4 and §5 appears here. Each is a test that can be made to
fail. Watch each one fail once before trusting it (house rules).

**Store (child A):**

- **S1, the superset.** The #81, #224 and #225 contract suites are re-run
  unmodified against the new stack, and all pass. Any assertion this migration
  deliberately reverses is marked with Vitest's `fails`, by exact title, as
  ADR 0013 did, and is named in the pull request. None is expected.
- **S2, the new shapes accepted.** The 15-key `order_placed` and the 5-key
  `flash_sheet_shown` (5 slugs and 6 slugs; all `free`, all `reduced`, and
  mixed) are accepted, for each of `sf`, `hcmc` and `la`. Cite §4.2 and §4.3.
- **S3, the new shapes refused.** Every refusal in §4.4.
- **S4, the envelope.** Q7 and B3. Also `events_clean` includes `seq` and
  `build`, and still excludes a browser with one `is_internal` row.
- **S5, the views.** Seed these rows, then assert every column of every
  resulting row:
  - one browser whose order has two `order_placed` rows: `placed_rows = 2`,
    and the columns come from the earlier row;
  - one order with `order_delivered`, `rating_submitted`,
    `driver_rating_submitted` and two `tip_sent` rows: the earliest tip is
    used;
  - one order with no post-order events: every post-order column is `null`;
  - one orphan `order_delivered`: no `orders` row;
  - one `#81` 9-key order: `props_shape = '#81'`, `city` from R3, and the
    #219 fields `null`;
  - one `#219` 14-key order: `props_shape = '#219'`, and `restaurant_slug`
    `null`;
  - one `#270` order: `restaurant_slug` set, and `build` set;
  - one session with `seq` 1, 2, 4 and 4 (a duplicated tab):
    `seq_max = 4`, `seq_distinct = 3`, `seq_lost = 1`;
  - one session with no `session_started`: source `(unknown)`;
  - one session with two `session_started` rows: the earliest by
    (`occurred_at`, `id`) is used, and `session_started_rows = 2`;
  - one internal browser: absent from all three views.
- **S6, privacy.** `anon` cannot `select` any `analytics` view.
  `information_schema.view_table_usage` for schema `analytics` lists only
  `public.events_clean` and `analytics.*`.

**Client (child B):**

- **C1, `order_placed`'s exact props.** `restaurant_slug` is the cart's slug.
  Double-tapping Place order yields one event. The store accepts the same
  object in PGlite.
- **C2, `flash_sheet_shown`'s exact props.** A seeded 6-restaurant draw gives
  6 slugs and 6 fee modes, aligned by index. A reload in the same session
  fires none. The store accepts the same object in PGlite.
- **C3, the validator.** `isValidEventProps` refuses:
  - the 14-key `order_placed`;
  - the 4-key `flash_sheet_shown`;
  - a 5-key `flash_sheet_shown` with mismatched lengths, or a `fee_modes`
    value `half`.

  The client never sends an old shape.
- **C4-C9, the counter.** Q1, Q2, Q3, Q4, Q5 and Q6 from §5.5, one test each.
- **C10-C11, the build.** B1 and B2 from §5.5.
- **C12, About.** About asserts each line of criterion B4.

**Queries (child C):**

- **C-Q1, the seed.** It is built by the real row shapes: the same payloads
  the client sends, and never a shape the client cannot produce. It covers:
  - three cities;
  - an old-shape order;
  - a browser that enters M5 through `location_selected` only;
  - a session with a `seq` gap;
  - a flash sheet with mixed fee modes and one tap;
  - two restaurants for M20, one with `build` null on its `restaurant_opened`;
  - an internal browser.
- **C-Q2, the boundaries.**
  - **M3:** a browser active on D and on D−7 is returning; one active on D
    and on D−8 only is not.
  - **M9 and M11:** an order at t0 + 23h59m counts. One at t0 + 24h01m does
    not. One before t0 does not.
  - **M20:** a `restaurant_opened` with `build` null is outside R(r).
  - **R2:** a row with `occurred_at` of 23:59:30 UTC on day D and
    `received_at` of 00:00:10 UTC on D+1 counts on D+1.

## 15. Questions this document settled on its own authority, for review

None needs the owner. Each is stated so a reviewer can disagree with it on
purpose.

- **`sessions` means tab sessions.** The alternative was the 30-minute
  "visit" that #266 Part 1 sketched. It lost because no M-number reads it,
  and a second meaning of "session" beside `session_id` is the confusion
  #266 Part 2 set out to remove. If #257 wants visits, they are `visits`.
- **The views live in schema `analytics`, not `public`.** The alternative was
  `public`, beside `events_clean`. It lost because Supabase's Data API
  exposes `public`, so one missed revoke would publish the views to every
  browser.
- **The store checks `fee_modes`' length against `restaurant_slugs`.** It is
  a structural check, argued in §4.3 and ADR 0014. The alternative was to
  accept any length and exclude mismatched rows in M19. It lost because the
  client already drops those rows, so accepting them only lets forged rows in.
- **`seq` is nullable, not `not null default 0`.** Zero would have to mean
  both "old client" and "counter failed". A null says "absent" in the way
  R4 already reads it.
