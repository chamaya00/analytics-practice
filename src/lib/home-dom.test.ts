import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initHomePage } from './home-dom';
import { getStoredCity } from './location';
import { restaurantsForCity } from './restaurants';
import { resetTrack, setTrack } from './tracking';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  resetTrack();
});

function root(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('initHomePage — no persisted city (AC1)', () => {
  it('shows the location picker with both city cards, and does not fire home_viewed yet', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();

    initHomePage(el, window.localStorage);

    expect(el.querySelector('[data-testid="location-picker"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="location-card-sf"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="location-card-hcmc"]')).not.toBeNull();
    expect(stub).not.toHaveBeenCalledWith('home_viewed', expect.anything());
  });

  it('picking San Francisco persists the choice, fires location_selected then home_viewed, and shows only SF restaurants', () => {
    const events: [string, unknown][] = [];
    setTrack((name, props) => events.push([name, props]));
    const el = root();

    initHomePage(el, window.localStorage);
    el.querySelector<HTMLButtonElement>('[data-testid="location-card-sf"]')?.click();

    expect(getStoredCity(window.localStorage)).toBe('sf');
    // The first load also draws and shows this session's flash deal (#89) — its own event/props are covered
    // in home-dom's flash-deal tests below; this test's own concern is the location/home_viewed sequence.
    const nonFlashEvents = events.filter(([name]) => name !== 'flash_sheet_shown');
    expect(nonFlashEvents).toEqual([
      ['location_selected', { city: 'sf', is_switch: false }],
      ['home_viewed', { city: 'sf' }],
    ]);

    for (const restaurant of restaurantsForCity('sf')) {
      expect(el.querySelector(`[data-testid="restaurant-card-${restaurant.slug}"]`)).not.toBeNull();
    }
    for (const restaurant of restaurantsForCity('hcmc')) {
      expect(el.querySelector(`[data-testid="restaurant-card-${restaurant.slug}"]`)).toBeNull();
    }
  });

  it('shows the storage-blocked inline notice up front, and still proceeds to the feed on a tap', () => {
    const throwing: Storage = {
      ...window.localStorage,
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
    } as Storage;
    const el = root();

    initHomePage(el, throwing);
    expect(el.querySelector('[data-testid="location-blocked-notice"]')).not.toBeNull();

    el.querySelector<HTMLButtonElement>('[data-testid="location-card-hcmc"]')?.click();
    expect(el.querySelector('[data-testid="home-feed"]')).not.toBeNull();
  });
});

describe('initHomePage — persisted city (AC1)', () => {
  it('renders the feed directly and fires home_viewed with the stored city', () => {
    window.localStorage.setItem('parody.city', 'hcmc');
    const stub = vi.fn();
    setTrack(stub);

    initHomePage(root(), window.localStorage);

    expect(stub).toHaveBeenCalledWith('home_viewed', { city: 'hcmc' });
  });

  it('falls back to the picker on an unrecognised stored value, rather than throwing', () => {
    window.localStorage.setItem('parody.city', 'nowhereville');
    const el = root();

    expect(() => initHomePage(el, window.localStorage)).not.toThrow();
    expect(el.querySelector('[data-testid="location-picker"]')).not.toBeNull();
  });
});

