// @vitest-environment node
//
// Proves 20261002000000_session_started_and_is_internal.sql (#225) against
// a real Postgres (ADR 0006), for
// docs/measurement/219-analytics-readiness-contract.md §5, §6 and §13
// item 7. The strict-superset half (every fixture #81 and #224 accepted is
// still stored) is session-started-superset-two-city.migration.test.ts and
// session-started-superset-224.migration.test.ts.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startTracking } from '../../src/lib/tracking-transport';
import { resetTrack } from '../../src/lib/tracking';

const sql = (file: string) =>
  readFileSync(path.join(process.cwd(), 'supabase/migrations', file), 'utf-8');

let db: PGlite;

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(sql('20260925000000_events.sql'));
  await db.exec(sql('20260926000000_two_city_event_contract.sql'));
  await db.exec(sql('20261001000000_analytics_readiness_event_contract.sql'));
  await db.exec(sql('20261002000000_session_started_and_is_internal.sql'));
});

afterAll(async () => {
  await db.close();
});

/** Runs `fn` as `anon`, the role the browser's inserts arrive as. */
async function asAnon<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec('set role anon;');
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

interface Row {
  id?: string;
  visitor_id?: string;
  session_id?: string;
  event_name: string;
  occurred_at?: string;
  props: unknown;
  is_internal?: boolean;
}

/** Inserts as anon, sending `is_internal` only when the row has it — as an old tab without the column would. */
function insert(row: Row) {
  const columns = ['id', 'visitor_id', 'session_id', 'event_name', 'occurred_at', 'props', 'variant'];
  const values: unknown[] = [
    row.id ?? randomUUID(),
    row.visitor_id ?? randomUUID(),
    row.session_id ?? randomUUID(),
    row.event_name,
    row.occurred_at ?? new Date().toISOString(),
    JSON.stringify(row.props),
    null,
  ];
  if (row.is_internal !== undefined) {
    columns.push('is_internal');
    values.push(row.is_internal);
  }
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  return asAnon(() =>
    db.query(`insert into public.events (${columns.join(', ')}) values (${placeholders})`, values),
  );
}

const accepts = (props: unknown) => expect(insert({ event_name: 'session_started', props })).resolves.toBeDefined();
const refuses = (props: unknown) => expect(insert({ event_name: 'session_started', props })).rejects.toThrow();

const SENTINELS = { referrer_host: '(none)', utm_source: '(none)', utm_medium: '(none)', utm_campaign: '(none)' };
const PATTERN_VALID = {
  referrer_host: 'news.ycombinator.com',
  utm_source: 'linkedin',
  utm_medium: 'social',
  utm_campaign: 'launch_2026-10.v1',
};

describe('session_started is stored (AC1)', () => {
  it('with the four §6 props as sentinels', async () => {
    await accepts(SENTINELS);
    await accepts({ ...SENTINELS, referrer_host: '(self)' });
    await accepts({ ...SENTINELS, referrer_host: '(invalid)', utm_medium: '(invalid)' });
  });

  it('with pattern-valid values', async () => {
    await accepts(PATTERN_VALID);
    await accepts({ ...PATTERN_VALID, utm_campaign: 'a'.repeat(50), referrer_host: 'linkedin.com' });
  });
});

describe('session_started is refused (AC1)', () => {
  it.each(['referrer_host', 'utm_source', 'utm_medium', 'utm_campaign'])(
    'when %s contains /, @ or ?',
    async (key) => {
      for (const bad of ['linkedin.com/feed', 'me@example.com', 'linkedin?x']) {
        await refuses({ ...PATTERN_VALID, [key]: bad });
      }
    },
  );

  it.each(['utm_source', 'utm_medium', 'utm_campaign'])('when %s is 51 characters long', async (key) => {
    await refuses({ ...PATTERN_VALID, [key]: 'a'.repeat(51) });
  });

  it('with an extra key, a missing key, a non-string value, or (self) as a utm_ value', async () => {
    await refuses({ ...PATTERN_VALID, gclid: 'x' });
    await refuses({ referrer_host: '(none)', utm_source: '(none)', utm_medium: '(none)' });
    await refuses({ ...PATTERN_VALID, utm_source: 7 });
    await refuses({ ...PATTERN_VALID, utm_source: '(self)' });
    await refuses({ ...PATTERN_VALID, referrer_host: 'https://linkedin.com' });
  });

  it("while #224's other refusals still hold (the half of its reversed test that isn't session_started)", async () => {
    await expect(insert({ event_name: 'home_viewed', props: { city: 'nyc' } })).rejects.toThrow();
    await expect(insert({ event_name: 'not_an_event', props: {} })).rejects.toThrow();
  });
});

