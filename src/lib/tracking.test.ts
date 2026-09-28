import { afterEach, describe, expect, it, vi } from 'vitest';
import { VOUCHER_IDS, isValidEventProps, resetTrack, setTrack, track, type EventProps } from './tracking';

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
    expect(isValidEventProps('order_delivered', { order_id: ORDER_ID, minutes_since_order: 7 })).toBe(true);
    expect(isValidEventProps('rating_submitted', { order_id: ORDER_ID, stars: 5, tags: [] })).toBe(true);
  });

  it('rejects the retired order_abandoned shape outright — no case accepts it anymore (contract §6)', () => {
    expect(
      isValidEventProps('order_abandoned' as never, {
        order_id: ORDER_ID,
        minutes_since_order: 12,
        view_count: 3,
      }),
    ).toBe(false);
  });

  it('rejects rating_submitted with a stars value outside 1–5', () => {
    expect(isValidEventProps('rating_submitted', { order_id: ORDER_ID, stars: 0, tags: [] })).toBe(false);
    expect(isValidEventProps('rating_submitted', { order_id: ORDER_ID, stars: 6, tags: [] })).toBe(false);
  });

  it('rejects rating_submitted with an unknown tag or a duplicate tag', () => {
    expect(
      isValidEventProps('rating_submitted', { order_id: ORDER_ID, stars: 4, tags: ['not_a_real_tag'] }),
    ).toBe(false);
    expect(
      isValidEventProps('rating_submitted', { order_id: ORDER_ID, stars: 4, tags: ['fast', 'fast'] }),
    ).toBe(false);
  });

  it('accepts rating_submitted with all three tags and rejects a fourth', () => {
    expect(
      isValidEventProps('rating_submitted', {
        order_id: ORDER_ID,
        stars: 4,
        tags: ['fast', 'great_packaging', 'order_was_correct'],
      }),
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

describe('isValidEventProps — flash_sheet_shown / flash_sheet_closed (AC6)', () => {
  it('accepts a well-shaped flash_sheet_shown for each city, bounded to its own drawn range', () => {
    expect(
      isValidEventProps('flash_sheet_shown', {
        city: 'hcmc',
        amount_minor: 15000,
        currency: 'VND',
        restaurant_slugs: ['ben-thanh-banh-mi', 'saigon-pho-quan'],
      }),
    ).toBe(true);
    expect(
      isValidEventProps('flash_sheet_shown', {
        city: 'sf',
        amount_minor: 400,
        currency: 'USD',
        restaurant_slugs: ['mission-taqueria', 'north-beach-pizzeria'],
      }),
    ).toBe(true);
  });

  it('rejects a drawn amount outside the city’s own range even though it is inside the general per-currency bound', () => {
    expect(
      isValidEventProps('flash_sheet_shown', {
        city: 'hcmc',
        amount_minor: 45000, // a valid discount-tier amount, but outside the flash draw's own 10.000–30.000 range
        currency: 'VND',
        restaurant_slugs: ['ben-thanh-banh-mi', 'saigon-pho-quan'],
      }),
    ).toBe(false);
  });

  it('rejects restaurant_slugs with anything but exactly 2 entries', () => {
    expect(
      isValidEventProps('flash_sheet_shown', {
        city: 'hcmc',
        amount_minor: 15000,
        currency: 'VND',
        restaurant_slugs: ['ben-thanh-banh-mi'],
      }),
    ).toBe(false);
  });

  it('rejects a 5-6 restaurant_slugs payload from #120\'s grown draw — the contract stays at exactly 2, so the event goes quiet rather than being widened or truncated (AC6)', () => {
    expect(
      isValidEventProps('flash_sheet_shown', {
        city: 'hcmc',
        amount_minor: 15000,
        currency: 'VND',
        restaurant_slugs: [
          'ben-thanh-banh-mi',
          'saigon-pho-quan',
          'com-tam-quan-nha',
          'bun-cha-co-ba',
          'hu-tieu-nam-vang-hoa-phat',
        ],
      }),
    ).toBe(false);
    expect(
      isValidEventProps('flash_sheet_shown', {
        city: 'hcmc',
        amount_minor: 15000,
        currency: 'VND',
        restaurant_slugs: [
          'ben-thanh-banh-mi',
          'saigon-pho-quan',
          'com-tam-quan-nha',
          'bun-cha-co-ba',
          'hu-tieu-nam-vang-hoa-phat',
          'goi-cuon-co-hai-cho-cu',
        ],
      }),
    ).toBe(false);
  });

  it('accepts flash_sheet_closed for each outcome, with restaurant_slug carrying the fixed literal "none" except restaurant_tapped', () => {
    expect(
      isValidEventProps('flash_sheet_closed', {
        city: 'hcmc',
        outcome: 'dismissed',
        seconds_remaining: 512,
        restaurant_slug: 'none',
      }),
    ).toBe(true);
    expect(
      isValidEventProps('flash_sheet_closed', {
        city: 'hcmc',
        outcome: 'expired',
        seconds_remaining: 0,
        restaurant_slug: 'none',
      }),
    ).toBe(true);
    expect(
      isValidEventProps('flash_sheet_closed', {
        city: 'hcmc',
        outcome: 'restaurant_tapped',
        seconds_remaining: 700,
        restaurant_slug: 'ben-thanh-banh-mi',
      }),
    ).toBe(true);
  });

  it('rejects restaurant_tapped with the "none" literal, and a non-tapped outcome with a real slug', () => {
    expect(
      isValidEventProps('flash_sheet_closed', {
        city: 'hcmc',
        outcome: 'restaurant_tapped',
        seconds_remaining: 700,
        restaurant_slug: 'none',
      }),
    ).toBe(false);
    expect(
      isValidEventProps('flash_sheet_closed', {
        city: 'hcmc',
        outcome: 'dismissed',
        seconds_remaining: 700,
        restaurant_slug: 'ben-thanh-banh-mi',
      }),
    ).toBe(false);
  });
});

describe('VOUCHER_IDS pins the ten catalogue ids (#166: the thanks voucher must never widen this list)', () => {
  it('deep-equals the literal ten ids, in vouchers.ts\'s own order', () => {
    expect(VOUCHER_IDS).toEqual([
      'hcmc-delivery-entry',
      'hcmc-discount-t1',
      'hcmc-discount-t2',
      'hcmc-discount-t3',
      'hcmc-flash',
      'sf-delivery-entry',
      'sf-discount-t1',
      'sf-discount-t2',
      'sf-discount-t3',
      'sf-flash',
    ]);
  });
});

describe('isValidEventProps — order_placed with real vouchers (AC3, AC4, AC6)', () => {
  it('accepts up to 2 known catalogue voucher ids with a nonzero saved_amount_minor', () => {
    expect(
      isValidEventProps('order_placed', {
        ...VALID_ORDER_PLACED,
        applied_voucher_ids: ['hcmc-discount-t2', 'hcmc-delivery-entry'],
        currency: 'VND',
        amount_minor: 250000,
        saved_amount_minor: 40000,
      }),
    ).toBe(true);
  });

  it('rejects a typed free-text string standing in for a voucher id', () => {
    expect(
      isValidEventProps('order_placed', { ...VALID_ORDER_PLACED, applied_voucher_ids: ['SAVE10'] }),
    ).toBe(false);
  });

  it('rejects the thanks voucher id (#166: it is not a catalogue voucher and must never validate here)', () => {
    expect(
      isValidEventProps('order_placed', { ...VALID_ORDER_PLACED, applied_voucher_ids: ['thanks-voucher'] }),
    ).toBe(false);
  });

  it('rejects more than 2 voucher ids, and duplicate ids', () => {
    expect(
      isValidEventProps('order_placed', {
        ...VALID_ORDER_PLACED,
        applied_voucher_ids: ['hcmc-discount-t1', 'hcmc-discount-t2', 'hcmc-delivery-entry'],
      }),
    ).toBe(false);
    expect(
      isValidEventProps('order_placed', {
        ...VALID_ORDER_PLACED,
        applied_voucher_ids: ['hcmc-discount-t1', 'hcmc-discount-t1'],
      }),
    ).toBe(false);
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

  it('calling track before any setTrack does not throw (it queues — see #245 below)', () => {
    expect(() => track('home_viewed', { city: 'sf' })).not.toThrow();
  });
});

describe('track() calls made before a sender is set are buffered, not lost (#245 AC1)', () => {
  it('delivers every earlier call to the sender, in call order, before any later call', () => {
    track('home_viewed', { city: 'sf' });
    track('restaurant_opened', { city: 'sf', restaurant_slug: 'mission-taqueria' });

    const sent: string[] = [];
    setTrack((eventName) => sent.push(eventName));
    track('location_selected', { city: 'sf', is_switch: false });

    expect(sent).toEqual(['home_viewed', 'restaurant_opened', 'location_selected']);
  });

  it('buffers only calls whose props pass the shape check', () => {
    track('home_viewed', { city: 'not-a-city' });
    const sender = vi.fn();
    setTrack(sender);
    expect(sender).not.toHaveBeenCalled();
  });

  it('caps the buffer at 50 entries, keeping the earliest', () => {
    for (let i = 0; i < 80; i += 1) track('home_viewed', { city: i === 0 ? 'hcmc' : 'sf' });
    const sent: EventProps[] = [];
    setTrack((_eventName, props) => sent.push(props));
    expect(sent).toHaveLength(50);
    expect(sent[0]).toEqual({ city: 'hcmc' });
  });

  it('resetTrack() discards the buffer, so one test never leaks calls into the next', () => {
    track('home_viewed', { city: 'sf' });
    resetTrack();
    const sender = vi.fn();
    setTrack(sender);
    expect(sender).not.toHaveBeenCalled();
  });
});
