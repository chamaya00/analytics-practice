import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidEventProps, resetTrack, setTrack, track } from './tracking';

const ORDER_ID = '11111111-2222-4333-8444-555555555555';

const VALID_ORDER_PLACED = {
  order_id: ORDER_ID,
  item_count: 2,
  subtotal_cents: 1800,
  drop_off_spot: 'couch',
  handling_instructions: 'guard_it',
  utensils: true,
  tip_percent: 10,
  promo_code: 'dont_drop10',
};

afterEach(() => {
  resetTrack();
});

describe('isValidEventProps (AC3, AC8)', () => {
  it('accepts a well-shaped order_placed carrying a valid promo_code', () => {
    expect(isValidEventProps('order_placed', VALID_ORDER_PLACED)).toBe(true);
  });

  it('rejects an order_placed with an unknown promo_code value (AC8)', () => {
    expect(isValidEventProps('order_placed', { ...VALID_ORDER_PLACED, promo_code: 'not_a_real_code' })).toBe(
      false,
    );
  });

  it('rejects an order_placed missing promo_code entirely', () => {
    const withoutPromo = Object.fromEntries(
      Object.entries(VALID_ORDER_PLACED).filter(([key]) => key !== 'promo_code'),
    );
    expect(isValidEventProps('order_placed', withoutPromo)).toBe(false);
  });

  it('accepts every event name in the contract with a minimal valid payload', () => {
    expect(isValidEventProps('location_selected', { city: 'sf', is_switch: false })).toBe(true);
    expect(isValidEventProps('home_viewed', { city: 'hcmc' })).toBe(true);
    expect(isValidEventProps('restaurant_opened', { city: 'sf', restaurant_slug: 'north-beach-pizzeria' })).toBe(
      true,
    );
    expect(isValidEventProps('cart_viewed', { item_count: 0, subtotal_cents: 0 })).toBe(true);
    expect(isValidEventProps('checkout_viewed', { item_count: 1, subtotal_cents: 100 })).toBe(true);
    expect(
      isValidEventProps('tracker_viewed', { order_id: ORDER_ID, minutes_since_order: 0, view_number: 1 }),
    ).toBe(true);
    expect(
      isValidEventProps('order_abandoned', { order_id: ORDER_ID, minutes_since_order: 12, view_count: 3 }),
    ).toBe(true);
  });

  it('rejects checkout_viewed with a zero item_count (checkout is only reachable from a populated cart)', () => {
    expect(isValidEventProps('checkout_viewed', { item_count: 0, subtotal_cents: 500 })).toBe(false);
  });
});

describe('track (AC3)', () => {
  it('forwards a valid call to the injected stub with the exact event name and props', () => {
    const stub = vi.fn();
    setTrack(stub);

    track('order_placed', VALID_ORDER_PLACED);

    expect(stub).toHaveBeenCalledTimes(1);
    expect(stub).toHaveBeenCalledWith('order_placed', VALID_ORDER_PLACED);
  });

  it('drops a malformed call rather than forwarding it to the stub', () => {
    const stub = vi.fn();
    setTrack(stub);

    track('order_placed', { ...VALID_ORDER_PLACED, promo_code: 'not_a_real_code' });

    expect(stub).not.toHaveBeenCalled();
  });

  it('is a genuine no-op by default — calling track before any setTrack does not throw', () => {
    expect(() => track('home_viewed', { city: 'sf' })).not.toThrow();
  });
});
