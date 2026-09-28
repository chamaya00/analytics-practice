// @vitest-environment node
//
// Proves 20261001000000_analytics_readiness_event_contract.sql (#224)
// against a real Postgres (ADR 0006), for docs/measurement/219-analytics-readiness-contract.md
// §8 and §13 items 1-6. The strict-superset half (old shapes still stored)
// is analytics-readiness-superset.migration.test.ts.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const sql = (file: string) =>
  readFileSync(path.join(process.cwd(), 'supabase/migrations', file), 'utf-8');

let db: PGlite;

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(sql('20260925000000_events.sql'));
  await db.exec(sql('20260926000000_two_city_event_contract.sql'));
  await db.exec(sql('20261001000000_analytics_readiness_event_contract.sql'));
  await db.exec('set role anon;');
});

afterAll(async () => {
  await db.close();
});

function insertEvent(eventName: string, props: unknown) {
  return db.query(
    `insert into public.events (id, visitor_id, session_id, event_name, occurred_at, props, variant)
     values ($1, $2, $3, $4, $5, $6, null)`,
    [randomUUID(), randomUUID(), randomUUID(), eventName, new Date().toISOString(), JSON.stringify(props)],
  );
}

const accepts = (eventName: string, props: unknown) =>
  expect(insertEvent(eventName, props)).resolves.toBeDefined();
const refuses = (eventName: string, props: unknown) =>
  expect(insertEvent(eventName, props)).rejects.toThrow();

const slugs = (n: number) => Array.from({ length: n }, (_, i) => `place-${i + 1}`);
const CITIES = ['sf', 'hcmc', 'la'] as const;
const currencyOf = (city: string) => (city === 'hcmc' ? 'VND' : 'USD');
const flashAmount = (city: string) => (city === 'hcmc' ? 20000 : 300);

const ORDER_PLACED_14 = {
  amount_minor: 1800,
  applied_voucher_ids: ['la-discount-t1'],
  city: 'la',
  currency: 'USD',
  delivery_instructions: 'leave_at_door',
  drop_off_preset: 'home',
  item_count: 2,
  order_id: '11111111-2222-4333-8444-555555555555',
  saved_amount_minor: 200,
  thanks_voucher_amount_minor: 0,
  utensils: false,
  vip_level: 'none',
  vip_saved_amount_minor: 0,
  wallet_paid: true,
};

// One valid props object per new event, exactly as §8 specifies.
const NEW_EVENTS: Record<string, Record<string, unknown>> = {
  driver_rating_submitted: { order_id: randomUUID(), stars: 4 },
  tip_sent: { currency: 'USD', order_id: randomUUID(), tip_amount_minor: 200 },
  sign_in_prompt_shown: { surface: 'checkout' },
  sign_in_started: { provider: 'google', surface: 'tip' },
  sign_in_completed: { outcome: 'success', provider: 'apple', surface: 'checkout' },
  wallet_short_shown: { city: 'la', surface: 'tip' },
};

describe('new shapes are accepted (AC2)', () => {
  it('cart_viewed and checkout_viewed in the 4-key shape with city', async () => {
    await accepts('cart_viewed', { amount_minor: 0, city: 'sf', currency: 'USD', item_count: 0 });
    await accepts('checkout_viewed', { amount_minor: 350000, city: 'hcmc', currency: 'VND', item_count: 3 });
  });

  it('order_placed in the 14-key shape', async () => {
    await accepts('order_placed', ORDER_PLACED_14);
    await accepts('order_placed', {
      ...ORDER_PLACED_14,
      city: 'hcmc',
      currency: 'VND',
      amount_minor: 395000,
      vip_level: 'platinum',
      vip_saved_amount_minor: 15000,
      thanks_voucher_amount_minor: 20000,
      applied_voucher_ids: [],
      saved_amount_minor: 0,
    });
  });

  it.each([5, 6])('flash_sheet_shown with %i distinct slugs', async (n) => {
    await accepts('flash_sheet_shown', {
      amount_minor: 300,
      city: 'sf',
      currency: 'USD',
      restaurant_slugs: slugs(n),
    });
  });

  it.each(CITIES)('every city-carrying event accepts city = %s', async (city) => {
    const currency = currencyOf(city);
    await accepts('location_selected', { city, is_switch: false });
    await accepts('home_viewed', { city });
    await accepts('restaurant_opened', { city, restaurant_slug: 'pho-place' });
    await accepts('cart_viewed', { amount_minor: 100, city, currency, item_count: 1 });
    await accepts('checkout_viewed', { amount_minor: 100, city, currency, item_count: 1 });
    await accepts('flash_sheet_shown', {
      amount_minor: flashAmount(city),
      city,
      currency,
      restaurant_slugs: slugs(5),
    });
    await accepts('flash_sheet_closed', { city, outcome: 'dismissed', restaurant_slug: 'none', seconds_remaining: 9 });
    await accepts('order_placed', { ...ORDER_PLACED_14, city, currency });
    await accepts('wallet_short_shown', { city, surface: 'checkout' });
  });

  it.each(['la-delivery-entry', 'la-discount-t1', 'la-discount-t2', 'la-discount-t3', 'la-flash'])(
    'order_placed carrying %s (14-key and 9-key)',
    async (id) => {
      await accepts('order_placed', { ...ORDER_PLACED_14, applied_voucher_ids: [id] });
      await accepts('order_placed', {
        amount_minor: ORDER_PLACED_14.amount_minor,
        applied_voucher_ids: [id],
        currency: ORDER_PLACED_14.currency,
        delivery_instructions: ORDER_PLACED_14.delivery_instructions,
        drop_off_preset: ORDER_PLACED_14.drop_off_preset,
        item_count: ORDER_PLACED_14.item_count,
        order_id: ORDER_PLACED_14.order_id,
        saved_amount_minor: ORDER_PLACED_14.saved_amount_minor,
        utensils: ORDER_PLACED_14.utensils,
      });
    },
  );

  it.each(Object.keys(NEW_EVENTS))('%s exactly as §8 specifies', async (name) => {
    await accepts(name, NEW_EVENTS[name]);
  });

  it.each([
    ['tip_sent', { currency: 'USD', order_id: randomUUID(), tip_amount_minor: 100 }],
    ['tip_sent', { currency: 'USD', order_id: randomUUID(), tip_amount_minor: 300 }],
    ['tip_sent', { currency: 'VND', order_id: randomUUID(), tip_amount_minor: 10000 }],
    ['tip_sent', { currency: 'VND', order_id: randomUUID(), tip_amount_minor: 30000 }],
    ['sign_in_completed', { outcome: 'failed', provider: 'google', surface: 'tip' }],
    ['sign_in_prompt_shown', { surface: 'tip' }],
  ])('%s enum values are accepted', async (name, props) => {
    await accepts(name, props);
  });
});