describe('home feed contents (AC2)', () => {
  it('renders one promo banner, cuisine shortcut chips, and a restaurant card with photo, rating, ETA, delivery fee and deal badge', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, window.localStorage);

    expect(el.querySelectorAll('[data-testid="promo-banner"]')).toHaveLength(1);
    expect(el.querySelector('[data-testid="cuisine-chips"]')?.children.length).toBeGreaterThan(0);

    const dealRestaurant = restaurantsForCity('sf').find((restaurant) => restaurant.hasDeal)!;
    const card = el.querySelector(`[data-testid="restaurant-card-${dealRestaurant.slug}"]`);
    expect(card?.querySelector('img.restaurant-card-photo')).not.toBeNull();
    expect(card?.textContent).toContain(dealRestaurant.rating.toFixed(1));
    // #82 review round 2, item 2: the fee reads "$1.99 delivery" / "15.000 ₫ delivery",
    // not the bare amount — the word was dropped when the card was laid out in round 1.
    // Allows an optional trailing "Flash" badge text (#104: appended inside this same
    // element, beside the meta line, when this session's flash draw covers the card).
    expect(card?.querySelector('.restaurant-card-meta')?.textContent).toMatch(/delivery(Flash)?$/);
    expect(card?.querySelector(`[data-testid="deal-badge-${dealRestaurant.slug}"]`)).not.toBeNull();

    const noDealRestaurant = restaurantsForCity('sf').find((restaurant) => !restaurant.hasDeal)!;
    const plainCard = el.querySelector(`[data-testid="restaurant-card-${noDealRestaurant.slug}"]`);
    expect(plainCard?.querySelector('.deal-badge')).toBeNull();
  });

  it('an empty search names the current city rather than a generic empty state', () => {
    window.localStorage.setItem('parody.city', 'hcmc');
    const el = root();
    initHomePage(el, window.localStorage);

    const search = el.querySelector<HTMLInputElement>('[data-testid="home-search"]')!;
    search.value = 'ramen';
    search.dispatchEvent(new Event('input'));

    expect(el.querySelector('[data-testid="home-empty"]')?.textContent).toContain('Ho Chi Minh City');
    expect(el.querySelector('[data-testid="restaurant-list"]')?.hasAttribute('hidden')).toBe(true);
  });

  it('shows a "Near you" heading above the restaurant list, and every restaurant for the city (#104; 14 each since catalogue-more.ts)', () => {
    expect(restaurantsForCity('sf')).toHaveLength(14);
    expect(restaurantsForCity('hcmc')).toHaveLength(14);

    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, window.localStorage);

    expect(el.querySelector('[data-testid="near-you-heading"]')?.textContent).toBe('Near you');
    expect(el.querySelectorAll('[data-testid^="restaurant-card-"]')).toHaveLength(14);
  });

  it('the promo banner shows real discount copy per city, not the placeholder (#104)', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const sf = root();
    initHomePage(sf, window.localStorage);
    expect(sf.querySelector('[data-testid="promo-banner-claim"]')?.textContent).toBe('$2 off your first order');
    expect(sf.querySelector('[data-testid="promo-banner-sub"]')?.textContent).toBe('Applied automatically at checkout');

    window.localStorage.setItem('parody.city', 'hcmc');
    const hcmc = root();
    initHomePage(hcmc, window.localStorage);
    expect(hcmc.querySelector('[data-testid="promo-banner-claim"]')?.textContent).toBe('10.000 ₫ off your first order');
    expect(hcmc.querySelector('[data-testid="promo-banner-sub"]')?.textContent).toBe(
      'Applied automatically at checkout',
    );
  });

  it('the promo banner has no image (#104 round 1, item 1: no Unsplash search was ever named for this slot)', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, window.localStorage);
    expect(el.querySelector('[data-testid="promo-banner"] img')).toBeNull();
  });
});

describe('the flash-deal sheet on the home feed (AC4, AC6)', () => {
  it('the first load this session draws, stores under flashDeal:<city>, and fires flash_sheet_shown once', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const stub = vi.fn();
    setTrack(stub);

    initHomePage(root(), window.localStorage, window.sessionStorage);

    const shown = stub.mock.calls.filter(([name]) => name === 'flash_sheet_shown');
    expect(shown).toHaveLength(1);
    expect(shown[0][1].city).toBe('sf');
    expect(window.sessionStorage.getItem('flashDeal:sf')).not.toBeNull();
  });

  it('the sheet is present in the DOM on first load', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();
    initHomePage(el, window.localStorage, window.sessionStorage);
    expect(el.querySelector('[data-testid="flash-sheet"]')).not.toBeNull();
  });

  it('reloading the feed in the same session does not redraw or reopen the sheet', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const stub = vi.fn();
    setTrack(stub);

    initHomePage(root(), window.localStorage, window.sessionStorage);
    const firstDraw = window.sessionStorage.getItem('flashDeal:sf');

    const second = root();
    initHomePage(second, window.localStorage, window.sessionStorage);

    expect(window.sessionStorage.getItem('flashDeal:sf')).toBe(firstDraw);
    expect(second.querySelector('[data-testid="flash-sheet"]')).toBeNull();
    expect(stub.mock.calls.filter(([name]) => name === 'flash_sheet_shown')).toHaveLength(1);
  });

  it('the first visit to the other city this session makes its own independent draw and shows its own sheet', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const stub = vi.fn();
    setTrack(stub);
    const el = root();

    initHomePage(el, window.localStorage, window.sessionStorage);
    el.querySelector<HTMLButtonElement>('[data-testid="location-bar"]')?.click();
    el.querySelector<HTMLButtonElement>('[data-testid="location-card-hcmc"]')?.click();

    const shown = stub.mock.calls.filter(([name]) => name === 'flash_sheet_shown');
    expect(shown).toHaveLength(2);
    expect(shown[1][1].city).toBe('hcmc');
    expect(window.sessionStorage.getItem('flashDeal:hcmc')).not.toBeNull();
  });

  it('a flash-active restaurant shows the Flash marker as a small badge beside the meta line, not a full-width bar underneath it (#104)', () => {
    window.localStorage.setItem('parody.city', 'sf');
    const el = root();

    initHomePage(el, window.localStorage, window.sessionStorage);

    const draw = JSON.parse(window.sessionStorage.getItem('flashDeal:sf')!) as { restaurants: [{ slug: string }, { slug: string }] };
    const flashSlug = draw.restaurants[0].slug;
    const badge = el.querySelector(`[data-testid="flash-badge-${flashSlug}"]`);

    expect(badge).not.toBeNull();
    // Beside the meta line: a child of .restaurant-card-meta, not a sibling
    // block rendered on its own row underneath the card body.
    expect(badge?.parentElement).toBe(el.querySelector(`[data-testid="restaurant-card-${flashSlug}"] .restaurant-card-meta`));
  });
});
