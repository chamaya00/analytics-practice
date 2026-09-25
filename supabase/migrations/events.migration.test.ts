// @vitest-environment node
//
// Proves the migration's anti-spam bounds are enforced by Postgres itself,
// not by src/lib/tracking-transport.ts — the store's endpoint is public
// (ADR 0005), so a request that never goes through this repository's
// TypeScript must still be refused. Runs the real migration SQL against
// @electric-sql/pglite, a WASM build of actual Postgres (not a JS
// reimplementation — see docs/decisions/0006-pglite-for-migration-tests.md)
// entirely in-process: no server to start, no service to configure in CI.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const MIGRATION_SQL = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260925000000_events.sql'),
  'utf-8',
);

const VALID_ORDER_PLACED_PROPS = {
  order_id: '11111111-2222-4333-8444-555555555555',
  item_count: 2,
  subtotal_cents: 1800,
  drop_off_spot: 'couch',
  handling_instructions: 'guard_it',
  utensils: true,
  tip_percent: 10,
  promo_code: 'dont_drop10',
};

let db: PGlite;

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(MIGRATION_SQL);
  await db.exec('set role anon;');
});

afterAll(async () => {
  await db.close();
});

function insertEvent(overrides: {
  eventName?: string;
  props?: unknown;
  variant?: string | null;
  occurredAt?: string;
}) {
  const row = {
    id: randomUUID(),
    visitor_id: randomUUID(),
    session_id: randomUUID(),
    event_name: overrides.eventName ?? 'restaurants_viewed',
    occurred_at: overrides.occurredAt ?? new Date().toISOString(),
    props: overrides.props ?? {},
    variant: overrides.variant ?? null,
  };
  return db.query(
    `insert into public.events (id, visitor_id, session_id, event_name, occurred_at, props, variant)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [row.id, row.visitor_id, row.session_id, row.event_name, row.occurred_at, JSON.stringify(row.props), row.variant],
  );
}

describe('schema constraints refuse a malformed row (AC6)', () => {
  it('accepts a well-shaped restaurants_viewed row as anon', async () => {
    await expect(insertEvent({})).resolves.toBeDefined();
  });

  it('refuses an event_name outside the contract', async () => {
    await expect(insertEvent({ eventName: 'not_a_real_event' })).rejects.toThrow();
  });

  it('refuses props over the 1 KB cap (oversized)', async () => {
    await expect(
      insertEvent({
        eventName: 'restaurant_opened',
        props: { restaurant_slug: 'a', padding: 'x'.repeat(2000) },
      }),
    ).rejects.toThrow();
  });

  it('refuses occurred_at outside the received_at window', async () => {
    await expect(
      insertEvent({ occurredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }),
    ).rejects.toThrow();
  });
});

describe('variant is always null this round (AC6, event contract §3)', () => {
  it('refuses a non-null variant', async () => {
    await expect(insertEvent({ variant: 'a' })).rejects.toThrow();
  });

  it('accepts a null variant', async () => {
    await expect(insertEvent({ variant: null })).resolves.toBeDefined();
  });
});

describe('event_is_valid refuses a malformed props shape via RLS (AC6)', () => {
  it('accepts a well-shaped order_placed', async () => {
    await expect(insertEvent({ eventName: 'order_placed', props: VALID_ORDER_PLACED_PROPS })).resolves.toBeDefined();
  });

  it("refuses an order_placed with a handling_instructions value outside #67's amended enum", async () => {
    await expect(
      insertEvent({
        eventName: 'order_placed',
        props: { ...VALID_ORDER_PLACED_PROPS, handling_instructions: 'toss_it' },
      }),
    ).rejects.toThrow();
  });

  it('refuses an order_placed with a promo_code value outside the enum', async () => {
    await expect(
      insertEvent({
        eventName: 'order_placed',
        props: { ...VALID_ORDER_PLACED_PROPS, promo_code: 'not_a_real_code' },
      }),
    ).rejects.toThrow();
  });

  it('refuses an order_placed missing a required key', async () => {
    const withoutPromoCode = Object.fromEntries(
      Object.entries(VALID_ORDER_PLACED_PROPS).filter(([key]) => key !== 'promo_code'),
    );
    await expect(insertEvent({ eventName: 'order_placed', props: withoutPromoCode })).rejects.toThrow();
  });

  it('refuses checkout_viewed with a zero item_count', async () => {
    await expect(
      insertEvent({ eventName: 'checkout_viewed', props: { item_count: 0, subtotal_cents: 500 } }),
    ).rejects.toThrow();
  });
});

describe('rate limit trigger refuses a too-frequent insert from one IP (AC6, ADR 0005 §4)', () => {
  it('allows 60 writes from one IP in the window, then refuses the 61st', async () => {
    await db.query("select set_config('request.headers', $1, false)", [
      JSON.stringify({ 'x-forwarded-for': '203.0.113.7' }),
    ]);

    for (let i = 0; i < 60; i += 1) {
      await expect(insertEvent({})).resolves.toBeDefined();
    }

    await expect(insertEvent({})).rejects.toThrow();

    await db.query("select set_config('request.headers', '', false)", []);
  });

  it('a different IP is not affected by the first IP exhausting its limit', async () => {
    await db.query("select set_config('request.headers', $1, false)", [
      JSON.stringify({ 'x-forwarded-for': '198.51.100.20' }),
    ]);
    await expect(insertEvent({})).resolves.toBeDefined();
    await db.query("select set_config('request.headers', '', false)", []);
  });
});

describe('anon cannot read, update, or delete rows (ADR 0005 §1)', () => {
  it('refuses a select as anon', async () => {
    await expect(db.query('select * from public.events limit 1')).rejects.toThrow();
  });

  it('refuses an update as anon', async () => {
    await expect(db.query("update public.events set event_name = 'landing_viewed'")).rejects.toThrow();
  });

  it('refuses a delete as anon', async () => {
    await expect(db.query('delete from public.events')).rejects.toThrow();
  });
});
