// @vitest-environment node
//
// Proves 20260928000000_wallet_tip.sql (#164) against a real Postgres — see
// wallet.migration.test.ts and ADR 0006/ADR 0008 for why PGlite and how the
// `auth` schema is stubbed. The fixture never goes in a migration file: a
// `create or replace function auth.uid()` there would overwrite Supabase's
// own function on the live project.
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
const WALLET_TIP_MIGRATION_SQL = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260928000000_wallet_tip.sql'),
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

async function signInAsAnonymousAuth(target: PGlite, userId: string) {
  await target.query('insert into auth.users (id) values ($1) on conflict do nothing', [userId]);
  await target.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: userId, is_anonymous: true }),
  ]);
  await target.query('set role authenticated');
}

async function signOut(target: PGlite) {
  await target.query("select set_config('request.jwt.claims', '', false)", []);
  await target.query('reset role');
}

// Setup as the table owner, bypassing grants entirely — the same pattern
// wallet.migration.test.ts uses for private.wallet_claim_drip_at and
// private.ensure_wallet.
async function givePaidOrder(target: PGlite, userId: string, orderId: string, currency: 'USD' | 'VND') {
  await target.query('reset role');
  await target.query('insert into auth.users (id) values ($1) on conflict do nothing', [userId]);
  await target.query('select private.ensure_wallet($1)', [userId]);
  await target.query(
    'insert into private.wallet_debits (order_id, user_id, currency, amount_minor) values ($1, $2, $3, $4)',
    [orderId, userId, currency, currency === 'USD' ? 2500 : 500000],
  );
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(AUTH_FIXTURE_SQL);
  await db.exec(EVENTS_MIGRATION_SQL);
  await db.exec(TWO_CITY_MIGRATION_SQL);
  await db.exec(WALLET_MIGRATION_SQL);
  await db.exec(WALLET_TIP_MIGRATION_SQL);
});

afterAll(async () => {
  await db.close();
});

describe('AC1: the migration applies cleanly after the existing three', () => {
  it('created the wallet_tips table', async () => {
    await db.query('reset role');
    const result = await db.query(
      "select 1 from information_schema.tables where table_schema = 'private' and table_name = 'wallet_tips'",
    );
    expect(result.rows).toHaveLength(1);
  });
});

