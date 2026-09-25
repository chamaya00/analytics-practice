import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initOrderPlacedPage } from './order-placed-dom';
import { addToCart, placeOrder } from './order-store';

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

function root(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('initOrderPlacedPage (AC9)', () => {
  it('redirects to /restaurants/ when no order is stored (direct nav, or Back after a cleared order)', () => {
    const navigate = vi.fn();
    initOrderPlacedPage(root(), window.localStorage, navigate);
    expect(navigate).toHaveBeenCalledWith('/restaurants/');
  });

  it('renders a confirmation with a link to /tracker/ once an order exists', () => {
    addToCart(window.localStorage, LINE);
    placeOrder(window.localStorage, {
      dropOffSpot: 'couch',
      handlingInstructions: 'guard_it',
      utensils: true,
      tipPercent: 0,
      promoCode: 'gotcha',
    });

    const el = root();
    initOrderPlacedPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="track-order"]')?.getAttribute('href')).toBe('/tracker/');
    expect(el.querySelector('[data-testid="order-placed-summary"]')?.textContent).toContain('One Job Pizza');
  });
});
