// Home feed (docs/design/80-two-city-brand-and-flow.md, screens 1 and 2):
// `/` now replaces both the old landing page and `/restaurants` — a real
// delivery app opens directly onto its feed. Renders the location picker
// (first visit or no persisted city) or the current city's feed (location
// bar, search, one promo banner, cuisine shortcuts, restaurant cards).

import { CITIES, CITY_CURRENCY, CITY_NAMES, formatMoneyForCity, type City } from './money';
import { getStoredCity, setStoredCity } from './location';
import { CUISINE_SHORTCUTS, restaurantsForCity, type Restaurant } from './restaurants';
import { getVisitorId } from './order-store';
import { estimateEtaMinutes, etaLabel } from './eta';
import { formatReviewCount } from './reviews';
import { createVehicleIcon } from './vehicle-icon';
import { track } from './tracking';
import {
  ensureFlashDraw,
  flashFeeForRestaurant,
  flashSecondsRemaining,
  isFlashLive,
  setFlashDrawState,
  type FlashDraw,
} from './flash-deal';
import { renderFlashReopenBar, renderFlashSheet } from './flash-sheet-dom';

const STORAGE_PROBE_KEY = 'parody.storageProbe';

/** The home feed's one promo banner slot (docs/design/80-two-city-brand-and-flow.md,
 * "Look outside this repository": one legible claim, no carousel), localized per
 * city's own currency — docs/design/80-home-sf.html / 80-home-hcmc.html's own
 * banner copy, not a placeholder. */
const PROMO_BANNER_CLAIM: Record<City, string> = {
  sf: '$2 off your first order',
  hcmc: '10.000 ₫ off your first order',
};

/** Storage-blocked (private browsing) is detected up front, not only after a failed write — #80's error state is a property of the sheet itself, shown before any tap rather than for the instant between a tap and the sheet dismissing. */
function isStorageBlocked(storage: Storage): boolean {
  try {
    storage.setItem(STORAGE_PROBE_KEY, '1');
    storage.removeItem(STORAGE_PROBE_KEY);
    return false;
  } catch {
    return true;
  }
}

/** Same in-memory fallback as the rest of this module's storage-blocked handling — the feed
 * still functions for this page load even though the ETA it shows won't persist to a reload. */
function safeVisitorId(storage: Storage): string {
  try {
    return getVisitorId(storage);
  } catch {
    return 'storage-blocked-visitor';
  }
}

function renderLocationPicker(root: HTMLElement, storage: Storage, onPicked: (city: City) => void): void {
  const sheet = document.createElement('div');
  sheet.className = 'location-picker';
  sheet.setAttribute('data-testid', 'location-picker');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');

  const heading = document.createElement('h2');
  heading.textContent = 'Choose your city';
  sheet.append(heading);

  const cards = document.createElement('div');
  cards.className = 'location-cards';

  for (const city of CITIES) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'location-card';
    card.setAttribute('data-testid', `location-card-${city}`);

    const img = document.createElement('img');
    img.src = `/images/cities/${city}.svg`;
    img.alt = '';
    img.width = 96;
    img.height = 64;

    const name = document.createElement('span');
    name.className = 'location-card-name';
    name.textContent = CITY_NAMES[city];

    const currencyNote = document.createElement('span');
    currencyNote.className = 'location-card-currency';
    currencyNote.textContent = city === 'sf' ? 'Prices in USD' : 'Prices in VND';

    card.append(img, name, currencyNote);
    card.addEventListener('click', () => {
      const previous = getStoredCity(storage);
      setStoredCity(storage, city);
      const isSwitch = previous !== null && previous !== city;
      track('location_selected', { city, is_switch: isSwitch });
      // The in-memory fallback: the sheet still functions for this page load
      // even when storage is blocked (the notice above already said so), so
      // the caller proceeds exactly as if the pick had been stored.
      onPicked(city);
    });
    cards.append(card);
  }

  sheet.append(cards);

  if (isStorageBlocked(storage)) {
    const notice = document.createElement('p');
    notice.className = 'location-blocked-notice';
    notice.setAttribute('data-testid', 'location-blocked-notice');
    notice.textContent = "Your city won't be remembered after you close this.";
    sheet.append(notice);
  }

  root.append(sheet);
}

