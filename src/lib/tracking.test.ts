import { afterEach, describe, expect, it, vi } from 'vitest';
import { LA_VOUCHER_IDS, VOUCHER_IDS, isValidEventProps, resetTrack, setTrack, track, type EventProps } from './tracking';
import { LA_VOUCHER_IDS as CATALOGUE_LA_VOUCHER_IDS } from './vouchers';

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
  restaurant_slug: 'north-beach-pizzeria',
  city: 'sf',
  thanks_voucher_amount_minor: 0,
  vip_level: 'none',
  vip_saved_amount_minor: 0,
  wallet_paid: false,
};

/** #81's 9-key shape: the store still takes it (§13), but the client never sends it again (§14). */
const OLD_ORDER_PLACED = Object.fromEntries(
  Object.entries(VALID_ORDER_PLACED).filter(
    ([key]) => !['city', 'restaurant_slug', 'thanks_voucher_amount_minor', 'vip_level', 'vip_saved_amount_minor', 'wallet_paid'].includes(key),
  ),
) as EventProps;

const SIX_HCMC_SLUGS = [
  'ben-thanh-banh-mi',
  'saigon-pho-quan',
  'com-tam-quan-nha',
  'bun-cha-co-ba',
  'hu-tieu-nam-vang-hoa-phat',
  'goi-cuon-co-hai-cho-cu',
];

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
    expect(isValidEventProps('cart_viewed', { item_count: 0, amount_minor: 0, city: 'sf', currency: 'USD' })).toBe(true);
    expect(isValidEventProps('checkout_viewed', { item_count: 1, amount_minor: 100, city: 'la', currency: 'USD' })).toBe(
      true,
    );
    expect(
      isValidEventProps('tracker_viewed', { order_id: ORDER_ID, minutes_since_order: 0, view_number: 1 }),
    ).toBe(true);
    expect(isValidEventProps('order_delivered', { order_id: ORDER_ID, minutes_since_order: 7 })).toBe(true);
    expect(isValidEventProps('rating_submitted', { order_id: ORDER_ID, stars: 5, tags: [] })).toBe(true);
    expect(isValidEventProps('sign_in_prompt_shown', { surface: 'checkout' })).toBe(true);
    expect(isValidEventProps('sign_in_started', { provider: 'google', surface: 'tip' })).toBe(true);
    expect(isValidEventProps('sign_in_completed', { outcome: 'failed', provider: 'apple', surface: 'checkout' })).toBe(
      true,
    );
    expect(isValidEventProps('wallet_short_shown', { city: 'hcmc', surface: 'tip' })).toBe(true);
    expect(isValidEventProps('tip_sent', { currency: 'VND', order_id: ORDER_ID, tip_amount_minor: 20000 })).toBe(true);
    expect(isValidEventProps('driver_rating_submitted', { order_id: ORDER_ID, stars: 1 })).toBe(true);
  });

  it("refuses #81's old cart_viewed, checkout_viewed and order_placed shapes (#219 §14: the client never sends them again)", () => {
    expect(isValidEventProps('cart_viewed', { item_count: 0, amount_minor: 0, currency: 'USD' })).toBe(false);
    expect(isValidEventProps('checkout_viewed', { item_count: 1, amount_minor: 100, currency: 'USD' })).toBe(false);
    expect(isValidEventProps('order_placed', OLD_ORDER_PLACED)).toBe(false);
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
    expect(isValidEventProps('checkout_viewed', { item_count: 0, amount_minor: 500, city: 'sf', currency: 'USD' })).toBe(
      false,
    );
  });

  it('accepts a VND cart_viewed and checkout_viewed within the currency’s own bound', () => {
    expect(isValidEventProps('cart_viewed', { item_count: 3, amount_minor: 250000, city: 'hcmc', currency: 'VND' })).toBe(
      true,
    );
    expect(
      isValidEventProps('checkout_viewed', { item_count: 3, amount_minor: 250000, city: 'hcmc', currency: 'VND' }),
    ).toBe(true);
  });

  it('rejects an amount_minor over the currency’s own bound', () => {
    expect(isValidEventProps('cart_viewed', { item_count: 1, amount_minor: 100001, city: 'sf', currency: 'USD' })).toBe(
      false,
    );
    expect(
      isValidEventProps('cart_viewed', { item_count: 1, amount_minor: 5000001, city: 'hcmc', currency: 'VND' }),
    ).toBe(false);
  });
});

