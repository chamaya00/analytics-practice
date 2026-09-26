// @vitest-environment node
//
// Proves 20260926000000_two_city_event_contract.sql (#85) against a real
// Postgres — see events.migration.test.ts and ADR 0006 for why PGlite. That
// file stays scoped to 20260925000000_events.sql alone; this one is its
// sibling for the new migration, covering the revised event contract
// (docs/measurement/81-two-city-event-contract.md).
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const BASE_MIGRATION_SQL = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260925000000_events.sql'),
  'utf-8',
);
const NEW_MIGRATION_SQL = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260926000000_two_city_event_contract.sql'),
  'utf-8',
);

const VALID_ORDER_ID = '11111111-2222-4333-8444-555555555555';

const VALID_HCMC_ORDER_PLACED_PROPS = {
  order_id: VALID_ORDER_ID,
  item_count: 2,
  amount_minor: 395000,
  currency: 'VND',
  drop_off_preset: 'home',
  delivery_instructions: 'leave_at_door',
  utensils: true,
  // #87's own worked example: one discount voucher plus the delivery
  // voucher — ₫25.000 discount plus the ₫15.000 delivery fee waived. Two
  // discount-group vouchers (as in an earlier draft of this fixture) would
  // violate #87's stacking rules even though the store doesn't check stack
  // groups; this fixture is what #82 and #89 copy, so it should be real.
  applied_voucher_ids: ['hcmc-discount-t2', 'hcmc-delivery-entry'],
  saved_amount_minor: 40000,
};

const OLD_PARODY_ORDER_PLACED_PROPS = {
  order_id: VALID_ORDER_ID,
  item_count: 2,
  subtotal_cents: 1800,
  drop_off_spot: 'the_void',
  handling_instructions: 'guard_it',
  utensils: true,
  tip_percent: 10,
  promo_code: 'dont_drop10',
};

let db: PGlite;

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(BASE_MIGRATION_SQL);
  await db.exec(NEW_MIGRATION_SQL);
  await db.exec('set role anon;');
});

afterAll(async () => {
  await db.close();
});

function insertEvent(
  target: PGlite,
  overrides: { eventName: string; props?: unknown; occurredAt?: string },
) {
  const row = {
    id: randomUUID(),
    visitor_id: randomUUID(),
    session_id: randomUUID(),
    event_name: overrides.eventName,
    occurred_at: overrides.occurredAt ?? new Date().toISOString(),
    props: overrides.props ?? {},
  };
  return target.query(
    `insert into public.events (id, visitor_id, session_id, event_name, occurred_at, props, variant)
     values ($1, $2, $3, $4, $5, $6, null)`,
    [row.id, row.visitor_id, row.session_id, row.event_name, row.occurred_at, JSON.stringify(row.props)],
  );
}

describe('the migration applies cleanly (AC2)', () => {
  it('applies to a fresh database with no manual step', async () => {
    const fresh = new PGlite({ extensions: { pgcrypto } });
    await expect(fresh.exec(BASE_MIGRATION_SQL)).resolves.not.toThrow();
    await expect(fresh.exec(NEW_MIGRATION_SQL)).resolves.not.toThrow();
    await fresh.close();
  });

  it('applies on top of a database where 20260925000000_events.sql has already run and already holds a parody-shaped row, leaving that row untouched', async () => {
    const alreadyMigrated = new PGlite({ extensions: { pgcrypto } });
    await alreadyMigrated.exec(BASE_MIGRATION_SQL);
    await alreadyMigrated.exec('set role anon;');
    await insertEvent(alreadyMigrated, {
      eventName: 'landing_viewed',
      props: { has_active_order: false },
    });
    await alreadyMigrated.exec('reset role;');

    await expect(alreadyMigrated.exec(NEW_MIGRATION_SQL)).resolves.not.toThrow();

    const rows = await alreadyMigrated.query<{ event_name: string }>(
      'select event_name from public.events',
    );
    expect(rows.rows).toEqual([{ event_name: 'landing_viewed' }]);
    await alreadyMigrated.close();
  });
});

