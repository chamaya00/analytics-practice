# Content run: add a city, or add restaurants to an existing city

Ordered steps. Each names the file, command or check, and who does it: **driver** (the driving session, run
locally), **agent** (a role run), or **owner**. Written for #232 from main after PR #250 (#230) and PR #242
(#231, LA photos). Anything marked *unconfirmed* was not checked against code.

**Scope.** A city that spends an existing currency (`USD` or `VND`). A new currency is not a content run: it
touches `Currency` and every `Record<Currency, …>` (`money.ts`, `checkout-dom.ts`, `vip-level.ts`,
`tracker-dom.ts`), the binary `otherCurrencyForCity`, and the wallet's `usd_minor`/`vnd_minor` columns and
currency checks in `supabase/migrations/2026092[78]*`. File it as its own objective.

**Where agents can't go.** Workflow agent runs have been refused `node <script>`, heredoc file writes and
`npx vitest` (#221 D9, D11), so the manifest, credits rewrite, test runs and renders belong to the driver or
a local run. An agent can't re-run a workflow or read its log (`docs/memory/engineer.md`). **No agent edits
`.github/workflows/photos.yml`** (its header, lines 9-10).

## 1. Add a city

`<c>` is the short city id (`la`), as in `<c>-discount-t1` and `cities/<c>.jpg`; `<C>` is its upper case.

1. **Spec.** *Agent (designer).* `docs/design/<issue>-<c>-catalogue.md`, modelled on `229-la-catalogue.md`:
   a `<c>` value for every hit of `rg -n "Record<City" src`; the voucher ladder under `<c>-*` ids; about 14
   restaurants of 4-6 dishes (invented names, prices in minor units); carousel slides; a search and a
   *different* fallback search per photo slot, in batches (§3).
   **Check:** `rg -n -i "<every new slug>" src` prints nothing, and every slug matches
   `^[a-z0-9]+(-[a-z0-9]+)*$` in at most 60 characters, as the store enforces on `restaurant_slug`
   (`20261001000000_analytics_readiness_event_contract.sql:56-60`).
2. **The city as data, not yet offered.** *Agent (engineer).* Mirrors PR #250.
   - `src/lib/money.ts`: `<c>` in `City` and `CITIES`; a value in `CITY_CURRENCY`, `CITY_LOCALE`,
     `CITY_NAMES`, `CITY_SHORT_NAMES`. `isCity` reads `CITIES`.
   - `npm run typecheck` then lists every other `Record<City, …>` to fill: `thanks-voucher.ts`
     (`THANKS_VOUCHER_AMOUNT_MINOR`, `THANKS_VOUCHER_MINIMUM_SPEND_MINOR`); `flash-deal.ts`
     (`AMOUNT_STEPS_MINOR`, `FLASH_REDUCED_OFF_MINOR`); `home-dom.ts` (`PROMO_BANNER_CLAIM`, `_AMOUNT`,
     `_AMOUNT_COMPACT`, `CAROUSEL_RESTAURANT_SLIDES.<c> = []`); `vehicle-icon.ts` (`VEHICLE_ICON_PATHS`);
     `drivers.ts` (`DRIVERS_BY_CITY`: reuse a pool as LA reuses `SF_DRIVERS`, or see step 5); `restaurants.ts`
     (`RESTAURANTS_BY_CITY.<c> = []`, `CUISINE_SHORTCUTS`); and `flash-deal.test.ts`'s `ZERO_FEE_SLUGS`.
   - `vouchers.ts`: the five ids in `VoucherId`; `<C>_CATALOGUE` and its `CATALOGUE_BY_CITY` entry;
     `FLASH_MINIMUM_SPEND_MINOR`; the ids exported as a separate `<C>_VOUCHER_IDS` like `LA_VOUCHER_IDS`.
     `VOUCHER_IDS` stays at the ten `tracking.test.ts` pins (#166).
   - `home-dom.ts`: add `<c>` to the `PICKER_CITIES` filter, so it isn't offered before it has restaurants.
   - **Pin tracking.** `tracking.ts` checks `location_selected`, `home_viewed`, `restaurant_opened` and
     `flash_sheet_closed` against `money.ts`'s `CITIES`, so `<c>` would be *sent* and silently rejected by
     the store (ADR 0005). Make those four check `EVENT_CITIES` (the store's list) and test that `<c>` is
     refused. Don't add `<c>` to `EVENT_CITIES` or `EVENT_VOUCHER_IDS`; that is step 7. (This pin was #230's
     criterion 3, superseded only because #219's contract already had `la`.)
   - Copy `src/lib/la-city.test.ts` for `<c>`: a mocked `<c>` restaurant, with the city checked at
     checkout, Offers, cart, tracker, history and thanks voucher.
   - **Check:** `npm run typecheck`, `npm run lint`, `npm run test` pass, and this prints nothing:
     `rg -n "=== 'VND' \? 'hcmc'|=== 'USD' \? 'sf'|=== 'sf' \? 'hcmc'|=== 'hcmc' \? 'sf'|\['(sf|hcmc)', ?'(sf|hcmc)'\]" src`.
     (#233: the earlier pattern matched only `['sf', 'hcmc']`, and missed `flash-deal.test.ts`'s
     `it.each(['hcmc', 'sf'])`, which is why LA's zero-fee check never ran until #233. Loop a test over
     `CITIES`, never a literal list.)
     `cart-dom`, `checkout-dom`, `offers-dom`, `tracker-dom`, `wallet-dom`, `history-date`, `order-store`,
     `image-budget.test.ts` and `scripts/generate-driver-avatars.mjs` changed for LA only to remove two-city
     assumptions (PR #250). A later city in an existing
     currency should need none of them (*inferred* from `cityForRestaurantSlug` in `order-store.ts`).
3. **Photos.** *Driver.* §3, for the city card, every hero and every dish. City card and heroes go in batch 1.
4. **Merge the photos PR first.** *Owner, or the driver under the objective's merge policy.* The catalogue
   can't go green before it: `image-budget.test.ts` reads every restaurant's hero and dish image file for every
   city in `CITIES`.
5. **Catalogue and picker.** *Agent (engineer).*
   - Put the city's restaurants in their own `src/lib/catalogue-<c>.ts` exporting `<C>_RESTAURANTS` (as
     `catalogue-la.ts` does, #233), and set `RESTAURANTS_BY_CITY.<c> = [...<C>_RESTAURANTS]`. `ALL_RESTAURANTS`
     is derived from `RESTAURANTS_BY_CITY` over `CITIES`, so it needs no edit. Generate the file from the spec's
     tables with a throwaway script rather than typing 70 dishes by hand; every image path is
     `/images/{restaurants/<slug>-hero|dishes/<dish id>}.jpg`.
   - Fill `CAROUSEL_RESTAURANT_SLIDES.<c>` from the spec's table. `CUISINE_SHORTCUTS.<c>` was already filled in
     step 2; check it equals the catalogue's `cuisineTag`s in order.
   - Remove the `PICKER_CITIES` filter in `home-dom.ts`, and flip `<c>-city.test.ts`'s "not offered in the
     picker yet" tests to assert the new card count (for LA, 2 became 3). The picker's row layout is three
     across from 720px (`BaseLayout.astro`, `.location-cards`), drawn for exactly three cities: a fourth city
     needs a designer's call on that grid before this step, not a CSS guess inside it.
   - A driver pool of its own: add it to `drivers.ts`; the driver runs `npm run generate-driver-avatars`; raise
     `AVATAR_TOTAL_MAX_BYTES` in `image-budget.test.ts` (300 KB assumes 50 avatars) and record it in ADR 0010.
     A reused pool needs none of this: the script skips an id it has already drawn, and `image-budget.test.ts`
     de-duplicates ids across cities.
   - **Tests to extend or write** (#233 found each missing):
     - a `<c>-catalogue.test.ts` that reads the spec's own tables (see `la-catalogue.test.ts`) and compares
       names, slugs, tags, ratings, fees, deals, heroes, sections, dishes and prices, plus 4-6 dishes each;
     - `home-dom.test.ts`: the 14-per-city count, the city's own feed, and its seven carousel slides;
     - `flash-deal.test.ts`: `ZERO_FEE_SLUGS.<c>`, now checked against the catalogue's zero-fee restaurants;
     - `image-budget.test.ts` already loops over `CITIES` for heroes, dish images and `cities/<c>.jpg`, and
       fails if a city has no restaurants, so it needs no edit.
   - **Check:** typecheck, lint, test and build pass. Render with `./scripts/app-render <route> <out-dir>
     [seed-file]` (1280 and 375 wide): `/` for the picker, and with a `<c>` seed the feed, the flash deal,
     `/offers/`, `/checkout/` and `/tracker/`. A seed goes in `docs/design/shots/<issue>-*-seed.js` and starts
     with `/* global window, ... */`; `233-*-seed.js` are working examples. Seed gotchas:
     - a stored flash draw with fewer than 5 restaurants is discarded and redrawn, so the sheet opens anyway;
     - `/offers/` with no cart shows "Nothing qualifies yet"; seed a cart;
     - the tracker shows the driver only once the order is picked up; seed `placedAt` well into `deliveryMs`;
     - the wallet sheet exists only on a build with `PUBLIC_WALLET_ENABLED=true`, `PUBLIC_SUPABASE_URL` and
       `PUBLIC_SUPABASE_PUBLISHABLE_KEY` in app-render's environment, plus a stored session and a stubbed
       `fetch` (`233-wallet-la-seed.js`). Never commit that build.
     app-render needs a headless browser on `PATH` (none in the workflow, PR #250). A local run without one
     can unpack Chromium from the npm registry (`@sparticuz/chromium`) outside the repository and put it on
     `PATH` for the render only. For a 1366 picture, serve `dist/` and call `node scripts/render-shot.mjs
     chromium <url> 1366 900 <out>` directly.
6. **Say what goes quiet.** *Agent (engineer), in the PR.* This applies only while step 7 has not landed.
   Until it does, the city's events are **dropped client-side**: every event with a `city` prop, i.e. the four
   in step 2 plus `cart_viewed`, `checkout_viewed`, `flash_sheet_shown`, `wallet_short_shown` and
   **`order_placed`** (all checked against `EVENT_CITIES`). City-less events such as `tracker_viewed` and
   `rating_submitted` still land. For LA, step 7 (#219: PRs #240, #244, #246, #248) merged *before* the
   catalogue did, so `la` and the `la-*` ids were already in `EVENT_CITIES`/`EVENT_VOUCHER_IDS` and nothing
   went quiet. Check `tracking.ts` rather than assuming the order in this list.
7. **Store contract: its own analytics-readiness objective (#79 rule).** *Owner files it and applies the SQL.*
   - A contract revision in `docs/measurement/`.
   - An additive migration adding `<c>` to every `props->>'city' in (…)` list and the five `<c>-*` ids to the
     voucher list (for `la`: `20261001000000_…sql:48-256` and `:169`). Since `20261002000000_…sql:36` those
     lists live in `event_is_valid_224` behind a wrapper. *Unconfirmed:* whether the next migration replaces
     that function or renames again; the engineer decides.
   - A new line in ADR 0005's "Owner setup checklist". Only the owner runs it, in the Supabase SQL editor.
   - Then `tracking.ts`: `<c>` into `EVENT_CITIES`, `<C>_VOUCHER_IDS` into `EVENT_VOUCHER_IDS`.

## 2. Add restaurants to an existing city

1. **Spec.** *Agent (designer).* As §1 step 1: restaurants, dishes, prices, searches, fallbacks; slug check.
2. **Photos.** *Driver.* §3, for the new heroes and dishes.
3. **Merge the photos PR.** *Owner, or the driver under policy.* Reason: §1 step 4.
4. **Catalogue.** *Agent (engineer).* Add the entries to the city's catalogue file (`restaurants.ts`,
   `catalogue-more.ts`, or the city's own); a new cuisine to `CUISINE_SHORTCUTS`; a zero-fee restaurant to
   `flash-deal.test.ts`'s `ZERO_FEE_SLUGS`; the new count in `home-dom.test.ts`'s "Near you" test and in
   `la-catalogue.test.ts`'s `ALL_RESTAURANTS` total (42 after #233). For LA, `la-catalogue.test.ts` reads
   `229-la-catalogue.md`'s tables, so a new LA restaurant goes into that spec's tables too, or the test fails.
   **Check:** typecheck, lint, test and build pass.
5. **Events:** none. The store checks a slug's shape, not a list of slugs (§1 step 1).

## 3. Photos (both procedures)

**The pipeline.** Edit `docs/design/80-photo-credits.md` → `node scripts/generate-photo-manifest.mjs` writes
`docs/design/photos.json` → a PR change to `photos.json` fires `photos.yml` → `scripts/fetch-photos.mjs` →
the workflow commits the JPEGs and `docs/design/photos.lock.json` to the PR branch. **Never hand-edit
`photos.json`:** `scripts/generate-photo-manifest.test.ts` requires it to equal the generator's output (PR #242).

| Limit | Source |
|---|---|
| 1-3 search requests per slot: with orientation, without, then minus the last word (only past 2 words) | `fetch-photos.mjs:108-116, 143-152` |
| Plus 1 download ping to `api.unsplash.com`: 2-4 per fetched slot; a 0-result slot spends 2-3 and fails | `fetch-photos.mjs:156-162` |
| Demo key: 50 requests an hour. Out of budget, the run stops, commits what it got, and exits red | `fetch-photos.mjs:32-35, 219-238`; `photos.yml:21-22, 71-91` |
| The job fires **only** when `docs/design/photos.json` changes on a PR from this repository | `photos.yml:24-27, 38` |
| A slot is refetched when its file is missing or its query changed | `fetch-photos.mjs:93-100` |
| *Inferred:* the image download (`images.unsplash.com`) isn't counted; it isn't an API call | `fetch-photos.mjs:25-27, 196` |

**Batch size: 15-18 slots.** At 2 requests a slot, 18 uses 36 of 50 and leaves 14 for retries
(`229-la-catalogue.md:563-566`); at the worst case of 4, one run fetches 12. So *N* slots need ⌈*N*/18⌉ batch
runs, plus one run per round of fallback swaps. LA: 85 slots in 5 batches (15, 18, 18, 17, 17).
**Where LA's runs differed:** batch 1 fetched all 15 in one run (PR #242, first comment). Five of the 85
searches (all dishes) came back with 0 results and needed the spec's fallback: "haemul pajeon seafood
pancake", "tsukemen dipping noodles", "lumpia spring rolls", "edamame bowl sea salt" and "barg kebab beef
rice". Each fallback fetched on the re-triggered run. #233 counted these by comparing the spec's batch
queries with `photos.json`, because only the `photos` job logs on PR #242 name them. Expect about one slot
in 17 to need its fallback.

**Steps.** *Driver*, every batch on the one photos PR's branch.
1. `git pull` first: the workflow's bot has pushed to the branch.
2. Add one row per slot to the right table in `80-photo-credits.md`: `` `public/images/{cities|restaurants|dishes}/<slug>.svg` ``
   (`.svg`, not `.jpg`; the folder sets the crop size, `generate-photo-manifest.mjs:25-29`), the search in
   double quotes, and a status such as "Placeholder — not yet downloaded". Hero rows also carry a Cuisine cell.
3. `node scripts/generate-photo-manifest.mjs`. **Check:** `git diff --stat` shows additions only, one entry
   per row; `npx vitest run scripts/generate-photo-manifest.test.ts` passes.
4. Commit both files together and push. That fires the job.
5. Wait for the `photos` check. Slots still missing are the `photos.json` paths with no key in
   `photos.lock.json`; this is how to see them without the log.
6. A 0-result slot: replace its row's search with the spec's fallback, regenerate, commit. That re-fires the
   job. Out-of-budget slots need nothing: the next batch's run retries them.
7. Next batch **about an hour after the previous run finished**. Repeat 1-6.
8. After the last batch has fetched: `npm run rewrite-photo-credits`, then commit. It swaps each fetched row to
   `.jpg` with photographer and licence, and leaves unfetched rows alone (`rewrite-photo-credits.mjs:1-9`).
   **Check:** `grep -c "\.svg" docs/design/80-photo-credits.md` prints 0. Look at every new picture and swap
   a wrong one with its fallback (step 6).

**Expected red:** `image-budget.test.ts`'s "no placeholder left" test fails while any row is `.svg`, so the
photos PR is red until step 8. Don't chase it.

## 4. What only the owner does, and what comes after

- **The Unsplash secret.** `UNSPLASH_ACCESS_KEY` is a repository secret (`photos.yml:63`). Only the owner sets
  or rotates it, or applies for a production key to lift the 50-an-hour limit.
- **The per-batch commits.** The owner's unless delegated; for LA, #221 O15 gave them to the driver.
- **The store's contract and migration for a new city.** §1 step 7: its own analytics-readiness objective after
  the product merges (#79 rule); the owner applies the SQL. Until then its events are dropped client-side.
- **Merging.** Every PR: the owner, or the driver under the policy the owner set.
- **Widening the workflow's command allow-list** (`node`, heredocs, `vitest`; #221 D11), if wanted.

**Known gaps, named, not built:** `tracking.ts`'s four `CITIES` checks should read `EVENT_CITIES`; only the
log says which photo slots failed (a lock-versus-manifest diff script would); batches are committed by hand.

Last tested by: #233, 2026-09-28, an engineer run done locally, adding Los Angeles. It exercised §1 steps 5 and
6 and §1 step 2's check. It corrected §1 step 2 (the check's pattern missed `['hcmc', 'sf']`), step 4 (line
numbers replaced by test names), step 5 (`catalogue-<c>.ts`; `ALL_RESTAURANTS` is derived; `CUISINE_SHORTCUTS`
is step 2's; the picker-pin test flip; tests to write; render seeds and gotchas) and step 6 (only while step 7
is unmerged). It also corrected §2 step 4 (`la-catalogue.test.ts` reads the spec) and §3 (five zero-result
searches, not three). §1 steps 1-4 and §3's fetch were exercised by #229, #230 and #231/#242, not re-run here.
