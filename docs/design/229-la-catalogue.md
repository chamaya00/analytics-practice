# #229 — Los Angeles: catalogue, per-city values, photo batches, three-card picker and the "other city" line

Parent: #227. Children that build from this: #230 (currency is no longer the
city), #231 (LA photo manifest, fetched in batches), #233 (the LA catalogue,
drivers, and a picker with three cities). Specification only. Nothing here
is imported by the site, and nothing under `src/` changes in this pull
request.

## For the driver: the calls in this document

The owner delegated the catalogue, the photo choices and the switch design
to the driving session (#221, O9). Each call below has a recommendation, and
your review of this spec settles it.

1. **The "other city" line is really an "other currency" line** (the
   largest call). LA and SF share one USD wallet balance and one USD VIP
   spend. So from SF or LA the line names Ho Chi Minh City. From HCMC it
   names **"San Francisco and Los Angeles"** in one row, not two. Two rows
   would show the same $20.00 twice. See [The "other city" line](#the-other-city-line-with-three-cities).
2. **Picker: compact rows, three across at wide widths**, instead of
   today's card repeated three times. The row version leaves about 420px
   free for #220's intro at 375 wide. The current card leaves about 200px.
   See [The three-card picker](#the-three-card-picker).
3. **Drivers: LA reuses SF's pool** (no new avatars, no ADR 0010 change).
   See [Drivers](#drivers-la-reuses-sfs-pool).
4. **Vouchers, flash and thanks amounts: identical to SF's.** Same currency
   and comparable prices, so a different ladder would be a difference
   nobody chose. The ids alone tell LA from SF.
5. **Photos: five batches (15, 18, 18, 17, 17 slots).** Batch 1 is the city
   card plus the 14 heroes, so the feed looks finished first.

## Outcome, constraints, guesses

- **Outcome.** A person can pick Los Angeles and get a feed as full as SF's.
  Every surface that names "the other city" still tells the truth when
  there are three.
- **Constraints, checked rather than assumed.**
  - The city value is `la`, and the voucher ids are `la-delivery-entry`,
    `la-discount-t1`, `la-discount-t2`, `la-discount-t3` and `la-flash`.
    #223 is writing these into the store (#221, O7).
  - Flash amounts must sit within 200-600 minor units
    (`isFlashAmountInRange`).
  - The wallet stays per currency: `usd_minor` and `vnd_minor`, no
    migration.
  - VIP spend is per currency: `ledger.spendMinor[currency]`.
  - Photo entries carry only `path`, `query`, `width` and `height`, plus an
    optional `photo`. `validateEntry` in `scripts/fetch-photos.mjs`
    enforces this.
  - The `photos` job runs only when `photos.json` changes.
  - City card images are 96×64. `cities/la.jpg` has to match, which rules
    out a picker built on large photos (see the picker's rejected option).
- **Guesses in the issue, and my view of each.**
  - *"Switch"* is a guess. Neither surface switches anything. Both display
    the *other currency's* number, labelled with a city name, and that
    label is the only thing that breaks.
  - *"Three-card picker"* is right about the count. It says nothing about
    shape, and the shape is what decides whether #220's intro still fits.
  - *"14 restaurants, 4-6 dishes"* I kept. It gives 70 dishes, beside SF's
    69.

## What is there now

`./scripts/app-render /` on main (#220 unmerged; rendered locally with a
Chromium from the npm registry, since the sandbox has none on PATH). At 375
wide the first screen has:

- the wordmark;
- "Choose your city";
- two tall white cards. Each is a 96×64 thumbnail sitting *above* the city
  name and "Prices in USD/VND", with the right two-thirds of the card
  empty;
- "What we log, and why";
- the tab bar.

The cards take about 290px for two. At 1280 wide the same two cards
stretch to about 936px each, and each is mostly blank white. It reads as a
form with two radio buttons rather than two places. Nothing about it is
broken. It simply spends height it will need once #220 puts an intro above
it, and a third card in this shape makes that worse.

## What I looked at, and what I took

- **Citymapper's city selection** ([UI Sources](https://www.uisources.com/explainer/citymapper-city-selection)).
  Each city gets its own picture, so the list reads as places rather than
  options.
  - *Taking:* the photo is the card's identity, so it gets the card's full
    height and edge.
  - *Refusing:* the mascot illustration. This site's cities are
    photographs, credited.
- **Airbnb's destination rows** ([analysis](https://medium.com/design-bootcamp/the-genius-behind-airbnbs-design-93cf8bd24e38)).
  "Cards are visually uniform so the photos carry the variation": photo
  first, a small text block, and a consistent width.
  - *Taking:* identical row geometry for all three, with only the photo
    and the words varying, three across once the width allows.
  - *Refusing:* the carousel. Three items never need to scroll.
- **Wise's multi-currency balances** ([Wise](https://wise.com/us/account/)).
  One balance per currency, however many places spend it.
  - *Taking:* the "other" line is keyed on currency, and the label lists
    the places that spend it.
  - *Refusing:* a list of one row per balance with flags. There are only
    two balances here.

## Direction

**Compact, even, place-first.** Three cities should read as three equal
places you can take in at one glance, and never as a stacked form or a
promotional hero.

## The three-card picker

Mock: `229-three-city-picker.html`. Pictures: `-narrow.png` (375) and
`-wide.png` (1280), both from `scripts/design-render`, plus `-1366.png` and
`-narrow-dark.png` from `scripts/render-shot.mjs`. **Drawn against main as
it stands; #220 is unmerged** (criterion 1). What #220 adds sits above
"Choose your city", and this spec leaves it room rather than guessing its
shape.

### Two directions, one recommended

| | A: compact rows (recommended) | B: today's card, three times |
|---|---|---|
| Card | Row: 96×64 photo flush to the card's left edge, name and currency, chevron | Photo on top, name and currency under it, padding all round |
| 375 wide | Stacked. Cards end about 328px from the top, **about 420px** clear above the 56px tab bar | Stacked. Cards end about 556px down, **about 200px** clear |
| 1280/1366 wide | Three across in the 60rem column | Three full-width bars, each about 900px wide and mostly blank |
| Assets | Uses the 96×64 photo at its own size | Same |
| Mock | `229-three-city-picker.html` | `229-three-city-picker-rejected.html` |

A third direction was **rejected on an asset constraint**: large
photo-first "postcards" three across at wide widths. `cities/*.jpg` are
96×64 slots, fetched at 2×, so 192×128 pixels. A 300px-wide postcard would
stretch them by more than 1.5× at 2× density, and the criterion fixes
`la.jpg` to the existing city-card size.

### Composition

- **What the eye lands on first:** the three photos, as a column at 375
  and as a row at wide widths. The names come second and are the largest
  text on the cards. The chevrons come last.
- **Space:** the rows are deliberately short (64px), so the vertical space
  goes to whatever sits above them. Today that is nothing. After #220, it
  is the intro.
- **At 375:** the longest name, "Ho Chi Minh City", sits at 1rem/800 in the
  space left after the 96px photo, 14px gap, 20px chevron and 14px right
  padding: about 199px. The 375 picture shows it on one line with room to spare, so it does not
  wrap. The rule `overflow-wrap: normal; word-break: keep-all` is there to
  guarantee a name breaks only between words if a font ever falls back
  wider.
- **Order:** `CITIES` becomes `['sf', 'hcmc', 'la']`. The new city is
  appended, so the existing cards and `location-card-sf` and
  `location-card-hcmc` keep their positions, and the picker's order is
  simply `CITIES`.

### The component: `location-card` (reshaped)

- **Purpose:** to pick a city. The behaviour is unchanged: tap, then
  `setStoredCity`, then the feed. `location_selected` fires exactly as it
  does today, with `la` dropped client-side until #219's wiring lands.
- **Inputs:** `city` and `CITY_NAMES[city]`, with the currency note from
  `CITY_CURRENCY[city]` ("Prices in USD") instead of today's
  `city === 'sf' ? … : …`. The image is `/images/cities/${city}.jpg` with
  `alt=""`: the name beside it already says it.
- **Geometry:**
  - a grid `96px 1fr 20px`, column gap `--space-md`;
  - min-height 64px, no left padding and `--space-md` right padding;
  - `overflow: hidden`, so the 12px radius clips the photo;
  - 1px `--color-border` on `--color-surface`;
  - the list gap is `--space-sm` below 720px, and it becomes three columns
    with a `--space-md` gap at 720px and above.
- **Type:** the name at 1rem, weight 800. The currency note at
  `--font-size-muted` in `--color-text-muted`.
- **States:**
  - *rest*;
  - *hover* (pointer devices): border `--color-accent-a`, the rule main
    already has for cards;
  - *keyboard focus*: a 2px `--color-accent-a` outline, offset 2px. It is
    drawn on LA in the mock;
  - *pressed*: no extra state; navigation is immediate;
  - *image not yet fetched*: until batch 1 lands `la.jpg`, the `<img>` 404s.
    The engineer must not ship the picker with LA before batch 1 is merged
    (#233 depends on #231). If it does happen, the 96×64 cell shows
    `--color-bg` and the row still reads, because the name carries it;
  - *storage blocked*: `location-blocked-notice` is unchanged and sits
    under the list.
- **Never:** the card never carries a price or a promo line, never uses
  the accent as a fill, and never shows LA with a "New" badge. A badge
  would be the one thing on the screen louder than the cities themselves.
- **Deliberate oddity:** the photo is flush to the card's edge, full
  height, with no inner radius. *Defence:* it turns three form options
  into three places at no extra asset cost, because the 96×64 image is
  used at exactly its own size.

### Colour and contrast (both themes; every pair via `./scripts/contrast`)

The picker adds no colour. These are the site's tokens from
`src/styles/global.css`.

| Pair | Light | Dark |
|---|---|---|
| Name `--color-text` on `--color-surface` | `#0b0f0c`/`#ffffff` **19.30** | `#edf5ee`/`#121712` **16.33** |
| Currency note `--color-text-muted` on `--color-surface` | `#56665b`/`#ffffff` **6.09** | `#9fb3a2`/`#121712` **8.16** |
| "What we log" `--color-text-muted` on `--color-bg` | `#56665b`/`#f1f4f1` **5.50** | `#9fb3a2`/`#0b0f0c` **8.68** |
| Focus ring `--color-accent-a` on `--color-bg` (non-text, needs 3) | `#0f766e`/`#f1f4f1` **4.94** | `#14b8a6`/`#0b0f0c` **7.76** |

**Motion:** none is added. The row has no transition, so there is nothing
for `prefers-reduced-motion` to take away.

### The header city pill

Unchanged. It shows `CITY_NAMES[city]`, and "Los Angeles" is shorter than
"Ho Chi Minh City", which already fits.

## The "other city" line with three cities

Mock: `229-city-switch.html`. Pictures: `-narrow.png` and `-wide.png` from
`scripts/design-render`, plus `-1366.png` and `-narrow-dark.png`. Each
column (each block at 375) is one current city. Each shows the wallet
sheet's header and the tracker's VIP card at Gold.

**The one sentence that replaces `city === 'sf' ? 'hcmc' : 'sf'`:** the
other line shows the *other currency*,
`CITY_CURRENCY[city] === 'USD' ? 'VND' : 'USD'`, labelled with every city
that spends it, `CITIES.filter((c) => CITY_CURRENCY[c] === otherCurrency)`,
joined with " and ".

### Exactly what each surface offers, from each city

| Current city | Wallet sheet kicker | Wallet sheet other row (label · amount) | Tracker VIP other-currency line (shown only when that spend > 0) |
|---|---|---|---|
| San Francisco | "Play money. San Francisco and Los Angeles orders spend dollars." | **Ho Chi Minh City** · 100.000 ₫ | "Plus 420.000 ₫ of 1.500.000 ₫ in **HCMC**, counted apart." |
| Ho Chi Minh City | "Play money. Ho Chi Minh City orders spend đồng." | **San Francisco and Los Angeles** · $20.00 | "Plus $18.40 of $60.00 in **SF and LA**, counted apart." |
| Los Angeles | "Play money. Los Angeles and San Francisco orders spend dollars." | **Ho Chi Minh City** · 100.000 ₫ | "Plus 420.000 ₫ of 1.500.000 ₫ in **HCMC**, counted apart." |

- **Kicker rule:** the current city comes first, then the other cities
  sharing its currency, joined with " and ". The noun comes from the
  currency: "dollars" for USD, "đồng" for VND. This replaces
  `city === 'sf' ? 'dollars' : 'đồng'`.
- **Short labels** for the VIP line: SF, HCMC, LA. Today these are
  hard-coded as `otherCity === 'hcmc' ? 'HCMC' : 'SF'`. I recommend a
  `CITY_SHORT_NAMES: Record<City, string>` beside `CITY_NAMES`.
- **Platinum copy:** "Free delivery and 10% off every order, both cities."
  becomes "…, every city." With three cities, "both" is false.
- **States carried from the existing specs (143, 162), unchanged:**
  - The VIP line is absent when the other currency's spend is 0.
  - The wallet sheet's other row is always present.
  - The drip card is unaffected. It credits both currencies, and LA spends
    the USD one.

**The alternative I rejected: one row per other city.** From SF this would
list HCMC and LA, and from HCMC it would list SF and LA. It fails three
ways:

- From SF it would show "Los Angeles · $20.00" under a large "$20.00". That
  is the same money twice, which reads as $40.
- From HCMC, SF and LA would each show $20.00.
- It grows by one row per city, while the thing it measures grows only by
  currency.

**Contrast:** the mock adds only the Gold pill, `#0b0f0c` on `#e0b95a`, at
**10.35**. The pill is an existing token. The pale highlight under city
names is mock annotation, not UI.

## Per-city values: every table `rg -n "Record<City" src` lists

Run on main at `b82c990`. It lists 18 lines. Each has an LA value below. For
LA and SF, the SF value and the LA value are the same unless the row says
otherwise.

| File:line | Table | `la` value |
|---|---|---|
| `money.ts:15` | `CITY_CURRENCY` | `'USD'` |
| `money.ts:20` | `CITY_LOCALE` | `'en-US'` |
| `money.ts:25` | `CITY_NAMES` | `'Los Angeles'` |
| `restaurants.ts:464` | `RESTAURANTS_BY_CITY` | `[...LA_RESTAURANTS]`: the 14 below. The 4-in-`restaurants.ts` / 10-in-`catalogue-more.ts` split exists only for history, so #233 may put all 14 in one `LA_RESTAURANTS` (for example in `catalogue-la.ts`). `ALL_RESTAURANTS` must include them. |
| `restaurants.ts:489` | `CUISINE_SHORTCUTS` | `['Tacos', 'Korean BBQ', 'Thai', 'Armenian', 'Smoothie bowls', 'Ramen', 'Filipino', 'Poke', 'Breakfast', 'Hand rolls', 'Soul food', 'Persian', 'Deli', 'Vegan']`: exactly the 14 `cuisineTag`s, in catalogue order, as SF's are |
| `thanks-voucher.ts:13` | `THANKS_VOUCHER_AMOUNT_MINOR` | `300` |
| `thanks-voucher.ts:14` | `THANKS_VOUCHER_MINIMUM_SPEND_MINOR` | `1500` |
| `thanks-voucher.ts:35` | `ThanksVoucherStore` (a *type*, `Partial<Record<City, ThanksVoucher>>`) | No literal to fill. An LA thanks voucher is stored under key `la`, separately from SF's, per the existing "at most one per city" rule. |
| `vouchers.ts:163` | `FLASH_MINIMUM_SPEND_MINOR` | `1000` |
| `flash-deal.ts:24` | `AMOUNT_STEPS_MINOR` | `[200, 300, 400, 500, 600]`: every step is within 200-600 |
| `flash-deal.ts:29` | `FLASH_REDUCED_OFF_MINOR` | `200` |
| `flash-deal.test.ts:226` | `ZERO_FEE_SLUGS` (test fixture) | `['echo-park-breakfast-burritos', 'los-feliz-plant-kitchen']`: LA's two `deliveryFeeMinor: 0` restaurants |
| `home-dom.ts:35` | `PROMO_BANNER_CLAIM` | `'$2 off your first order'` |
| `home-dom.ts:42` | `PROMO_BANNER_AMOUNT` | `'$2 off'` |
| `home-dom.ts:50` | `PROMO_BANNER_AMOUNT_COMPACT` | `false` |
| `home-dom.ts:76` | `CAROUSEL_RESTAURANT_SLIDES` | See the next table. |
| `vehicle-icon.ts:22` | `VEHICLE_ICON_PATHS` | SF's car path, reused. `vehicleForCity` already returns `'car'` for anything but `hcmc`. |
| `drivers.ts:78` | `DRIVERS_BY_CITY` | `SF_DRIVERS` (see [Drivers](#drivers-la-reuses-sfs-pool)) |

**The four voucher tiers in `vouchers.ts`** are a `CatalogueEntry[]` per
city, not a `Record<City>`. `catalogueForCity` becomes a lookup, not
`city === 'hcmc' ? … : …`. LA's tiers are SF's amounts under LA ids:

| id | stackGroup | tier | label | minimumSpendMinor | amountMinor | expiry |
|---|---|---|---|---:|---:|---|
| `la-delivery-entry` | delivery | entry | Free delivery | 1000 | `null` | Today (1 day) |
| `la-discount-t1` | discount | 1 | $2 off | 2000 | 200 | 3 days |
| `la-discount-t2` | discount | 2 | $5 off | 4000 | 500 | 3 days |
| `la-discount-t3` | discount | 3 | $8 off | 6000 | 800 | 1 day |
| `la-flash` | discount | flash | `$X.XX off flash deals` | 1000 | drawn from `AMOUNT_STEPS_MINOR.la` | the countdown |

`flashCatalogueEntry` builds the id as `` `${city}-flash` `` and the label
from the city's currency, not from `city === 'hcmc'`. `VoucherId` and
`VOUCHER_IDS` gain exactly these five ids, and #230 pins `tracking.ts` to
the store's list until #219's wiring lands.

**`CAROUSEL_RESTAURANT_SLIDES.la`**, in the fixed order used for SF and
HCMC (ad, promo, ad, promo, ad, promo):

| # | type | slug | claim |
|---|---|---|---|
| 1 | ad | `boyle-heights-taco-window` | (restaurant name) |
| 2 | promo | `koreatown-charcoal-house` | "Free Corn cheese with a $25 minimum" |
| 3 | ad | `little-tokyo-hand-roll-bar` | (restaurant name) |
| 4 | promo | `echo-park-breakfast-burritos` | "Buy 1 get 1 free: Chorizo breakfast burrito" |
| 5 | ad | `thai-town-boat-noodle-house` | (restaurant name) |
| 6 | promo | `glendale-lavash-bakery` | "Free Pakhlava with a $15 minimum" |

**Binary checks that are not `Record<City>` literals but will be wrong for
LA.** They are listed for #230, not specified here:

- `money.ts` `isCity`, and `formatMoney`'s `currency === 'USD' ? 'sf'`
  (harmless, since both are `en-US`, but it is still inference);
- `home-dom.ts:481`;
- `vouchers.ts:155,167,173`;
- `wallet-dom.ts:33,239,245`;
- `tracker-dom.ts:371,1068,1076`;
- `history-date.ts:19`;
- the three `currency === 'VND' ? 'hcmc' : 'sf'` sites named in #227.

## Drivers: LA reuses SF's pool

**Decision:** `DRIVERS_BY_CITY.la = SF_DRIVERS`. There are no new avatars,
no change to `image-budget.test.ts`, and no ADR 0010 edit.

**Why that is acceptable:**

- The 25 SF names are first name plus last initial, and they read as
  plausibly Angeleno as San Franciscan.
- `pickDriver(city)` draws from the city's pool, so an LA order still gets
  a stable driver chosen by its restaurant's city.
- The only place the `sf-driver-NN` id shows is in a `data-driver-id`
  attribute and an avatar URL (`/avatars/drivers/<id>.svg`). No event
  carries a driver: `tracking.ts` has no `driver` field.
- The cost is that the same "Sarah K." can deliver in both cities. Nobody
  sees both cities' tracker at once, and the site has no driver identity
  beyond a name and a picture.

**What would change my mind:** an event that someday carries `driver.id`.
At that point an analyst could not tell an LA delivery from an SF one by
driver, and LA would need `la-driver-NN`. That belongs in #219's readiness
pass, not here.

## The catalogue: 14 restaurants, 70 dishes

The rules are the same as `catalogue-more.ts`:

- invented names, and no real chain's;
- prices in USD cents, in the same band as SF: mains $11.50-$26.95 and
  sides $3.50-$11.50;
- two zero-fee restaurants, as SF has;
- five with `hasDeal: true`, as SF has.

Every image path follows the existing convention, and every dish id is
`<slug>-<dish>`. **Check** (criterion 3):
`rg -n -i "<all 14 slugs and names>" src/lib/restaurants.ts src/lib/catalogue-more.ts`
prints nothing and exits 1. The exact command and output are in the PR.

| # | Slug | Name | Cuisine tag | Rating · reviews | Fee | Deal | Dishes |
|---|---|---|---|---|---:|---|---:|
| 1 | `boyle-heights-taco-window` | Boyle Heights Taco Window | Tacos | 4.7 · 1583 | 199 ($1.99) | yes | 5 |
| 2 | `koreatown-charcoal-house` | Koreatown Charcoal House | Korean BBQ | 4.8 · 2876 | 299 ($2.99) | yes | 5 |
| 3 | `thai-town-boat-noodle-house` | Thai Town Boat Noodle House | Thai | 4.6 · 1942 | 149 ($1.49) | no | 5 |
| 4 | `glendale-lavash-bakery` | Glendale Lavash Bakery | Armenian | 4.7 · 1206 | 99 ($0.99) | yes | 5 |
| 5 | `venice-boardwalk-bowls` | Venice Boardwalk Bowls | Smoothie bowls | 4.5 · 734 | 199 ($1.99) | no | 5 |
| 6 | `sawtelle-tonkotsu-bar` | Sawtelle Tonkotsu Bar | Ramen | 4.7 · 2214 | 249 ($2.49) | no | 5 |
| 7 | `temple-street-filipino-kitchen` | Temple Street Filipino Kitchen | Filipino | 4.6 · 988 | 199 ($1.99) | yes | 5 |
| 8 | `silver-lake-poke-counter` | Silver Lake Poke Counter | Poke | 4.5 · 647 | 149 ($1.49) | no | 4 |
| 9 | `echo-park-breakfast-burritos` | Echo Park Breakfast Burritos | Breakfast | 4.6 · 1377 | 0 (Free) | no | 5 |
| 10 | `little-tokyo-hand-roll-bar` | Little Tokyo Hand Roll Bar | Hand rolls | 4.8 · 2641 | 249 ($2.49) | no | 6 |
| 11 | `leimert-park-soul-kitchen` | Leimert Park Soul Kitchen | Soul food | 4.7 · 1129 | 199 ($1.99) | no | 5 |
| 12 | `westwood-persian-grill` | Westwood Persian Grill | Persian | 4.6 · 1468 | 249 ($2.49) | no | 5 |
| 13 | `fairfax-pastrami-deli` | Fairfax Pastrami Deli | Deli | 4.5 · 2033 | 199 ($1.99) | yes | 5 |
| 14 | `los-feliz-plant-kitchen` | Los Feliz Plant Kitchen | Vegan | 4.4 · 612 | 0 (Free) | no | 5 |

#### 1. Boyle Heights Taco Window

`boyle-heights-taco-window` · cuisine tag **Tacos** · rating 4.7 · 1583 reviews · delivery fee `199` ($1.99) · `hasDeal: true` · hero `/images/restaurants/boyle-heights-taco-window-hero.jpg`

| Section | Dish id | Name | Description | `amountMinor` |
|---|---|---|---|---:|
| Tacos | `boyle-heights-taco-window-birria-tacos` | Birria tacos | Three beef birria tacos, melted cheese, a cup of consommé. | 1395 |
| Tacos | `boyle-heights-taco-window-carnitas-taco` | Carnitas taco | Slow-cooked pork, onion, cilantro, salsa roja. | 450 |
| Tacos | `boyle-heights-taco-window-nopales-taco` | Nopales taco | Grilled cactus, queso fresco, pico de gallo. | 425 |
| Sides & drinks | `boyle-heights-taco-window-elote` | Elote | Grilled corn, mayo, cotija, chile, lime. | 550 |
| Sides & drinks | `boyle-heights-taco-window-agua-de-jamaica` | Agua de jamaica | Hibiscus iced tea, lightly sweet. | 400 |

#### 2. Koreatown Charcoal House

`koreatown-charcoal-house` · cuisine tag **Korean BBQ** · rating 4.8 · 2876 reviews · delivery fee `299` ($2.99) · `hasDeal: true` · hero `/images/restaurants/koreatown-charcoal-house-hero.jpg`

| Section | Dish id | Name | Description | `amountMinor` |
|---|---|---|---|---:|
| From the grill | `koreatown-charcoal-house-galbi-plate` | Galbi plate | Marinated beef short rib, rice, banchan. | 2695 |
| From the grill | `koreatown-charcoal-house-pork-belly-set` | Pork belly set | Grilled pork belly, lettuce wraps, ssamjang. | 2395 |
| From the grill | `koreatown-charcoal-house-kimchi-fried-rice` | Kimchi fried rice | Kimchi, pork, fried egg, sesame. | 1595 |
| Sides | `koreatown-charcoal-house-seafood-pancake` | Seafood pancake | Scallion and squid pancake, soy dipping sauce. | 1695 |
| Sides | `koreatown-charcoal-house-corn-cheese` | Corn cheese | Sweet corn baked under mozzarella. | 895 |

#### 3. Thai Town Boat Noodle House

`thai-town-boat-noodle-house` · cuisine tag **Thai** · rating 4.6 · 1942 reviews · delivery fee `149` ($1.49) · `hasDeal: false` · hero `/images/restaurants/thai-town-boat-noodle-house-hero.jpg`

| Section | Dish id | Name | Description | `amountMinor` |
|---|---|---|---|---:|
| Noodles & rice | `thai-town-boat-noodle-house-boat-noodle-soup` | Boat noodle soup | Rich beef broth, rice noodles, morning glory. | 1450 |
| Noodles & rice | `thai-town-boat-noodle-house-pad-see-ew` | Pad see ew | Wide rice noodles, Chinese broccoli, egg, chicken. | 1595 |
| Noodles & rice | `thai-town-boat-noodle-house-khao-man-gai` | Khao man gai | Poached chicken, ginger rice, soybean sauce. | 1495 |
| Sides & drinks | `thai-town-boat-noodle-house-papaya-salad` | Papaya salad | Green papaya, lime, chile, peanuts. | 1150 |
| Sides & drinks | `thai-town-boat-noodle-house-thai-iced-tea` | Thai iced tea | Black tea, condensed milk, over ice. | 550 |

#### 4. Glendale Lavash Bakery

`glendale-lavash-bakery` · cuisine tag **Armenian** · rating 4.7 · 1206 reviews · delivery fee `99` ($0.99) · `hasDeal: true` · hero `/images/restaurants/glendale-lavash-bakery-hero.jpg`

| Section | Dish id | Name | Description | `amountMinor` |
|---|---|---|---|---:|
| Bakery | `glendale-lavash-bakery-lahmajun` | Lahmajun | Thin flatbread, spiced minced beef, parsley, lemon. | 650 |
| Bakery | `glendale-lavash-bakery-cheese-boereg` | Cheese boereg | Flaky pastry layered with three cheeses. | 525 |
| Bakery | `glendale-lavash-bakery-pakhlava` | Pakhlava | Walnut and honey pastry, two pieces. | 450 |
| Plates | `glendale-lavash-bakery-chicken-shawarma-plate` | Chicken shawarma plate | Rice pilaf, garlic sauce, pickles, lavash. | 1795 |
| Plates | `glendale-lavash-bakery-lule-kebab-plate` | Lule kebab plate | Two ground beef kebabs, grilled tomato, bulgur. | 1895 |

#### 5. Venice Boardwalk Bowls

`venice-boardwalk-bowls` · cuisine tag **Smoothie bowls** · rating 4.5 · 734 reviews · delivery fee `199` ($1.99) · `hasDeal: false` · hero `/images/restaurants/venice-boardwalk-bowls-hero.jpg`

| Section | Dish id | Name | Description | `amountMinor` |
|---|---|---|---|---:|
| Bowls | `venice-boardwalk-bowls-acai-bowl` | Açaí bowl | Açaí, banana, granola, strawberries, honey. | 1395 |
| Bowls | `venice-boardwalk-bowls-pitaya-bowl` | Pitaya bowl | Pink dragon fruit, mango, coconut, chia. | 1450 |
| Bowls | `venice-boardwalk-bowls-avocado-toast` | Avocado toast | Sourdough, smashed avocado, chile flakes, lemon. | 1250 |
| Smoothies | `venice-boardwalk-bowls-peanut-butter-banana-smoothie` | Peanut butter banana smoothie | Banana, peanut butter, oat milk, dates. | 1095 |
| Smoothies | `venice-boardwalk-bowls-green-smoothie` | Green smoothie | Spinach, pineapple, apple, ginger. | 1050 |

#### 6. Sawtelle Tonkotsu Bar

`sawtelle-tonkotsu-bar` · cuisine tag **Ramen** · rating 4.7 · 2214 reviews · delivery fee `249` ($2.49) · `hasDeal: false` · hero `/images/restaurants/sawtelle-tonkotsu-bar-hero.jpg`

| Section | Dish id | Name | Description | `amountMinor` |
|---|---|---|---|---:|
| Ramen | `sawtelle-tonkotsu-bar-tonkotsu-ramen` | Tonkotsu ramen | Pork bone broth, chashu, soft egg, scallion. | 1795 |
| Ramen | `sawtelle-tonkotsu-bar-spicy-miso-ramen` | Spicy miso ramen | Miso broth, chile oil, ground pork, corn. | 1850 |
| Ramen | `sawtelle-tonkotsu-bar-tsukemen` | Tsukemen | Thick dipping noodles, rich fish and pork broth. | 1895 |
| Sides | `sawtelle-tonkotsu-bar-gyoza` | Gyoza | Six pan-fried pork dumplings. | 795 |
| Sides | `sawtelle-tonkotsu-bar-chashu-rice-bowl` | Chashu rice bowl | Torched pork belly over rice, mayo, scallion. | 895 |

#### 7. Temple Street Filipino Kitchen

`temple-street-filipino-kitchen` · cuisine tag **Filipino** · rating 4.6 · 988 reviews · delivery fee `199` ($1.99) · `hasDeal: true` · hero `/images/restaurants/temple-street-filipino-kitchen-hero.jpg`

| Section | Dish id | Name | Description | `amountMinor` |
|---|---|---|---|---:|
| Mains | `temple-street-filipino-kitchen-chicken-adobo` | Chicken adobo | Braised in vinegar, soy, garlic and bay; garlic rice. | 1650 |
| Mains | `temple-street-filipino-kitchen-pork-sisig` | Pork sisig | Sizzling chopped pork, onion, chile, egg. | 1795 |
| Mains | `temple-street-filipino-kitchen-pancit-bihon` | Pancit bihon | Rice noodles, chicken, cabbage, carrot, calamansi. | 1495 |
| Sides & dessert | `temple-street-filipino-kitchen-lumpia-shanghai` | Lumpia shanghai | Ten crisp pork spring rolls, sweet chile sauce. | 895 |
| Sides & dessert | `temple-street-filipino-kitchen-ube-halo-halo` | Ube halo-halo | Shaved ice, ube, leche flan, sweet beans. | 850 |

#### 8. Silver Lake Poke Counter

`silver-lake-poke-counter` · cuisine tag **Poke** · rating 4.5 · 647 reviews · delivery fee `149` ($1.49) · `hasDeal: false` · hero `/images/restaurants/silver-lake-poke-counter-hero.jpg`

| Section | Dish id | Name | Description | `amountMinor` |
|---|---|---|---|---:|
| Bowls | `silver-lake-poke-counter-classic-ahi-poke-bowl` | Classic ahi poke bowl | Ahi tuna, shoyu, sweet onion, seaweed, rice. | 1695 |
| Bowls | `silver-lake-poke-counter-spicy-salmon-poke-bowl` | Spicy salmon poke bowl | Salmon, spicy mayo, cucumber, avocado, rice. | 1650 |
| Bowls | `silver-lake-poke-counter-tofu-poke-bowl` | Tofu poke bowl | Marinated tofu, edamame, mango, brown rice. | 1395 |
| Sides | `silver-lake-poke-counter-spam-musubi` | Spam musubi | Seared Spam, rice, nori, teriyaki glaze. | 450 |

#### 9. Echo Park Breakfast Burritos

`echo-park-breakfast-burritos` · cuisine tag **Breakfast** · rating 4.6 · 1377 reviews · delivery fee `0` (Free) · `hasDeal: false` · hero `/images/restaurants/echo-park-breakfast-burritos-hero.jpg`

| Section | Dish id | Name | Description | `amountMinor` |
|---|---|---|---|---:|
| Burritos | `echo-park-breakfast-burritos-bacon-breakfast-burrito` | Bacon breakfast burrito | Eggs, bacon, potatoes, cheddar, salsa roja. | 1250 |
| Burritos | `echo-park-breakfast-burritos-chorizo-breakfast-burrito` | Chorizo breakfast burrito | Eggs, chorizo, potatoes, jack cheese. | 1295 |
| Burritos | `echo-park-breakfast-burritos-veggie-breakfast-burrito` | Veggie breakfast burrito | Eggs, black beans, peppers, avocado. | 1150 |
| Plates & drinks | `echo-park-breakfast-burritos-chilaquiles` | Chilaquiles | Tortilla chips in salsa verde, fried egg, crema. | 1395 |
| Plates & drinks | `echo-park-breakfast-burritos-cafe-de-olla` | Café de olla | Coffee with cinnamon and piloncillo. | 450 |

#### 10. Little Tokyo Hand Roll Bar

`little-tokyo-hand-roll-bar` · cuisine tag **Hand rolls** · rating 4.8 · 2641 reviews · delivery fee `249` ($2.49) · `hasDeal: false` · hero `/images/restaurants/little-tokyo-hand-roll-bar-hero.jpg`

| Section | Dish id | Name | Description | `amountMinor` |
|---|---|---|---|---:|
| Hand rolls | `little-tokyo-hand-roll-bar-toro-hand-roll` | Toro hand roll | Fatty tuna, scallion, crisp nori. | 895 |
| Hand rolls | `little-tokyo-hand-roll-bar-blue-crab-hand-roll` | Blue crab hand roll | Blue crab, butter, rice, nori. | 795 |
| Hand rolls | `little-tokyo-hand-roll-bar-salmon-hand-roll` | Salmon hand roll | Salmon, sesame, rice, nori. | 695 |
| Hand rolls | `little-tokyo-hand-roll-bar-yellowtail-hand-roll` | Yellowtail hand roll | Yellowtail, scallion, rice, nori. | 750 |
| Sides | `little-tokyo-hand-roll-bar-edamame` | Edamame | Steamed, sea salt. | 450 |
| Sides | `little-tokyo-hand-roll-bar-miso-soup` | Miso soup | Tofu, wakame, scallion. | 350 |

#### 11. Leimert Park Soul Kitchen

`leimert-park-soul-kitchen` · cuisine tag **Soul food** · rating 4.7 · 1129 reviews · delivery fee `199` ($1.99) · `hasDeal: false` · hero `/images/restaurants/leimert-park-soul-kitchen-hero.jpg`

| Section | Dish id | Name | Description | `amountMinor` |
|---|---|---|---|---:|
| Plates | `leimert-park-soul-kitchen-chicken-and-waffles` | Chicken and waffles | Fried chicken, buttermilk waffle, maple butter. | 1895 |
| Plates | `leimert-park-soul-kitchen-oxtail-plate` | Oxtail plate | Braised oxtails, rice and gravy, cornbread. | 2495 |
| Sides & dessert | `leimert-park-soul-kitchen-mac-and-cheese` | Mac and cheese | Baked, three cheeses, crisp top. | 695 |
| Sides & dessert | `leimert-park-soul-kitchen-collard-greens` | Collard greens | Slow-cooked with smoked turkey. | 595 |
| Sides & dessert | `leimert-park-soul-kitchen-peach-cobbler` | Peach cobbler | Warm peaches, buttery crust. | 650 |

#### 12. Westwood Persian Grill

`westwood-persian-grill` · cuisine tag **Persian** · rating 4.6 · 1468 reviews · delivery fee `249` ($2.49) · `hasDeal: false` · hero `/images/restaurants/westwood-persian-grill-hero.jpg`

| Section | Dish id | Name | Description | `amountMinor` |
|---|---|---|---|---:|
| Kebabs & stews | `westwood-persian-grill-chicken-koobideh-plate` | Chicken koobideh plate | Two ground chicken skewers, saffron rice, grilled tomato. | 1895 |
| Kebabs & stews | `westwood-persian-grill-barg-kebab-plate` | Barg kebab plate | Beef filet skewer, saffron rice, sumac. | 2595 |
| Kebabs & stews | `westwood-persian-grill-ghormeh-sabzi` | Ghormeh sabzi | Herb and kidney bean stew with beef, rice. | 1795 |
| Sides & drinks | `westwood-persian-grill-tahdig` | Tahdig | Crisp saffron rice from the bottom of the pot. | 895 |
| Sides & drinks | `westwood-persian-grill-doogh` | Doogh | Salted yogurt drink with mint. | 450 |

#### 13. Fairfax Pastrami Deli

`fairfax-pastrami-deli` · cuisine tag **Deli** · rating 4.5 · 2033 reviews · delivery fee `199` ($1.99) · `hasDeal: true` · hero `/images/restaurants/fairfax-pastrami-deli-hero.jpg`

| Section | Dish id | Name | Description | `amountMinor` |
|---|---|---|---|---:|
| Sandwiches | `fairfax-pastrami-deli-hot-pastrami-sandwich` | Hot pastrami sandwich | Hand-cut pastrami on rye, mustard. | 1895 |
| Sandwiches | `fairfax-pastrami-deli-reuben` | Reuben | Corned beef, swiss, sauerkraut, Russian dressing. | 1795 |
| Soups & sides | `fairfax-pastrami-deli-matzo-ball-soup` | Matzo ball soup | Chicken broth, carrots, dill. | 995 |
| Soups & sides | `fairfax-pastrami-deli-potato-latkes` | Potato latkes | Three crisp latkes, applesauce, sour cream. | 795 |
| Soups & sides | `fairfax-pastrami-deli-black-and-white-cookie` | Black and white cookie | Soft cake cookie, half chocolate, half vanilla. | 450 |

#### 14. Los Feliz Plant Kitchen

`los-feliz-plant-kitchen` · cuisine tag **Vegan** · rating 4.4 · 612 reviews · delivery fee `0` (Free) · `hasDeal: false` · hero `/images/restaurants/los-feliz-plant-kitchen-hero.jpg`

| Section | Dish id | Name | Description | `amountMinor` |
|---|---|---|---|---:|
| Mains | `los-feliz-plant-kitchen-jackfruit-tacos` | Jackfruit tacos | Chile-braised jackfruit, cabbage, cashew crema. | 1395 |
| Mains | `los-feliz-plant-kitchen-mushroom-cheesesteak` | Mushroom cheesesteak | Seared oyster mushrooms, cashew cheese, peppers. | 1595 |
| Mains | `los-feliz-plant-kitchen-kale-caesar` | Kale caesar | Kale, capers, sourdough crumbs, cashew dressing. | 1295 |
| Sides & drinks | `los-feliz-plant-kitchen-buffalo-cauliflower` | Buffalo cauliflower | Crisp cauliflower, buffalo sauce, ranch. | 1150 |
| Sides & drinks | `los-feliz-plant-kitchen-oat-milk-horchata` | Oat milk horchata | Rice, oat milk, cinnamon, over ice. | 595 |


## Photo manifest, in batches

- **85 slots:** `cities/la.jpg` (96×64), 14 heroes (343×180) and 70 dishes
  (64×64). These are the sizes every existing city-card, hero and dish
  entry in `photos.json` uses.
- **No path here is already in `photos.json`.** The PR shows the check and
  its output.

**Budget.**
- A slot costs 1 search and 1 download ping when its first search hits,
  and up to 3 searches and 1 ping when it doesn't.
- The largest batch is 18 slots, so 36 requests in the usual case, leaving
  14 of the demo key's 50 for retries.
- Batch 1 is 15 slots: the city card and every hero, so the feed and the
  picker are finished before any dish.

**Run plan (for #231 and the driver under O15).**

1. #231 appends batch 1's `photos` entries to `docs/design/photos.json` and
   pushes. The `photos` job fires on that change.
2. About an hour later, the driver appends batch 2. That change is what
   re-fires the job. Then batches 3, 4 and 5 follow, an hour apart.
3. A slot a run could not finish (the budget ran out) is simply retried by
   the next batch's run. The job fetches every missing file, not only the
   new batch.
4. **After batch 5**, look at every picture:
   - A photo that came back wrong: replace that entry's `query` with its
     `fallbacks[path]`. Editing a query re-fetches that one slot, and the
     edit is itself the `photos.json` change that re-fires the job.
   - A slot still missing (it failed or ran out of budget in batch 5's
     run): the same fallback swap re-fires the job and retries it.
5. `npm run rewrite-photo-credits` after the last fetch. #231 is red on the
   credits test until then, as expected.

**Shape.**
- `batches[n].photos` holds entries in `photos.json`'s own shape, to paste
  as they are.
- `fallbacks` maps each path to its one fallback query. It is **not**
  pasted into `photos.json`. It is used only for step 4's swap.
- A fallback is a genuinely different phrasing, not the query shortened:
  `searchAttempts` already drops the last word by itself.

```json
{
  "batches": [
    {
      "batch": 1,
      "photos": [
        {
          "path": "public/images/cities/la.jpg",
          "query": "los angeles palm trees street",
          "width": 96,
          "height": 64
        },
        {
          "path": "public/images/restaurants/boyle-heights-taco-window-hero.jpg",
          "query": "birria tacos consomme",
          "width": 343,
          "height": 180
        },
        {
          "path": "public/images/restaurants/koreatown-charcoal-house-hero.jpg",
          "query": "korean bbq grill table",
          "width": 343,
          "height": 180
        },
        {
          "path": "public/images/restaurants/thai-town-boat-noodle-house-hero.jpg",
          "query": "thai boat noodle soup bowls",
          "width": 343,
          "height": 180
        },
        {
          "path": "public/images/restaurants/glendale-lavash-bakery-hero.jpg",
          "query": "armenian bakery lavash bread",
          "width": 343,
          "height": 180
        },
        {
          "path": "public/images/restaurants/venice-boardwalk-bowls-hero.jpg",
          "query": "acai bowl beach",
          "width": 343,
          "height": 180
        },
        {
          "path": "public/images/restaurants/sawtelle-tonkotsu-bar-hero.jpg",
          "query": "ramen bar counter bowls",
          "width": 343,
          "height": 180
        },
        {
          "path": "public/images/restaurants/temple-street-filipino-kitchen-hero.jpg",
          "query": "filipino food spread table",
          "width": 343,
          "height": 180
        },
        {
          "path": "public/images/restaurants/silver-lake-poke-counter-hero.jpg",
          "query": "poke bowls counter",
          "width": 343,
          "height": 180
        },
        {
          "path": "public/images/restaurants/echo-park-breakfast-burritos-hero.jpg",
          "query": "breakfast burrito foil",
          "width": 343,
          "height": 180
        },
        {
          "path": "public/images/restaurants/little-tokyo-hand-roll-bar-hero.jpg",
          "query": "temaki hand roll sushi bar",
          "width": 343,
          "height": 180
        },
        {
          "path": "public/images/restaurants/leimert-park-soul-kitchen-hero.jpg",
          "query": "soul food plate fried chicken",
          "width": 343,
          "height": 180
        },
        {
          "path": "public/images/restaurants/westwood-persian-grill-hero.jpg",
          "query": "persian kebab rice saffron",
          "width": 343,
          "height": 180
        },
        {
          "path": "public/images/restaurants/fairfax-pastrami-deli-hero.jpg",
          "query": "deli counter pastrami sandwiches",
          "width": 343,
          "height": 180
        },
        {
          "path": "public/images/restaurants/los-feliz-plant-kitchen-hero.jpg",
          "query": "vegan food bowls table",
          "width": 343,
          "height": 180
        }
      ]
    },
    {
      "batch": 2,
      "photos": [
        {
          "path": "public/images/dishes/boyle-heights-taco-window-birria-tacos.jpg",
          "query": "birria tacos consomme dipping",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/boyle-heights-taco-window-carnitas-taco.jpg",
          "query": "carnitas taco cilantro onion",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/boyle-heights-taco-window-nopales-taco.jpg",
          "query": "nopales cactus taco",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/boyle-heights-taco-window-elote.jpg",
          "query": "elote mexican street corn",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/boyle-heights-taco-window-agua-de-jamaica.jpg",
          "query": "agua de jamaica hibiscus drink",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/koreatown-charcoal-house-galbi-plate.jpg",
          "query": "galbi korean short ribs",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/koreatown-charcoal-house-pork-belly-set.jpg",
          "query": "samgyeopsal pork belly grill",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/koreatown-charcoal-house-kimchi-fried-rice.jpg",
          "query": "kimchi fried rice egg",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/koreatown-charcoal-house-seafood-pancake.jpg",
          "query": "haemul pajeon seafood pancake",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/koreatown-charcoal-house-corn-cheese.jpg",
          "query": "korean corn cheese skillet",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/thai-town-boat-noodle-house-boat-noodle-soup.jpg",
          "query": "thai boat noodle soup",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/thai-town-boat-noodle-house-pad-see-ew.jpg",
          "query": "pad see ew noodles",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/thai-town-boat-noodle-house-khao-man-gai.jpg",
          "query": "khao man gai chicken rice",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/thai-town-boat-noodle-house-papaya-salad.jpg",
          "query": "som tam papaya salad",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/thai-town-boat-noodle-house-thai-iced-tea.jpg",
          "query": "thai iced tea glass",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/glendale-lavash-bakery-lahmajun.jpg",
          "query": "lahmacun flatbread lemon",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/glendale-lavash-bakery-cheese-boereg.jpg",
          "query": "borek cheese pastry",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/glendale-lavash-bakery-pakhlava.jpg",
          "query": "baklava walnut honey",
          "width": 64,
          "height": 64
        }
      ]
    },
    {
      "batch": 3,
      "photos": [
        {
          "path": "public/images/dishes/glendale-lavash-bakery-chicken-shawarma-plate.jpg",
          "query": "chicken shawarma plate rice",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/glendale-lavash-bakery-lule-kebab-plate.jpg",
          "query": "lule kebab grilled skewers",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/venice-boardwalk-bowls-acai-bowl.jpg",
          "query": "acai bowl granola strawberries",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/venice-boardwalk-bowls-pitaya-bowl.jpg",
          "query": "pitaya dragon fruit bowl",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/venice-boardwalk-bowls-avocado-toast.jpg",
          "query": "avocado toast sourdough",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/venice-boardwalk-bowls-peanut-butter-banana-smoothie.jpg",
          "query": "peanut butter banana smoothie",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/venice-boardwalk-bowls-green-smoothie.jpg",
          "query": "green smoothie spinach",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/sawtelle-tonkotsu-bar-tonkotsu-ramen.jpg",
          "query": "tonkotsu ramen chashu egg",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/sawtelle-tonkotsu-bar-spicy-miso-ramen.jpg",
          "query": "spicy miso ramen",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/sawtelle-tonkotsu-bar-tsukemen.jpg",
          "query": "tsukemen dipping noodles",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/sawtelle-tonkotsu-bar-gyoza.jpg",
          "query": "gyoza pan fried dumplings",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/sawtelle-tonkotsu-bar-chashu-rice-bowl.jpg",
          "query": "chashu pork rice bowl",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/temple-street-filipino-kitchen-chicken-adobo.jpg",
          "query": "chicken adobo rice",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/temple-street-filipino-kitchen-pork-sisig.jpg",
          "query": "pork sisig sizzling plate",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/temple-street-filipino-kitchen-pancit-bihon.jpg",
          "query": "pancit bihon noodles",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/temple-street-filipino-kitchen-lumpia-shanghai.jpg",
          "query": "lumpia spring rolls",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/temple-street-filipino-kitchen-ube-halo-halo.jpg",
          "query": "halo halo ube dessert",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/silver-lake-poke-counter-classic-ahi-poke-bowl.jpg",
          "query": "ahi tuna poke bowl",
          "width": 64,
          "height": 64
        }
      ]
    },
    {
      "batch": 4,
      "photos": [
        {
          "path": "public/images/dishes/silver-lake-poke-counter-spicy-salmon-poke-bowl.jpg",
          "query": "salmon poke bowl avocado",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/silver-lake-poke-counter-tofu-poke-bowl.jpg",
          "query": "tofu poke bowl",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/silver-lake-poke-counter-spam-musubi.jpg",
          "query": "spam musubi",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/echo-park-breakfast-burritos-bacon-breakfast-burrito.jpg",
          "query": "bacon egg breakfast burrito",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/echo-park-breakfast-burritos-chorizo-breakfast-burrito.jpg",
          "query": "chorizo breakfast burrito",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/echo-park-breakfast-burritos-veggie-breakfast-burrito.jpg",
          "query": "vegetarian breakfast burrito",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/echo-park-breakfast-burritos-chilaquiles.jpg",
          "query": "chilaquiles verdes fried egg",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/echo-park-breakfast-burritos-cafe-de-olla.jpg",
          "query": "cafe de olla clay mug",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/little-tokyo-hand-roll-bar-toro-hand-roll.jpg",
          "query": "toro temaki hand roll",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/little-tokyo-hand-roll-bar-blue-crab-hand-roll.jpg",
          "query": "crab hand roll temaki",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/little-tokyo-hand-roll-bar-salmon-hand-roll.jpg",
          "query": "salmon hand roll",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/little-tokyo-hand-roll-bar-yellowtail-hand-roll.jpg",
          "query": "yellowtail hamachi hand roll",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/little-tokyo-hand-roll-bar-edamame.jpg",
          "query": "edamame bowl sea salt",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/little-tokyo-hand-roll-bar-miso-soup.jpg",
          "query": "miso soup bowl",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/leimert-park-soul-kitchen-chicken-and-waffles.jpg",
          "query": "chicken and waffles",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/leimert-park-soul-kitchen-oxtail-plate.jpg",
          "query": "braised oxtail rice",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/leimert-park-soul-kitchen-mac-and-cheese.jpg",
          "query": "baked mac and cheese",
          "width": 64,
          "height": 64
        }
      ]
    },
    {
      "batch": 5,
      "photos": [
        {
          "path": "public/images/dishes/leimert-park-soul-kitchen-collard-greens.jpg",
          "query": "collard greens bowl",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/leimert-park-soul-kitchen-peach-cobbler.jpg",
          "query": "peach cobbler",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/westwood-persian-grill-chicken-koobideh-plate.jpg",
          "query": "koobideh kebab saffron rice",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/westwood-persian-grill-barg-kebab-plate.jpg",
          "query": "barg kebab beef rice",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/westwood-persian-grill-ghormeh-sabzi.jpg",
          "query": "ghormeh sabzi stew",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/westwood-persian-grill-tahdig.jpg",
          "query": "tahdig crispy rice",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/westwood-persian-grill-doogh.jpg",
          "query": "doogh yogurt drink mint",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/fairfax-pastrami-deli-hot-pastrami-sandwich.jpg",
          "query": "pastrami sandwich rye",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/fairfax-pastrami-deli-reuben.jpg",
          "query": "reuben sandwich",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/fairfax-pastrami-deli-matzo-ball-soup.jpg",
          "query": "matzo ball soup",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/fairfax-pastrami-deli-potato-latkes.jpg",
          "query": "potato latkes applesauce",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/fairfax-pastrami-deli-black-and-white-cookie.jpg",
          "query": "black and white cookie",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/los-feliz-plant-kitchen-jackfruit-tacos.jpg",
          "query": "jackfruit tacos",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/los-feliz-plant-kitchen-mushroom-cheesesteak.jpg",
          "query": "mushroom cheesesteak sandwich",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/los-feliz-plant-kitchen-kale-caesar.jpg",
          "query": "kale caesar salad",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/los-feliz-plant-kitchen-buffalo-cauliflower.jpg",
          "query": "buffalo cauliflower wings",
          "width": 64,
          "height": 64
        },
        {
          "path": "public/images/dishes/los-feliz-plant-kitchen-oat-milk-horchata.jpg",
          "query": "horchata cinnamon glass",
          "width": 64,
          "height": 64
        }
      ]
    }
  ],
  "fallbacks": {
    "public/images/cities/la.jpg": "los angeles skyline sunset",
    "public/images/restaurants/boyle-heights-taco-window-hero.jpg": "taco stand night mexican",
    "public/images/restaurants/koreatown-charcoal-house-hero.jpg": "korean barbecue meat charcoal",
    "public/images/restaurants/thai-town-boat-noodle-house-hero.jpg": "thai street food noodles",
    "public/images/restaurants/glendale-lavash-bakery-hero.jpg": "middle eastern bakery pastries",
    "public/images/restaurants/venice-boardwalk-bowls-hero.jpg": "smoothie bowls colorful fruit",
    "public/images/restaurants/sawtelle-tonkotsu-bar-hero.jpg": "japanese ramen shop",
    "public/images/restaurants/temple-street-filipino-kitchen-hero.jpg": "filipino rice dishes",
    "public/images/restaurants/silver-lake-poke-counter-hero.jpg": "hawaiian poke bowl",
    "public/images/restaurants/echo-park-breakfast-burritos-hero.jpg": "breakfast burritos cafe",
    "public/images/restaurants/little-tokyo-hand-roll-bar-hero.jpg": "sushi counter chef",
    "public/images/restaurants/leimert-park-soul-kitchen-hero.jpg": "southern food table",
    "public/images/restaurants/westwood-persian-grill-hero.jpg": "persian restaurant food",
    "public/images/restaurants/fairfax-pastrami-deli-hero.jpg": "jewish deli sandwich",
    "public/images/restaurants/los-feliz-plant-kitchen-hero.jpg": "plant based restaurant plates",
    "public/images/dishes/boyle-heights-taco-window-birria-tacos.jpg": "beef tacos cheese red",
    "public/images/dishes/boyle-heights-taco-window-carnitas-taco.jpg": "pork taco corn tortilla",
    "public/images/dishes/boyle-heights-taco-window-nopales-taco.jpg": "vegetarian taco queso fresco",
    "public/images/dishes/boyle-heights-taco-window-elote.jpg": "grilled corn cotija chili",
    "public/images/dishes/boyle-heights-taco-window-agua-de-jamaica.jpg": "hibiscus iced tea glass",
    "public/images/dishes/koreatown-charcoal-house-galbi-plate.jpg": "korean grilled beef ribs",
    "public/images/dishes/koreatown-charcoal-house-pork-belly-set.jpg": "korean pork belly lettuce wrap",
    "public/images/dishes/koreatown-charcoal-house-kimchi-fried-rice.jpg": "korean fried rice",
    "public/images/dishes/koreatown-charcoal-house-seafood-pancake.jpg": "korean scallion pancake",
    "public/images/dishes/koreatown-charcoal-house-corn-cheese.jpg": "baked corn cheese",
    "public/images/dishes/thai-town-boat-noodle-house-boat-noodle-soup.jpg": "beef noodle soup thai",
    "public/images/dishes/thai-town-boat-noodle-house-pad-see-ew.jpg": "thai stir fried wide noodles",
    "public/images/dishes/thai-town-boat-noodle-house-khao-man-gai.jpg": "hainanese chicken rice",
    "public/images/dishes/thai-town-boat-noodle-house-papaya-salad.jpg": "green papaya salad thai",
    "public/images/dishes/thai-town-boat-noodle-house-thai-iced-tea.jpg": "orange milk tea ice",
    "public/images/dishes/glendale-lavash-bakery-lahmajun.jpg": "thin meat flatbread",
    "public/images/dishes/glendale-lavash-bakery-cheese-boereg.jpg": "flaky cheese pastry",
    "public/images/dishes/glendale-lavash-bakery-pakhlava.jpg": "baklava pastry plate",
    "public/images/dishes/glendale-lavash-bakery-chicken-shawarma-plate.jpg": "shawarma plate garlic sauce",
    "public/images/dishes/glendale-lavash-bakery-lule-kebab-plate.jpg": "kofta kebab plate",
    "public/images/dishes/venice-boardwalk-bowls-acai-bowl.jpg": "purple smoothie bowl",
    "public/images/dishes/venice-boardwalk-bowls-pitaya-bowl.jpg": "pink smoothie bowl",
    "public/images/dishes/venice-boardwalk-bowls-avocado-toast.jpg": "avocado toast plate",
    "public/images/dishes/venice-boardwalk-bowls-peanut-butter-banana-smoothie.jpg": "banana smoothie glass",
    "public/images/dishes/venice-boardwalk-bowls-green-smoothie.jpg": "green juice glass",
    "public/images/dishes/sawtelle-tonkotsu-bar-tonkotsu-ramen.jpg": "pork ramen bowl",
    "public/images/dishes/sawtelle-tonkotsu-bar-spicy-miso-ramen.jpg": "red ramen bowl chili",
    "public/images/dishes/sawtelle-tonkotsu-bar-tsukemen.jpg": "japanese cold noodles dipping",
    "public/images/dishes/sawtelle-tonkotsu-bar-gyoza.jpg": "japanese dumplings plate",
    "public/images/dishes/sawtelle-tonkotsu-bar-chashu-rice-bowl.jpg": "pork belly donburi",
    "public/images/dishes/temple-street-filipino-kitchen-chicken-adobo.jpg": "filipino braised chicken",
    "public/images/dishes/temple-street-filipino-kitchen-pork-sisig.jpg": "sizzling pork egg",
    "public/images/dishes/temple-street-filipino-kitchen-pancit-bihon.jpg": "filipino rice noodles",
    "public/images/dishes/temple-street-filipino-kitchen-lumpia-shanghai.jpg": "fried spring rolls sauce",
    "public/images/dishes/temple-street-filipino-kitchen-ube-halo-halo.jpg": "purple shaved ice dessert",
    "public/images/dishes/silver-lake-poke-counter-classic-ahi-poke-bowl.jpg": "tuna poke rice",
    "public/images/dishes/silver-lake-poke-counter-spicy-salmon-poke-bowl.jpg": "spicy salmon bowl",
    "public/images/dishes/silver-lake-poke-counter-tofu-poke-bowl.jpg": "vegan poke bowl tofu",
    "public/images/dishes/silver-lake-poke-counter-spam-musubi.jpg": "rice nori block snack",
    "public/images/dishes/echo-park-breakfast-burritos-bacon-breakfast-burrito.jpg": "breakfast burrito cut",
    "public/images/dishes/echo-park-breakfast-burritos-chorizo-breakfast-burrito.jpg": "mexican breakfast burrito",
    "public/images/dishes/echo-park-breakfast-burritos-veggie-breakfast-burrito.jpg": "egg burrito avocado",
    "public/images/dishes/echo-park-breakfast-burritos-chilaquiles.jpg": "chilaquiles plate",
    "public/images/dishes/echo-park-breakfast-burritos-cafe-de-olla.jpg": "cinnamon coffee mug",
    "public/images/dishes/little-tokyo-hand-roll-bar-toro-hand-roll.jpg": "tuna hand roll nori",
    "public/images/dishes/little-tokyo-hand-roll-bar-blue-crab-hand-roll.jpg": "crab sushi roll",
    "public/images/dishes/little-tokyo-hand-roll-bar-salmon-hand-roll.jpg": "salmon temaki",
    "public/images/dishes/little-tokyo-hand-roll-bar-yellowtail-hand-roll.jpg": "hamachi sushi",
    "public/images/dishes/little-tokyo-hand-roll-bar-edamame.jpg": "steamed soybeans",
    "public/images/dishes/little-tokyo-hand-roll-bar-miso-soup.jpg": "japanese soup tofu",
    "public/images/dishes/leimert-park-soul-kitchen-chicken-and-waffles.jpg": "fried chicken waffle",
    "public/images/dishes/leimert-park-soul-kitchen-oxtail-plate.jpg": "oxtail stew",
    "public/images/dishes/leimert-park-soul-kitchen-mac-and-cheese.jpg": "macaroni cheese skillet",
    "public/images/dishes/leimert-park-soul-kitchen-collard-greens.jpg": "southern greens",
    "public/images/dishes/leimert-park-soul-kitchen-peach-cobbler.jpg": "fruit cobbler dessert",
    "public/images/dishes/westwood-persian-grill-chicken-koobideh-plate.jpg": "persian kebab plate",
    "public/images/dishes/westwood-persian-grill-barg-kebab-plate.jpg": "beef kebab rice",
    "public/images/dishes/westwood-persian-grill-ghormeh-sabzi.jpg": "persian herb stew",
    "public/images/dishes/westwood-persian-grill-tahdig.jpg": "crispy saffron rice",
    "public/images/dishes/westwood-persian-grill-doogh.jpg": "yogurt drink glass",
    "public/images/dishes/fairfax-pastrami-deli-hot-pastrami-sandwich.jpg": "deli sandwich pastrami",
    "public/images/dishes/fairfax-pastrami-deli-reuben.jpg": "corned beef sandwich",
    "public/images/dishes/fairfax-pastrami-deli-matzo-ball-soup.jpg": "chicken soup dumpling",
    "public/images/dishes/fairfax-pastrami-deli-potato-latkes.jpg": "potato pancakes",
    "public/images/dishes/fairfax-pastrami-deli-black-and-white-cookie.jpg": "iced cookie bakery",
    "public/images/dishes/los-feliz-plant-kitchen-jackfruit-tacos.jpg": "vegan tacos",
    "public/images/dishes/los-feliz-plant-kitchen-mushroom-cheesesteak.jpg": "vegan mushroom sandwich",
    "public/images/dishes/los-feliz-plant-kitchen-kale-caesar.jpg": "kale salad bowl",
    "public/images/dishes/los-feliz-plant-kitchen-buffalo-cauliflower.jpg": "roasted cauliflower bites",
    "public/images/dishes/los-feliz-plant-kitchen-oat-milk-horchata.jpg": "rice milk drink cinnamon"
  }
}
```

## Events

No `track()` change and no contract change (the #79 rule). What goes quiet
for LA is listed on #227's plan comment:
- `location_selected`, `home_viewed`, `restaurant_opened` and the flash
  events with `city: 'la'`;
- `order_placed` carrying `la-*` ids.

The picker's reshape moves no event: the same tap fires the same
`location_selected`.

## Critique of the rendered mocks, and what changed

- **The first picker render: the LA stand-in pulled the eye first.** Its
  saturated sunset beat both real photos, and together with the focus ring
  the picture read as "LA is featured". That is the opposite of *even*.
  *Changed:* I muted the stand-in to dusty tones. The ring stays, because
  a focus state has to be shown somewhere, and the note says it is focus.
- **The first switch render at wide: the VIP cards sat at different
  heights.** The HCMC kicker is one line and the others are two, so the
  comparison row broke, and the row is the thing a reader scans across.
  *Changed:* the kicker has a two-line minimum height at wide widths, and
  the three VIP cards now align.
- **The narrow-only caption showed at wide.** *Changed:* it is hidden
  above 480px.
- **Narrow before wide.** At 375 all three picker rows and names fit
  unbroken. All six switch panels fit in 812px because the wallet balance
  is drawn at 1.25rem (the caption says so; the real sheet stays 2.5rem).
- **Cover the accent.** The picker loses only the focus ring. Hierarchy
  comes from photo, weight and size. The switch mock's teal "FROM …"
  labels are annotation.
- **Blur your eyes.** Three equal blocks, each with an image, at both
  widths. That is the composition the direction asked for.
- **The one element I'd remove:** the chevron. It stayed because without
  it the row at wide widths reads as a static label, not something you
  tap. It is muted, and it is the last thing seen.

## Mocks and pictures

| File | What it shows | Pictures |
|---|---|---|
| `229-three-city-picker.html` | Recommended picker, LA in keyboard-focus | `-narrow.png`, `-wide.png` (design-render), `-1366.png`, `-narrow-dark.png` |
| `229-three-city-picker-rejected.html` | Direction B, for comparison | `-narrow.png`, `-wide.png` |
| `229-city-switch.html` | Wallet sheet header and tracker VIP card, from SF, HCMC and LA | `-narrow.png`, `-wide.png` (design-render), `-1366.png`, `-narrow-dark.png` |

**Rendering notes.**
- `scripts/design-render` photographs at 1280 and 375, not 1366. The
  `-1366.png` files come from `node scripts/render-shot.mjs chromium <url>
  1366 900 <out>`, the same program design-render calls. Criterion 1's
  "1366 wide" is checked on those.
- This sandbox has no browser on PATH, and the Playwright and Chrome
  download hosts are blocked by the egress policy. So the pictures were
  taken with `@sparticuz/chromium` 131 from the npm registry, unpacked
  outside the repository and put on PATH for the render only. Nothing in
  the repository changed to allow it.
