import { beforeEach, describe, expect, it } from 'vitest';
import {
  addToCart,
  cartCurrency,
  cartItemCount,
  cartsByRestaurant,
  cartSubtotalMinor,
  clearCart,
  clearRestaurantCart,
  clearOrder,
  computeCheckoutBreakdown,
  findOrder,
  getCart,
  getLatestOrder,
  getOrders,
  getSessionId,
  getVisitorId,
  linesForRestaurant,
  markOrderDelivered,
  minutesSinceOrder,
  ORDER_HISTORY_CAP,
  ORDER_KEY,
  ORDERS_KEY,
  pickDeliveryMs,
  placeOrder,
  recordTrackerView,
  removeFromCart,
  selectRestaurantCart,
  setItemQuantity,
  submitRating,
  type PlacedOrder,
} from './order-store';
import { estimateEtaMinutes, ETA_MAX_MINUTES, ETA_MIN_MINUTES } from './eta';
import { DRIVERS_BY_CITY } from './drivers';

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

describe('computeCheckoutBreakdown — no voucher applied (AC1, AC3)', () => {
  it('an SF cart of $21.50 with a $2.99 delivery fee and a $1.50 service fee totals $25.99, no Discount/"You saved" line', () => {
    const lines = [{ ...LINE, amountMinor: 2150, quantity: 1 }];
    expect(computeCheckoutBreakdown(lines, 299)).toEqual({
      subtotalMinor: 2150,
      deliveryFeeMinor: 299,
      deliveryFeeOriginalMinor: null,
      serviceFeeMinor: 150,
      discountAmountMinor: 0,
      savedAmountMinor: 0,
      totalMinor: 2599,
      currency: 'USD',
    });
  });

  it('an HCMC cart of ₫250.000 with ₫15.000 and ₫20.000 fees totals ₫285.000, no Discount/"You saved" line', () => {
    const lines = [{ ...LINE, currency: 'VND' as const, amountMinor: 250000, quantity: 1 }];
    expect(computeCheckoutBreakdown(lines, 15000)).toEqual({
      subtotalMinor: 250000,
      deliveryFeeMinor: 15000,
      deliveryFeeOriginalMinor: null,
      serviceFeeMinor: 20000,
      discountAmountMinor: 0,
      savedAmountMinor: 0,
      totalMinor: 285000,
      currency: 'VND',
    });
  });

  it('returns null for an empty cart rather than a $0 breakdown', () => {
    expect(computeCheckoutBreakdown([], 0)).toBeNull();
  });
});

