// @vitest-environment node
//
// Proves 20261003000000_second_pass_readiness.sql (#273) against a real
// Postgres (ADR 0006), for docs/measurement/270-analytics-readiness-second-pass.md
// §4.2, §4.3 and §4.4 (AC1, tests S2 and S3). The strict-superset half is
// second-pass-superset*.migration.test.ts.
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
  for (const file of [
    '20260925000000_events.sql',
    '20260926000000_two_city_event_contract.sql',
    '20261001000000_analytics_readiness_event_contract.sql',
    '20261002000000_session_started_and_is_internal.sql',
    '20261003000000_second_pass_readiness.sql',
  ]) {
    await db.exec(sql(file));
  }
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

const CITIES = ['sf', 'hcmc', 'la'] as const;
const currencyOf = (city: string) => (city === 'hcmc' ? 'VND' : 'USD');
const flashAmount = (city: string) => (city === 'hcmc' ? 20000 : 300);
const orderAmount = (city: string) => (city === 'hcmc' ? 395000 : 1800);
const slugs = (n: number) => Array.from({ length: n }, (_, i) => `place-${i + 1}`);
const modes = (n: number, mode: 'free' | 'reduced' | 'mixed') =>
  Array.from({ length: n }, (_, i) => (mode === 'mixed' ? (i % 2 === 0 ? 'free' : 'reduced') : mode));

/** §4.2's 15-key shape, exactly as the client will send it. */
const orderPlaced15 = (city: (typeof CITIES)[number]) => ({
  amount_minor: orderAmount(city),
  applied_voucher_ids: [],
  city,
  currency: currencyOf(city),
  delivery_instructions: 'leave_at_door',
  drop_off_preset: 'home',
  item_count: 2,
  order_id: '11111111-2222-4333-8444-555555555555',
  restaurant_slug: 'pho-place',
  saved_amount_minor: 0,
  thanks_voucher_amount_minor: 0,
  utensils: false,
  vip_level: 'none',
  vip_saved_amount_minor: 0,
  wallet_paid: true,
});

/** §4.3's 5-key shape. */
const flash5 = (city: (typeof CITIES)[number], n: number, fee: 'free' | 'reduced' | 'mixed') => ({
  amount_minor: flashAmount(city),
  city,
  currency: currencyOf(city),
  fee_modes: modes(n, fee),
  restaurant_slugs: slugs(n),
});

describe('§4.2 the 15-key order_placed is accepted (S2)', () => {
  it.each(CITIES)('for city %s', async (city) => {
    await accepts('order_placed', orderPlaced15(city));
  });

  it('with a 60-character slug and with one vip level of each kind', async () => {
    await accepts('order_placed', { ...orderPlaced15('sf'), restaurant_slug: 'a'.repeat(60) });
    await accepts('order_placed', { ...orderPlaced15('la'), vip_level: 'gold' });
    await accepts('order_placed', { ...orderPlaced15('la'), vip_level: 'platinum' });
  });
});

describe('§4.3 the 5-key flash_sheet_shown is accepted (S2)', () => {
  it.each(CITIES.flatMap((city) => [5, 6].map((n) => [city, n] as const)))(
    'for city %s with %i slots, all free, all reduced and mixed',
    async (city, n) => {
      for (const fee of ['free', 'reduced', 'mixed'] as const) {
        await accepts('flash_sheet_shown', flash5(city, n, fee));
      }
    },
  );
});

