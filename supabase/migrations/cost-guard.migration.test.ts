// @vitest-environment node
//
// Proves 20261004000000_cost_guard.sql (#283, parent #281) against a real
// Postgres (ADR 0006): the global hourly ceiling, the storage ceiling, their
// messages against the per-IP limit's, and the owner-only headroom query.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const sql = (file: string) =>
  readFileSync(path.join(process.cwd(), 'supabase/migrations', file), 'utf-8');

const MIGRATIONS = [
  '20260925000000_events.sql',
  '20260926000000_two_city_event_contract.sql',
  '20261001000000_analytics_readiness_event_contract.sql',
  '20261002000000_session_started_and_is_internal.sql',
  '20261003000000_second_pass_readiness.sql',
  '20261004000000_cost_guard.sql',
];

let db: PGlite;

async function insertEvent(ip: string = randomUUID()) {
  await db.query("select set_config('request.headers', $1, false)", [
    JSON.stringify({ 'x-forwarded-for': ip }),
  ]);
  return db.query(
    `insert into public.events (id, visitor_id, session_id, event_name, occurred_at, props, variant)
     values ($1, $2, $3, 'home_viewed', now(), $4, null)`,
    [randomUUID(), randomUUID(), randomUUID(), JSON.stringify({ city: 'sf' })],
  );
}

async function messageOf(ip?: string) {
  try {
    await insertEvent(ip);
    return '';
  } catch (e) {
    return (e as Error).message;
  }
}

async function ownerExec(text: string) {
  await db.exec('reset role;');
  try {
    return await db.query<Record<string, unknown>>(text);
  } finally {
    await db.exec('set role anon;');
  }
}

const eventCount = async () =>
  Number((await ownerExec('select count(*)::int as c from public.events')).rows[0].c);

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  for (const file of MIGRATIONS) await db.exec(sql(file));
  await db.exec('set role anon;');
});

afterAll(async () => {
  await db.close();
});

describe('AC1/AC2: hourly ceiling trips and recovers', () => {
  it('refuses the insert once 20,000 were accepted in the last hour, leaving the count unchanged', async () => {
    await expect(insertEvent()).resolves.toBeDefined();
    const before = await eventCount();
    await ownerExec(
      'update private.event_write_buckets set n = 20000 where bucket = (select max(bucket) from private.event_write_buckets)',
    );
    await expect(insertEvent()).rejects.toThrow('global event ceiling exceeded');
    expect(await eventCount()).toBe(before);
  });

  it('accepts the same insert once the counted window is older than 60 minutes', async () => {
    await ownerExec("update private.event_write_buckets set bucket = bucket - interval '2 hours'");
    await expect(insertEvent()).resolves.toBeDefined();
  });
});

describe('AC3: storage ceiling trips and recovers', () => {
  it('refuses with the constant below the table size and accepts once set back above', async () => {
    await ownerExec('update private.event_ceilings set storage_ceiling_bytes = 1');
    const before = await eventCount();
    await expect(insertEvent()).rejects.toThrow('event storage ceiling exceeded');
    expect(await eventCount()).toBe(before);
    await ownerExec('update private.event_ceilings set storage_ceiling_bytes = 314572800');
    await expect(insertEvent()).resolves.toBeDefined();
  });

  it("ships the owner's numbers as the constants", async () => {
    const { rows } = await ownerExec('select * from private.event_ceilings');
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].hourly_ceiling)).toBe(20000);
    expect(Number(rows[0].storage_ceiling_bytes)).toBe(314572800);
  });
});

describe('AC4: the three limits are distinguishable, and private stays closed', () => {
  it('reports three different messages', async () => {
    await ownerExec("update private.event_write_buckets set bucket = bucket - interval '2 hours'");
    let rateMessage = '';
    for (let i = 0; i < 61; i += 1) {
      rateMessage = await messageOf('203.0.113.9');
    }
    await ownerExec('update private.event_ceilings set hourly_ceiling = 1');
    const hourlyMessage = await messageOf();
    await ownerExec(
      'update private.event_ceilings set hourly_ceiling = 20000, storage_ceiling_bytes = 1',
    );
    const storageMessage = await messageOf();
    await ownerExec('update private.event_ceilings set storage_ceiling_bytes = 314572800');
    expect([rateMessage, hourlyMessage, storageMessage]).toEqual([
      'rate limit exceeded',
      'global event ceiling exceeded',
      'event storage ceiling exceeded',
    ]);
  });

  it('gives anon no usage on private', async () => {
    const { rows } = await ownerExec("select has_schema_privilege('anon', 'private', 'USAGE') as u");
    expect(rows[0].u).toBe(false);
  });
});

describe('AC5: headroom query', () => {
  it('returns usage and ceilings to the owner', async () => {
    const { rows } = await ownerExec('select * from public.event_ceiling_headroom()');
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].hourly_ceiling)).toBe(20000);
    expect(Number(rows[0].storage_ceiling_bytes)).toBe(314572800);
    expect(Number(rows[0].accepted_last_hour)).toBeGreaterThan(0);
    const size = await ownerExec("select pg_total_relation_size('public.events')::bigint as s");
    expect(Number(rows[0].events_total_bytes)).toBe(Number(size.rows[0].s));
  });

  it('is not executable by anon', async () => {
    await expect(db.query('select * from public.event_ceiling_headroom()')).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('AC4: the wallet keeps working while a ceiling is tripped', () => {
  it('wallet_get() succeeds as authenticated with the cost guard applied after the wallet migrations', async () => {
    const wdb = new PGlite({ extensions: { pgcrypto } });
    try {
      // ADR 0008's auth fixture, as in wallet.migration.test.ts.
      await wdb.exec(`
        create schema auth;
        create table auth.users (id uuid primary key);
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(coalesce(current_setting('request.jwt.claim.sub', true), (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')), '')::uuid
        $$;
        create role authenticated nologin;
      `);
      for (const file of [
        '20260925000000_events.sql',
        '20260926000000_two_city_event_contract.sql',
        '20260927000000_wallet.sql',
        '20260928000000_wallet_tip.sql',
        '20260929000000_wallet_revoke_anon_execute.sql',
        '20261004000000_cost_guard.sql',
      ]) {
        await wdb.exec(sql(file));
      }
      await wdb.exec('update private.event_ceilings set hourly_ceiling = 1');
      await wdb.exec("insert into private.event_write_buckets (bucket, n) values (date_trunc('minute', now()), 1)");

      const userId = randomUUID();
      await wdb.query('insert into auth.users (id) values ($1)', [userId]);
      await wdb.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: userId })]);
      await wdb.query('set role authenticated');
      const { rows } = await wdb.query<{ wallet_get: unknown }>('select public.wallet_get() as wallet_get');
      expect(rows[0].wallet_get).not.toBeNull();

      await wdb.query('reset role');
      await expect(
        wdb.query(
          `insert into public.events (id, visitor_id, session_id, event_name, occurred_at, props, variant)
           values ($1, $2, $3, 'restaurants_viewed', now(), '{}', null)`,
          [randomUUID(), randomUUID(), randomUUID()],
        ),
      ).rejects.toThrow('global event ceiling exceeded');
    } finally {
      await wdb.close();
    }
  });
});
