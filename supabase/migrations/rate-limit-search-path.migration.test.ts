// @vitest-environment node
//
// Proves #222's fix for `enforce_write_rate_limit()`'s pinned `search_path`
// against a PGlite database recreating Supabase's *real* schema layout, not
// the top-level one every other test in this directory uses. On Supabase,
// pgcrypto is installed into an `extensions` schema — the platform's own
// default, not a project setting — and the platform's default `search_path`
// (`"$user", public, extensions`) is what makes `digest()`/`gen_random_bytes()`
// resolve ambiently everywhere except inside a function that pins its own
// `search_path` explicitly, the way `enforce_write_rate_limit()` does
// (`20260925000000_events.sql`, `security definer set search_path = public,
// private, pg_temp`, deliberately pinned so a same-named object earlier on
// some other role's path can't hijack it). That pin excludes `extensions`,
// so every insert as `anon` — which fires the trigger, which calls
// `digest()` — failed with "function digest(bytea, unknown) does not exist"
// on the real platform, silently: the browser swallows the error (ADR 0005),
// so the store looked fine and recorded nothing.
//
// `events.migration.test.ts` and every other file in this directory build
// their PGlite instance with `PGlite({ extensions: { pgcrypto } })` and let
// the migration's own `create extension if not exists pgcrypto;` install it
// wherever a vanilla session's default `search_path` (`"$user", public`)
// puts it — `public`. That never reproduces this bug. Here, `extensions`
// is created and pgcrypto installed into it *before* the migrations run,
// and the session's `search_path` is set to match Supabase's own platform
// default, exactly as Supabase's real database would greet a fresh
// connection — the migrations then run unmodified against that.
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
const WALLET_REVOKE_ANON_MIGRATION_SQL = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260929000000_wallet_revoke_anon_execute.sql'),
  'utf-8',
);
const RATE_LIMIT_SEARCH_PATH_MIGRATION_SQL = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260930000000_rate_limit_search_path.sql'),
  'utf-8',
);

const ALL_MIGRATIONS_SQL = [
  EVENTS_MIGRATION_SQL,
  TWO_CITY_MIGRATION_SQL,
  WALLET_MIGRATION_SQL,
  WALLET_TIP_MIGRATION_SQL,
  WALLET_REVOKE_ANON_MIGRATION_SQL,
];

// Supabase's own auth.uid() definition, verbatim (ADR 0008, quoting
// supabase/auth's `20211202183645_update_auth_uid.up.sql`) — the wallet
// migrations in ALL_MIGRATIONS_SQL need `auth`/`authenticated` to apply at
// all, same fixture as wallet.migration.test.ts.
const AUTH_FIXTURE_SQL = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(current_setting('request.jwt.claim.sub', true), (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')), '')::uuid
  $$;
  create role authenticated nologin;
`;

// Recreates Supabase's real layout — pgcrypto installed into `extensions`,
// not `public` — and the platform's own default `search_path`, which a
// vanilla PGlite session does not carry, before any migration runs.
const SUPABASE_LAYOUT_SQL = `
  create schema extensions;
  create extension pgcrypto schema extensions;
  set search_path = "$user", public, extensions;
`;

const VALID_EVENT_PROPS = { city: 'sf', restaurant_slug: 'a-place' };

// The rate-limit trigger only calls digest() when it has a client IP to hash
// (`if client_ip is not null then ... digest ...`, 20260925000000_events.sql)
// — a request with no `x-forwarded-for`/`cf-connecting-ip` header skips that
// branch entirely and is not rate-limited (that file's own comment). A test
// insert has to set one of those headers, or it never reaches digest() and
// never exercises the bug this file exists to prove. Defaults to a fresh,
// unique fake IP per call so an unrelated insertEvent() call never counts
// against another test's own rate-limit window on a shared `db`.
async function insertEvent(target: PGlite, ip: string = randomUUID()) {
  await target.query("select set_config('request.headers', $1, false)", [
    JSON.stringify({ 'x-forwarded-for': ip }),
  ]);
  return target.query(
    `insert into public.events (id, visitor_id, session_id, event_name, occurred_at, props, variant)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      randomUUID(),
      randomUUID(),
      randomUUID(),
      'restaurant_opened',
      new Date().toISOString(),
      JSON.stringify(VALID_EVENT_PROPS),
      null,
    ],
  );
}

describe('AC1/AC2: Supabase-layout PGlite database (pgcrypto in extensions, not public)', () => {
  let beforeFixDb: PGlite;
  let afterFixDb: PGlite;

  beforeAll(async () => {
    beforeFixDb = new PGlite({ extensions: { pgcrypto } });
    await beforeFixDb.exec(SUPABASE_LAYOUT_SQL);
    await beforeFixDb.exec(AUTH_FIXTURE_SQL);
    for (const migrationSql of ALL_MIGRATIONS_SQL) {
      await beforeFixDb.exec(migrationSql);
    }
    await beforeFixDb.exec('set role anon;');

    afterFixDb = new PGlite({ extensions: { pgcrypto } });
    await afterFixDb.exec(SUPABASE_LAYOUT_SQL);
    await afterFixDb.exec(AUTH_FIXTURE_SQL);
    for (const migrationSql of ALL_MIGRATIONS_SQL) {
      await afterFixDb.exec(migrationSql);
    }
    await afterFixDb.exec(RATE_LIMIT_SEARCH_PATH_MIGRATION_SQL);
    await afterFixDb.exec('set role anon;');
  });

  afterAll(async () => {
    await beforeFixDb.close();
    await afterFixDb.close();
  });

  it('AC1: without the fix, an insert as anon fails because the trigger cannot resolve digest()', async () => {
    await expect(insertEvent(beforeFixDb)).rejects.toThrow(/function digest\(bytea, unknown\) does not exist/);
  });

  it('AC2: with the fix applied, the same insert as anon succeeds', async () => {
    await expect(insertEvent(afterFixDb)).resolves.toBeDefined();
  });
});

describe('AC3: the fix does not regress the existing top-level PGlite layout', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite({ extensions: { pgcrypto } });
    await db.exec(AUTH_FIXTURE_SQL);
    for (const migrationSql of ALL_MIGRATIONS_SQL) {
      await db.exec(migrationSql);
    }
    await db.exec(RATE_LIMIT_SEARCH_PATH_MIGRATION_SQL);
    await db.exec('set role anon;');
  });

  afterAll(async () => {
    await db.close();
  });

  it('still accepts a well-shaped insert as anon', async () => {
    await expect(insertEvent(db)).resolves.toBeDefined();
  });

  it('still enforces the 60-per-5-minutes rate limit (ADR 0005 §4)', async () => {
    for (let i = 0; i < 60; i += 1) {
      await expect(insertEvent(db, '203.0.113.7')).resolves.toBeDefined();
    }
    await expect(insertEvent(db, '203.0.113.7')).rejects.toThrow();
  });
});
