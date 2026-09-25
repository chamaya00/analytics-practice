import { beforeEach, describe, expect, it } from 'vitest';
import {
  addToCart,
  cartItemCount,
  cartSubtotalCents,
  clearCart,
  clearOrder,
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
  priceCents: 1400,
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
    expect(cartSubtotalCents(lines)).toBe(2800);
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
});

describe('placeOrder (AC1, AC9)', () => {
  it('snapshots the cart into the order record and clears the cart', () => {
    addToCart(window.localStorage, LINE);

    const order = placeOrder(window.localStorage, {
      dropOffSpot: 'couch',
      handlingInstructions: 'guard_it',
      utensils: true,
      tipPercent: 10,
      promoCode: 'dont_drop10',
    });

    expect(order.itemCount).toBe(1);
    expect(order.subtotalCents).toBe(1400);
    expect(order.items).toHaveLength(1);
    expect(getCart(window.localStorage)).toEqual([]);
    expect(getOrder(window.localStorage)).toEqual(order);
  });

  it('gives every order a distinct order id', () => {
    addToCart(window.localStorage, LINE);
    const first = placeOrder(window.localStorage, {
      dropOffSpot: 'couch',
      handlingInstructions: 'guard_it',
      utensils: true,
      tipPercent: 0,
      promoCode: 'gotcha',
    });
    addToCart(window.localStorage, LINE);
    const second = placeOrder(window.localStorage, {
      dropOffSpot: 'couch',
      handlingInstructions: 'guard_it',
      utensils: true,
      tipPercent: 0,
      promoCode: 'gotcha',
    });
    expect(first.orderId).not.toBe(second.orderId);
  });
});

describe('clearOrder / start over (AC1)', () => {
  it('removes the stored order but leaves the visitor id untouched', () => {
    const visitorId = getVisitorId(window.localStorage);
    addToCart(window.localStorage, LINE);
    placeOrder(window.localStorage, {
      dropOffSpot: 'couch',
      handlingInstructions: 'guard_it',
      utensils: true,
      tipPercent: 0,
      promoCode: 'gotcha',
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
      dropOffSpot: 'couch',
      handlingInstructions: 'guard_it',
      utensils: true,
      tipPercent: 0,
      promoCode: 'gotcha',
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
      dropOffSpot: 'couch',
      handlingInstructions: 'guard_it',
      utensils: true,
      tipPercent: 0,
      promoCode: 'gotcha',
    });
    const before = new Date(order.placedAt).getTime() - 60_000;
    expect(minutesSinceOrder(order, before)).toBe(0);
  });
});
