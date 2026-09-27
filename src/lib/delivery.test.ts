import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkDelivery } from './delivery';
import { addToCart, getOrder, placeOrder } from './order-store';
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
    expect(getOrder(window.localStorage)?.deliveredEventFired).toBe(false);
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
    expect(getOrder(window.localStorage)?.deliveredEventFired).toBe(true);
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