describe('bad shapes are refused (AC2)', () => {
  it('flash_sheet_shown with 5 slugs including a duplicate', async () => {
    await refuses('flash_sheet_shown', {
      amount_minor: 300,
      city: 'sf',
      currency: 'USD',
      restaurant_slugs: ['a-1', 'b-2', 'c-3', 'd-4', 'a-1'],
    });
  });

  it.each([4, 7, 3, 1, 0])('flash_sheet_shown with %i slugs', async (n) => {
    await refuses('flash_sheet_shown', {
      amount_minor: 300,
      city: 'sf',
      currency: 'USD',
      restaurant_slugs: slugs(n),
    });
  });

  it('tip_sent with tip_amount_minor = 150, or a preset from the other currency', async () => {
    await refuses('tip_sent', { currency: 'USD', order_id: randomUUID(), tip_amount_minor: 150 });
    await refuses('tip_sent', { currency: 'USD', order_id: randomUUID(), tip_amount_minor: 10000 });
    await refuses('tip_sent', { currency: 'VND', order_id: randomUUID(), tip_amount_minor: 200 });
  });

  it("sign_in_completed with outcome = 'cancelled'", async () => {
    await refuses('sign_in_completed', { outcome: 'cancelled', provider: 'google', surface: 'checkout' });
  });

  it.each(Object.keys(NEW_EVENTS))('%s with one extra key', async (name) => {
    await refuses(name, { ...NEW_EVENTS[name], extra: 'x' });
  });

  it('the changed events with one extra key, or a missing key', async () => {
    await refuses('cart_viewed', { amount_minor: 0, city: 'sf', currency: 'USD', item_count: 0, extra: 1 });
    await refuses('checkout_viewed', { amount_minor: 100, city: 'sf', currency: 'USD', item_count: 1, extra: 1 });
    await refuses('order_placed', { ...ORDER_PLACED_14, extra: 1 });
    await refuses('order_placed', { ...ORDER_PLACED_14, wallet_paid: undefined });
    await refuses('flash_sheet_shown', {
      amount_minor: 300,
      city: 'sf',
      currency: 'USD',
      restaurant_slugs: slugs(5),
      extra: 1,
    });
  });

  it('a new-shape order_placed with a bad vip_level or an out-of-bounds thanks amount', async () => {
    await refuses('order_placed', { ...ORDER_PLACED_14, vip_level: 'silver' });
    await refuses('order_placed', { ...ORDER_PLACED_14, thanks_voucher_amount_minor: 100001 });
  });

  it('a city outside sf/hcmc/la, and session_started (not yet in the store)', async () => {
    await refuses('home_viewed', { city: 'nyc' });
    await refuses('session_started', {
      referrer_host: '(none)',
      utm_campaign: '(none)',
      utm_medium: '(none)',
      utm_source: '(none)',
    });
  });

  it('does not check currency against city (ADR 0007: cross-field invariants are client tests)', async () => {
    await accepts('cart_viewed', { amount_minor: 100, city: 'hcmc', currency: 'USD', item_count: 1 });
  });
});
