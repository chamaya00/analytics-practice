// Home feed (docs/design/80-two-city-brand-and-flow.md, screens 1 and 2):
// `/` now replaces both the old landing page and `/restaurants` — a real
// delivery app opens directly onto its feed. Renders the location picker
// (first visit or no persisted city) or the current city's feed (location
// bar, search, one promo banner, cuisine shortcuts, restaurant cards).

import { CITIES, CITY_NAMES, formatMoneyForCity, type City } from './money';
import { getStoredCity, setStoredCity } from './location';
import { CUISINE_SHORTCUTS, restaurantsForCity, etaRangeLabel, type Restaurant } from './restaurants';
import { track } from './tracking';

const STORAGE_PROBE_KEY = 'parody.storageProbe';

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

function renderRestaurantCard(restaurant: Restaurant): HTMLElement {
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

  const meta = document.createElement('span');
  meta.className = 'restaurant-card-meta';
  const feeLabel =
    restaurant.deliveryFeeMinor === 0 ? 'Free' : formatMoneyForCity(restaurant.deliveryFeeMinor, restaurant.city);
  meta.textContent = `★ ${restaurant.rating.toFixed(1)} · ${etaRangeLabel(restaurant)} · ${feeLabel}`;

  body.append(name, tag, meta);

  if (restaurant.hasDeal) {
    const badge = document.createElement('span');
    badge.className = 'deal-badge';
    badge.setAttribute('data-testid', `deal-badge-${restaurant.slug}`);
    badge.textContent = 'Deal';
    body.append(badge);
  }

  card.append(img, body);
  return card;
}

function renderFeed(root: HTMLElement, city: City): void {
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
      renderFeed(root, pickedCity);
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
  const bannerImg = document.createElement('img');
  bannerImg.src = '/images/promo-banner.svg';
  bannerImg.alt = '';
  bannerImg.width = 343;
  bannerImg.height = 96;
  const bannerText = document.createElement('span');
  bannerText.textContent = 'Special offers, picked for you';
  banner.append(bannerImg, bannerText);

  const chipRow = document.createElement('div');
  chipRow.className = 'cuisine-chips';
  chipRow.setAttribute('data-testid', 'cuisine-chips');

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

    list.innerHTML = '';
    for (const restaurant of matches) {
      list.append(renderRestaurantCard(restaurant));
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

  feed.append(locationBar, search, banner, chipRow, list, empty);
  root.append(feed);
}

export function initHomePage(root: HTMLElement, storage: Storage = window.localStorage): void {
  root.innerHTML = '';
  const city = getStoredCity(storage);

  if (city === null) {
    renderLocationPicker(root, storage, (pickedCity) => {
      root.innerHTML = '';
      renderFeed(root, pickedCity);
      track('home_viewed', { city: pickedCity });
    });
    return;
  }

  renderFeed(root, city);
  track('home_viewed', { city });
}