describe('§4.4 refusals: order_placed (S3)', () => {
  it.each([
    ['an empty string', ''],
    ['61 characters', 'a'.repeat(61)],
    ['Pho_Place', 'Pho_Place'],
    ['a number', 7],
    ['null', null],
  ])('a 15-key order_placed whose restaurant_slug is %s', async (_label, value) => {
    await refuses('order_placed', { ...orderPlaced15('sf'), restaurant_slug: value });
  });

  it('a 10-key order_placed: the 9-key shape plus restaurant_slug', async () => {
    await refuses('order_placed', {
      amount_minor: 1800,
      applied_voucher_ids: [],
      currency: 'USD',
      delivery_instructions: 'leave_at_door',
      drop_off_preset: 'home',
      item_count: 2,
      order_id: '11111111-2222-4333-8444-555555555555',
      restaurant_slug: 'pho-place',
      saved_amount_minor: 0,
      utensils: false,
    });
  });

  it('a 16-key order_placed: the 15-key shape plus extra', async () => {
    await refuses('order_placed', { ...orderPlaced15('sf'), extra: 1 });
  });

  it('a 15-key order_placed whose shared fields break the 14-key rules', async () => {
    await refuses('order_placed', { ...orderPlaced15('sf'), city: 'nyc' });
    await refuses('order_placed', { ...orderPlaced15('sf'), amount_minor: 0 });
    await refuses('order_placed', { ...orderPlaced15('sf'), vip_level: 'diamond' });
  });
});

describe('§4.4 refusals: flash_sheet_shown (S3)', () => {
  it('a 5-key flash_sheet_shown with 2 slugs', async () => {
    await refuses('flash_sheet_shown', flash5('sf', 2, 'free'));
  });

  it('a 5-key flash_sheet_shown with 6 slugs and 5 fee_modes', async () => {
    await refuses('flash_sheet_shown', { ...flash5('sf', 6, 'free'), fee_modes: modes(5, 'free') });
  });

  it('a 5-key flash_sheet_shown with 5 slugs and 6 fee_modes', async () => {
    await refuses('flash_sheet_shown', { ...flash5('sf', 5, 'free'), fee_modes: modes(6, 'free') });
  });

  it.each([['half'], [true], [null], [1], ['Free']])(
    'a 5-key flash_sheet_shown with a fee_modes element %j',
    async (bad) => {
      const fee_modes: unknown[] = modes(5, 'free');
      fee_modes[2] = bad;
      await refuses('flash_sheet_shown', { ...flash5('sf', 5, 'free'), fee_modes });
    },
  );

  it('a 5-key flash_sheet_shown with duplicate slugs', async () => {
    const dup = slugs(5);
    dup[4] = dup[0];
    await refuses('flash_sheet_shown', { ...flash5('sf', 5, 'free'), restaurant_slugs: dup });
  });

  it('a 5-key flash_sheet_shown whose fee_modes is not an array', async () => {
    await refuses('flash_sheet_shown', { ...flash5('sf', 5, 'free'), fee_modes: 'free' });
    await refuses('flash_sheet_shown', { ...flash5('sf', 5, 'free'), fee_modes: { 0: 'free' } });
    await refuses('flash_sheet_shown', { ...flash5('sf', 5, 'free'), fee_modes: null });
  });

  it('a 5-key flash_sheet_shown whose restaurant_slugs is not an array', async () => {
    await refuses('flash_sheet_shown', { ...flash5('sf', 5, 'free'), restaurant_slugs: 'place-1' });
  });

  it('a 6-key flash_sheet_shown: the 5-key shape plus extra', async () => {
    await refuses('flash_sheet_shown', { ...flash5('sf', 5, 'free'), extra: 1 });
  });

  it('a 5-key flash_sheet_shown whose shared fields break the 4-key rules', async () => {
    await refuses('flash_sheet_shown', { ...flash5('sf', 5, 'free'), amount_minor: 601 });
    await refuses('flash_sheet_shown', { ...flash5('sf', 5, 'free'), city: 'nyc' });
  });
});

describe('§4.1 the old shapes are still accepted, and other events are untouched', () => {
  it('the 4-key flash_sheet_shown with 2, 5 and 6 slugs', async () => {
    for (const n of [2, 5, 6]) {
      await accepts('flash_sheet_shown', {
        amount_minor: 300,
        city: 'sf',
        currency: 'USD',
        restaurant_slugs: slugs(n),
      });
    }
  });

  it('the 14-key order_placed', async () => {
    const fourteen: Record<string, unknown> = orderPlaced15('la');
    delete fourteen.restaurant_slug;
    await accepts('order_placed', fourteen);
  });

  it('the wrapper decides nothing else: home_viewed and an unknown name', async () => {
    await accepts('home_viewed', { city: 'sf' });
    await refuses('home_viewed', { city: 'nyc' });
    await refuses('not_an_event', {});
  });
});