describe('AC2: one tip per order, exact presets, the order own currency', () => {
  it('tipping a paid USD order for a USD preset debits exactly that amount, leaves VND untouched, and records one row', async () => {
    const userId = randomUUID();
    const orderId = randomUUID();
    await givePaidOrder(db, userId, orderId, 'USD');

    await signInAs(db, userId);
    const result = await db.query<{
      wallet_tip: { status: string; amount_minor: number; currency: string; usd_minor: number; vnd_minor: number };
    }>('select public.wallet_tip($1, $2) as wallet_tip', [orderId, 300]);

    expect(result.rows[0].wallet_tip.status).toBe('tipped');
    expect(result.rows[0].wallet_tip.amount_minor).toBe(300);
    expect(result.rows[0].wallet_tip.currency).toBe('USD');
    expect(result.rows[0].wallet_tip.usd_minor).toBe(3000 - 300);
    expect(result.rows[0].wallet_tip.vnd_minor).toBe(750000);

    await db.query('reset role');
    const tipRows = await db.query('select 1 from private.wallet_tips where order_id = $1', [orderId]);
    expect(tipRows.rows).toHaveLength(1);
  });

  it('a second tip on the same order, same or different preset, charges nothing and reports the original amount', async () => {
    const userId = randomUUID();
    const orderId = randomUUID();
    await givePaidOrder(db, userId, orderId, 'USD');

    await signInAs(db, userId);
    await db.query('select public.wallet_tip($1, $2)', [orderId, 200]);

    const sameAmount = await db.query<{ wallet_tip: { status: string; amount_minor: number; usd_minor: number } }>(
      'select public.wallet_tip($1, $2) as wallet_tip',
      [orderId, 200],
    );
    expect(sameAmount.rows[0].wallet_tip.status).toBe('already_tipped');
    expect(sameAmount.rows[0].wallet_tip.amount_minor).toBe(200);
    expect(sameAmount.rows[0].wallet_tip.usd_minor).toBe(3000 - 200);

    const differentAmount = await db.query<{ wallet_tip: { status: string; amount_minor: number; usd_minor: number } }>(
      'select public.wallet_tip($1, $2) as wallet_tip',
      [orderId, 300],
    );
    expect(differentAmount.rows[0].wallet_tip.status).toBe('already_tipped');
    expect(differentAmount.rows[0].wallet_tip.amount_minor).toBe(200);
    expect(differentAmount.rows[0].wallet_tip.usd_minor).toBe(3000 - 200);

    await signOut(db);
  });

  it('an amount that is not one of the presets is refused', async () => {
    const userId = randomUUID();
    const orderId = randomUUID();
    await givePaidOrder(db, userId, orderId, 'USD');

    await signInAs(db, userId);
    await expect(db.query('select public.wallet_tip($1, $2)', [orderId, 150])).rejects.toThrow();

    const balance = await db.query<{ wallet_get: { usd_minor: number } }>('select public.wallet_get() as wallet_get');
    expect(balance.rows[0].wallet_get.usd_minor).toBe(3000);
    await signOut(db);
  });

  it('a tip larger than the balance returns insufficient, with balances unchanged', async () => {
    const userId = randomUUID();
    const orderId = randomUUID();
    await givePaidOrder(db, userId, orderId, 'USD');

    await db.query('reset role');
    await db.query('update public.wallets set usd_minor = 50 where user_id = $1', [userId]);

    await signInAs(db, userId);
    const result = await db.query<{ wallet_tip: { status: string; usd_minor: number } }>(
      'select public.wallet_tip($1, $2) as wallet_tip',
      [orderId, 100],
    );
    expect(result.rows[0].wallet_tip.status).toBe('insufficient');
    expect(result.rows[0].wallet_tip.usd_minor).toBe(50);
    await signOut(db);
  });

  it("the currency comes from the order's own debit row, not a guess from the amount: a VND preset is refused on a USD order", async () => {
    const userId = randomUUID();
    const orderId = randomUUID();
    await givePaidOrder(db, userId, orderId, 'USD');

    await signInAs(db, userId);
    await expect(db.query('select public.wallet_tip($1, $2)', [orderId, 10000])).rejects.toThrow();

    const balance = await db.query<{ wallet_get: { usd_minor: number } }>('select public.wallet_get() as wallet_get');
    expect(balance.rows[0].wallet_get.usd_minor).toBe(3000);
    await signOut(db);
  });

  it('a VND order accepts a VND preset and touches only the VND balance', async () => {
    const userId = randomUUID();
    const orderId = randomUUID();
    await givePaidOrder(db, userId, orderId, 'VND');

    await signInAs(db, userId);
    const result = await db.query<{ wallet_tip: { status: string; usd_minor: number; vnd_minor: number } }>(
      'select public.wallet_tip($1, $2) as wallet_tip',
      [orderId, 20000],
    );
    expect(result.rows[0].wallet_tip.status).toBe('tipped');
    expect(result.rows[0].wallet_tip.usd_minor).toBe(3000);
    expect(result.rows[0].wallet_tip.vnd_minor).toBe(750000 - 20000);
    await signOut(db);
  });
});

describe('AC3: only your own paid order', () => {
  it('is refused, with no balance change, for an order_id with no wallet_debits row', async () => {
    const userId = randomUUID();
    await db.query('reset role');
    await db.query('insert into auth.users (id) values ($1) on conflict do nothing', [userId]);
    await db.query('select private.ensure_wallet($1)', [userId]);

    await signInAs(db, userId);
    await expect(db.query('select public.wallet_tip($1, $2)', [randomUUID(), 300])).rejects.toThrow();

    const balance = await db.query<{ wallet_get: { usd_minor: number } }>('select public.wallet_get() as wallet_get');
    expect(balance.rows[0].wallet_get.usd_minor).toBe(3000);
    await signOut(db);
  });

  it("is refused, with no balance change, for an order_id whose debit row belongs to someone else", async () => {
    const userA = randomUUID();
    const userB = randomUUID();
    const orderId = randomUUID();
    await givePaidOrder(db, userB, orderId, 'USD');

    await db.query('reset role');
    await db.query('insert into auth.users (id) values ($1) on conflict do nothing', [userA]);
    await db.query('select private.ensure_wallet($1)', [userA]);

    await signInAs(db, userA);
    await expect(db.query('select public.wallet_tip($1, $2)', [orderId, 300])).rejects.toThrow();

    const balanceA = await db.query<{ wallet_get: { usd_minor: number } }>('select public.wallet_get() as wallet_get');
    expect(balanceA.rows[0].wallet_get.usd_minor).toBe(3000);
    await signOut(db);

    await db.query('reset role');
    const balanceB = await db.query<{ usd_minor: number }>('select usd_minor from public.wallets where user_id = $1', [
      userB,
    ]);
    expect(balanceB.rows[0].usd_minor).toBe(3000);
  });

  it('refuses an anon caller', async () => {
    await db.query('set role anon');
    await expect(db.query('select public.wallet_tip($1, $2)', [randomUUID(), 300])).rejects.toThrow();
    await db.query('reset role');
  });

  it('refuses an anonymous-auth JWT (is_anonymous)', async () => {
    const userId = randomUUID();
    const orderId = randomUUID();
    await givePaidOrder(db, userId, orderId, 'USD');

    await signInAsAnonymousAuth(db, userId);
    await expect(db.query('select public.wallet_tip($1, $2)', [orderId, 300])).rejects.toThrow();
    await signOut(db);

    await db.query('reset role');
    const balance = await db.query<{ usd_minor: number }>('select usd_minor from public.wallets where user_id = $1', [
      userId,
    ]);
    expect(balance.rows[0].usd_minor).toBe(3000);
  });
});