describe('computeCheckoutBreakdown — #87\'s worked examples with vouchers applied (AC3)', () => {
  it('HCMC ₫250.000 with t2 (₫25.000) and the delivery voucher (waiving the ₫15.000 fee): Free delivery, Discount −₫25.000, You saved ₫40.000, Total ₫245.000', () => {
    const lines = [{ ...LINE, currency: 'VND' as const, amountMinor: 250000, quantity: 1 }];
    const breakdown = computeCheckoutBreakdown(lines, 15000, {
      deliveryVoucherApplied: true,
      discountAmountMinor: 25000,
      flashDeliveryFeeMinor: null,
    });
    expect(breakdown).toEqual({
      subtotalMinor: 250000,
      deliveryFeeMinor: 0,
      deliveryFeeOriginalMinor: 15000,
      serviceFeeMinor: 20000,
      discountAmountMinor: 25000,
      savedAmountMinor: 40000,
      totalMinor: 245000,
      currency: 'VND',
    });
  });

  it('SF $21.50 with the tier-1 discount ($2.00) and the delivery voucher (waiving the $2.99 fee): Free delivery, Discount −$2.00, You saved $4.99, Total $21.00', () => {
    const lines = [{ ...LINE, amountMinor: 2150, quantity: 1 }];
    const breakdown = computeCheckoutBreakdown(lines, 299, {
      deliveryVoucherApplied: true,
      discountAmountMinor: 200,
      flashDeliveryFeeMinor: null,
    });
    expect(breakdown).toEqual({
      subtotalMinor: 2150,
      deliveryFeeMinor: 0,
      deliveryFeeOriginalMinor: 299,
      serviceFeeMinor: 150,
      discountAmountMinor: 200,
      savedAmountMinor: 499,
      totalMinor: 2100,
      currency: 'USD',
    });
  });

  it('a live flash fee reduction with no delivery voucher applied shows the struck-through original but no "You saved" contribution from it (#87: case 2 alone isn\'t a "You saved" line)', () => {
    const lines = [{ ...LINE, currency: 'VND' as const, amountMinor: 250000, quantity: 1 }];
    const breakdown = computeCheckoutBreakdown(lines, 15000, {
      deliveryVoucherApplied: false,
      discountAmountMinor: 0,
      flashDeliveryFeeMinor: 5000,
    });
    expect(breakdown!.deliveryFeeMinor).toBe(5000);
    expect(breakdown!.deliveryFeeOriginalMinor).toBe(15000);
    expect(breakdown!.savedAmountMinor).toBe(0);
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
    expect(getLatestOrder(window.localStorage)).toEqual(order);
  });

  it('stores a per-visitor estimate (10-25 min) and a delivery time at or before half of it (AC1, AC3)', () => {
    addToCart(window.localStorage, LINE);

    const order = placeOrder(
      window.localStorage,
      { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true },
      undefined,
      () => 0.5,
    );

    expect(Number.isInteger(order.etaMinutes)).toBe(true);
    expect(order.etaMinutes).toBeGreaterThanOrEqual(ETA_MIN_MINUTES);
    expect(order.etaMinutes).toBeLessThanOrEqual(ETA_MAX_MINUTES);
    expect(order.deliveryMs).toBeGreaterThan(0);
    expect(order.deliveryMs).toBeLessThanOrEqual((order.etaMinutes * 60_000) / 2);
  });

  it('the same visitor and restaurant give the same estimate placeOrder stores as checkout showed', () => {
    addToCart(window.localStorage, LINE);
    const visitorId = getVisitorId(window.localStorage);

    const order = placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
    });

    expect(order.etaMinutes).toBe(estimateEtaMinutes(visitorId, LINE.restaurantSlug));
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

describe('one cart per restaurant', () => {
  const PIZZA = {
    itemId: 'north-beach-pizzeria-margherita',
    restaurantSlug: 'north-beach-pizzeria',
    restaurantName: 'North Beach Pizzeria',
    name: 'Margherita',
    amountMinor: 1650,
    currency: 'USD' as const,
  };
  const TACO = {
    itemId: 'mission-taqueria-al-pastor',
    restaurantSlug: 'mission-taqueria',
    restaurantName: 'Mission Taqueria',
    name: 'Al pastor taco',
    amountMinor: 425,
    currency: 'USD' as const,
  };
  const PHO = {
    itemId: 'saigon-pho-quan-bo',
    restaurantSlug: 'saigon-pho-quan',
    restaurantName: 'Saigon Phở Quán',
    name: 'Phở bò',
    amountMinor: 55000,
    currency: 'VND' as const,
  };

  function seed(): void {
    addToCart(window.localStorage, PIZZA);
    addToCart(window.localStorage, TACO);
    addToCart(window.localStorage, TACO);
    addToCart(window.localStorage, PHO);
  }

  it('linesForRestaurant returns only that restaurant’s lines', () => {
    seed();
    const lines = getCart(window.localStorage);
    expect(linesForRestaurant(lines, 'mission-taqueria').map((line) => line.itemId)).toEqual([TACO.itemId]);
    expect(linesForRestaurant(lines, 'nowhere')).toEqual([]);
  });

  it('cartsByRestaurant groups lines into one cart per restaurant, in the order each was first added, with its own count, subtotal and currency', () => {
    seed();
    const carts = cartsByRestaurant(getCart(window.localStorage));
    expect(carts.map((cart) => cart.restaurantSlug)).toEqual(['north-beach-pizzeria', 'mission-taqueria', 'saigon-pho-quan']);
    expect(carts[1]).toMatchObject({ restaurantName: 'Mission Taqueria', itemCount: 2, subtotalMinor: 850, currency: 'USD' });
    expect(carts[2]).toMatchObject({ itemCount: 1, subtotalMinor: 55000, currency: 'VND' });
  });

  it('cartsByRestaurant is empty for an empty cart', () => {
    expect(cartsByRestaurant([])).toEqual([]);
  });

  it('clearRestaurantCart removes one restaurant’s lines and keeps the rest', () => {
    seed();
    const remaining = clearRestaurantCart(window.localStorage, 'mission-taqueria');
    expect(remaining.map((line) => line.restaurantSlug)).toEqual(['north-beach-pizzeria', 'saigon-pho-quan']);
    expect(getCart(window.localStorage)).toEqual(remaining);
  });

  it('clearRestaurantCart on the last cart leaves nothing stored', () => {
    addToCart(window.localStorage, PIZZA);
    clearRestaurantCart(window.localStorage, 'north-beach-pizzeria');
    expect(window.localStorage.getItem('parody.cart')).toBeNull();
  });

  describe('selectRestaurantCart', () => {
    it('is empty for an empty cart, whatever slug is asked for', () => {
      expect(selectRestaurantCart([], null)).toEqual({ kind: 'empty' });
      expect(selectRestaurantCart([], 'north-beach-pizzeria')).toEqual({ kind: 'empty' });
    });

    it('picks the only cart when no slug is given', () => {
      addToCart(window.localStorage, PIZZA);
      const selection = selectRestaurantCart(getCart(window.localStorage), null);
      expect(selection.kind === 'single' && selection.cart.restaurantSlug).toBe('north-beach-pizzeria');
    });

    it('returns every cart when several exist and no slug is given', () => {
      seed();
      const selection = selectRestaurantCart(getCart(window.localStorage), null);
      expect(selection.kind === 'several' && selection.carts).toHaveLength(3);
    });

    it('picks the named restaurant’s cart when it has lines', () => {
      seed();
      const selection = selectRestaurantCart(getCart(window.localStorage), 'saigon-pho-quan');
      expect(selection.kind).toBe('single');
      expect(selection.kind === 'single' && selection.cart.lines.map((line) => line.itemId)).toEqual([PHO.itemId]);
    });

    it('falls back to the no-slug rules for an unknown slug or one whose cart is empty', () => {
      seed();
      expect(selectRestaurantCart(getCart(window.localStorage), 'not-a-restaurant').kind).toBe('several');
      expect(selectRestaurantCart(getCart(window.localStorage), 'golden-lotus-dim-sum').kind).toBe('several');

      window.localStorage.clear();
      addToCart(window.localStorage, PIZZA);
      const selection = selectRestaurantCart(getCart(window.localStorage), 'mission-taqueria');
      expect(selection.kind === 'single' && selection.cart.restaurantSlug).toBe('north-beach-pizzeria');
    });
  });

  it('placeOrder with a restaurant slug orders only that restaurant’s lines and leaves every other cart in place', () => {
    seed();
    const order = placeOrder(
      window.localStorage,
      { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true },
      'mission-taqueria',
    );

    expect(order.items.map((line) => line.itemId)).toEqual([TACO.itemId]);
    expect(order.itemCount).toBe(2);
    expect(order.amountMinor).toBe(850);
    expect(order.currency).toBe('USD');
    expect(getCart(window.localStorage).map((line) => line.restaurantSlug)).toEqual([
      'north-beach-pizzeria',
      'saigon-pho-quan',
    ]);
    expect(getLatestOrder(window.localStorage)?.orderId).toBe(order.orderId);
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

    expect(getLatestOrder(window.localStorage)).toBeNull();
    expect(getVisitorId(window.localStorage)).toBe(visitorId);
  });
});

describe('several orders coexist (AC1)', () => {
  it('placing a second order keeps the first, each with its own placedAt/etaMinutes/deliveryMs', () => {
    addToCart(window.localStorage, LINE);
    const first = placeOrder(
      window.localStorage,
      { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true },
      undefined,
      () => 0.2,
    );

    addToCart(window.localStorage, LINE);
    const second = placeOrder(
      window.localStorage,
      { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true },
      undefined,
      () => 0.8,
    );

    const orders = getOrders(window.localStorage);
    expect(orders.map((order) => order.orderId)).toEqual([first.orderId, second.orderId]);
    expect(orders[0].deliveryMs).not.toBe(orders[1].deliveryMs);
    expect(getLatestOrder(window.localStorage)?.orderId).toBe(second.orderId);
  });

  it('getLatestOrder and getOrders are both empty with nothing stored', () => {
    expect(getLatestOrder(window.localStorage)).toBeNull();
    expect(getOrders(window.localStorage)).toEqual([]);
  });

  it('findOrder retrieves a specific order by id regardless of which is latest', () => {
    addToCart(window.localStorage, LINE);
    const first = placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true });
    addToCart(window.localStorage, LINE);
    placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true });

    expect(findOrder(window.localStorage, first.orderId)?.orderId).toBe(first.orderId);
    expect(findOrder(window.localStorage, 'not-a-stored-id')).toBeNull();
  });
});