describe('the new event_is_valid accepts the two-city contract (AC1, AC3)', () => {
  it('accepts an HCMC order_placed with a VND amount, two distinct catalogue vouchers, and a positive saved amount', async () => {
    const result = await insertEvent(db, { eventName: 'order_placed', props: VALID_HCMC_ORDER_PLACED_PROPS });
    expect(result).toBeDefined();

    await db.exec('reset role;');
    const rows = await db.query(
      "select 1 from public.events where event_name = 'order_placed' and props->>'order_id' = $1",
      [VALID_ORDER_ID],
    );
    expect(rows.rows.length).toBeGreaterThan(0);
    await db.exec('set role anon;');
  });

  it('accepts an SF order_placed with a cents amount and no vouchers applied', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'order_placed',
        props: {
          order_id: randomUUID(),
          item_count: 1,
          amount_minor: 1800,
          currency: 'USD',
          drop_off_preset: 'office',
          delivery_instructions: 'hand_to_me',
          utensils: false,
          applied_voucher_ids: [],
          saved_amount_minor: 0,
        },
      }),
    ).resolves.toBeDefined();
  });

  it('accepts location_selected', async () => {
    await expect(
      insertEvent(db, { eventName: 'location_selected', props: { city: 'hcmc', is_switch: true } }),
    ).resolves.toBeDefined();
  });

  it('accepts home_viewed', async () => {
    await expect(insertEvent(db, { eventName: 'home_viewed', props: { city: 'sf' } })).resolves.toBeDefined();
  });

  it('accepts restaurant_opened carrying city', async () => {
    await expect(
      insertEvent(db, { eventName: 'restaurant_opened', props: { city: 'hcmc', restaurant_slug: 'pho-place' } }),
    ).resolves.toBeDefined();
  });

  it('accepts cart_viewed with a VND amount_minor, including the empty-cart zero case', async () => {
    await expect(
      insertEvent(db, { eventName: 'cart_viewed', props: { item_count: 0, amount_minor: 0, currency: 'VND' } }),
    ).resolves.toBeDefined();
  });

  it('accepts checkout_viewed with a VND amount_minor above the old 100000-cent USD bound', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'checkout_viewed',
        props: { item_count: 3, amount_minor: 350000, currency: 'VND' },
      }),
    ).resolves.toBeDefined();
  });

  it('accepts flash_sheet_shown with a VND amount in the drawn range and two distinct restaurant slugs', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'flash_sheet_shown',
        props: {
          city: 'hcmc',
          amount_minor: 20000,
          currency: 'VND',
          restaurant_slugs: ['pho-place', 'banh-mi-shop'],
        },
      }),
    ).resolves.toBeDefined();
  });

  it('accepts flash_sheet_closed with outcome restaurant_tapped and a real slug', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'flash_sheet_closed',
        props: {
          city: 'sf',
          outcome: 'restaurant_tapped',
          seconds_remaining: 400,
          restaurant_slug: 'pho-place',
        },
      }),
    ).resolves.toBeDefined();
  });

  it('accepts flash_sheet_closed with outcome expired and restaurant_slug "none"', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'flash_sheet_closed',
        props: { city: 'sf', outcome: 'expired', seconds_remaining: 0, restaurant_slug: 'none' },
      }),
    ).resolves.toBeDefined();
  });

  it('accepts tracker_viewed unchanged from the parody contract', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'tracker_viewed',
        props: { order_id: randomUUID(), minutes_since_order: 2.5, view_number: 1 },
      }),
    ).resolves.toBeDefined();
  });

  it('accepts order_delivered', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'order_delivered',
        props: { order_id: randomUUID(), minutes_since_order: 7 },
      }),
    ).resolves.toBeDefined();
  });

  it('accepts rating_submitted with tags', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'rating_submitted',
        props: { order_id: randomUUID(), stars: 5, tags: ['fast', 'great_packaging'] },
      }),
    ).resolves.toBeDefined();
  });
});

describe('every old parody shape is rejected, not accepted and not migrated (AC4, contract "AC7")', () => {
  it('refuses an order_placed carrying drop_off_spot: "the_void"', async () => {
    await expect(
      insertEvent(db, { eventName: 'order_placed', props: OLD_PARODY_ORDER_PLACED_PROPS }),
    ).rejects.toThrow();
  });

  it('refuses the retired event name landing_viewed', async () => {
    await expect(
      insertEvent(db, { eventName: 'landing_viewed', props: { has_active_order: false } }),
    ).rejects.toThrow();
  });

  it('refuses the retired event name restaurants_viewed', async () => {
    await expect(insertEvent(db, { eventName: 'restaurants_viewed', props: {} })).rejects.toThrow();
  });

  it('refuses the retired event name order_abandoned', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'order_abandoned',
        props: { order_id: randomUUID(), minutes_since_order: 30, view_count: 3 },
      }),
    ).rejects.toThrow();
  });

  it('refuses a cart_viewed still shaped as subtotal_cents rather than amount_minor/currency', async () => {
    await expect(
      insertEvent(db, { eventName: 'cart_viewed', props: { item_count: 1, subtotal_cents: 500 } }),
    ).rejects.toThrow();
  });
});