function matchesFilter(restaurant: Restaurant, query: string, cuisine: string | null): boolean {
  if (cuisine && restaurant.cuisineTag !== cuisine) return false;
  if (!query) return true;
  const haystack = `${restaurant.name} ${restaurant.cuisineTag}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

/** A restaurant's flash fee, in minor units, while this session's draw is live for it — `null` otherwise (#87, "the effective delivery fee"). Read fresh on every render so the fee and the "Flash" badge disappear together the instant the window ends (AC4). */
function flashFeeFor(restaurant: Restaurant, draw: FlashDraw | null, now: number): number | null {
  if (!draw) return null;
  return flashFeeForRestaurant(draw, restaurant.city, restaurant.slug, restaurant.deliveryFeeMinor, now);
}

function renderRestaurantCard(restaurant: Restaurant, draw: FlashDraw | null, now: number, visitorId: string): HTMLElement {
  const card = document.createElement('a');
  card.className = 'restaurant-card';
  card.href = `/restaurants/${restaurant.slug}/`;
  card.setAttribute('data-testid', `restaurant-card-${restaurant.slug}`);

  const img = document.createElement('img');
  img.className = 'restaurant-card-photo';
  img.src = restaurant.heroImage;
  img.alt = '';
  img.loading = 'lazy';
  img.width = 96;
  img.height = 96;

  const body = document.createElement('div');
  body.className = 'restaurant-card-body';

  const name = document.createElement('span');
  name.className = 'restaurant-card-name';
  name.textContent = restaurant.name;

  const tag = document.createElement('span');
  tag.className = 'restaurant-card-tag';
  tag.textContent = restaurant.cuisineTag;

  const flashFeeMinor = flashFeeFor(restaurant, draw, now);
  const effectiveFeeMinor = flashFeeMinor ?? restaurant.deliveryFeeMinor;

  const meta = document.createElement('span');
  meta.className = 'restaurant-card-meta';
  const feeLabel = effectiveFeeMinor === 0 ? 'Free' : formatMoneyForCity(effectiveFeeMinor, restaurant.city);
  const eta = etaLabel(estimateEtaMinutes(visitorId, restaurant.slug));
  meta.append(
    `★ ${restaurant.rating.toFixed(1)} (${formatReviewCount(restaurant.reviewCount)}) · `,
    createVehicleIcon(restaurant.city),
    ` ${eta} · ${feeLabel} delivery`,
  );

  body.append(name, tag, meta);

  if (restaurant.hasDeal) {
    const badge = document.createElement('span');
    badge.className = 'deal-badge';
    badge.setAttribute('data-testid', `deal-badge-${restaurant.slug}`);
    badge.textContent = 'Deal';
    body.append(badge);
  }

  if (flashFeeMinor !== null) {
    // A small badge beside the meta line, not a full-width bar underneath it
    // (#104) — appended inside .restaurant-card-meta itself so it sits on
    // the same line as the rating/ETA/fee text rather than as its own row.
    const flashBadge = document.createElement('span');
    flashBadge.className = 'flash-badge';
    flashBadge.setAttribute('data-testid', `flash-badge-${restaurant.slug}`);
    flashBadge.textContent = 'Flash';
    meta.append(flashBadge);
  }

  card.append(img, body);
  return card;
}

function renderFeed(root: HTMLElement, city: City, sessionStorage: Storage, visitorId: string): void {
  const now = Date.now();
  const initial = ensureFlashDraw(sessionStorage, city, now);
  const { isNewDraw } = initial;
  let draw = initial.draw;

  const feed = document.createElement('div');
  feed.className = 'home-feed';
  feed.setAttribute('data-testid', 'home-feed');

  const locationBar = document.createElement('button');
  locationBar.type = 'button';
  locationBar.className = 'location-bar';
  locationBar.setAttribute('data-testid', 'location-bar');
  locationBar.textContent = `${CITY_NAMES[city]} ▾`;
  locationBar.addEventListener('click', () => {
    root.innerHTML = '';
    renderLocationPicker(root, window.localStorage, (pickedCity) => {
      root.innerHTML = '';
      renderFeed(root, pickedCity, sessionStorage, visitorId);
    });
  });

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'home-search';
  search.setAttribute('data-testid', 'home-search');
  search.setAttribute('placeholder', 'Search restaurants or cuisines');

  const banner = document.createElement('div');
  banner.className = 'promo-banner';
  banner.setAttribute('data-testid', 'promo-banner');
  const bannerClaim = document.createElement('span');
  bannerClaim.className = 'promo-banner-claim';
  bannerClaim.setAttribute('data-testid', 'promo-banner-claim');
  bannerClaim.textContent = PROMO_BANNER_CLAIM[city];
  const bannerSub = document.createElement('span');
  bannerSub.className = 'promo-banner-sub';
  bannerSub.setAttribute('data-testid', 'promo-banner-sub');
  bannerSub.textContent = 'Applied automatically at checkout';
  banner.append(bannerClaim, bannerSub);

  const chipRow = document.createElement('div');
  chipRow.className = 'cuisine-chips';
  chipRow.setAttribute('data-testid', 'cuisine-chips');

  const nearYouHeading = document.createElement('h2');
  nearYouHeading.className = 'home-section-title';
  nearYouHeading.setAttribute('data-testid', 'near-you-heading');
  nearYouHeading.textContent = 'Near you';

  const list = document.createElement('div');
  list.className = 'restaurant-list';
  list.setAttribute('data-testid', 'restaurant-list');

  const empty = document.createElement('p');
  empty.setAttribute('data-testid', 'home-empty');
  empty.hidden = true;

  let activeCuisine: string | null = null;

  function renderList(): void {
    const restaurants = restaurantsForCity(city);
    const matches = restaurants.filter((restaurant) => matchesFilter(restaurant, search.value, activeCuisine));

    const liveDraw = isFlashLive(draw, Date.now()) ? draw : null;

    list.innerHTML = '';
    for (const restaurant of matches) {
      list.append(renderRestaurantCard(restaurant, liveDraw, Date.now(), visitorId));
    }

    if (matches.length === 0) {
      const label = activeCuisine ?? search.value;
      empty.textContent = `No restaurants match “${label}” in ${CITY_NAMES[city]} yet.`;
      empty.hidden = false;
      list.hidden = true;
    } else {
      empty.hidden = true;
      list.hidden = false;
    }
  }

  search.addEventListener('input', renderList);

  for (const cuisine of CUISINE_SHORTCUTS[city]) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'cuisine-chip';
    chip.textContent = cuisine;
    chip.setAttribute('data-testid', `cuisine-${cuisine.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    chip.addEventListener('click', () => {
      activeCuisine = activeCuisine === cuisine ? null : cuisine;
      for (const candidate of Array.from(chipRow.children)) {
        candidate.classList.toggle('selected', candidate === chip && activeCuisine !== null);
      }
      renderList();
    });
    chipRow.append(chip);
  }

  renderList();

  feed.append(locationBar, search, banner, chipRow, nearYouHeading, list, empty);
  root.append(feed);

  if (isFlashLive(draw, Date.now())) {
    const remainingMs = flashSecondsRemaining(draw, Date.now()) * 1000;
    setTimeout(renderList, remainingMs);
  }

  let barHandle: { destroy(): void } | null = null;

  function showBar(): void {
    if (!isFlashLive(draw, Date.now())) return;
    barHandle = renderFlashReopenBar(root, city, draw, () => {
      draw = setFlashDrawState(sessionStorage, city, draw, { collapsed: false });
      openSheet();
    });
  }

  function openSheet(): void {
    if (barHandle) {
      barHandle.destroy();
      barHandle = null;
    }
    renderFlashSheet(
      root,
      city,
      draw,
      visitorId,
      (path) => {
        window.location.href = path;
      },
      Date.now,
      {
        eventAlreadyFired: draw.closedEventFired === true,
        onDismissed: () => {
          draw = setFlashDrawState(sessionStorage, city, draw, { collapsed: true, closedEventFired: true });
          showBar();
        },
      },
    );
  }

  if (isNewDraw) {
    // A 5-6 restaurant draw's own restaurant_slugs no longer matches
    // flash_sheet_shown's contract (exactly 2, tracking.ts's
    // isValidRestaurantSlugs and the store's own check) - all of this
    // draw's slugs are still passed through rather than truncated to 2, so
    // the event is dropped by that validation and goes quiet rather than
    // wrong (#120 AC6; docs/design/119-flash-sheet-tall-and-collapsed-
    // bar.md and the parent objective's "event tracking comes last" rule).
    track('flash_sheet_shown', {
      city,
      amount_minor: draw.amountMinor,
      currency: CITY_CURRENCY[city],
      restaurant_slugs: draw.restaurants.map((restaurant) => restaurant.slug),
    });
    openSheet();
  } else if (draw.collapsed) {
    showBar();
  }
}

export function initHomePage(
  root: HTMLElement,
  storage: Storage = window.localStorage,
  sessionStorage: Storage = window.sessionStorage,
): void {
  root.innerHTML = '';
  const city = getStoredCity(storage);
  const visitorId = safeVisitorId(storage);

  if (city === null) {
    renderLocationPicker(root, storage, (pickedCity) => {
      root.innerHTML = '';
      renderFeed(root, pickedCity, sessionStorage, visitorId);
      track('home_viewed', { city: pickedCity });
    });
    return;
  }

  renderFeed(root, city, sessionStorage, visitorId);
  track('home_viewed', { city });
}
