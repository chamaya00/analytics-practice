# Event contract: analytics readiness (every screen since #81, LA, acquisition, owner traffic)

Issue: #223 (child of objective #219). Binding amendments from the driver on
#219: Los Angeles (#221 O7), acquisition decided (#221 O10), owner-traffic
exclusion (#221 O12), and migration compatibility.

**Supersedes `docs/measurement/81-two-city-event-contract.md` in full.** From
the day this merges, build against this document. #81 stays as history. This
is a new file rather than an edit to #81, for two reasons. First, the repo's
convention: #81 superseded #66 the same way. Second, #81 is cited by line and
section from ADR 0007, from `supabase/migrations/20260926000000_two_city_event_contract.sql`
and from `src/lib/tracking.ts`, and editing it in place would leave those
citations pointing at text that no longer says what they quote. Where #81's
reasoning still holds and is not load-bearing here (for example, why VND's
minor unit is the đồng), this document cites it instead of repeating it. Every
event shape, bound and metric definition is restated here in full, so no one
has to read both documents.

Reads as fixed: ADR 0005 (the store), ADR 0007 (the two-city shapes and the
"store does not enforce cross-field invariants" decision), ADR 0008 (sign-in,
the wallet, and the #79 rule: no user id, email or wallet field in any event),
`docs/design/162-rating-win-tips-rewards-vip.md` ("Events"), and the code as
shipped on the default branch today.

**Decision this contract serves:** whether the launch works. Specifically:
does the LinkedIn launch bring visitors who reach an order? Where does the
home-to-order funnel lose them, in each of the three cities? Do they come
back? And does the sign-in wall at Place order, added with the wallet, cost
orders? Every event below answers one of those questions or feeds a metric
in §11. Everything else is in §10, named as not logged.

## 1. Units, and why there is no exposure event

- **No experiment ships.** `variant` stays `null` on every row, so there is
  no arm, no assignment unit and no exposure event. If an experiment is
  added later, it needs its own contract revision. That revision must define
  an exposure event that fires at assignment, before the first render that
  differs between arms, whether or not the person acts.
- **Counting units, fixed per metric in §11:**
  - **visitor** (`visitor_id`) for the funnel, daily visitors and returning
    visitors;
  - **(visitor, city) pair** for the by-city funnel;
  - **session** (`session_id`) for sessions, acquisition source, and the
    sign-in and short-balance metrics;
  - **order** (`order_id`) for everything after `order_placed`;
  - **(session, city) pair** for the flash sheet.
- A visitor who does something five times is still one visitor. Every
  visitor or session metric counts `distinct`, never rows.

## 2. What changed from #81, at a glance

- **Los Angeles.** Every `city` enum accepts `la`. The voucher-id list gains
  five LA ids. `order_placed`, `cart_viewed` and `checkout_viewed` gain a
  `city` prop, because LA and SF share `USD` and currency can no longer
  stand in for city (§4).
- **Seven new events:**
  - `session_started` (acquisition, §6);
  - `sign_in_prompt_shown`, `sign_in_started` and `sign_in_completed` (the
    sign-in wall, §7);
  - `wallet_short_shown` (a short balance blocking an order);
  - `tip_sent`;
  - `driver_rating_submitted`.
- **`order_placed` gains five props:** `city`, `wallet_paid`, `vip_level`,
  `vip_saved_amount_minor` and `thanks_voucher_amount_minor`.
- **`flash_sheet_shown.restaurant_slugs` now takes 5-6 elements**, matching
  the sheet's actual draw (`FLASH_DRAW_SIZE_MIN`/`MAX` in
  `src/lib/flash-deal.ts`). #81 required exactly 2, which is why the event
  has been quiet since #119/#120.
- **A new store column, `is_internal`**, marks the owner's own browsers
  (§5). `events_clean` excludes them.
- **The store now keeps accepting old shapes.** This reverses #81's AC7
  ("old shapes rejected") for this revision. See §13 for why.

## 3. Screen by screen (AC1)

One line per screen named in #223, checked against the code on the default
branch:

| Screen / feature | Logged as | Or not logged, because |
|---|---|---|
| Sign-in (Google/Apple at Place order, and "Sign in to tip") | `sign_in_prompt_shown`, `sign_in_started`, `sign_in_completed` (§7, §9) | - |
| Wallet (header chip, wallet sheet, drip "Collect", sign-out) | `wallet_short_shown` only, when a short balance blocks an order or a tip; `order_placed.wallet_paid` | The wallet sheet, chip, drip claims and sign-out are not logged. §10 gives the reason. |
| Tips (tracker history row: Tip, presets, Send) | `tip_sent` | Opening the panel, choosing a preset and Cancel are not logged (§10). |
| VIP levels (Gold/Platinum, checkout perk lines, tracker VIP card) | `order_placed.vip_level`, `order_placed.vip_saved_amount_minor` | There is no level-change event. It can be derived as the first `order_placed` per visitor carrying the new level (§10). |
| Driver rating (rating sheet, step 1) | `driver_rating_submitted` | Skip, the mini win, the win screen and the confetti are not logged (§10). |
| Thanks voucher (unlocked by rating, applied at a later checkout) | `order_placed.thanks_voucher_amount_minor` | There is no unlock event. The unlock is the first rating step submitted for an order, already visible as `driver_rating_submitted` or `rating_submitted` (§10). |
| Promo carousel (home, 7 slides) | Not logged | See §10. |
| Offers screen (`/offers`, checkboxes, Apply) | Not logged. The applied set is on `order_placed.applied_voucher_ids`, as in #81. | See §10. |
| `order_placed`'s missing fields | `wallet_paid`, `vip_level`, `vip_saved_amount_minor`, `thanks_voucher_amount_minor`, plus `city` (LA amendment). **Tips are not an `order_placed` field**: a tip is sent after delivery, so it is its own event, `tip_sent`, joined on `order_id`. | - |
| Flash-deal sheet (5-6 restaurants since #119/#120) | `flash_sheet_shown` (bound fixed, AC3), `flash_sheet_closed` (unchanged except `la`) | - |

## 4. Money and city

**Money is unchanged from #81 §2.** Every amount is an integer
`*_amount_minor` plus one `currency` enum of `USD`/`VND` per event. USD is
counted in cents; VND in whole đồng. The shared bounds apply to every
`*_amount_minor` prop unless a row in §9 says otherwise:

| Currency | Zero-allowed props | Nonzero props |
|---|---|---|
| `USD` | `0`-`100000` | `1`-`100000` |
| `VND` | `0`-`5000000` | `1`-`5000000` |

**City.** `city` is an enum of `sf`, `hcmc` and `la`.

- **Currency no longer implies city.** `la` pays in `USD`, like `sf`. #81
  let `currency` stand in for `city` on money events. That stops working
  the day LA ships, so every money event that describes a basket now
  carries `city` too.
- **Invariant, on every row that carries both:**
  - `city in (sf, la)` ⇔ `currency = USD`;
  - `city = hcmc` ⇔ `currency = VND`.
- **Enforcement.** The client's tests enforce this invariant. The store
  does not: ADR 0007 decided the store checks shapes, enums and bounds, and
  does not refuse a primary-metric row over a cross-field inconsistency.
  Guardrail G5 (§12) is where a violation shows.

**LA assumptions, stated so #227 can check them.** LA uses the USD bounds
above. Its flash amounts fall in SF's drawn range, `200`-`600` cents. Its
tip presets are the USD presets. If #227 gives LA a flash range or tip
presets outside those, that objective must say `flash_sheet_shown` or
`tip_sent` will go quiet for LA (the #79 rule), and this contract needs an
amendment.

**Voucher ids (15).** These are the only values any `applied_voucher_ids`
element may take, on either `order_placed` shape:

- `hcmc-delivery-entry`, `hcmc-discount-t1`, `hcmc-discount-t2`,
  `hcmc-discount-t3`, `hcmc-flash`
- `sf-delivery-entry`, `sf-discount-t1`, `sf-discount-t2`, `sf-discount-t3`,
  `sf-flash`
- `la-delivery-entry`, `la-discount-t1`, `la-discount-t2`, `la-discount-t3`,
  `la-flash`

## 5. Row envelope: ids, session and the owner-traffic flag (O12)

Every row has these store columns (ADR 0005). None of them is repeated in
`props`:

- `id` uuid: the client's retry key.
- `visitor_id` uuid: `localStorage` `parody.visitorId`, per browser, kept
  until storage is cleared.
- `session_id` uuid: `sessionStorage` `parody.sessionId`.
- `event_name`, `occurred_at`, `received_at`, `props`.
- `variant`: always `null`.
- **new: `is_internal` boolean**, described below.

**What a session is, as a definition this contract commits to.**

- A session is one browser tab's `sessionStorage` lifetime.
- It survives reloads and same-tab navigation, including the full-page
  OAuth round trip to Google/Apple and back.
- It ends when the tab closes.
- There is no inactivity timeout: a tab left open for two days is one
  session.
- This boundary is kept on purpose, because the flash-deal draw (#87) is
  keyed to it. A different "session" for analytics would split one flash
  draw across two sessions.
- A link opened in a new tab usually starts a new session.

**The owner-traffic flag, `is_internal` (decided per O12).**

- **Shape.** A new column: `is_internal boolean not null default false`.
  - It is a column, not a prop, for two reasons. It must ride on every
    event. And `event_is_valid` matches each event's `props` key set
    exactly, so a new prop key would make every shape the deployed client
    sends fail to match.
  - With a default of `false`, an old tab that doesn't send the column
    still inserts.
  - It is a true/false only: never an identifier, never a user id, never
    linked to sign-in.
- **Marking a browser.** On every page load, before any event from that
  load is sent, the client reads the query parameter `internal`:
  - `1` sets `localStorage` key `parody.internal` to `"1"`;
  - `0` removes that key;
  - any other value, or none, does nothing.

  The `internal` parameter is never captured anywhere, including by
  acquisition (§6). Reading or writing the key is wrapped: blocked storage
  reads as unmarked.
- **Sending it.** Every row sets
  `is_internal = (localStorage.getItem('parody.internal') === '1')`, read at
  send time.
- **Excluding it.** `events_clean` removes every row whose `visitor_id` has
  **at least one** row with `is_internal = true`. The exclusion is by
  visitor, not only by the flagged rows, so the owner's earlier, unflagged
  events from the same browser are removed too. That browser's
  `visitor_id` is the same before and after marking.
- **What it cannot do:**
  - A browser the owner never marked is counted as a visitor. That includes
    another device, a private window, or a browser whose storage was
    cleared.
  - The owner marks each browser once per device (O12), and again after
    clearing storage.
- **About must say this flag exists.** This is a requirement on the child
  that implements it (§14).

## 6. Acquisition, as decided (O10)

**Decided by the owner (#221, O10). This is not an open question.**

**Where it rides.** A new event, `session_started`. It fires once per
session, on the session's first page load. Its four props carry acquisition
and nothing else. No other event carries any acquisition field. Acquisition
needs **no new column**, only a new `event_is_valid` branch. The ADR the
migration owes (§13) covers the `is_internal` column and this new branch
together.

**When `session_started` fires:**

- On the page load where the client first sees a `session_id` it has not
  yet started. The client tracks this with a `sessionStorage` key
  `parody.sessionStarted`, holding the `session_id` it last fired for.
- It fires from the site-wide tracking initialiser (`BaseLayout.astro` runs
  it on every page), after the `internal` marking above, and **before any
  other event that page load sends**.
- So a session that lands on About, Offers or a 404 and leaves still counts
  as a session with a source.
- The key is set when the event is handed to the sender. A second page load
  in the same session fires nothing.
- If `sessionStorage` is unavailable, no event of any kind is sent (the
  sender cannot build `session_id`), so this case adds no rows.

**The four props, all derived on that page load:**

- **`referrer_host`**, from `document.referrer`, in this order:
  1. An empty referrer gives `(none)`.
  2. A referrer that `new URL()` cannot parse gives `(invalid)`.
  3. A referrer whose origin equals `location.origin` gives `(self)`.
  4. Otherwise: the parsed `hostname`, lowercased, with **one** leading
     `www.` removed.
  5. It is kept only if it is 1-253 characters and matches
     `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$`.
     Anything else gives `(invalid)`.

  The host is never the full URL: no scheme, port, path, query string,
  fragment or user info. The pattern cannot contain `/`, `?`, `:`, `=`, `&`
  or `@`.
- **`utm_source`, `utm_medium`, `utm_campaign`**:
  - Each is read by name from `new URLSearchParams(location.search)`.
  - A missing value, or one that is empty after trimming whitespace, gives
    `(none)`.
  - Otherwise the value is trimmed and lowercased. It is kept if it matches
    `^[a-z0-9][a-z0-9._-]{0,49}$` (so 1-50 characters), and gives
    `(invalid)` otherwise.

  The allow-list is these three parameter **names**. Values are bounded by
  the pattern, not by a fixed value list, so a campaign tag the owner
  invents tomorrow needs no migration. `@` is not in the pattern, so an
  email address cannot pass as a value.

**What is never captured:**

- the full referrer URL;
- the landing URL, its path, or any query string;
- any query parameter other than those three.

That rules out click IDs by name: `gclid`, `fbclid`, `li_fat_id`,
`msclkid`, `ttclid`, `twclid`, `dclid`, `mc_eid`, and anything else. The
client never iterates the query string. It calls `.get()` three times.

**Why the sentinels are in parentheses.** `(none)`, `(self)` and `(invalid)`
contain characters the value patterns exclude. A real `utm_source=none` or
a host literally named `none` can therefore never be confused with "absent".

**The launch link.** `?utm_source=linkedin` arrives as
`utm_source = 'linkedin'`, `utm_medium = '(none)'` and
`utm_campaign = '(none)'`. The source rule in §11 (M6) reports it as
`linkedin`, whatever the referrer was.

## 7. Sign-in across the OAuth round trip (AC4)

The round trip leaves the site. The browser goes to `<ref>.supabase.co`,
then to Google or Apple, then back to our `redirect_to` with `?code=` or
`?error=` (ADR 0008). Three events cover it:

1. **`sign_in_prompt_shown`**, **before** the redirect. It fires each time
   the sign-in sheet opens:
   - at checkout, on a Place order tap by a signed-out visitor while the
     wallet is live;
   - on the tracker, on a "Sign in to tip" tap.
2. **`sign_in_started`**, **before** the redirect. It fires after
   `signInWithOAuth` has returned a provider URL and immediately before the
   browser navigates to it. If `beginSignIn` returns `false` (no URL, or an
   error), nothing fires, because no navigation happens.
   - The send survives the page unloading because the transport already
     posts with `fetch(..., { keepalive: true })`. The wiring must keep
     that option.
   - Before this event fires, the client writes `sessionStorage` key
     `parody.pendingSignIn` = `{"provider": "google"|"apple", "surface":
     "checkout"|"tip"}`. A later tap overwrites it.
   - The key holds the only state the return needs. It holds no identifier,
     email or amount.
3. **`sign_in_completed`**, **after** the return. It fires on the page load
   where `isOAuthReturn(url)` is true.
   - **Claiming the pending record.** The module handling the return reads
     `parody.pendingSignIn` and **removes it in the same synchronous step**,
     before any `await`. Only then does it resolve the outcome, and it
     fires once the outcome is known.
     - `outcome = success` when `completeOAuthReturn` returned a session.
     - `outcome = failed` otherwise.
     - A cancel and a failure look the same (ADR 0008).
     - A success followed by an unreachable wallet (D1 dark) is still
       `success`: the sign-in worked.
   - **Why this is exactly once.** The claim is synchronous, so if two
     modules both see the return (checkout or tracker, and the header's
     wallet module), only the first finds the record. A reload after the
     URL has been cleaned is not an OAuth return, so it fires nothing.
   - **No record means no event.** If the record is missing (a different
     tab, or cleared storage), nothing fires. The attempt then counts as
     not completed (§12, failure cases).

**How the state survives the navigation.** `sessionStorage` is per tab and
per origin. It survives a same-tab navigation away to another origin and
back. So `session_id` is unchanged across the round trip:
`sign_in_started` and `sign_in_completed` share one `session_id`, and no
second `session_started` fires. `parody.pendingSignIn` survives the same
way.

The checkout choices already cross the round trip in `parody.pendingOrder.<slug>` (ADR 0008). That record is not an event and is not read by any event.

## 8. Every event, in one place

Each `props` shape below is matched exactly by key set (sorted). Every shape
is well under the 1 KB cap. Store columns (§5) are not repeated.

| Event | Fires when | `props` (name: type, bounds) | Invariant a test can violate |
|---|---|---|---|
| `session_started` **new** | First page load of a session, before any other event from that load (§6). | `referrer_host`: `(none)`, `(self)`, `(invalid)`, or a host of 1-253 chars matching §6's host pattern. `utm_source`, `utm_medium`, `utm_campaign`: each `(none)`, `(invalid)`, or matching `^[a-z0-9][a-z0-9._-]{0,49}$`. | Exactly one per `session_id`. Its `occurred_at` is ≤ that of every other row with the same `session_id`. Two page loads in one tab produce one. A URL carrying `gclid`, `fbclid`, `li_fat_id` or any non-`utm_` parameter produces a row whose serialised JSON contains none of those parameters' values. |
| `location_selected` | A location card is tapped. | `city`: `sf`/`hcmc`/`la`. `is_switch`: boolean, true only when a *different* city was already stored. | One per card tap. Opening and dismissing the picker fires nothing. |
| `home_viewed` | Every load of `/` that renders a feed, including after the first pick. | `city`: `sf`/`hcmc`/`la`. | No dedup: one per load. Metrics count distinct visitors. |
| `restaurant_opened` | Every load of `/restaurants/<slug>`. | `city`: `sf`/`hcmc`/`la`. `restaurant_slug`: string, 1-60, `^[a-z0-9]+(-[a-z0-9]+)*$`, built for that city. | One per load. |
| `cart_viewed` **changed** | Every load of `/cart` showing one cart or the empty state. The "Your carts" list fires nothing, as today. | `amount_minor`: integer, §4 zero-allowed. `city`: `sf`/`hcmc`/`la` **new**, the cart's restaurant's city, or for the empty state the stored city (`sf` if none, as today's currency fallback). `currency`: `USD`/`VND`. `item_count`: integer, 0-999. | `item_count = 0` ⇔ `amount_minor = 0`. `currency` matches `city` (§4). |
| `checkout_viewed` **changed** | Every load of `/checkout` with one populated cart. A sign-in round trip loads it twice (ADR 0008). Metrics count distinct visitors or sessions, never rows. | `amount_minor`: integer, §4 nonzero. `city`: `sf`/`hcmc`/`la` **new**. `currency`: `USD`/`VND`. `item_count`: integer, 1-999. | `currency` matches `city`. |
| `flash_sheet_shown` **changed (AC3)** | A session's first home-feed load for a given city draws the flash deal and opens the sheet (`isNewDraw`). | `amount_minor`: integer, `200`-`600` when `USD`, `10000`-`30000` when `VND`. `city`: `sf`/`hcmc`/`la`. `currency`: `USD`/`VND`. `restaurant_slugs`: array of **5-6** distinct strings (the whole draw, in drawn order), each 1-60 chars matching the slug pattern. | At most one per (`session_id`, `city`). The array length equals the number of restaurants the sheet renders, with no truncation. A test seeds a 6-restaurant draw and asserts the event carries all 6. |
| `flash_sheet_closed` | The sheet first closes, by drag, scrim, ×, a restaurant tap, or the countdown reaching `00:00`. The collapsed bar's reopen-and-close never fires a second one (`closedEventFired`, #120). | `city`: `sf`/`hcmc`/`la`. `outcome`: `restaurant_tapped`/`dismissed`/`expired`. `restaurant_slug`: one of the paired `restaurant_slugs` when `restaurant_tapped`, the literal `none` otherwise. `seconds_remaining`: integer, 0-900. | At most one per `flash_sheet_shown`. `restaurant_slug ≠ 'none'` ⇔ `outcome = restaurant_tapped`. |
| `order_placed` **changed** | Once, when the order is written locally, as in #81. With the wallet live, that happens only after a successful debit or in the D1 fallback, never on an `insufficient` or `blocked` answer (ADR 0008). | `amount_minor`: integer, §4 nonzero (the subtotal). `applied_voucher_ids`: array, 0-2 distinct §4 ids, catalogue vouchers only. `city`: `sf`/`hcmc`/`la` **new**. `currency`: `USD`/`VND`. `delivery_instructions`: `leave_at_door`/`hand_to_me`/`meet_downstairs`/`call_on_arrival`. `drop_off_preset`: `home`/`office`/`front_desk`. `item_count`: integer, 1-999. `order_id`: uuid. `saved_amount_minor`: integer, §4 zero-allowed, catalogue vouchers' saving only. `thanks_voucher_amount_minor`: integer, §4 zero-allowed **new**. `utensils`: boolean. `vip_level`: `none`/`gold`/`platinum` **new**, the level in effect at placement. `vip_saved_amount_minor`: integer, §4 zero-allowed **new**, Gold's waived delivery fee plus Platinum's 10%. `wallet_paid`: boolean **new**. | Exactly one per `order_id`. `saved_amount_minor = 0` ⇔ `applied_voucher_ids = []`. `vip_level = 'none'` ⇒ `vip_saved_amount_minor = 0`. `thanks_voucher_amount_minor` is `0` or that city's fixed voucher amount. `wallet_paid = true` ⇔ `wallet_debit` answered `debited` or `already_debited` for this `order_id`. Every voucher id starts with `city + '-'`. `currency` matches `city`. All are client-tested, not store-enforced (ADR 0007). |
| `tracker_viewed` | Every load of `/tracker` that finds a stored order. | `minutes_since_order`: number, ≥ 0. `order_id`: uuid. `view_number`: integer, ≥ 1. | `view_number` rises by exactly 1 per fire for an `order_id`. |
| `order_delivered` | The first observation of an order at Delivered. | `minutes_since_order`: number, ≥ 0. `order_id`: uuid. | Exactly one per `order_id`. |
| `rating_submitted` | The **restaurant** step's Submit, in the rating sheet or the inline prompt (#162 "Events"). | `order_id`: uuid. `stars`: integer, 1-5. `tags`: array of 0-3 distinct values from `fast`/`great_packaging`/`order_was_correct`. | At most one per `order_id`. Skipping the restaurant step fires nothing. |
| `driver_rating_submitted` **new** | The **driver** step's Next, with a star count chosen, when `submitDriverRating` stores it. | `order_id`: uuid. `stars`: integer, 1-5. | At most one per `order_id`: the second call returns `null` and fires nothing, from the sheet or from a history re-rate. Skip fires nothing. |
| `tip_sent` **new** | `wallet_tip` answers `tipped` for an order and `storeTip` records it. | `currency`: `USD`/`VND`. `order_id`: uuid. `tip_amount_minor`: one of the fixed presets for that currency, `100`/`200`/`300` for `USD` and `10000`/`20000`/`30000` for `VND`. | At most one per `order_id`. `already_tipped`, `blocked`, `insufficient`, an unreachable call and Cancel fire nothing. A double tap on Send fires one. |
| `sign_in_prompt_shown` **new** | The sign-in sheet opens (§7). | `surface`: `checkout`/`tip`. | One per opening. Dismissing it fires nothing. |
| `sign_in_started` **new** | Immediately before navigating to the provider URL (§7). | `provider`: `google`/`apple`. `surface`: `checkout`/`tip`. | Fires only when navigation follows. `beginSignIn → false` fires nothing. |
| `sign_in_completed` **new** | The return page load, after the outcome resolves (§7). | `outcome`: `success`/`failed`. `provider`: `google`/`apple`. `surface`: `checkout`/`tip`, both copied from `parody.pendingSignIn`. | At most one per `sign_in_started`, on the same `session_id`. No pending record means no event. A reload of the cleaned URL fires nothing. |
| `wallet_short_shown` **new** | The not-enough-play-money block is first rendered on a page load: at checkout (on load, or after an `insufficient` debit) or in the tip panel (`tracker-tip-short`). | `city`: `sf`/`hcmc`/`la`, the basket's city at checkout, or the tipped order's restaurant's city. `surface`: `checkout`/`tip`. | At most one per (page load, `surface`). Re-renders, Collect and preset changes do not re-fire it. |

**Fired by nobody any more:** nothing. All 11 of #81's event names are still
live.

## 9. The #79 rule, checked (AC2)

**The rule.** No event carries an email, any wallet balance, or an amount a
person typed. ADR 0008 adds: no user id and no wallet field.

**The new props.** These are every prop this contract adds, with where each
value comes from:

- `referrer_host`, `utm_source`, `utm_medium`, `utm_campaign`: a hostname,
  or a bounded token from the landing URL. The pattern excludes `@`.
- `provider`, `surface`, `outcome`: fixed enums.
- `city`: an enum.
- `wallet_paid`: a boolean about how *this order* was paid. It is a field
  of the order (`PlacedOrder.walletPaid`), not of the wallet, and #223
  names it explicitly.
- `vip_level`: an enum computed on the device from delivered orders.
- `vip_saved_amount_minor`, `thanks_voucher_amount_minor`: computed by the
  site from its own constants and the basket. Nobody types them.
- `tip_amount_minor`: one of six fixed presets. Nobody types it.
- `stars`: 1-5, from tapped stars.
- `order_id`: the existing client-generated order key. It is not a user id.

**Deliberately excluded, and why.** `wallet_short_shown` carries no
shortfall. A shortfall plus the order total (which is derivable) would
reveal the balance. No event carries the Supabase `auth.users.id`, and none
links `visitor_id` to an account. ADR 0008 left linking to this objective,
and this contract declines it: no metric in §11 needs it.

## 10. Not logged, and why

Carried forward from #81, still true:

- Add-to-cart and stepper taps, nav taps, scrolling, search input, cuisine
  chips, checkout field changes before submit, and About page views.
- The Offers screen being opened, and individual voucher toggles before
  Apply. The applied set on `order_placed` already answers "are vouchers
  used". The #81 §3 reasoning is unchanged.
- A voucher crossing into qualifying as the basket grows.
- The flash draw as a separate event from `flash_sheet_shown`.
- Silent abandonment.

New to this contract:

- **The promo carousel.** It covers slide impressions, auto-advance, swipes,
  dots, pause, and slide taps.
  - Auto-advance means an "impression" is a timer tick, not a person
    seeing something.
  - A slide tap lands on `restaurant_opened` with no record of where it
    came from.
  - Nobody has named a decision the carousel's own numbers would change.
  - **If one is named** ("does the carousel earn its slot?"), the
    lightest-weight answer is an `entry` enum on `restaurant_opened`
    (`carousel`/`tile`/`flash_sheet`/`other`), added in a revision that
    states that decision. It would not be a carousel event.
- **The wallet sheet, header chip, drip claims and sign-out.** The one
  wallet question tied to the launch decision is whether the wallet costs
  orders. `wallet_short_shown` together with `order_placed` answers it
  (M11). A drip-claim count answers nothing on its own. Every wallet event
  is also one step from a balance field, which the #79 rule forbids.
- **The tip panel opening, preset choice and Cancel.** Whether tips happen
  is the question, and `tip_sent` over wallet-paid delivered orders answers
  it (M12). How someone browsed three presets is the "log what is easy"
  trap.
- **VIP level changes and the ledger sweep.** `order_placed.vip_level`
  already shows each visitor's level at every order. "When did this visitor
  reach Gold" is the first order carrying `gold`. A separate event would
  also fire from a background sweep on page load, not from anything the
  person did.
- **The thanks voucher's unlock and consumption.**
  - Unlock is defined as the first rating step submitted for an order,
    which `driver_rating_submitted` and `rating_submitted` already record.
  - Consumption is `thanks_voucher_amount_minor > 0` on the order that used
    it.
- **The rating sheet opening, Skip, dismissal, the mini win, the win screen
  and confetti.** The step events plus `order_delivered` give the sheet's
  completion (M8). The rest is presentation.
- **Order again, order history views, the tracker's VIP card, and the
  flash reopen bar.** No decision named.
- **The order's total, delivery fee and service fee.** Order value is read
  from `amount_minor` (the subtotal), as in #81. No metric needs the total.
  The total is also the exact debit, so logging it adds nothing and moves
  one step closer to wallet arithmetic.
- **The landing path, the full referrer, and any query string or click
  ID** (§6).

## 11. Metrics (AC6)

### Rules every query follows

- **R1 Source.** Read from `public.events_clean`, never `public.events`.
  `events_clean` already excludes internal visitors (§5).
- **R2 Time.** Window on `occurred_at`, not `received_at`.
  - A day is `(occurred_at at time zone 'UTC')::date`. The owner's markets
    span UTC-8 to UTC+7, so no local day is neutral, and UTC is
    unambiguous.
  - Windows are half-open: `[start, end)`.
  - A day's numbers can still change for 24 hours after it ends, because
    the store accepts `occurred_at` up to one day before `received_at`
    (ADR 0005). Read yesterday's numbers the day after.
- **R3 City of a row.**
  `coalesce(props->>'city', case props->>'currency' when 'VND' then 'hcmc' when 'USD' then 'sf' end)`.
  - The fallback only reaches old-shape `cart_viewed`, `checkout_viewed`
    and `order_placed` rows, which have no `city`.
  - It is correct for them because no client that predates this contract
    can produce an LA basket.
  - Events that carry neither prop (tracker, rating, tip, sign-in) have no
    row city and are not used by city metrics.
- **R4 Shape boundary.** A metric that reads a prop this contract adds
  counts only rows that **have** the key (`props ? 'wallet_paid'` and so
  on) in its numerator and its denominator. Absent means "sent by an older
  client", not `false` or `0`. Mixing the two would draw a cliff on the day
  the wiring deploys.
- **R5 Session day.** A session's day is the UTC day of the minimum
  `occurred_at` across all of that `session_id`'s rows in `events_clean`.
- **R6 First seen.** A visitor's first-seen day is the UTC day of their
  minimum `occurred_at` across **all** their rows in `events_clean`,
  unwindowed.
- **R7 Order cohorts.** Order-unit metrics take their cohort from
  `order_placed.occurred_at` in the window. Later events (delivery, rating,
  tip) count whenever they happened, up to query time, so recent cohorts
  are still maturing.
- **R8 Source of a session.** Take the session's `session_started` row. If
  there is more than one, which is a guardrail breach (G2), use the
  earliest by `occurred_at`, then by `id`.

  ```
  source = case
    when props->>'utm_source' not in ('(none)','(invalid)') then props->>'utm_source'
    when props->>'referrer_host' = '(self)'    then '(self)'
    when props->>'referrer_host' = '(invalid)' then '(invalid)'
    when props->>'referrer_host' <> '(none)'   then props->>'referrer_host'
    else '(direct)'
  end
  ```

  A session with no `session_started` row (sent by an older client, or a
  lost send) has source `(unknown)`. It stays in denominators under that
  label and is never dropped.

### Volume counts (a count, not a rate: never compare cities or sources on these)

- **M1 Visitors by day.**
  `count(distinct visitor_id)` over rows on day D. Unit: visitor.
  Denominator: none, by design.
- **M2 Sessions by day.**
  `count(distinct session_id)` whose session day (R5) is D. Unit: session.
  Denominator: none, by design.

### Rates

- **M3 Returning visitors.**
  - Returning on day D: visitors active on D (as counted in M1) whose
    first-seen day (R6) is before D.
  - **Returning share** = returning on D ÷ M1(D). Unit: visitor.
  - "Returning" means *this browser* was seen on an earlier UTC day. The
    same person on a second device, or after clearing storage, is a new
    visitor.
  - Deleting old rows (for example, an export-and-trim) would make returning
    visitors look new.
- **M4 Home-to-order funnel, and the primary metric.**
  - **Cohort** C(W) = distinct `visitor_id` with ≥ 1 `home_viewed` in W.
  - **Steps**, each counted as a distinct visitor **in C(W)** with ≥ 1 of
    that step's event in W, in any order:
    - S1 = C(W);
    - S2 = `restaurant_opened`;
    - S3 = `cart_viewed` with `(props->>'item_count')::int >= 1`, since an
      empty cart is not progress (a change from #81);
    - S4 = `checkout_viewed`;
    - S5 = `order_placed`.
  - **Step conversion** = |Sk| ÷ |Sk-1|. The steps are not nested, so a
    ratio can exceed 1 when a visitor enters mid-funnel, for example with
    a saved cart. That is a reading, not a bug.
  - **Primary metric, checkout conversion** = |S5| ÷ |S1|: distinct
    visitors with `order_placed` ÷ distinct visitors with `home_viewed`, in
    W. Unit: visitor.
- **M5 Funnel by city.** Unit: (visitor, city) pair.
  - Cohort C(W, c) = pairs (`visitor_id`, c) with ≥ 1 `home_viewed` whose
    `city = c` in W.
  - Step k for city c = pairs in C(W, c) with ≥ 1 step-k event whose row
    city (R3) is c, in W.
  - **Conversion by city** = |S5(c)| ÷ |S1(c)|, for c in (`sf`, `hcmc`,
    `la`).
  - A visitor active in two cities is one pair in each, so the pairs summed
    over cities can exceed M4's |S1|.
  - LA shows up as its own `la` row from the first `home_viewed` carrying
    `la`.
- **M6 Acquisition by source.** Unit: session.
  - **M6a Source share by day.** Sessions with session day D and source s
    (R8) ÷ all sessions with session day D. The denominator includes
    `(unknown)`.
  - **M6b Session conversion by source.** Among sessions with source s and
    session day in W: those with ≥ 1 `order_placed` on the same
    `session_id` ÷ all of them.
  - **M6c First-touch visitor conversion by source.** Unit: visitor.
    - A visitor's first-touch source is the source of their earliest
      `session_started`, all time.
    - Cohort: visitors whose earliest `session_started` is in W.
    - Numerator: those with ≥ 1 `order_placed` at any time (R7-style
      maturing).
    - M6b credits the session that ordered. M6c credits whatever brought
      the visitor first. For "did LinkedIn bring buyers", read M6c.
  - `utm_medium` and `utm_campaign` are reported alongside s, as they are.
    They are never folded into s.
- **M7 Completion rate** (carried from #81).
  `count(distinct order_id with order_delivered)` ÷
  `count(distinct order_id with order_placed)`. Unit: order. Cohort per R7.
- **M8 Rating rates.** Unit: order. Both use the same denominator,
  `count(distinct order_id with order_delivered)`.
  - **Restaurant:** `count(distinct order_id with rating_submitted)` ÷ that
    denominator.
  - **Driver:** `count(distinct order_id with driver_rating_submitted)` ÷
    that denominator.

  If driver ratings run well above restaurant ratings, people are stopping
  at the sheet's second step.
- **M9 Sign-in wall.** Unit: session. The base set P = sessions with ≥ 1
  `sign_in_prompt_shown` where `surface = 'checkout'`.
  - **Start rate** = sessions in P with ≥ 1 `sign_in_started`
    (`surface = 'checkout'`) ÷ |P|.
  - **Pass rate** = sessions in P with ≥ 1 `sign_in_completed`
    (`surface = 'checkout'`, `outcome = 'success'`) ÷ |P|.
  - **Wall-to-order** = sessions in P with ≥ 1 `order_placed` whose
    `occurred_at` is later than the session's first `sign_in_prompt_shown`
    ÷ |P|.
  - The same three with `surface = 'tip'` replace `order_placed` with
    `tip_sent`.
- **M10 Wallet-paid share.** `count(distinct order_id where
  (props->>'wallet_paid')::boolean)` ÷ `count(distinct order_id)`, over
  `order_placed` rows with the key present (R4). Unit: order.
- **M11 Short-balance recovery.** Among sessions with ≥ 1
  `wallet_short_shown` where `surface = 'checkout'`: those with an
  `order_placed` later in the same session ÷ all of them. Unit: session.
  This is the drip-sizing reading: low recovery means the drip doesn't
  cover real baskets.
- **M12 Tip rate.**
  `count(distinct order_id with tip_sent)` ÷ `count(distinct order_id with
  order_placed where wallet_paid = true and with order_delivered)`. Unit:
  order. Cohort per R7. Only wallet-paid orders can be tipped (D14).
- **M13 VIP mix.** For each level v: `count(distinct order_id where
  vip_level = v)` ÷ `count(distinct order_id)`, over new-shape
  `order_placed` rows (R4). Unit: order.
- **M14 Thanks-voucher use.** `count(distinct order_id where
  thanks_voucher_amount_minor > 0)` ÷ `count(distinct order_id)`, over
  new-shape `order_placed` rows (R4). Unit: order.
- **M15 Voucher attachment** (carried from #81).
  `count(distinct order_id where jsonb_array_length(applied_voucher_ids) > 0)`
  ÷ `count(distinct order_id)` over `order_placed`. Unit: order.
- **M16 Flash view-to-action** (carried from #81).
  `count(distinct (session_id, city) with flash_sheet_closed where outcome
  = 'restaurant_tapped')` ÷ `count(distinct (session_id, city) with
  flash_sheet_shown)`. Unit: (session, city).
- **M17 Location switch rate** (carried from #81).
  `count(distinct visitor_id with location_selected where is_switch)` ÷
  `count(distinct visitor_id with location_selected)`. Unit: visitor.

## 12. Guardrails, ship/stop, and failure cases

### Guardrails: what must not move, and what it means if it does

- **G1 New-shape coverage.** Share of `order_placed` rows per day carrying
  `city`.
  - It should pass 95% within three days of the wiring deploy.
  - If it doesn't, stale clients are still running, or the new shape is
    being refused and only old tabs get through.
- **G2 One `session_started` per session.** Among sessions whose rows
  include any new-shape event:
  - the share with exactly one `session_started` must be ≥ 98%;
  - the share with two or more must be ≤ 1%.

  Below the first threshold, sources are unreadable. Above the second,
  the guard is broken and M2 or M6 double-count.
- **G3 Internal share.** Rows excluded by `is_internal` ÷ all rows in
  `events`, per day.
  - Zero on a day the owner used a marked browser means the flag isn't
    arriving.
  - Most of the traffic being internal means launch-day numbers are
    thinner than they look.
- **G4 No cliff on deploy day.** M1 and M4's S1 on the wiring deploy day,
  compared with the three days before.
  - A drop of more than half means the store is refusing a shape the new
    client sends.
  - ADR 0005's store refuses such rows silently. This guardrail is the only
    place that shows.
- **G5 City/currency coherence.** Rows where `props ? 'city'` and the
  `currency` doesn't match the city (§4) must be 0. A non-zero count means
  a client bug. Those rows are excluded from M5.

**The claim this contract makes, and where it could be wrong.** Old-shape
and new-shape rows are treated as comparable (R3, R4). If G1 shows old
shapes lingering for weeks, per-city numbers from the fallback in R3 are
still correct. But metrics that rely on new-shape rows only (M10, M13, M14)
then describe a subset of orders, and must be labelled that way.

### Ship / stop

**Read the launch numbers only when all of these hold:**

1. The owner's Supabase project exists and has every migration applied,
   including this contract's (#222's checklist).
2. The wiring children are merged and deployed.
3. G1 ≥ 95% for a full day.
4. G2 holds.
5. A row with `is_internal = true` exists for each device the owner uses.

**Stop, fix, and do not publish a number if any of these happens:**

- G4 fires;
- G2 breaks either threshold;
- G5 is non-zero;
- an internal visitor's rows appear in `events_clean`.

### Failure cases

- **The store refuses a row.** Sends are best-effort and swallow errors
  (ADR 0005), so a refused row is simply missing. That is why every new or
  changed shape needs a PGlite test against the exact client payload, and
  why G1 and G4 exist.
- **Blocked storage.** No `visitor_id` or `session_id` can be built, so
  nothing is sent. The visitor is absent from every count. That is
  exclusion, not a third category.
- **A person who never signs in.** They are counted in every visitor,
  session and funnel metric. They are outside M9-M12's denominators, which
  start at the prompt. Someone who never saw the prompt is outside the
  sign-in metrics, not a "didn't sign in" group.
- **A visitor with no `home_viewed` in W.** They are outside M4 and M5's
  cohort, and excluded rather than treated as a separate group. They still
  count in M1, M2 and M6.
- **The OAuth return lands in a different tab, or storage is lost.**
  - No `sign_in_completed` fires, so the attempt counts as not passing the
    wall.
  - A fresh `session_started` may then appear with `referrer_host` of
    `<ref>.supabase.co`, `accounts.google.com` or `appleid.apple.com`.
  - In M6 those hosts mean "lost across sign-in", not an acquisition
    source.
- **Duplicates of `driver_rating_submitted`, `tip_sent` or
  `sign_in_completed`.** Each row gets a fresh `id`, so the store's primary
  key cannot catch a client guard bug, just as with #81's
  `order_delivered`. The invariants in §8 are what the tests assert. Every
  metric counts `distinct order_id` or `distinct session_id`, so a
  duplicate that does land inflates nothing.
- **An old tab after the migration.** It sends #81 shapes with no
  `is_internal`. The store accepts them (§13), and the default is `false`.
  If the old tab is the owner's, its rows are still excluded, provided that
  browser has any flagged row (exclusion is by visitor).

### Whether any of this can be read yet

**No.** Today, a per-city or per-source number on any page would be an
artefact, not a result:

- The seven new events and five new `order_placed` props do not exist in the
  client.
- `flash_sheet_shown` is refused.
- `city` cannot tell LA from SF on money events.
- There is no acquisition field.
- The owner's own visits are counted as visitors.

The store does take events off the device (ADR 0005), so an aggregate is
possible once the ship conditions above hold. Until then, the only honest
statement is "not measured yet".

## 13. What the store must accept (for the migration child)

**The migration's shape:**

- **Additive.** A new file under `supabase/migrations/`. No existing
  migration is edited, and no stored row is changed.
- **A strict superset (amendment 4).** Every (`event_name`, `props`) pair
  the currently deployed `event_is_valid`
  (`20260926000000_two_city_event_contract.sql`) accepts must still be
  accepted. Open tabs keep sending #81's shapes after the new client
  ships, and a refused row is lost silently.
  - Test: every accepting fixture in
    `two-city-event-contract.migration.test.ts` still passes against the new
    function, unmodified.
  - This deliberately reverses #81's AC7 posture ("old shapes rejected")
    for this revision. #81's reason was to stop stale clients writing
    shapes the contract no longer describes. Here the old shapes *are*
    still described (R3, R4), and they map cleanly.

**Concretely:**

1. **Event names.** `event_name`'s CHECK becomes the 18 names in §8. Drop
   and re-add it `not valid`, as in #85, so historical rows aren't
   re-scanned.
2. **`la` everywhere a city is checked.** Every `city` check accepts `la`.
   Every voucher-id check (both `order_placed` shapes) accepts the 15 ids
   in §4. Widening the old shape costs nothing, and one list is simpler
   than two.
3. **`cart_viewed` and `checkout_viewed`.** Accept both the #81 3-key shape
   and the 4-key shape with `city`.
4. **`order_placed`.** Accept both the #81 9-key shape and the 14-key shape
   in §8. For #224's AC3: the previous shape **continues to be accepted**,
   intentionally.
5. **`flash_sheet_shown`.** `restaurant_slugs` length is 5-6 (the product's
   actual draw), **or** 2. The 2 is kept only because the current store
   accepts it and this migration is a strict superset. No current client
   sends 2.
   - The 5-6 elements must be distinct. That is a new constraint, and it
     only applies to the new length.
   - The client validator in `tracking.ts` requires 5-6.
6. **The seven new events.** Their shapes are exactly as in §8, with keys
   matched exactly. Enumerated literals (`(none)`, `(self)`, `(invalid)`,
   the tip presets per currency) are checked. Cross-field invariants are
   not checked (ADR 0007).
7. **The `is_internal` column.**
   - `alter table public.events add column is_internal boolean not null default false`.
   - Add `grant insert (is_internal) on public.events to anon`, alongside
     the existing column grant.
   - Recreate `public.events_clean` (still `security_invoker = true`, with
     anon/authenticated privileges revoked again) as every `events` row
     whose `visitor_id` has no row with `is_internal`. A view defined with
     `select *` does not pick up a new column until it is recreated.

**An ADR is owed.** It belongs in the diff of the migration that adds the
column, using the next free number in `docs/decisions/` and referencing ADR
0005, ADR 0007 and this contract. It must cover:

- the new column and its grant;
- `events_clean`'s first real exclusion rule;
- `event_is_valid`'s strict-superset posture.

House rules put an ADR in the same diff that makes the schema change. This
document makes none, so it writes none, the same split #81 and #85 used.

## 14. Requirements on the implementing children

**The About page (`src/pages/about.astro`, with `about-page.test.ts`
asserting each line):**

- It must say an internal-traffic flag exists. It marks the owner's own
  browser when visited with `?internal=1`, it is true/false only, and it is
  never an identifier (O12).
- It must say acquisition is captured: the referring site's name only,
  plus `utm_source`, `utm_medium` and `utm_campaign` from the link, and
  never the full address, the rest of the query string, or click IDs.
- It must list the new events in plain words: sign-in attempts and their
  outcome, tips sent (preset amount), driver ratings, and a short wallet
  blocking an order or tip.
- The `flash_sheet_shown` line must stop saying "not recorded at the
  moment" once the store and client accept 5-6.

**Client and tests:**

- `tracking.ts`'s validator mirrors §8 exactly, for the new shapes only.
  The client never sends an old shape again.
- Every new or changed `track()` call site has two tests:
  - a unit test proving the exact props;
  - a PGlite test proving the store accepts that exact payload, the same
    object and not a hand-written lookalike (#224's own "what must not
    happen").
- Each invariant in §8 marked "at most one" or "exactly one" gets a test
  that performs the action twice and asserts one event.
- `session_started` and the `internal` marking need tests with a fake
  `document.referrer` and query string. They must include
  `?utm_source=linkedin&gclid=X&fbclid=Y&li_fat_id=Z&internal=1`, and
  assert:
  - the props are exactly `{referrer_host, utm_source: 'linkedin',
    utm_medium: '(none)', utm_campaign: '(none)'}`;
  - none of `X`, `Y`, `Z` appears in the serialised row;
  - `is_internal = true` on that row and on every later one.
