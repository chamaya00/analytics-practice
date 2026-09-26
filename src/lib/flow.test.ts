// Integration test walking the full funnel — home feed to restaurant to
// items to cart to checkout to order placed to tracker — one browser
// storage threaded through every screen's init function, the same object a
// real page load would share via window.localStorage. Rewritten for #82:
// the landing page and the `/restaurants` list route are gone, replaced by
// the home feed at `/`; AC5's exact-props check for `location_selected`,
// `home_viewed`, and `restaurant_opened` lives here rather than only in
// tracking.test.ts, because only this integration walks the real sequence a
// visitor triggers them in.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initHomePage } from './home-dom';
import { initMenuPage } from './menu-dom';
import { initCartPage } from './cart-dom';
import { initCheckoutPage } from './checkout-dom';
import { initOrderPlacedPage } from './order-placed-dom';
import { initTrackerPage } from './tracker-dom';
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

describe('home → restaurant → items → cart → checkout → order-placed → tracker (AC1, AC5)', () => {
  it('walks the whole flow, firing location_selected/home_viewed/restaurant_opened with exact props, and never the retired landing_viewed/restaurants_viewed', () => {
    const events: [string, unknown][] = [];
    setTrack((name, props) => events.push([name, props]));

    const homeRoot = root();
    initHomePage(homeRoot, window.localStorage);
    homeRoot.querySelector<HTMLButtonElement>('[data-testid="location-card-sf"]')?.click();

    const restaurant = restaurantsForCity('sf')[0];
    const item = restaurant.menu[0].items[0];

    const menuRoot = root();
    initMenuPage(menuRoot, restaurant, window.localStorage);
    menuRoot.querySelector<HTMLButtonElement>(`[data-testid="add-${item.id}"]`)?.click();

    initCartPage(root(), window.localStorage);

    const checkoutRoot = root();
    initCheckoutPage(checkoutRoot, window.localStorage, vi.fn());
    checkoutRoot.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();

    initOrderPlacedPage(root(), window.localStorage, vi.fn());

    const trackerRoot = root();
    initTrackerPage(trackerRoot, window.localStorage, vi.fn());

    const names = events.map(([name]) => name);
    expect(names).not.toContain('landing_viewed');
    expect(names).not.toContain('restaurants_viewed');

    expect(events.find(([name]) => name === 'location_selected')?.[1]).toEqual({ city: 'sf', is_switch: false });
    expect(events.find(([name]) => name === 'home_viewed')?.[1]).toEqual({ city: 'sf' });
    expect(events.find(([name]) => name === 'restaurant_opened')?.[1]).toEqual({
      city: 'sf',
      restaurant_slug: restaurant.slug,
    });

    // The current tracker (#83's to finish) never resolves yet.
    expect(trackerRoot.textContent).not.toMatch(/delivered/i);
    expect(trackerRoot.querySelector('[data-testid="tracker-empty"]')).toBeNull();
  });

  it('reopening the location bar and picking the already-persisted city fires is_switch: false', () => {
    const events: [string, unknown][] = [];
    setTrack((name, props) => events.push([name, props]));

    const homeRoot = root();
    initHomePage(homeRoot, window.localStorage);
    homeRoot.querySelector<HTMLButtonElement>('[data-testid="location-card-sf"]')?.click();

    homeRoot.querySelector<HTMLButtonElement>('[data-testid="location-bar"]')?.click();
    homeRoot.querySelector<HTMLButtonElement>('[data-testid="location-card-sf"]')?.click();

    const locationSelected = events.filter(([name]) => name === 'location_selected');
    expect(locationSelected).toHaveLength(2);
    expect(locationSelected[1][1]).toEqual({ city: 'sf', is_switch: false });
  });

  it('reopening the location bar and picking a different city fires is_switch: true', () => {
    const events: [string, unknown][] = [];
    setTrack((name, props) => events.push([name, props]));

    const homeRoot = root();
    initHomePage(homeRoot, window.localStorage);
    homeRoot.querySelector<HTMLButtonElement>('[data-testid="location-card-sf"]')?.click();

    homeRoot.querySelector<HTMLButtonElement>('[data-testid="location-bar"]')?.click();
    homeRoot.querySelector<HTMLButtonElement>('[data-testid="location-card-hcmc"]')?.click();

    const locationSelected = events.filter(([name]) => name === 'location_selected');
    expect(locationSelected).toHaveLength(2);
    expect(locationSelected[1][1]).toEqual({ city: 'hcmc', is_switch: true });
  });

  it('pressing Back after ordering and hitting "Place order" again fires no second order_placed', () => {
    const events: [string, unknown][] = [];
    setTrack((name, props) => events.push([name, props]));

    const restaurant = restaurantsForCity('sf')[0];
    const item = restaurant.menu[0].items[0];

    const menuRoot = root();
    initMenuPage(menuRoot, restaurant, window.localStorage);
    menuRoot.querySelector<HTMLButtonElement>(`[data-testid="add-${item.id}"]`)?.click();

    const checkoutRoot = root();
    initCheckoutPage(checkoutRoot, window.localStorage, vi.fn());
    checkoutRoot.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();

    // Back to /checkout: the cart is now empty (placeOrder cleared it), so a
    // fresh mount of the checkout page renders #80's inline empty state
    // instead of "Place order" — there is no control left to press twice.
    const navigate = vi.fn();
    const secondCheckoutRoot = root();
    initCheckoutPage(secondCheckoutRoot, window.localStorage, navigate);

    expect(navigate).not.toHaveBeenCalled();
    expect(secondCheckoutRoot.querySelector('[data-testid="checkout-empty"]')).not.toBeNull();
    expect(secondCheckoutRoot.querySelector('[data-testid="place-order"]')).toBeNull();
    expect(events.filter(([name]) => name === 'order_placed')).toHaveLength(1);
  });
});
