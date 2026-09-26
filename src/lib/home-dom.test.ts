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
    expect(card?.querySelector('.restaurant-card-meta')?.textContent).toMatch(/delivery$/);
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
});
