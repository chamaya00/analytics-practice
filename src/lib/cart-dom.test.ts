import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initCartPage } from './cart-dom';
import { addToCart } from './order-store';
import { resetTrack, setTrack } from './tracking';

const LINE = {
  itemId: 'north-beach-pizzeria-margherita',
  restaurantSlug: 'north-beach-pizzeria',
  restaurantName: 'North Beach Pizzeria',
  name: 'Margherita',
  amountMinor: 1400,
  currency: 'USD' as const,
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

describe('initCartPage (AC1, AC3)', () => {
  it('shows the empty state with a CTA back to the home feed when the cart is empty, and still fires cart_viewed', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();

    initCartPage(el, window.localStorage);

    expect(el.querySelector('[data-testid="cart-empty"]')).not.toBeNull();
    expect(el.querySelector('a[href="/"]')).not.toBeNull();
    expect(stub).toHaveBeenCalledWith('cart_viewed', { item_count: 0, amount_minor: 0, currency: 'USD' });
  });

  it('fires cart_viewed with the populated cart’s item_count, amount_minor, and currency', () => {
    addToCart(window.localStorage, LINE);
    addToCart(window.localStorage, LINE);
    const stub = vi.fn();
    setTrack(stub);

    initCartPage(root(), window.localStorage);

    expect(stub).toHaveBeenCalledWith('cart_viewed', { item_count: 2, amount_minor: 2800, currency: 'USD' });
  });

  it('removing the last item switches to the empty state', () => {
    addToCart(window.localStorage, LINE);
    const el = root();
    initCartPage(el, window.localStorage);

    el.querySelector<HTMLButtonElement>(`[data-testid="remove-${LINE.itemId}"]`)?.click();

    expect(el.querySelector('[data-testid="cart-empty"]')).not.toBeNull();
  });

  it('links to /checkout/ from a populated cart', () => {
    addToCart(window.localStorage, LINE);
    const el = root();
    initCartPage(el, window.localStorage);
    expect(el.querySelector('[data-testid="go-to-checkout"]')?.getAttribute('href')).toBe('/checkout/');
  });
});
