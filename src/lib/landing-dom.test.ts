import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initLandingPage } from './landing-dom';
import { addToCart, placeOrder } from './order-store';
import { resetTrack, setTrack } from './tracking';

const LINE = {
  itemId: 'one-job-pizza-margherita',
  restaurantSlug: 'one-job-pizza',
  restaurantName: 'One Job Pizza',
  name: 'Margherita, carried flat',
  priceCents: 1400,
};

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

describe('initLandingPage (AC1, AC3)', () => {
  it('fires landing_viewed with has_active_order: false and renders no banner when there is no stored order', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();

    initLandingPage(el, window.localStorage);

    expect(stub).toHaveBeenCalledWith('landing_viewed', { has_active_order: false });
    expect(el.querySelector('[data-testid="order-banner"]')).toBeNull();
  });

  it('fires has_active_order: true and shows a banner linking to /tracker/ when an order is stored', () => {
    addToCart(window.localStorage, LINE);
    placeOrder(window.localStorage, {
      dropOffSpot: 'couch',
      handlingInstructions: 'guard_it',
      utensils: true,
      tipPercent: 0,
      promoCode: 'gotcha',
    });
    const stub = vi.fn();
    setTrack(stub);
    const el = root();

    initLandingPage(el, window.localStorage);

    expect(stub).toHaveBeenCalledWith('landing_viewed', { has_active_order: true });
    expect(el.querySelector('[data-testid="order-banner"]')?.getAttribute('href')).toBe('/tracker/');
  });
});