describe('getOrders — migrating the legacy `parody.order` key (AC2)', () => {
  const LEGACY_ORDER_ID = '11111111-1111-4111-8111-111111111111';

  function storeLegacyOrder(overrides: Record<string, unknown> = {}): void {
    window.localStorage.setItem(
      ORDER_KEY,
      JSON.stringify({
        orderId: LEGACY_ORDER_ID,
        placedAt: new Date().toISOString(),
        etaMinutes: 15,
        deliveryMs: 5 * 60_000,
        items: [LINE],
        itemCount: 1,
        amountMinor: 1400,
        currency: 'USD',
        dropOffPreset: 'home',
        deliveryInstructions: 'hand_to_me',
        utensils: true,
        appliedVoucherIds: [],
        savedAmountMinor: 0,
        viewCount: 3,
        deliveredEventFired: true,
        rating: { stars: 5, tags: ['fast'] },
        ...overrides,
      }),
    );
  }

  it('fills in a finite etaMinutes and the fixed 7-minute deliveryMs for a pre-#121 record missing them', () => {
    storeLegacyOrder({ etaMinutes: undefined, deliveryMs: undefined });
    const visitorId = getVisitorId(window.localStorage);

    const order = getLatestOrder(window.localStorage);

    expect(order?.etaMinutes).toBe(estimateEtaMinutes(visitorId, LINE.restaurantSlug));
    expect(order?.deliveryMs).toBe(7 * 60_000);
  });

  it('appears in the new structure exactly once, preserving deliveredEventFired/viewCount/rating, for both a current-shape and a pre-#121 record — and reading again does not duplicate it', () => {
    for (const legacyShape of [
      { etaMinutes: 15, deliveryMs: 5 * 60_000 },
      { etaMinutes: undefined, deliveryMs: undefined },
    ]) {
      window.localStorage.clear();
      storeLegacyOrder(legacyShape);

      const first = getOrders(window.localStorage);
      expect(first).toHaveLength(1);
      expect(first[0].orderId).toBe(LEGACY_ORDER_ID);
      expect(first[0].deliveredEventFired).toBe(true);
      expect(first[0].viewCount).toBe(3);
      expect(first[0].rating).toEqual({ stars: 5, tags: ['fast'] });

      const second = getOrders(window.localStorage);
      expect(second).toHaveLength(1);
      expect(second[0].orderId).toBe(LEGACY_ORDER_ID);
    }
  });

  it('gives the migrated order a null total and a driver from its own city’s pool, once, persisted across reads', () => {
    storeLegacyOrder();

    const first = getLatestOrder(window.localStorage);
    expect(first?.totalMinor).toBeNull();
    expect(DRIVERS_BY_CITY.sf.map((driver) => driver.id)).toContain(first?.driver.id);

    const second = getLatestOrder(window.localStorage);
    expect(second?.driver).toEqual(first?.driver);
  });

  it('removes the legacy key once migrated — nothing reads it again, so leaving it behind would only be dead state', () => {
    storeLegacyOrder();
    getOrders(window.localStorage);

    expect(window.localStorage.getItem(ORDER_KEY)).toBeNull();
    expect(window.localStorage.getItem(ORDERS_KEY)).not.toBeNull();
  });

  it('a later placeOrder appends to the migrated order rather than the migration re-running and re-adding it', () => {
    storeLegacyOrder();
    const migrated = getOrders(window.localStorage)[0]; // triggers the migration once

    addToCart(window.localStorage, LINE);
    placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true });

    const orders = getOrders(window.localStorage);
    expect(orders).toHaveLength(2);
    // Deep-equal, not just a matching id: if the migration ran a second time
    // instead of reading the already-migrated record back, this copy would
    // carry a freshly (re-)drawn driver rather than the one persisted the
    // first time.
    expect(orders[0]).toEqual(migrated);
    expect(orders[1].orderId).not.toBe(LEGACY_ORDER_ID);
  });
});