describe('AC4: grants and RLS, watched failing', () => {
  it('wallet_tip is security definer with a fixed search_path, revoked from PUBLIC, and granted only to authenticated', async () => {
    const result = await db.query<{ prosecdef: boolean; proconfig: string[] | null }>(`
      select p.prosecdef, p.proconfig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'wallet_tip'
    `);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].prosecdef).toBe(true);
    expect(result.rows[0].proconfig ?? []).toEqual(expect.arrayContaining([expect.stringMatching(/^search_path=/)]));

    const anonPriv = await db.query<{ has_privilege: boolean }>(
      "select has_function_privilege('anon', 'public.wallet_tip(uuid, bigint)', 'EXECUTE') as has_privilege",
    );
    expect(anonPriv.rows[0].has_privilege).toBe(false);

    const authenticatedPriv = await db.query<{ has_privilege: boolean }>(
      "select has_function_privilege('authenticated', 'public.wallet_tip(uuid, bigint)', 'EXECUTE') as has_privilege",
    );
    expect(authenticatedPriv.rows[0].has_privilege).toBe(true);
  });

  it('the private.is_valid_tip_amount helper has no grant to anon or authenticated', async () => {
    const anonPriv = await db.query<{ has_privilege: boolean }>(
      "select has_function_privilege('anon', 'private.is_valid_tip_amount(text, bigint)', 'EXECUTE') as has_privilege",
    );
    expect(anonPriv.rows[0].has_privilege).toBe(false);

    const authenticatedPriv = await db.query<{ has_privilege: boolean }>(
      "select has_function_privilege('authenticated', 'private.is_valid_tip_amount(text, bigint)', 'EXECUTE') as has_privilege",
    );
    expect(authenticatedPriv.rows[0].has_privilege).toBe(false);
  });

  it('removing the revoke on wallet_tip would leak PUBLIC execute to anon (the red half of this check, quoted in the pull request)', async () => {
    const brokenDb = new PGlite({ extensions: { pgcrypto } });
    await brokenDb.exec(AUTH_FIXTURE_SQL);
    await brokenDb.exec(EVENTS_MIGRATION_SQL);
    await brokenDb.exec(TWO_CITY_MIGRATION_SQL);
    await brokenDb.exec(WALLET_MIGRATION_SQL);
    const brokenWalletTipSql = WALLET_TIP_MIGRATION_SQL.replace(
      'revoke all on function public.wallet_tip(uuid, bigint) from public;\n',
      '',
    );
    await brokenDb.exec(brokenWalletTipSql);

    // With the revoke missing, Postgres's own default (every new function is
    // granted EXECUTE to PUBLIC) survives, and anon inherits it — exactly
    // what the real migration's revoke exists to prevent.
    const anonPriv = await brokenDb.query<{ has_privilege: boolean }>(
      "select has_function_privilege('anon', 'public.wallet_tip(uuid, bigint)', 'EXECUTE') as has_privilege",
    );
    expect(anonPriv.rows[0].has_privilege).toBe(true);
    await brokenDb.close();
  });

  it('the tips table cannot be inserted, updated or deleted directly by anon or authenticated', async () => {
    const userId = randomUUID();
    const orderId = randomUUID();
    await givePaidOrder(db, userId, orderId, 'USD');

    for (const role of ['anon', 'authenticated'] as const) {
      await db.query(`set role ${role}`);
      await expect(
        db.query(
          'insert into private.wallet_tips (order_id, user_id, currency, amount_minor) values ($1, $2, $3, $4)',
          [orderId, userId, 'USD', 100],
        ),
      ).rejects.toThrow();
      await expect(db.query('update private.wallet_tips set amount_minor = 1')).rejects.toThrow();
      await expect(db.query('delete from private.wallet_tips')).rejects.toThrow();
      await db.query('reset role');
    }
  });

  it('events grants are unchanged: anon still gets only its column-level insert', async () => {
    await db.query('set role anon');
    await expect(db.query('select * from public.events limit 1')).rejects.toThrow();
    await db.query('reset role');
  });

  it('no function anon or authenticated can execute, across public and private, takes a date/time argument', async () => {
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
