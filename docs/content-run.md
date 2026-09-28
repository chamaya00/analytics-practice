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
     `rg -n "=== 'VND' \? 'hcmc'|=== 'USD' \? 'sf'|=== 'sf' \? 'hcmc'|=== 'hcmc' \? 'sf'|\['sf', ?'hcmc'\]" src`.
     `cart-dom`, `checkout-dom`, `offers-dom`, `tracker-dom`, `wallet-dom`, `history-date`, `order-store`,
     `image-budget.test.ts` and `scripts/generate-driver-avatars.mjs` changed for LA only to remove two-city
     assumptions (PR #250). A later city in an existing
     currency should need none of them (*inferred* from `cityForRestaurantSlug` in `order-store.ts`).
3. **Photos.** *Driver.* §3, for the city card, every hero and every dish. City card and heroes go in batch 1.
4. **Merge the photos PR first.** *Owner, or the driver under the objective's merge policy.* The catalogue
   can't go green before it: `image-budget.test.ts:44-52` reads every restaurant's `heroImage` file for every
   city in `CITIES`.
5. **Catalogue and picker.** *Agent (engineer).*
   - Fill `RESTAURANTS_BY_CITY.<c>` and `ALL_RESTAURANTS` (#229 suggests one `catalogue-la.ts`; *unconfirmed*
     until #233 lands), `CUISINE_SHORTCUTS.<c>`, `CAROUSEL_RESTAURANT_SLIDES.<c>`; remove the picker filter.
   - A driver pool of its own: add it to `drivers.ts`; the driver runs `npm run generate-driver-avatars`; raise
     `AVATAR_TOTAL_MAX_BYTES` in `image-budget.test.ts` (300 KB assumes 50 avatars) and record it in ADR 0010.
     A reused pool needs none of this: the script skips an id it has already drawn.
   - **Check:** typecheck, lint, test and build pass; extend `home-dom.test.ts:279-287` (14 per city) to `<c>`.
     The driver renders `/` and a `<c>` restaurant with `./scripts/app-render`, which needs a headless browser
     that the workflow lacks (PR #250).
6. **Say what goes quiet.** *Agent (engineer), in the PR.* Until step 7 lands, the city's events are
   **dropped client-side**: every event with a `city` prop, i.e. the four in step 2 plus `cart_viewed`,
   `checkout_viewed`, `flash_sheet_shown`, `wallet_short_shown` and **`order_placed`** (all checked against
   `EVENT_CITIES`). City-less events such as `tracker_viewed` and `rating_submitted` still land.
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
   `flash-deal.test.ts`'s `ZERO_FEE_SLUGS`; the new count in `home-dom.test.ts:279-287`.
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
**Where LA's runs differed:** batch 1 fetched all 15 in one run (PR #242, first comment). Three dish searches
returned 0 results and needed fallbacks: "haemul pajeon seafood pancake", "tsukemen dipping noodles" and
"lumpia spring rolls" (the `photos` job logs on PR #242; each fallback fetched on the re-triggered run).

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

**Expected red:** `image-budget.test.ts:99-108` ("no placeholder left") fails while any row is `.svg`, so the
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

Last tested by: _(#233 fills this in: date, run, and each step it corrected)_
