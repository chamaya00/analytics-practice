// @vitest-environment node
//
// Proves 20260927000000_wallet.sql (#145) against a real Postgres — see
// events.migration.test.ts and ADR 0006 for why PGlite. PGlite has no `auth`
// schema and no `authenticated` role, so a test-only fixture (verbatim from
// ADR 0008, "How ADR 0006's PGlite tests stub auth") supplies both before
// the three migrations apply in order. The fixture never goes in a
// migration file: a `create or replace function auth.uid()` there would
// overwrite Supabase's own function on the live project.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const EVENTS_MIGRATION_SQL = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260925000000_events.sql'),
  'utf-8',
);
const TWO_CITY_MIGRATION_SQL = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260926000000_two_city_event_contract.sql'),
  'utf-8',
);
const WALLET_MIGRATION_SQL = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260927000000_wallet.sql'),
  'utf-8',
);

// Supabase's own auth.uid() definition, verbatim (ADR 0008, quoting
// supabase/auth's `20211202183645_update_auth_uid.up.sql`).
const AUTH_FIXTURE_SQL = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(current_setting('request.jwt.claim.sub', true), (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')), '')::uuid
  $$;
  create role authenticated nologin;
`;

let db: PGlite;

async function signInAs(target: PGlite, userId: string) {
  await target.query('insert into auth.users (id) values ($1) on conflict do nothing', [userId]);
  await target.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: userId })]);
  await target.query('set role authenticated');
}

async function signOut(target: PGlite) {
  await target.query("select set_config('request.jwt.claims', '', false)", []);
  await target.query('reset role');
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(AUTH_FIXTURE_SQL);
  await db.exec(EVENTS_MIGRATION_SQL);
  await db.exec(TWO_CITY_MIGRATION_SQL);
  await db.exec(WALLET_MIGRATION_SQL);
});

afterAll(async () => {
  await db.close();
});

describe('AC1: the migration applies cleanly after the existing two', () => {
  it('created the wallets table', async () => {
    await db.query('reset role');
    const result = await db.query(
      "select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wallets'",
    );
    expect(result.rows).toHaveLength(1);
  });
});

describe('AC2: preload, via wallet_get', () => {
  it('leaves a new user holding exactly the preload amounts on the first call, and adds nothing on the second', async () => {
    const userId = randomUUID();
    await signInAs(db, userId);

    const first = await db.query<{ wallet_get: { usd_minor: number; vnd_minor: number } }>(
      'select public.wallet_get() as wallet_get',
    );
    expect(first.rows[0].wallet_get.usd_minor).toBe(3000);
    expect(first.rows[0].wallet_get.vnd_minor).toBe(750000);

    const second = await db.query<{ wallet_get: { usd_minor: number; vnd_minor: number } }>(
      'select public.wallet_get() as wallet_get',
    );
    expect(second.rows[0].wallet_get.usd_minor).toBe(3000);
    expect(second.rows[0].wallet_get.vnd_minor).toBe(750000);

    await signOut(db);
  });

  it('refuses an anon caller', async () => {
    await db.query('set role anon');
    await expect(db.query('select public.wallet_get() as wallet_get')).rejects.toThrow();
    await db.query('reset role');
  });
});

describe("AC3: drip claim, through private.wallet_claim_drip_at (the internal, clock-taking engine wallet_claim_drip() calls with now())", () => {
  it('the first claim in a window credits exactly 500 cents and 100000 VND', async () => {
    const userId = randomUUID();
    await db.query('insert into auth.users (id) values ($1)', [userId]);
    await db.query('reset role');

    const at = new Date('2026-10-05T20:00:00Z'); // 13:00 PDT, mid [07:00,15:00) window
    const result = await db.query<{ wallet_claim_drip_at: { claimed: boolean; usd_minor: number; vnd_minor: number } }>(
      'select private.wallet_claim_drip_at($1, $2) as wallet_claim_drip_at',
      [userId, at.toISOString()],
    );
    expect(result.rows[0].wallet_claim_drip_at.claimed).toBe(true);
    expect(result.rows[0].wallet_claim_drip_at.usd_minor).toBe(3000 + 500);
    expect(result.rows[0].wallet_claim_drip_at.vnd_minor).toBe(750000 + 100000);
  });

  it('a second claim in the same window is refused, with balances unchanged', async () => {
    const userId = randomUUID();
    await db.query('insert into auth.users (id) values ($1)', [userId]);

    const at = new Date('2026-10-05T20:00:00Z');
    await db.query('select private.wallet_claim_drip_at($1, $2)', [userId, at.toISOString()]);

    const secondAt = new Date('2026-10-05T21:30:00Z'); // still 14:30 PDT, same window
    const result = await db.query<{ wallet_claim_drip_at: { claimed: boolean; usd_minor: number; vnd_minor: number } }>(
      'select private.wallet_claim_drip_at($1, $2) as wallet_claim_drip_at',
      [userId, secondAt.toISOString()],
    );
    expect(result.rows[0].wallet_claim_drip_at.claimed).toBe(false);
    expect(result.rows[0].wallet_claim_drip_at.usd_minor).toBe(3000 + 500);
    expect(result.rows[0].wallet_claim_drip_at.vnd_minor).toBe(750000 + 100000);
  });

  it('a claim in the next window succeeds', async () => {
    const userId = randomUUID();
    await db.query('insert into auth.users (id) values ($1)', [userId]);

    const firstWindow = new Date('2026-10-05T20:00:00Z');
    await db.query('select private.wallet_claim_drip_at($1, $2)', [userId, firstWindow.toISOString()]);

    const nextWindow = new Date('2026-10-06T04:00:00Z'); // 21:00 PDT, the [15:00,23:00) window
    const result = await db.query<{ wallet_claim_drip_at: { claimed: boolean; usd_minor: number; vnd_minor: number } }>(
      'select private.wallet_claim_drip_at($1, $2) as wallet_claim_drip_at',
      [userId, nextWindow.toISOString()],
    );
    expect(result.rows[0].wallet_claim_drip_at.claimed).toBe(true);
    expect(result.rows[0].wallet_claim_drip_at.usd_minor).toBe(3000 + 1000);
    expect(result.rows[0].wallet_claim_drip_at.vnd_minor).toBe(750000 + 200000);
  });

  it('refuses an anon or authenticated caller of wallet_claim_drip (no auth.uid())', async () => {
    await db.query('set role anon');
    await expect(db.query('select public.wallet_claim_drip() as wallet_claim_drip')).rejects.toThrow();
    await db.query('reset role');

    await db.query('set role authenticated');
    await expect(db.query('select public.wallet_claim_drip() as wallet_claim_drip')).rejects.toThrow();
    await db.query('reset role');
  });

  it('anon and authenticated cannot execute the internal clock-taking function directly', async () => {
    const userId = randomUUID();
    await db.query('insert into auth.users (id) values ($1)', [userId]);

    await db.query('set role anon');
    await expect(
      db.query('select private.wallet_claim_drip_at($1, now())', [userId]),
    ).rejects.toThrow();
    await db.query('reset role');

    await db.query('set role authenticated');
    await expect(
      db.query('select private.wallet_claim_drip_at($1, now())', [userId]),
    ).rejects.toThrow();
    await db.query('reset role');
  });

  describe('the DST windows, asserted as expected values (ADR 0008)', () => {
    it('the window opening 2026-10-31 23:00 PDT closes 9 real hours later', async () => {
      const at = new Date('2026-11-01T06:30:00Z'); // Sat Oct 31 23:30 PDT
      const result = await db.query<{ window_start: string; next_window_start: string }>(
        'select private.drip_window_start($1) as window_start, private.drip_next_window_start($1) as next_window_start',
        [at.toISOString()],
      );
      const windowStart = new Date(result.rows[0].window_start);
      const nextWindowStart = new Date(result.rows[0].next_window_start);
      expect(windowStart.toISOString()).toBe('2026-11-01T06:00:00.000Z');
      expect(nextWindowStart.toISOString()).toBe('2026-11-01T15:00:00.000Z');
      expect(nextWindowStart.getTime() - windowStart.getTime()).toBe(9 * 60 * 60 * 1000);
    });

    it('the window opening 2027-03-13 23:00 PST closes 7 real hours later', async () => {
      const at = new Date('2027-03-14T08:00:00Z'); // Sun Mar 14 00:00 PST
      const result = await db.query<{ window_start: string; next_window_start: string }>(
        'select private.drip_window_start($1) as window_start, private.drip_next_window_start($1) as next_window_start',
        [at.toISOString()],
      );
      const windowStart = new Date(result.rows[0].window_start);
      const nextWindowStart = new Date(result.rows[0].next_window_start);
      expect(windowStart.toISOString()).toBe('2027-03-14T07:00:00.000Z');
      expect(nextWindowStart.toISOString()).toBe('2027-03-14T14:00:00.000Z');
      expect(nextWindowStart.getTime() - windowStart.getTime()).toBe(7 * 60 * 60 * 1000);
    });
  });
});

describe('AC4: order debit, through wallet_debit', () => {
  it('debiting o1 for 2500 cents twice leaves the balance at 500 after both calls, the second reporting the original result', async () => {
    const userId = randomUUID();
    await signInAs(db, userId);
    await db.query('select public.wallet_get()'); // ensure the wallet exists at 3000/750000

    const orderId = randomUUID();
    const first = await db.query<{ wallet_debit: { status: string; usd_minor: number } }>(
      'select public.wallet_debit($1, $2, $3) as wallet_debit',
      [orderId, 'USD', 2500],
    );
    expect(first.rows[0].wallet_debit.status).toBe('debited');
    expect(first.rows[0].wallet_debit.usd_minor).toBe(500);

    const second = await db.query<{ wallet_debit: { status: string; usd_minor: number } }>(
      'select public.wallet_debit($1, $2, $3) as wallet_debit',
      [orderId, 'USD', 2500],
    );
    expect(second.rows[0].wallet_debit.status).toBe('already_debited');
    expect(second.rows[0].wallet_debit.usd_minor).toBe(500);

    const balance = await db.query<{ wallet_get: { usd_minor: number } }>('select public.wallet_get() as wallet_get');
    expect(balance.rows[0].wallet_get.usd_minor).toBe(500);

    await signOut(db);
  });

  it('a second call reports the original amount rather than charging again, even if the amount sent differs on retry', async () => {
    const userId = randomUUID();
    await signInAs(db, userId);
    await db.query('select public.wallet_get()');

    const orderId = randomUUID();
    await db.query('select public.wallet_debit($1, $2, $3)', [orderId, 'USD', 2500]);

    const retryWithDifferentAmount = await db.query<{ wallet_debit: { status: string; usd_minor: number } }>(
      'select public.wallet_debit($1, $2, $3) as wallet_debit',
      [orderId, 'USD', 2600],
    );
    expect(retryWithDifferentAmount.rows[0].wallet_debit.status).toBe('already_debited');
    expect(retryWithDifferentAmount.rows[0].wallet_debit.usd_minor).toBe(500);

    await signOut(db);
  });

  it('debiting o2 for 600 cents (short of the 500 remaining) is refused as insufficient, with the balance unchanged', async () => {
    const userId = randomUUID();
    await signInAs(db, userId);
    await db.query('select public.wallet_get()');
    await db.query('select public.wallet_debit($1, $2, $3)', [randomUUID(), 'USD', 2500]);

    const result = await db.query<{ wallet_debit: { status: string; usd_minor: number } }>(
      'select public.wallet_debit($1, $2, $3) as wallet_debit',
      [randomUUID(), 'USD', 600],
    );
    expect(result.rows[0].wallet_debit.status).toBe('insufficient');
    expect(result.rows[0].wallet_debit.usd_minor).toBe(500);

    const balance = await db.query<{ wallet_get: { usd_minor: number } }>('select public.wallet_get() as wallet_get');
    expect(balance.rows[0].wallet_get.usd_minor).toBe(500);

    await signOut(db);
  });

  it('a zero amount is refused', async () => {
    const userId = randomUUID();
    await signInAs(db, userId);
    await db.query('select public.wallet_get()');
    await expect(
      db.query('select public.wallet_debit($1, $2, $3)', [randomUUID(), 'USD', 0]),
    ).rejects.toThrow();
    await signOut(db);
  });

  it('a negative amount is refused', async () => {
    const userId = randomUUID();
    await signInAs(db, userId);
    await db.query('select public.wallet_get()');
    await expect(
      db.query('select public.wallet_debit($1, $2, $3)', [randomUUID(), 'USD', -100]),
    ).rejects.toThrow();
    await signOut(db);
  });

  it("an amount below the server-side floor (399 cents / 20000 VND) is refused, even though it's within the balance", async () => {
    const userId = randomUUID();
    await signInAs(db, userId);
    await db.query('select public.wallet_get()');
    await expect(
      db.query('select public.wallet_debit($1, $2, $3)', [randomUUID(), 'USD', 100]),
    ).rejects.toThrow();
    await expect(
      db.query('select public.wallet_debit($1, $2, $3)', [randomUUID(), 'VND', 5000]),
    ).rejects.toThrow();

    const balance = await db.query<{ wallet_get: { usd_minor: number; vnd_minor: number } }>(
      'select public.wallet_get() as wallet_get',
    );
    expect(balance.rows[0].wallet_get.usd_minor).toBe(3000);
    expect(balance.rows[0].wallet_get.vnd_minor).toBe(750000);
    await signOut(db);
  });

  it('a VND debit touches only the VND balance', async () => {
    const userId = randomUUID();
    await signInAs(db, userId);
    await db.query('select public.wallet_get()');

    const result = await db.query<{ wallet_debit: { status: string; usd_minor: number; vnd_minor: number } }>(
      'select public.wallet_debit($1, $2, $3) as wallet_debit',
      [randomUUID(), 'VND', 50000],
    );
    expect(result.rows[0].wallet_debit.status).toBe('debited');
    expect(result.rows[0].wallet_debit.usd_minor).toBe(3000);
    expect(result.rows[0].wallet_debit.vnd_minor).toBe(700000);

    await signOut(db);
  });

  it('is refused for an insufficient balance, leaving it unchanged', async () => {
    const userId = randomUUID();
    await signInAs(db, userId);
    await db.query('select public.wallet_get()');

    const result = await db.query<{ wallet_debit: { status: string; usd_minor: number } }>(
      'select public.wallet_debit($1, $2, $3) as wallet_debit',
      [randomUUID(), 'USD', 9000],
    );
    expect(result.rows[0].wallet_debit.status).toBe('insufficient');
    expect(result.rows[0].wallet_debit.usd_minor).toBe(3000);

    await signOut(db);
  });

  it("the server-side floor is safe for every real order total in the catalogue (ADR 0008 Consequences: 'the floor is a copy of the catalogue')", async () => {
    const { ALL_RESTAURANTS } = await import('../../src/lib/restaurants.ts');
    const { SERVICE_FEE_MINOR } = await import('../../src/lib/money.ts');

    const cheapestItemByCurrency: Record<'USD' | 'VND', number> = { USD: Infinity, VND: Infinity };
    const cheapestDeliveryFeeByCurrency: Record<'USD' | 'VND', number> = { USD: Infinity, VND: Infinity };
    for (const restaurant of ALL_RESTAURANTS) {
      const currency = restaurant.city === 'sf' ? 'USD' : 'VND';
      cheapestDeliveryFeeByCurrency[currency] = Math.min(
        cheapestDeliveryFeeByCurrency[currency],
        restaurant.deliveryFeeMinor,
      );
      for (const section of restaurant.menu) {
        for (const item of section.items) {
          cheapestItemByCurrency[currency] = Math.min(cheapestItemByCurrency[currency], item.amountMinor);
        }
      }
    }

    for (const currency of ['USD', 'VND'] as const) {
      const smallestRealTotal =
        cheapestItemByCurrency[currency] + cheapestDeliveryFeeByCurrency[currency] + SERVICE_FEE_MINOR[currency];
      const floor = await db.query<{ debit_floor_minor: number }>(
        'select private.debit_floor_minor($1) as debit_floor_minor',
        [currency],
      );
      expect(floor.rows[0].debit_floor_minor).toBeLessThanOrEqual(smallestRealTotal);
    }
  });
});

describe('AC5: RLS and grants', () => {
  it('a user selecting from wallets sees only their own row', async () => {
    const userA = randomUUID();
    const userB = randomUUID();
    await db.query('insert into auth.users (id) values ($1), ($2)', [userA, userB]);
    await db.query('select private.ensure_wallet($1)', [userA]);
    await db.query('select private.ensure_wallet($1)', [userB]);

    await signInAs(db, userA);
    const result = await db.query<{ user_id: string }>('select user_id from public.wallets');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].user_id).toBe(userA);
    await signOut(db);
  });

  it('refuses a direct insert, update, and delete on wallets by anon and authenticated', async () => {
    const userId = randomUUID();
    await db.query('insert into auth.users (id) values ($1)', [userId]);

    for (const role of ['anon', 'authenticated'] as const) {
      await db.query(`set role ${role}`);
      await expect(
        db.query('insert into public.wallets (user_id, usd_minor, vnd_minor) values ($1, 0, 0)', [userId]),
      ).rejects.toThrow();
      await expect(db.query('update public.wallets set usd_minor = 0')).rejects.toThrow();
      await expect(db.query('delete from public.wallets')).rejects.toThrow();
      await db.query('reset role');
    }
  });

  it('every wallet function reachable by anon or authenticated is security definer (except wallet_ready, which reads nothing) with a fixed search_path', async () => {
    const result = await db.query<{ proname: string; prosecdef: boolean; proconfig: string[] | null }>(`
      select p.proname, p.prosecdef, p.proconfig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'wallet%'
    `);
    expect(result.rows.length).toBe(4);
    for (const row of result.rows) {
      expect(row.proconfig ?? []).toEqual(expect.arrayContaining([expect.stringMatching(/^search_path=/)]));
      if (row.proname !== 'wallet_ready') {
        expect(row.prosecdef).toBe(true);
      }
    }
  });

  it('the events table grants are unchanged: anon still gets only its column-level insert', async () => {
    await db.query('set role anon');
    await expect(db.query('select * from public.events limit 1')).rejects.toThrow();
    await db.query('reset role');
  });

  it('breaking the wallets_select_own policy is caught red (house rules: watch it fail)', async () => {
    const brokenDb = new PGlite({ extensions: { pgcrypto } });
    await brokenDb.exec(AUTH_FIXTURE_SQL);
    await brokenDb.exec(EVENTS_MIGRATION_SQL);
    await brokenDb.exec(TWO_CITY_MIGRATION_SQL);
    const brokenWalletSql = WALLET_MIGRATION_SQL.replace(
      'using (user_id = (select auth.uid()))',
      'using (true)',
    );
    await brokenDb.exec(brokenWalletSql);

    const userA = randomUUID();
    const userB = randomUUID();
    await brokenDb.query('insert into auth.users (id) values ($1), ($2)', [userA, userB]);
    await brokenDb.query('select private.ensure_wallet($1)', [userA]);
    await brokenDb.query('select private.ensure_wallet($1)', [userB]);

    await signInAs(brokenDb, userA);
    const result = await brokenDb.query('select user_id from public.wallets');
    // With the broken policy this returns both rows, which is exactly what
    // the real policy above must never do — this assertion is the "red"
    // half of watching the check fail, quoted in the pull request.
    expect(result.rows.length).toBe(2);
    await signOut(brokenDb);
    await brokenDb.close();
  });

  it('no function anon or authenticated can execute takes a date/time argument (the internal clock-taking functions are excluded from both grants)', async () => {
    const result = await db.query<{ proname: string; argtypes: string }>(`
      select p.proname, pg_catalog.pg_get_function_arguments(p.oid) as argtypes
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and (
          has_function_privilege('anon', p.oid, 'EXECUTE')
          or has_function_privilege('authenticated', p.oid, 'EXECUTE')
        )
    `);
    for (const row of result.rows) {
      expect(row.argtypes.toLowerCase()).not.toMatch(/date|time|interval/);
    }
    expect(result.rows.length).toBeGreaterThan(0);
  });
});
