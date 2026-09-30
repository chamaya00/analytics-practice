// @vitest-environment node
//
// The one-paste setup files in supabase/setup/ (scripts/build-setup-sql.mjs)
// are what the owner actually runs in Supabase's SQL Editor, so they are
// tested as pasted: each bundle is applied as a single script, on a PGlite
// database laid out like Supabase's (pgcrypto in an `extensions` schema, the
// platform's default search_path, and ADR 0008's auth fixture), and its own
// closing checks table must read PASS on every row.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SETUP = path.join(process.cwd(), 'supabase/setup');
const EVENTS = readFileSync(path.join(SETUP, '1-events.sql'), 'utf-8');
const WALLET = readFileSync(path.join(SETUP, '2-wallet.sql'), 'utf-8');

// Supabase's layout, as in rate-limit-search-path.migration.test.ts, plus the
// auth schema and `authenticated` role the wallet needs (wallet.migration.test.ts).
const SUPABASE_LAYOUT_SQL = `
  create schema extensions;
  create extension pgcrypto schema extensions;
  set search_path = "$user", public, extensions;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(current_setting('request.jwt.claim.sub', true), (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')), '')::uuid
  $$;
  create role authenticated nologin;
`;

type Check = { '#': number; check_name: string; result: string };

/** Runs a whole bundle as one script and returns its final result set: the checks table. */
async function runBundle(db: PGlite, sql: string): Promise<Check[]> {
  const results = await db.exec(sql);
  return results[results.length - 1].rows as Check[];
}

describe('supabase/setup bundles', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite({ extensions: { pgcrypto } });
    await db.exec(SUPABASE_LAYOUT_SQL);
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  it('are exactly what scripts/build-setup-sql.mjs generates from the migrations', () => {
    expect(() =>
      execFileSync('node', ['scripts/build-setup-sql.mjs', '--check'], { stdio: 'pipe' }),
    ).not.toThrow();
  }, 30_000);

  it('1-events.sql applies in one paste and every check passes', async () => {
    const checks = await runBundle(db, EVENTS);
    expect(checks).toHaveLength(11);
    expect(checks.filter((row) => row.result !== 'PASS')).toEqual([]);
  }, 60_000);

  it('2-wallet.sql applies after it and every check passes', async () => {
    const checks = await runBundle(db, WALLET);
    expect(checks).toHaveLength(4);
    expect(checks.filter((row) => row.result !== 'PASS')).toEqual([]);
  }, 60_000);

  it('a failing bundle leaves nothing behind (one transaction)', async () => {
    const fresh = new PGlite({ extensions: { pgcrypto } });
    await fresh.exec(SUPABASE_LAYOUT_SQL);
    const broken = EVENTS.replace('commit;', 'select 1/0;\ncommit;');
    await expect(fresh.exec(broken)).rejects.toThrow();
    await fresh.exec('rollback');
    const { rows } = await fresh.query<{ n: number }>(
      "select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name = 'events'",
    );
    expect(rows[0].n).toBe(0);
    await fresh.close();
  }, 60_000);
});
