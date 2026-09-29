// @vitest-environment node
//
// Proves 20261003000000_second_pass_readiness.sql (#273) against a real
// Postgres (ADR 0006), for docs/measurement/270-analytics-readiness-second-pass.md
// §5.1 and §5.5 (AC2, test S4): the `seq` and `build` envelope columns, Q7
// and B3, and `events_clean`.
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
];

let db: PGlite;

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  for (const file of MIGRATIONS) await db.exec(sql(file));
});

afterAll(async () => {
  await db.close();
});

async function asAnon<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec('set role anon;');
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

interface Envelope {
  id?: string;
  visitor_id?: string;
  seq?: number | null;
  build?: string | null;
  is_internal?: boolean;
}

/** Inserts as anon, naming `seq`/`build`/`is_internal` only when given — as an old tab would not. */
function insert(row: Envelope = {}) {
  const id = row.id ?? randomUUID();
  const columns = ['id', 'visitor_id', 'session_id', 'event_name', 'occurred_at', 'props', 'variant'];
  const values: unknown[] = [
    id,
    row.visitor_id ?? randomUUID(),
    randomUUID(),
    'home_viewed',
    new Date().toISOString(),
    JSON.stringify({ city: 'sf' }),
    null,
  ];
  for (const key of ['seq', 'build', 'is_internal'] as const) {
    if (row[key] !== undefined) {
      columns.push(key);
      values.push(row[key]);
    }
  }
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  return asAnon(() =>
    db.query(`insert into public.events (${columns.join(', ')}) values (${placeholders})`, values),
  ).then(() => id);
}

const stored = async (id: string) =>
  (await db.query<{ seq: number | null; build: string | null }>('select seq, build from public.events where id = $1', [id]))
    .rows[0];

const SHA = 'a'.repeat(20) + '0123456789'.repeat(2);

describe('the columns (§5.1)', () => {
  it('are nullable integer and text with no default', async () => {
    const { rows } = await db.query(
      `select column_name, data_type, is_nullable, column_default
       from information_schema.columns
       where table_schema = 'public' and table_name = 'events' and column_name in ('seq', 'build')
       order by 1`,
    );
    expect(rows).toEqual([
      { column_name: 'build', data_type: 'text', is_nullable: 'YES', column_default: null },
      { column_name: 'seq', data_type: 'integer', is_nullable: 'YES', column_default: null },
    ]);
  });

  it('are null on a row inserted without them, as an old tab would (Q7, B3)', async () => {
    expect(await stored(await insert())).toEqual({ seq: null, build: null });
  });

  it('are stored when sent', async () => {
    expect(await stored(await insert({ seq: 3, build: SHA }))).toEqual({ seq: 3, build: SHA });
  });

  it('accept an explicit null, which the client sends when its counter fails', async () => {
    expect(await stored(await insert({ seq: null }))).toEqual({ seq: null, build: null });
  });
});

describe('seq boundaries (Q7)', () => {
  it.each([1, 100000])('accepts %i', async (seq) => {
    expect((await stored(await insert({ seq }))).seq).toBe(seq);
  });

  it.each([0, -1, 100001])('refuses %i', async (seq) => {
    await expect(insert({ seq })).rejects.toThrow();
  });
});

describe('build boundaries (B3)', () => {
  it('accepts a 40-hex value and (unknown)', async () => {
    expect((await stored(await insert({ build: SHA }))).build).toBe(SHA);
    expect((await stored(await insert({ build: '(unknown)' }))).build).toBe('(unknown)');
  });

  it.each([
    ['a 39-hex value', SHA.slice(1)],
    ['a 41-hex value', `${SHA}a`],
    ['upper-case hex', SHA.toUpperCase()],
    ['abc', 'abc'],
    ['unknown without parentheses', 'unknown'],
    ['an empty string', ''],
  ])('refuses %s', async (_label, build) => {
    await expect(insert({ build })).rejects.toThrow();
  });
});

describe('anon grants (§5.1)', () => {
  it('can insert seq and build, and still cannot read or change them', async () => {
    await insert({ seq: 1, build: SHA });
    await expect(asAnon(() => db.query('select seq, build from public.events limit 1'))).rejects.toThrow();
    await expect(asAnon(() => db.query('update public.events set seq = 2'))).rejects.toThrow();
  });
});

describe('events_clean (§5.1)', () => {
  it('exposes seq and build', async () => {
    const id = await insert({ seq: 9, build: SHA });
    const { rows } = await db.query('select seq, build from public.events_clean where id = $1', [id]);
    expect(rows).toEqual([{ seq: 9, build: SHA }]);
  });

  it('still excludes a browser with one is_internal row, keeping every other browser', async () => {
    const owner = randomUUID();
    const other = randomUUID();
    const before = await insert({ visitor_id: owner, seq: 1, build: SHA });
    await insert({ visitor_id: owner, seq: 2, build: SHA, is_internal: true });
    const kept = await insert({ visitor_id: other, seq: 1, build: SHA });

    const clean = await db.query<{ id: string }>('select id from public.events_clean where visitor_id in ($1, $2)', [
      owner,
      other,
    ]);
    expect(clean.rows.map((r) => r.id)).toEqual([kept]);
    expect(clean.rows.map((r) => r.id)).not.toContain(before);
  });

  it('stays unreadable by anon and authenticated under Supabase-style default privileges', async () => {
    const supabaseLikeDb = new PGlite({ extensions: { pgcrypto } });
    await supabaseLikeDb.exec('create role anon nologin; create role authenticated nologin;');
    await supabaseLikeDb.exec(
      'alter default privileges in schema public grant all on tables to anon, authenticated;',
    );
    for (const file of MIGRATIONS) await supabaseLikeDb.exec(sql(file));
    for (const role of ['anon', 'authenticated']) {
      await supabaseLikeDb.exec(`set role ${role};`);
      await expect(supabaseLikeDb.query('select * from public.events_clean limit 1')).rejects.toThrow();
      await supabaseLikeDb.exec('reset role;');
    }
    await supabaseLikeDb.close();
  });

  it('keeps security_invoker on', async () => {
    const { rows } = await db.query<{ reloptions: string[] }>(
      "select reloptions from pg_class where oid = 'public.events_clean'::regclass",
    );
    expect(rows[0].reloptions).toContain('security_invoker=true');
  });
});
