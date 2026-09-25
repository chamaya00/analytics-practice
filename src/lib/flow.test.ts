// Integration test walking the full funnel — issue #67 AC1 ("landing to
// restaurant to items to cart to checkout to order placed to tracker") and
// AC9's Back-after-ordering case — one browser storage threaded through
// every screen's init function, the same object a real page load would
// share via window.localStorage.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initLandingPage } from './landing-dom';
import { initRestaurantsPage } from './restaurants-dom';
import { initMenuPage } from './menu-dom';
import { initCartPage } from './cart-dom';
import { initCheckoutPage } from './checkout-dom';
import { initOrderPlacedPage } from './order-placed-dom';
import { initTrackerPage } from './tracker-dom';
import { RESTAURANTS } from './restaurants';
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

describe('landing → restaurant → items → cart → checkout → order-placed → tracker (AC1)', () => {
  it('walks the whole flow, firing every named event in order and never showing a delivered tracker state', () => {
    const events: [string, unknown][] = [];
    setTrack((name, props) => events.push([name, props]));

    const restaurant = RESTAURANTS[0];
    const item = restaurant.menu[0];

    initLandingPage(root(), window.localStorage);
    initRestaurantsPage();
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

    expect(events.map(([name]) => name)).toEqual([
      'landing_viewed',
      'restaurants_viewed',
      'restaurant_opened',
      'cart_viewed',
      'checkout_viewed',
      'order_placed',
      'tracker_viewed',
    ]);

    // The joke: no fifth, delivered step, ever.
    expect(trackerRoot.textContent).not.toMatch(/delivered/i);
    expect(trackerRoot.querySelector('[data-testid="tracker-empty"]')).toBeNull();
  });

  it('pressing Back after ordering and hitting "Place order" again fires no second order_placed (AC9)', () => {
    const events: [string, unknown][] = [];
    setTrack((name, props) => events.push([name, props]));

    const restaurant = RESTAURANTS[0];
    const item = restaurant.menu[0];

    const menuRoot = root();
    initMenuPage(menuRoot, restaurant, window.localStorage);
    menuRoot.querySelector<HTMLButtonElement>(`[data-testid="add-${item.id}"]`)?.click();

    const checkoutRoot = root();
    initCheckoutPage(checkoutRoot, window.localStorage, vi.fn());
    checkoutRoot.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();

    // Back to /checkout: the cart is now empty (placeOrder cleared it), so a
    // fresh mount of the checkout page redirects to /cart/ instead of
    // re-rendering "Place order" — there is no control left to press twice.
    const navigate = vi.fn();
    const secondCheckoutRoot = root();
    initCheckoutPage(secondCheckoutRoot, window.localStorage, navigate);

    expect(navigate).toHaveBeenCalledWith('/cart/');
    expect(secondCheckoutRoot.querySelector('[data-testid="place-order"]')).toBeNull();
    expect(events.filter(([name]) => name === 'order_placed')).toHaveLength(1);
  });
});
