import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initHomePage } from './home-dom';
import { getStoredCity } from './location';
import { restaurantsForCity } from './restaurants';
import { resetTrack, setTrack } from './tracking';

beforeEach(() => {
  window.localStorage.clear();
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
    expect(events).toEqual([
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
