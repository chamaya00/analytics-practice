import { beforeEach, describe, expect, it } from 'vitest';
import { initCartBadge } from './header-dom';
import { addToCart } from './order-store';

const LINE = {
  itemId: 'one-job-pizza-margherita',
  restaurantSlug: 'one-job-pizza',
  restaurantName: 'One Job Pizza',
  name: 'Margherita, carried flat',
  priceCents: 1400,
};

beforeEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = '<span data-testid="cart-badge" hidden></span>';
});

describe('initCartBadge', () => {
  it('stays hidden when the cart is empty', () => {
    initCartBadge(document, window.localStorage);
    expect(document.querySelector('[data-testid="cart-badge"]')?.hasAttribute('hidden')).toBe(true);
  });

  it('shows the item count and un-hides when the cart has items', () => {
    addToCart(window.localStorage, LINE);
    addToCart(window.localStorage, LINE);

    initCartBadge(document, window.localStorage);

    const badge = document.querySelector('[data-testid="cart-badge"]');
    expect(badge?.hasAttribute('hidden')).toBe(false);
    expect(badge?.textContent).toBe('2');
  });
});