describe('placeOrder — driver (AC4)', () => {
  const HCMC_LINE = {
    itemId: 'ben-thanh-banh-mi-thit-nuong',
    restaurantSlug: 'ben-thanh-banh-mi',
    restaurantName: 'Bến Thành Bánh Mì',
    name: 'Bánh mì thịt nướng',
    amountMinor: 35000,
    currency: 'VND' as const,
  };

  /** Returns each value in sequence, then keeps repeating the last one — lets a
   * test predict exactly which call (deliveryMs, then the driver draw) sees which value. */
  function seededRandom(sequence: number[]): () => number {
    let i = 0;
    return () => sequence[Math.min(i++, sequence.length - 1)];
  }

  it('stores exactly the driver a seeded random source picks from the order’s own restaurant’s city pool', () => {
    addToCart(window.localStorage, {
      itemId: 'north-beach-pizzeria-margherita',
      restaurantSlug: 'north-beach-pizzeria',
      restaurantName: 'North Beach Pizzeria',
      name: 'Margherita',
      amountMinor: 1650,
      currency: 'USD',
    });

    // random() is consumed once for deliveryMs, then once more for the driver
    // draw — the second value (0) is what picks pool index 0.
    const order = placeOrder(
      window.localStorage,
      { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true },
      'north-beach-pizzeria',
      seededRandom([0.5, 0]),
    );

    expect(order.driver).toEqual(DRIVERS_BY_CITY.sf[0]);
  });

  it('an HCMC restaurant’s order gets an HCMC driver even while the stored city preference says SF', () => {
    addToCart(window.localStorage, HCMC_LINE);

    const order = placeOrder(
      window.localStorage,
      { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true },
      'ben-thanh-banh-mi',
      seededRandom([0.5, 0.9]),
    );

    expect(DRIVERS_BY_CITY.hcmc.map((driver) => driver.id)).toContain(order.driver.id);
    expect(DRIVERS_BY_CITY.sf.map((driver) => driver.id)).not.toContain(order.driver.id);
  });

  it('re-reading or re-rendering the order never changes its driver', () => {
    addToCart(window.localStorage, LINE);
    const order = placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true });

    expect(getLatestOrder(window.localStorage)?.driver).toEqual(order.driver);
    expect(getLatestOrder(window.localStorage)?.driver).toEqual(order.driver);
  });
});