describe('the is_internal column (AC1)', () => {
  it('reads back false on a row inserted without it', async () => {
    const id = randomUUID();
    await insert({ id, event_name: 'home_viewed', props: { city: 'sf' } });
    const { rows } = await db.query<{ is_internal: boolean }>('select is_internal from public.events where id = $1', [id]);
    expect(rows).toEqual([{ is_internal: false }]);
  });

  it('anon can insert is_internal = true', async () => {
    const id = randomUUID();
    await insert({ id, event_name: 'home_viewed', props: { city: 'sf' }, is_internal: true });
    const { rows } = await db.query<{ is_internal: boolean }>('select is_internal from public.events where id = $1', [id]);
    expect(rows).toEqual([{ is_internal: true }]);
  });

  it('anon still cannot read events or events_clean', async () => {
    await expect(asAnon(() => db.query('select * from public.events limit 1'))).rejects.toThrow();
    await expect(asAnon(() => db.query('select * from public.events_clean limit 1'))).rejects.toThrow();
  });
});

describe('events_clean excludes by visitor (AC1)', () => {
  it('returns no row for a visitor with any is_internal row, including its earlier unflagged rows, and every other visitor\'s rows', async () => {
    const owner = randomUUID();
    const visitor = randomUUID();
    const earlier = new Date(Date.now() - 60_000).toISOString();

    await insert({ visitor_id: owner, event_name: 'home_viewed', props: { city: 'sf' }, occurred_at: earlier });
    await insert({ visitor_id: owner, event_name: 'home_viewed', props: { city: 'sf' }, is_internal: false });
    await insert({ visitor_id: owner, event_name: 'session_started', props: SENTINELS, is_internal: true });
    await insert({ visitor_id: visitor, event_name: 'home_viewed', props: { city: 'hcmc' } });
    await insert({ visitor_id: visitor, event_name: 'session_started', props: PATTERN_VALID, is_internal: false });

    const count = async (relation: string, visitorId: string) =>
      (
        await db.query<{ n: number }>(`select count(*)::int as n from public.${relation} where visitor_id = $1`, [
          visitorId,
        ])
      ).rows[0].n;

    expect(await count('events', owner)).toBe(3);
    expect(await count('events_clean', owner)).toBe(0);
    expect(await count('events', visitor)).toBe(2);
    expect(await count('events_clean', visitor)).toBe(2);

    const { rows } = await db.query<{ n: number }>(
      'select count(*)::int as n from public.events where visitor_id not in (select visitor_id from public.events where is_internal)',
    );
    const clean = await db.query<{ n: number }>('select count(*)::int as n from public.events_clean');
    expect(clean.rows[0].n).toBe(rows[0].n);
  });

  it('stays unreadable by anon and authenticated under Supabase-style default privileges, once recreated', async () => {
    // Supabase grants anon and authenticated everything on each new relation
    // in `public`; the recreated view is new, so it must be revoked again.
    const supabaseLikeDb = new PGlite({ extensions: { pgcrypto } });
    await supabaseLikeDb.exec('create role anon nologin; create role authenticated nologin;');
    await supabaseLikeDb.exec(
      'alter default privileges in schema public grant all on tables to anon, authenticated;',
    );
    for (const file of [
      '20260925000000_events.sql',
      '20260926000000_two_city_event_contract.sql',
      '20261001000000_analytics_readiness_event_contract.sql',
      '20261002000000_session_started_and_is_internal.sql',
    ]) {
      await supabaseLikeDb.exec(sql(file));
    }
    for (const role of ['anon', 'authenticated']) {
      await supabaseLikeDb.exec(`set role ${role};`);
      await expect(supabaseLikeDb.query('select * from public.events_clean limit 1')).rejects.toThrow();
      await expect(supabaseLikeDb.query('delete from public.events_clean')).rejects.toThrow();
      await supabaseLikeDb.exec('reset role;');
    }
    await supabaseLikeDb.close();
  });

  it('carries the is_internal column', async () => {
    const { rows } = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'events_clean' and column_name = 'is_internal'",
    );
    expect(rows).toHaveLength(1);
  });
});

describe('the client payload itself is stored (AC2)', () => {
  it('stores the exact row the sender POSTs for the launch link, is_internal included', async () => {
    const memory = () => {
      const map = new Map<string, string>();
      return {
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => void map.set(key, value),
        removeItem: (key: string) => void map.delete(key),
        clear: () => map.clear(),
        key: () => null,
        get length() {
          return map.size;
        },
      } as Storage;
    };
    vi.stubGlobal('navigator', { webdriver: false, userAgent: 'Mozilla/5.0' });
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    try {
      startTracking(
        { url: 'https://abcdefgh.supabase.co', publishableKey: 'sb_publishable_test_key', fetchImpl },
        {
          search: '?utm_source=linkedin&gclid=X&fbclid=Y&li_fat_id=Z&internal=1',
          referrer: 'https://www.linkedin.com/feed/',
          origin: 'https://dontdropthatpromo.test',
          localStorage: memory(),
          sessionStorage: memory(),
        },
      );
    } finally {
      resetTrack();
      vi.unstubAllGlobals();
    }

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const row = JSON.parse(fetchImpl.mock.calls[0][1].body) as Row & { variant: null };
    expect(row.event_name).toBe('session_started');
    expect(row.is_internal).toBe(true);

    await insert(row);
    const stored = await db.query<{ props: unknown; is_internal: boolean; visitor_id: string }>(
      'select props, is_internal, visitor_id from public.events where id = $1',
      [row.id],
    );
    expect(stored.rows).toEqual([{ props: row.props, is_internal: true, visitor_id: row.visitor_id }]);
  });
});
