import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkDelivery } from './delivery';
import { addToCart, findOrder, getLatestOrder, getOrders, ORDER_KEY, ORDERS_KEY, placeOrder } from './order-store';
import { resetTrack, setTrack } from './tracking';

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

afterEach(() => {
  resetTrack();
});

function placeAnOrder() {
  addToCart(window.localStorage, LINE);
  return placeOrder(
    window.localStorage,
    { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true },
    undefined,
    () => 0.5,
  );
}

describe('checkDelivery (AC5) — the one seam "reaching Delivered" goes through', () => {
  it('returns false and fires nothing before the stored delivery time', () => {
    const order = placeAnOrder();
    const stub = vi.fn();
    setTrack(stub);

    const delivered = checkDelivery(window.localStorage, Date.parse(order.placedAt) + order.deliveryMs - 1);

    expect(delivered).toBe(false);
    expect(stub).not.toHaveBeenCalled();
    expect(getLatestOrder(window.localStorage)?.deliveredEventFired).toBe(false);
  });

  it('is detectable with nothing mounted at all — no tracker, no DOM — past the stored delivery time', () => {
    const order = placeAnOrder();
    const stub = vi.fn();
    setTrack(stub);

    // Advance well past delivery with nothing else touching the order.
    const now = Date.parse(order.placedAt) + order.deliveryMs + 5 * 60_000;
    const delivered = checkDelivery(window.localStorage, now);

    expect(delivered).toBe(true);
    expect(stub).toHaveBeenCalledWith('order_delivered', {
      order_id: order.orderId,
      minutes_since_order: expect.any(Number),
    });
    expect(getLatestOrder(window.localStorage)?.deliveredEventFired).toBe(true);
  });

  it('fires order_delivered exactly once even when checked repeatedly past delivery', () => {
    const order = placeAnOrder();
    const stub = vi.fn();
    setTrack(stub);
    const now = Date.parse(order.placedAt) + order.deliveryMs + 1000;

    checkDelivery(window.localStorage, now);
    checkDelivery(window.localStorage, now + 60_000);
    checkDelivery(window.localStorage, now + 120_000);

    expect(stub.mock.calls.filter(([name]) => name === 'order_delivered')).toHaveLength(1);
  });

  it('returns false with no stored order', () => {
    expect(checkDelivery(window.localStorage, Date.now())).toBe(false);
  });
});

describe('checkDelivery — every order gets its own firing (#144 AC3)', () => {
  const NOW = Date.now();

  /** One order shape with every field checkDelivery/isDelivered care about, seeded directly so each of the three states (already delivered+fired, just past delivery, still live) is exact rather than reached by waiting. */
  function seededOrder(orderId: string, placedAtMsAgo: number, deliveryMs: number, deliveredEventFired: boolean) {
    return {
      orderId,
      placedAt: new Date(NOW - placedAtMsAgo).toISOString(),
      etaMinutes: 15,
      deliveryMs,
      items: [LINE],
      itemCount: 1,
      amountMinor: 1400,
      totalMinor: 1400,
      currency: 'USD',
      driver: { id: 'sf-driver-01', name: 'Sarah K.', rating: 4.9, ratingCount: 2143 },
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 0,
      deliveredEventFired,
      rating: null,
    };
  }

  it('fires order_delivered exactly once, for the one order that just crossed its own delivery time, even though the tracker only ever shows a different (latest, still-live) order', () => {
    const alreadyFired = seededOrder('11111111-1111-4111-8111-111111111111', 10 * 60_000, 1000, true);
    const justPastDelivery = seededOrder('22222222-2222-4222-8222-222222222222', 5 * 60_000, 1000, false);
    const stillLive = seededOrder('33333333-3333-4333-8333-333333333333', 1000, 999_999_999, false);
    window.localStorage.setItem(ORDERS_KEY, JSON.stringify([alreadyFired, justPastDelivery, stillLive]));

    const stub = vi.fn();
    setTrack(stub);

    checkDelivery(window.localStorage, NOW);
    checkDelivery(window.localStorage, NOW + 60_000);

    const deliveredCalls = stub.mock.calls.filter(([name]) => name === 'order_delivered');
    expect(deliveredCalls).toHaveLength(1);
    expect(deliveredCalls[0][1]).toEqual({
      order_id: justPastDelivery.orderId,
      minutes_since_order: expect.any(Number),
    });

    expect(findOrder(window.localStorage, alreadyFired.orderId)?.deliveredEventFired).toBe(true);
    expect(findOrder(window.localStorage, justPastDelivery.orderId)?.deliveredEventFired).toBe(true);
    expect(findOrder(window.localStorage, stillLive.orderId)?.deliveredEventFired).toBe(false);
    expect(getLatestOrder(window.localStorage)?.orderId).toBe(stillLive.orderId);
  });
});

describe('checkDelivery — a legacy order already marked delivered (#144 AC2)', () => {
  const LEGACY_ORDER_ID = '22222222-2222-4222-8222-222222222222';

  it('fires order_delivered zero times for a migrated legacy order whose deliveredEventFired was already true', () => {
    window.localStorage.setItem(
      ORDER_KEY,
      JSON.stringify({
        orderId: LEGACY_ORDER_ID,
        placedAt: new Date(Date.now() - 60_000).toISOString(),
        etaMinutes: 15,
        deliveryMs: 1000,
        items: [LINE],
        itemCount: 1,
        amountMinor: 1400,
        currency: 'USD',
        dropOffPreset: 'home',
        deliveryInstructions: 'hand_to_me',
        utensils: true,
        appliedVoucherIds: [],
        savedAmountMinor: 0,
        viewCount: 1,
        deliveredEventFired: true,
        rating: null,
      }),
    );
    const stub = vi.fn();
    setTrack(stub);

    checkDelivery(window.localStorage, Date.now());

    expect(stub.mock.calls.filter(([name]) => name === 'order_delivered')).toHaveLength(0);
    expect(window.localStorage.getItem(ORDERS_KEY)).not.toBeNull();
    expect(getOrders(window.localStorage)).toHaveLength(1);
  });
});