describe('placeOrder — total (AC5)', () => {
  it('stores the checkout breakdown’s totalMinor, separate from the amountMinor subtotal', () => {
    addToCart(window.localStorage, LINE);

    const order = placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      totalMinor: 1899,
    });

    expect(order.amountMinor).toBe(1400);
    expect(order.totalMinor).toBe(1899);
  });
});

describe('order history cap (AC5)', () => {
  function storedOrder(overrides: Partial<PlacedOrder> & { orderId: string; placedAt: string }): PlacedOrder {
    return {
      etaMinutes: 15,
      deliveryMs: 5 * 60_000,
      items: [{ ...LINE, quantity: 1 }],
      itemCount: 1,
      amountMinor: 1400,
      totalMinor: 1400,
      currency: 'USD',
      driver: DRIVERS_BY_CITY.sf[0],
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 0,
      deliveredEventFired: false,
      rating: null,
      driverRating: null,
      ratingPromptedAt: null,
      ...overrides,
    };
  }

  it('drops the oldest delivered-and-fired orders first once the cap is exceeded, never dropping a live order or a delivered one whose event hasn’t fired', () => {
    const now = Date.now();
    const orders: PlacedOrder[] = [];

    // Two protected orders, older than everything else, stored first (oldest-first).
    orders.push(
      storedOrder({
        orderId: 'delivered-unfired',
        placedAt: new Date(now - 1000 * 60_000).toISOString(),
        deliveryMs: 1000,
        deliveredEventFired: false,
      }),
    );
    orders.push(
      storedOrder({
        orderId: 'still-live',
        placedAt: new Date(now - 999 * 60_000).toISOString(),
        deliveryMs: 999_999_999,
        deliveredEventFired: false,
      }),
    );
    // ORDER_HISTORY_CAP droppable (delivered, event fired) orders, oldest first.
    for (let i = 0; i < ORDER_HISTORY_CAP; i++) {
      orders.push(
        storedOrder({
          orderId: `droppable-${i}`,
          placedAt: new Date(now - (ORDER_HISTORY_CAP - i) * 60_000).toISOString(),
          deliveryMs: 1000,
          deliveredEventFired: true,
        }),
      );
    }

    window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

    addToCart(window.localStorage, LINE);
    placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true });

    const ids = getOrders(window.localStorage).map((order) => order.orderId);

    expect(ids).toContain('still-live');
    expect(ids).toContain('delivered-unfired');
    expect(ids).not.toContain('droppable-0');
    expect(ids).not.toContain('droppable-1');
    expect(ids).not.toContain('droppable-2');
    expect(ids).toContain(`droppable-${ORDER_HISTORY_CAP - 1}`);
    expect(ids).toHaveLength(ORDER_HISTORY_CAP);
  });
});

