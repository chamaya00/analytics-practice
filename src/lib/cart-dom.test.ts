import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initCartPage } from './cart-dom';
import { addToCart, getCart } from './order-store';
import { resetTrack, setTrack } from './tracking';

const LINE = {
  itemId: 'north-beach-pizzeria-margherita',
  restaurantSlug: 'north-beach-pizzeria',
  restaurantName: 'North Beach Pizzeria',
  name: 'Margherita',
  amountMinor: 1400,
  currency: 'USD' as const,
};

// Mission Taqueria's own deliveryFeeMinor (restaurants.ts) is 199.
const TACO = {
  itemId: 'mission-taqueria-al-pastor',
  restaurantSlug: 'mission-taqueria',
  restaurantName: 'Mission Taqueria',
  name: 'Al pastor taco',
  amountMinor: 425,
  currency: 'USD' as const,
};

// Saigon Phở Quán's own deliveryFeeMinor is ₫15.000 — a different city, so a different currency.
const PHO = {
  itemId: 'saigon-pho-quan-bo',
  restaurantSlug: 'saigon-pho-quan',
  restaurantName: 'Saigon Phở Quán',
  name: 'Phở bò',
  amountMinor: 55000,
  currency: 'VND' as const,
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

    initCartPage(el, window.localStorage, '');

    expect(el.querySelector('[data-testid="cart-empty"]')).not.toBeNull();
    expect(el.querySelector('a[href="/"]')).not.toBeNull();
    expect(stub).toHaveBeenCalledWith('cart_viewed', { item_count: 0, amount_minor: 0, currency: 'USD' });
  });

  it('fires cart_viewed with the populated cart’s item_count, amount_minor, and currency', () => {
    addToCart(window.localStorage, LINE);
    addToCart(window.localStorage, LINE);
    const stub = vi.fn();
    setTrack(stub);

    initCartPage(root(), window.localStorage, '');

    expect(stub).toHaveBeenCalledWith('cart_viewed', { item_count: 2, amount_minor: 2800, currency: 'USD' });
  });

  it('removing the last item switches to the empty state', () => {
    addToCart(window.localStorage, LINE);
    const el = root();
    initCartPage(el, window.localStorage, '');

    el.querySelector<HTMLButtonElement>(`[data-testid="remove-${LINE.itemId}"]`)?.click();

    expect(el.querySelector('[data-testid="cart-empty"]')).not.toBeNull();
  });

  it('links to that restaurant’s checkout from a populated cart', () => {
    addToCart(window.localStorage, LINE);
    const el = root();
    initCartPage(el, window.localStorage, '');
    expect(el.querySelector('[data-testid="go-to-checkout"]')?.getAttribute('href')).toBe(
      '/checkout/?restaurant=north-beach-pizzeria',
    );
  });

  it('a single restaurant’s cart is headed by the restaurant’s name, and its lines carry no "(Restaurant)" suffix', () => {
    addToCart(window.localStorage, LINE);
    const el = root();
    initCartPage(el, window.localStorage, '');
    expect(el.querySelector('[data-testid="cart-heading"]')?.textContent).toBe('North Beach Pizzeria');
    expect(el.querySelector(`[data-testid="cart-line-name-${LINE.itemId}"]`)?.textContent).toBe('Margherita');
    // Only one cart, so there is no list to go back to.
    expect(el.querySelector('[data-testid="cart-back"]')).toBeNull();
  });
});

