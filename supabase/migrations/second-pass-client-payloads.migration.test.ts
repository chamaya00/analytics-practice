// #275, contract #270 §4.2, §4.3 and criterion B1: the objects the client
// sends for the two new shapes go through the real sender, are inserted as
// `anon` with `seq` and `build`, and the store (every migration through
// #273's) keeps them. Also: the client refuses the old shapes the store
// still accepts (C3), so it never sends one.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeEventStore, EVENT_STORE_BOOT_TIMEOUT_MS, openEventStore, rowTheClientSends, storeWhatTheClientSends } from '../../test-support/event-store';
import { isValidEventProps, type EventProps } from '../../src/lib/tracking';

const ORDER_PLACED = {
  order_id: '11111111-2222-4333-8444-555555555555',
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

const SLUGS = ['a-one', 'b-two', 'c-three', 'd-four', 'e-five', 'f-six'];

function flash(fee_modes: string[], restaurant_slugs = SLUGS): EventProps {
  return { city: 'sf', amount_minor: 400, currency: 'USD', restaurant_slugs, fee_modes };
}

beforeAll(openEventStore, EVENT_STORE_BOOT_TIMEOUT_MS);
afterAll(closeEventStore);

describe('the store keeps what the client sends (§4.2, §4.3)', () => {
  it('order_placed: the 15-key object', async () => {
    expect(Object.keys(ORDER_PLACED)).toHaveLength(15);
    await expect(storeWhatTheClientSends('order_placed', ORDER_PLACED)).resolves.toEqual(ORDER_PLACED);
  });

  it('flash_sheet_shown: 6 slugs with mixed, all-free and all-reduced fee modes', async () => {
    for (const modes of [
      ['free', 'reduced', 'free', 'free', 'reduced', 'reduced'],
      SLUGS.map(() => 'free'),
      SLUGS.map(() => 'reduced'),
    ]) {
      const props = flash(modes);
      await expect(storeWhatTheClientSends('flash_sheet_shown', props)).resolves.toEqual(props);
    }
  });

  it('flash_sheet_shown: 5 slugs', async () => {
    const props = flash(['free', 'reduced', 'free', 'free', 'reduced'], SLUGS.slice(0, 5));
    await expect(storeWhatTheClientSends('flash_sheet_shown', props)).resolves.toEqual(props);
  });

  it('the row the sender builds carries a numeric-or-null seq and a build that is a 40-hex SHA or (unknown), never null', () => {
    const row = rowTheClientSends('order_placed', ORDER_PLACED)!;
    expect(row.build).toMatch(/^([0-9a-f]{40}|\(unknown\))$/);
    expect(row.seq).toBeNull();
  });
});

describe('the client never sends an old shape (C3)', () => {
  it('refuses the 14-key order_placed', () => {
    const fourteen = Object.fromEntries(Object.entries(ORDER_PLACED).filter(([key]) => key !== 'restaurant_slug'));
    expect(isValidEventProps('order_placed', fourteen)).toBe(false);
    expect(rowTheClientSends('order_placed', fourteen)).toBeNull();
  });

  it('refuses the 4-key flash_sheet_shown', () => {
    const four = Object.fromEntries(Object.entries(flash([])).filter(([key]) => key !== 'fee_modes')) as EventProps;
    expect(isValidEventProps('flash_sheet_shown', four)).toBe(false);
    expect(rowTheClientSends('flash_sheet_shown', four)).toBeNull();
  });

  it('refuses a 5-key flash_sheet_shown with mismatched lengths, or a fee_modes value half', () => {
    expect(isValidEventProps('flash_sheet_shown', flash(['free', 'free']))).toBe(false);
    expect(isValidEventProps('flash_sheet_shown', flash(['free', 'free', 'free', 'free', 'free', 'free', 'free']))).toBe(false);
    expect(isValidEventProps('flash_sheet_shown', flash(['free', 'free', 'free', 'free', 'free', 'half']))).toBe(false);
  });
});