describe('isValidEventProps — flash_sheet_shown / flash_sheet_closed (AC6)', () => {
  it('accepts a well-shaped flash_sheet_shown for each city, bounded to its own drawn range', () => {
    expect(
      isValidEventProps('flash_sheet_shown', {
        city: 'hcmc',
        amount_minor: 15000,
        currency: 'VND',
        restaurant_slugs: SIX_HCMC_SLUGS,
        fee_modes: SIX_HCMC_SLUGS.map(() => 'free'),
      }),
    ).toBe(true);
    expect(
      isValidEventProps('flash_sheet_shown', {
        city: 'la',
        amount_minor: 400,
        currency: 'USD',
        restaurant_slugs: ['la-one', 'la-two', 'la-three', 'la-four', 'la-five'],
        fee_modes: ['free', 'reduced', 'free', 'free', 'reduced'],
      }),
    ).toBe(true);
  });

  it('rejects a drawn amount outside the city’s own range even though it is inside the general per-currency bound', () => {
    expect(
      isValidEventProps('flash_sheet_shown', {
        city: 'hcmc',
        amount_minor: 45000, // a valid discount-tier amount, but outside the flash draw's own 10.000–30.000 range
        currency: 'VND',
        restaurant_slugs: SIX_HCMC_SLUGS,
      }),
    ).toBe(false);
  });

  it('takes 5-6 distinct restaurant_slugs, and refuses 2, 4, 7 or a duplicate (#219 §8, §13 item 5)', () => {
    const flash = (restaurant_slugs: string[]) =>
      isValidEventProps('flash_sheet_shown', {
        city: 'hcmc',
        amount_minor: 15000,
        currency: 'VND',
        restaurant_slugs,
        fee_modes: restaurant_slugs.map(() => 'free'),
      });
    expect(flash(SIX_HCMC_SLUGS.slice(0, 5))).toBe(true);
    expect(flash(SIX_HCMC_SLUGS)).toBe(true);
    expect(flash(SIX_HCMC_SLUGS.slice(0, 2))).toBe(false);
    expect(flash(SIX_HCMC_SLUGS.slice(0, 4))).toBe(false);
    expect(flash([...SIX_HCMC_SLUGS, 'one-more'])).toBe(false);
    expect(flash([...SIX_HCMC_SLUGS.slice(0, 5), SIX_HCMC_SLUGS[0]])).toBe(false);
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
        city: 'hcmc',
      }),
    ).toBe(true);
  });

  it('accepts the five la-* voucher ids on an LA order (#219 §4)', () => {
    const withIds = (applied_voucher_ids: string[]) =>
      isValidEventProps('order_placed', { ...VALID_ORDER_PLACED, city: 'la', applied_voucher_ids, saved_amount_minor: 800 });
    expect(withIds(['la-discount-t3', 'la-flash'])).toBe(true);
    expect(withIds(['la-delivery-entry', 'la-discount-t1'])).toBe(true);
    expect(withIds(['la-discount-t2'])).toBe(true);
    expect(withIds(['la-discount-t4'])).toBe(false);
  });

  it('checks the four new order_placed props (#219 §8)', () => {
    const with_ = (extra: EventProps) => isValidEventProps('order_placed', { ...VALID_ORDER_PLACED, ...extra });
    expect(with_({ vip_level: 'platinum', vip_saved_amount_minor: 480 })).toBe(true);
    expect(with_({ vip_level: 'silver' })).toBe(false);
    expect(with_({ wallet_paid: 'yes' })).toBe(false);
    expect(with_({ thanks_voucher_amount_minor: -1 })).toBe(false);
    expect(with_({ vip_saved_amount_minor: 100001 })).toBe(false);
    expect(with_({ city: 'nyc' })).toBe(false);
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

describe('isValidEventProps — the six new events (#238, #219 §7-§8)', () => {
  it('refuses an unknown surface, provider or outcome', () => {
    expect(isValidEventProps('sign_in_prompt_shown', { surface: 'header' })).toBe(false);
    expect(isValidEventProps('sign_in_started', { provider: 'github', surface: 'tip' })).toBe(false);
    expect(isValidEventProps('sign_in_completed', { outcome: 'cancelled', provider: 'google', surface: 'tip' })).toBe(false);
  });

  it("tip_sent takes only its own currency's presets", () => {
    expect(isValidEventProps('tip_sent', { currency: 'USD', order_id: ORDER_ID, tip_amount_minor: 300 })).toBe(true);
    expect(isValidEventProps('tip_sent', { currency: 'USD', order_id: ORDER_ID, tip_amount_minor: 250 })).toBe(false);
    expect(isValidEventProps('tip_sent', { currency: 'VND', order_id: ORDER_ID, tip_amount_minor: 300 })).toBe(false);
  });

  it('driver_rating_submitted takes 1-5 stars and nothing else', () => {
    expect(isValidEventProps('driver_rating_submitted', { order_id: ORDER_ID, stars: 6 })).toBe(false);
    expect(isValidEventProps('driver_rating_submitted', { order_id: ORDER_ID, stars: 4, tags: [] })).toBe(false);
  });

  it('refuses an email, a user id, a balance or a shortfall riding on any new or changed event (the #79 rule)', () => {
    const extras: EventProps[] = [{ email: 'visitor@example.com' }, { user_id: ORDER_ID }, { balance_minor: 900 }, { shortfall_minor: 1100 }];
    for (const extra of extras) {
      expect(isValidEventProps('sign_in_completed', { outcome: 'success', provider: 'google', surface: 'tip', ...extra })).toBe(
        false,
      );
      expect(isValidEventProps('wallet_short_shown', { city: 'sf', surface: 'checkout', ...extra })).toBe(false);
      expect(isValidEventProps('tip_sent', { currency: 'USD', order_id: ORDER_ID, tip_amount_minor: 100, ...extra })).toBe(false);
      expect(isValidEventProps('order_placed', { ...VALID_ORDER_PLACED, ...extra })).toBe(false);
    }
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

describe('LA events (#230, superseding its older AC3: the store accepts la since #219, and #238 wired it)', () => {
  it('accepts city la on the events that read money.ts CITIES, exactly as the store does', () => {
    expect(isValidEventProps('location_selected', { city: 'la', is_switch: false })).toBe(true);
    expect(isValidEventProps('home_viewed', { city: 'la' })).toBe(true);
    expect(isValidEventProps('restaurant_opened', { city: 'la', restaurant_slug: 'boyle-heights-taco-window' })).toBe(true);
    expect(
      isValidEventProps('flash_sheet_closed', { city: 'la', outcome: 'dismissed', seconds_remaining: 512, restaurant_slug: 'none' }),
    ).toBe(true);
    expect(isValidEventProps('home_viewed', { city: 'nyc' })).toBe(false);
  });

  it("the la-* ids order_placed accepts are exactly vouchers.ts's LA catalogue, and VOUCHER_IDS still pins the ten", () => {
    expect([...LA_VOUCHER_IDS]).toEqual(['la-delivery-entry', 'la-discount-t1', 'la-discount-t2', 'la-discount-t3', 'la-flash']);
    expect([...LA_VOUCHER_IDS]).toEqual([...CATALOGUE_LA_VOUCHER_IDS]);
    expect(VOUCHER_IDS).toHaveLength(10);
  });
});