describe('initCartPage — one cart per restaurant', () => {
  beforeEach(() => {
    addToCart(window.localStorage, LINE);
    addToCart(window.localStorage, TACO);
    addToCart(window.localStorage, TACO);
    addToCart(window.localStorage, PHO);
  });

  it('with several carts and no ?restaurant=, lists one card per restaurant with its own count and subtotal in its own currency', () => {
    const el = root();
    initCartPage(el, window.localStorage, '');

    expect(el.querySelector('[data-testid="cart-heading"]')?.textContent).toBe('Your carts');
    expect(el.querySelector('[data-testid="cart-list"]')).toBeNull();
    const cards = el.querySelectorAll('[data-testid="cart-cards"] a');
    expect(cards).toHaveLength(3);

    const taco = el.querySelector<HTMLAnchorElement>('[data-testid="cart-card-mission-taqueria"]');
    expect(taco?.getAttribute('href')).toBe('/cart/?restaurant=mission-taqueria');
    expect(taco?.textContent).toContain('Mission Taqueria');
    expect(el.querySelector('[data-testid="cart-card-count-mission-taqueria"]')?.textContent).toBe('2 items');
    expect(el.querySelector('[data-testid="cart-card-subtotal-mission-taqueria"]')?.textContent).toBe('$8.50');

    expect(el.querySelector('[data-testid="cart-card-count-north-beach-pizzeria"]')?.textContent).toBe('1 item');
    expect(el.querySelector('[data-testid="cart-card-subtotal-saigon-pho-quan"]')?.textContent).toContain('55.000');
    expect(el.querySelector('[data-testid="cart-card-subtotal-saigon-pho-quan"]')?.textContent).toContain('₫');
  });

  it('the "Your carts" list fires no cart_viewed — it has no single cart or currency to describe', () => {
    const stub = vi.fn();
    setTrack(stub);
    initCartPage(root(), window.localStorage, '');
    expect(stub).not.toHaveBeenCalled();
  });

  it('?restaurant=<slug> shows only that restaurant’s lines, its own subtotal and delivery fee, and a checkout link carrying the slug', () => {
    const el = root();
    initCartPage(el, window.localStorage, '?restaurant=mission-taqueria');

    expect(el.querySelector('[data-testid="cart-heading"]')?.textContent).toBe('Mission Taqueria');
    expect(el.querySelectorAll('[data-testid="cart-list"] > li')).toHaveLength(1);
    expect(el.querySelector(`[data-testid="cart-line-${TACO.itemId}"]`)).not.toBeNull();
    expect(el.querySelector(`[data-testid="cart-line-${LINE.itemId}"]`)).toBeNull();
    expect(el.querySelector(`[data-testid="cart-line-name-${TACO.itemId}"]`)?.textContent).toBe('Al pastor taco');
    expect(el.querySelector('[data-testid="cart-subtotal"]')?.textContent).toBe('Subtotal: $8.50');
    expect(el.querySelector('[data-testid="cart-delivery-preview"]')?.textContent).toBe('Delivery fee: $1.99');
    expect(el.querySelector('[data-testid="go-to-checkout"]')?.getAttribute('href')).toBe(
      '/checkout/?restaurant=mission-taqueria',
    );
    expect(el.querySelector('[data-testid="cart-back"]')?.getAttribute('href')).toBe('/cart/');
  });

  it('?restaurant=<slug> fires cart_viewed once, with that cart’s own item_count, amount_minor and currency', () => {
    const stub = vi.fn();
    setTrack(stub);
    initCartPage(root(), window.localStorage, '?restaurant=saigon-pho-quan');
    expect(stub).toHaveBeenCalledTimes(1);
    expect(stub).toHaveBeenCalledWith('cart_viewed', { item_count: 1, amount_minor: 55000, currency: 'VND' });
  });

  it('changing a quantity re-renders the same restaurant’s cart and fires no second cart_viewed', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initCartPage(el, window.localStorage, '?restaurant=mission-taqueria');

    el.querySelector<HTMLButtonElement>(`[data-testid="increment-${TACO.itemId}"]`)?.click();

    expect(el.querySelector('[data-testid="cart-heading"]')?.textContent).toBe('Mission Taqueria');
    expect(el.querySelector(`[data-testid="quantity-${TACO.itemId}"]`)?.textContent).toBe('3');
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it('an unknown ?restaurant= falls back to the list', () => {
    const el = root();
    initCartPage(el, window.localStorage, '?restaurant=not-a-restaurant');
    expect(el.querySelector('[data-testid="cart-heading"]')?.textContent).toBe('Your carts');
  });

  it('emptying the named restaurant’s cart falls back to the list and leaves the other carts untouched', () => {
    const el = root();
    initCartPage(el, window.localStorage, '?restaurant=north-beach-pizzeria');

    el.querySelector<HTMLButtonElement>(`[data-testid="remove-${LINE.itemId}"]`)?.click();

    expect(el.querySelector('[data-testid="cart-heading"]')?.textContent).toBe('Your carts');
    expect(el.querySelectorAll('[data-testid="cart-cards"] a')).toHaveLength(2);
    expect(getCart(window.localStorage).map((line) => line.restaurantSlug)).toEqual([
      'mission-taqueria',
      'saigon-pho-quan',
    ]);
  });
});
