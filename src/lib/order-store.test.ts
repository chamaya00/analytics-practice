import { beforeEach, describe, expect, it } from 'vitest';
import {
  addToCart,
  cartCurrency,
  cartItemCount,
  cartSubtotalMinor,
  clearCart,
  clearOrder,
  computeCheckoutBreakdown,
  getCart,
  getOrder,
  getSessionId,
  getVisitorId,
  minutesSinceOrder,
  placeOrder,
  recordTrackerView,
  removeFromCart,
  setItemQuantity,
} from './order-store';

const LINE = {
  itemId: 'one-job-pizza-margherita',
  restaurantSlug: 'one-job-pizza',
  restaurantName: 'One Job Pizza',
  name: 'Margherita, carried flat',
  amountMinor: 1400,
  currency: 'USD' as const,
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('visitor/session ids', () => {
  it('persists a visitor id across calls, generated once', () => {
    const first = getVisitorId(window.localStorage);
    const second = getVisitorId(window.localStorage);
    expect(first).toBe(second);
  });

  it('is a distinct id from the session id', () => {
    expect(getVisitorId(window.localStorage)).not.toBe(getSessionId(window.sessionStorage));
  });
});

describe('cart (AC1, AC9)', () => {
  it('starts empty', () => {
    expect(getCart(window.localStorage)).toEqual([]);
  });

  it('adding the same item twice increments its quantity rather than duplicating the line', () => {
    addToCart(window.localStorage, LINE);
    const lines = addToCart(window.localStorage, LINE);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
  });

  it('computes item count and subtotal from quantities and prices', () => {
    addToCart(window.localStorage, LINE);
    addToCart(window.localStorage, LINE);
    const lines = getCart(window.localStorage);
    expect(cartItemCount(lines)).toBe(2);
    expect(cartSubtotalMinor(lines)).toBe(2800);
  });

  it('setItemQuantity to zero removes the line, same as removeFromCart', () => {
    addToCart(window.localStorage, LINE);
    setItemQuantity(window.localStorage, LINE.itemId, 0);
    expect(getCart(window.localStorage)).toEqual([]);

    addToCart(window.localStorage, LINE);
    removeFromCart(window.localStorage, LINE.itemId);
    expect(getCart(window.localStorage)).toEqual([]);
  });

  it('clearCart empties the cart', () => {
    addToCart(window.localStorage, LINE);
    clearCart(window.localStorage);
    expect(getCart(window.localStorage)).toEqual([]);
  });

  it('cartCurrency reads the cart’s own currency, and is null when empty', () => {
    expect(cartCurrency([])).toBeNull();
    addToCart(window.localStorage, LINE);
    expect(cartCurrency(getCart(window.localStorage))).toBe('USD');
  });
});

describe('computeCheckoutBreakdown (AC1)', () => {
  it('an SF cart of $21.50 with a $2.99 delivery fee and a $1.50 service fee totals $25.99', () => {
    const lines = [{ ...LINE, amountMinor: 2150, quantity: 1 }];
    expect(computeCheckoutBreakdown(lines, 299)).toEqual({
      subtotalMinor: 2150,
      deliveryFeeMinor: 299,
      serviceFeeMinor: 150,
      totalMinor: 2599,
      currency: 'USD',
    });
  });

  it('an HCMC cart of ₫250.000 with ₫15.000 and ₫20.000 fees totals ₫285.000', () => {
    const lines = [{ ...LINE, currency: 'VND' as const, amountMinor: 250000, quantity: 1 }];
    expect(computeCheckoutBreakdown(lines, 15000)).toEqual({
      subtotalMinor: 250000,
      deliveryFeeMinor: 15000,
      serviceFeeMinor: 20000,
      totalMinor: 285000,
      currency: 'VND',
    });
  });

  it('returns null for an empty cart rather than a $0 breakdown', () => {
    expect(computeCheckoutBreakdown([], 0)).toBeNull();
  });
});

describe('placeOrder (AC1, AC9)', () => {
  it('snapshots the cart into the order record and clears the cart, with no voucher applied', () => {
    addToCart(window.localStorage, LINE);

    const order = placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
    });

    expect(order.itemCount).toBe(1);
    expect(order.amountMinor).toBe(1400);
    expect(order.currency).toBe('USD');
    expect(order.appliedVoucherIds).toEqual([]);
    expect(order.savedAmountMinor).toBe(0);
    expect(order.items).toHaveLength(1);
    expect(getCart(window.localStorage)).toEqual([]);
    expect(getOrder(window.localStorage)).toEqual(order);
  });

  it('gives every order a distinct order id', () => {
    addToCart(window.localStorage, LINE);
    const first = placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
    });
    addToCart(window.localStorage, LINE);
    const second = placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
    });
    expect(first.orderId).not.toBe(second.orderId);
  });
});

describe('clearOrder / start over (AC1)', () => {
  it('removes the stored order but leaves the visitor id untouched', () => {
    const visitorId = getVisitorId(window.localStorage);
    addToCart(window.localStorage, LINE);
    placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
    });

    clearOrder(window.localStorage);

    expect(getOrder(window.localStorage)).toBeNull();
    expect(getVisitorId(window.localStorage)).toBe(visitorId);
  });
});

describe('recordTrackerView (AC3)', () => {
  it('increments the stored order’s view count on every call, starting at 1', () => {
    addToCart(window.localStorage, LINE);
    placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
    });

    expect(recordTrackerView(window.localStorage)).toBe(1);
    expect(recordTrackerView(window.localStorage)).toBe(2);
    expect(getOrder(window.localStorage)?.viewCount).toBe(2);
  });

  it('does nothing when there is no stored order', () => {
    expect(recordTrackerView(window.localStorage)).toBe(0);
  });
});

describe('minutesSinceOrder', () => {
  it('never goes negative even if the clock reads before placedAt', () => {
    addToCart(window.localStorage, LINE);
    const order = placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
    });
    const before = new Date(order.placedAt).getTime() - 60_000;
    expect(minutesSinceOrder(order, before)).toBe(0);
  });
});
