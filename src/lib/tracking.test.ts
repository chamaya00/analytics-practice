import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidEventProps, resetTrack, setTrack, track } from './tracking';

const ORDER_ID = '11111111-2222-4333-8444-555555555555';

const VALID_ORDER_PLACED = {
  order_id: ORDER_ID,
  item_count: 2,
  amount_minor: 1800,
  currency: 'USD',
  drop_off_preset: 'home',
  delivery_instructions: 'hand_to_me',
  utensils: true,
  applied_voucher_ids: [],
  saved_amount_minor: 0,
};

afterEach(() => {
  resetTrack();
});

describe('isValidEventProps (AC3)', () => {
  it('accepts a well-shaped no-voucher order_placed', () => {
    expect(isValidEventProps('order_placed', VALID_ORDER_PLACED)).toBe(true);
  });

  it('rejects an order_placed with an unknown drop_off_preset value', () => {
    expect(isValidEventProps('order_placed', { ...VALID_ORDER_PLACED, drop_off_preset: 'not_a_real_preset' })).toBe(
      false,
    );
  });

  it('rejects an order_placed with an unknown applied_voucher_ids entry', () => {
    expect(
      isValidEventProps('order_placed', { ...VALID_ORDER_PLACED, applied_voucher_ids: ['not_a_real_code'] }),
    ).toBe(false);
  });

  it('rejects an order_placed missing drop_off_preset entirely', () => {
    const withoutField = Object.fromEntries(
      Object.entries(VALID_ORDER_PLACED).filter(([key]) => key !== 'drop_off_preset'),
    );
    expect(isValidEventProps('order_placed', withoutField)).toBe(false);
  });

  it('does not itself enforce the saved-amount/voucher cross-field invariant — ADR 0007 leaves that to #89 to prove client-side, same as the store', () => {
    expect(isValidEventProps('order_placed', { ...VALID_ORDER_PLACED, saved_amount_minor: 500 })).toBe(true);
  });

  it('accepts every event name in the contract with a minimal valid payload', () => {
    expect(isValidEventProps('location_selected', { city: 'sf', is_switch: false })).toBe(true);
    expect(isValidEventProps('home_viewed', { city: 'hcmc' })).toBe(true);
    expect(isValidEventProps('restaurant_opened', { city: 'sf', restaurant_slug: 'north-beach-pizzeria' })).toBe(
      true,
    );
    expect(isValidEventProps('cart_viewed', { item_count: 0, amount_minor: 0, currency: 'USD' })).toBe(true);
    expect(isValidEventProps('checkout_viewed', { item_count: 1, amount_minor: 100, currency: 'USD' })).toBe(true);
    expect(
      isValidEventProps('tracker_viewed', { order_id: ORDER_ID, minutes_since_order: 0, view_number: 1 }),
    ).toBe(true);
    expect(
      isValidEventProps('order_abandoned', { order_id: ORDER_ID, minutes_since_order: 12, view_count: 3 }),
    ).toBe(true);
  });

  it('rejects checkout_viewed with a zero item_count (checkout is only reachable from a populated cart)', () => {
    expect(isValidEventProps('checkout_viewed', { item_count: 0, amount_minor: 500, currency: 'USD' })).toBe(false);
  });

  it('accepts a VND cart_viewed and checkout_viewed within the currency’s own bound', () => {
    expect(isValidEventProps('cart_viewed', { item_count: 3, amount_minor: 250000, currency: 'VND' })).toBe(true);
    expect(isValidEventProps('checkout_viewed', { item_count: 3, amount_minor: 250000, currency: 'VND' })).toBe(
      true,
    );
  });

  it('rejects an amount_minor over the currency’s own bound', () => {
    expect(isValidEventProps('cart_viewed', { item_count: 1, amount_minor: 100001, currency: 'USD' })).toBe(false);
    expect(isValidEventProps('cart_viewed', { item_count: 1, amount_minor: 5000001, currency: 'VND' })).toBe(false);
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

    track('order_placed', { ...VALID_ORDER_PLACED, drop_off_preset: 'not_a_real_preset' });

    expect(stub).not.toHaveBeenCalled();
  });

  it('is a genuine no-op by default — calling track before any setTrack does not throw', () => {
    expect(() => track('home_viewed', { city: 'sf' })).not.toThrow();
  });
});