describe('recordTrackerView (AC3)', () => {
  it('increments the named order’s view count on every call, starting at 1', () => {
    addToCart(window.localStorage, LINE);
    const order = placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
    });

    expect(recordTrackerView(window.localStorage, order.orderId)).toBe(1);
    expect(recordTrackerView(window.localStorage, order.orderId)).toBe(2);
    expect(getLatestOrder(window.localStorage)?.viewCount).toBe(2);
  });

  it('does nothing when that id isn’t stored', () => {
    expect(recordTrackerView(window.localStorage, 'not-a-stored-id')).toBe(0);
  });

  it('updates only the named order when several are stored', () => {
    addToCart(window.localStorage, LINE);
    const first = placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true });
    addToCart(window.localStorage, LINE);
    const second = placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true });

    recordTrackerView(window.localStorage, first.orderId);

    expect(findOrder(window.localStorage, first.orderId)?.viewCount).toBe(1);
    expect(findOrder(window.localStorage, second.orderId)?.viewCount).toBe(0);
  });
});

describe('markOrderDelivered (contract §10)', () => {
  it('sets deliveredEventFired on the named order, defaulting to false', () => {
    addToCart(window.localStorage, LINE);
    const order = placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
    });
    expect(getLatestOrder(window.localStorage)?.deliveredEventFired).toBe(false);

    markOrderDelivered(window.localStorage, order.orderId);
    expect(getLatestOrder(window.localStorage)?.deliveredEventFired).toBe(true);
  });

  it('does nothing when that id isn’t stored', () => {
    expect(() => markOrderDelivered(window.localStorage, 'not-a-stored-id')).not.toThrow();
    expect(getLatestOrder(window.localStorage)).toBeNull();
  });

  it('marks only the named order when several are stored', () => {
    addToCart(window.localStorage, LINE);
    const first = placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true });
    addToCart(window.localStorage, LINE);
    const second = placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true });

    markOrderDelivered(window.localStorage, first.orderId);

    expect(findOrder(window.localStorage, first.orderId)?.deliveredEventFired).toBe(true);
    expect(findOrder(window.localStorage, second.orderId)?.deliveredEventFired).toBe(false);
  });
});

describe('submitRating (contract §7’s rating_submitted invariant)', () => {
  it('records the rating on the named order, defaulting to null', () => {
    addToCart(window.localStorage, LINE);
    const order = placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
    });
    expect(getLatestOrder(window.localStorage)?.rating).toBeNull();

    const updated = submitRating(window.localStorage, order.orderId, 4, ['fast']);
    expect(updated?.rating).toEqual({ stars: 4, tags: ['fast'] });
    expect(getLatestOrder(window.localStorage)?.rating).toEqual({ stars: 4, tags: ['fast'] });
  });

  it('returns null and leaves the stored rating untouched on a second call — a second Submit is impossible', () => {
    addToCart(window.localStorage, LINE);
    const order = placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
    });
    submitRating(window.localStorage, order.orderId, 4, ['fast']);

    expect(submitRating(window.localStorage, order.orderId, 2, [])).toBeNull();
    expect(getLatestOrder(window.localStorage)?.rating).toEqual({ stars: 4, tags: ['fast'] });
  });

  it('does nothing when that id isn’t stored', () => {
    expect(submitRating(window.localStorage, 'not-a-stored-id', 4, [])).toBeNull();
  });

  it('rates only the named order when several are stored', () => {
    addToCart(window.localStorage, LINE);
    const first = placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true });
    addToCart(window.localStorage, LINE);
    const second = placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true });

    submitRating(window.localStorage, first.orderId, 3, []);

    expect(findOrder(window.localStorage, first.orderId)?.rating).toEqual({ stars: 3, tags: [] });
    expect(findOrder(window.localStorage, second.orderId)?.rating).toBeNull();
  });
});

describe('pickDeliveryMs (AC3)', () => {
  it('is always > 0 and never more than half the estimate, for any injected random in [0, 1)', () => {
    for (const random of [0, 0.1, 0.5, 0.99]) {
      const ms = pickDeliveryMs(20, () => random);
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual((20 * 60_000) / 2);
    }
  });

  it('is deterministic for a fixed random source', () => {
    expect(pickDeliveryMs(20, () => 0.5)).toBe(pickDeliveryMs(20, () => 0.5));
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