describe('per-currency money bounds (AC1, contract §2)', () => {
  it('refuses a VND amount_minor above the 5000000 bound', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'checkout_viewed',
        props: { item_count: 1, amount_minor: 5000001, currency: 'VND' },
      }),
    ).rejects.toThrow();
  });

  it('refuses a USD amount_minor above the 100000 bound', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'checkout_viewed',
        props: { item_count: 1, amount_minor: 100001, currency: 'USD' },
      }),
    ).rejects.toThrow();
  });

  it('refuses a zero amount_minor on checkout_viewed, which disallows the zero case', async () => {
    await expect(
      insertEvent(db, { eventName: 'checkout_viewed', props: { item_count: 1, amount_minor: 0, currency: 'USD' } }),
    ).rejects.toThrow();
  });

  it('refuses a flash_sheet_shown amount_minor outside its narrower drawn range even though it is within the general VND bound', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'flash_sheet_shown',
        props: {
          city: 'hcmc',
          amount_minor: 100000,
          currency: 'VND',
          restaurant_slugs: ['pho-place', 'banh-mi-shop'],
        },
      }),
    ).rejects.toThrow();
  });
});

describe('order_placed cross-field and enum invariants (AC1, contract §7)', () => {
  it('refuses applied_voucher_ids containing an id from the wrong catalogue-shaped but unlisted string', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'order_placed',
        props: { ...VALID_HCMC_ORDER_PLACED_PROPS, applied_voucher_ids: ['not_a_real_id'] },
      }),
    ).rejects.toThrow();
  });

  it('refuses applied_voucher_ids with a duplicate id', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'order_placed',
        props: {
          ...VALID_HCMC_ORDER_PLACED_PROPS,
          applied_voucher_ids: ['hcmc-discount-t1', 'hcmc-discount-t1'],
          saved_amount_minor: 20000,
        },
      }),
    ).rejects.toThrow();
  });

  it('refuses more than 2 applied_voucher_ids', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'order_placed',
        props: {
          ...VALID_HCMC_ORDER_PLACED_PROPS,
          applied_voucher_ids: ['hcmc-discount-t1', 'hcmc-discount-t2', 'hcmc-discount-t3'],
        },
      }),
    ).rejects.toThrow();
  });

  it('accepts an applied_voucher_ids/saved_amount_minor pair that disagrees with each other', async () => {
    // Contract §7's "saved_amount_minor is 0 iff applied_voucher_ids is []"
    // invariant is deliberately NOT enforced by the store (decided on #79,
    // 2026-09-26 11:47, see ADR 0007): a CHECK here would turn a client
    // arithmetic bug into an order_placed row silently dropped on the
    // primary metric's numerator. It's #89's client-side invariant to
    // enforce; an inconsistent row that lands here can be counted and
    // excluded later.
    await expect(
      insertEvent(db, {
        eventName: 'order_placed',
        props: { ...VALID_HCMC_ORDER_PLACED_PROPS, applied_voucher_ids: [], saved_amount_minor: 45000 },
      }),
    ).resolves.toBeDefined();
  });

  it('refuses a drop_off_preset outside the new preset enum', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'order_placed',
        props: { ...VALID_HCMC_ORDER_PLACED_PROPS, drop_off_preset: 'couch' },
      }),
    ).rejects.toThrow();
  });

  it('refuses a delivery_instructions value outside the new preset enum', async () => {
    await expect(
      insertEvent(db, {
        eventName: 'order_placed',
        props: { ...VALID_HCMC_ORDER_PLACED_PROPS, delivery_instructions: 'guard_it' },
      }),
    ).rejects.toThrow();
  });
});

describe('the old migration and its own bounds are untouched (AC1)', () => {
  it('20260925000000_events.sql on its own still enforces the old order_placed shape', async () => {
    const untouched = new PGlite({ extensions: { pgcrypto } });
    await untouched.exec(BASE_MIGRATION_SQL);
    await untouched.exec('set role anon;');
    await expect(
      insertEvent(untouched, {
        eventName: 'order_placed',
        props: {
          order_id: randomUUID(),
          item_count: 2,
          subtotal_cents: 1800,
          drop_off_spot: 'couch',
          handling_instructions: 'guard_it',
          utensils: true,
          tip_percent: 10,
          promo_code: 'dont_drop10',
        },
      }),
    ).resolves.toBeDefined();
    await untouched.close();
  });
});
