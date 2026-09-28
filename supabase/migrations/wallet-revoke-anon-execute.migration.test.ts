// @vitest-environment node
//
// Proves 20260929000000_wallet_revoke_anon_execute.sql (#188) against a real
// Postgres — see wallet.migration.test.ts and ADR 0008 for why PGlite and how
// the `auth` schema is stubbed. PGlite has no Supabase project, so it never
// reproduces Supabase's own default privileges: Supabase grants `execute` on
// every new `public` function directly to `anon` and `authenticated`, not
// only through the `PUBLIC` pseudo-role, so a naive test (no
// default-privileges fixture) would pass before the fix even ships. This
// test recreates that default first, with `alter default privileges in
// schema public grant execute on functions to anon, authenticated`, before
// applying any migration.
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
const REVOKE_ANON_MIGRATION_SQL = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260929000000_wallet_revoke_anon_execute.sql'),
  'utf-8',
);

// Supabase's own auth.uid() definition, verbatim (ADR 0008, quoting
// supabase/auth's `20211202183645_update_auth_uid.up.sql`). `anon` comes
// from the events migration; this fixture supplies only what PGlite has
// none of.
const AUTH_FIXTURE_SQL = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(current_setting('request.jwt.claim.sub', true), (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')), '')::uuid
  $$;
  create role authenticated nologin;
`;

// Supabase's own project-level default: every new `public` function is
// granted `execute` directly to `anon` and `authenticated` at creation time,
// on top of the `PUBLIC` grant Postgres itself always gives a new function.
// This has to run before the migrations below — it is a *default* applying
// to functions this same session role creates afterwards, not a one-off
// grant on functions that already exist. `alter default privileges`
// requires its grantee roles to already exist, and `anon` is not created
// until the events migration runs, so this fixture creates it early too —
// guarded the same way the events migration itself guards its own create,
// so the later `create role anon nologin` there is a no-op.
const SUPABASE_DEFAULT_PRIVILEGES_SQL = `
  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin;
    end if;
  end
  $$;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

const PROTECTED_FUNCTION_SIGNATURES = [
  'public.wallet_get()',
  'public.wallet_claim_drip()',
  'public.wallet_debit(uuid, text, bigint)',
  'public.wallet_tip(uuid, bigint)',
];

async function hasExecute(target: PGlite, role: string, signature: string) {
  const result = await target.query<{ has_privilege: boolean }>(
    "select has_function_privilege($1, $2, 'execute') as has_privilege",
    [role, signature],
  );
  return result.rows[0].has_privilege;
}

async function makeDb(includeFix: boolean) {
  const target = new PGlite({ extensions: { pgcrypto } });
  await target.exec(AUTH_FIXTURE_SQL);
  await target.exec(SUPABASE_DEFAULT_PRIVILEGES_SQL);
  await target.exec(EVENTS_MIGRATION_SQL);
  await target.exec(TWO_CITY_MIGRATION_SQL);
  await target.exec(WALLET_MIGRATION_SQL);
  await target.exec(WALLET_TIP_MIGRATION_SQL);
  if (includeFix) {
    await target.exec(REVOKE_ANON_MIGRATION_SQL);
  }
  return target;
}

let holeDb: PGlite; // AC1: the four existing migrations, Supabase defaults recreated, new file left out
let fixedDb: PGlite; // AC2: the same, plus the new file

beforeAll(async () => {
  holeDb = await makeDb(false);
  fixedDb = await makeDb(true);
});

afterAll(async () => {
  await holeDb.close();
  await fixedDb.close();
});

describe('AC1: the test reproduces the hole before the fix', () => {
  it.each(PROTECTED_FUNCTION_SIGNATURES)(
    'with Supabase default privileges recreated and the new migration left out, anon can execute %s',
    async (signature) => {
      expect(await hasExecute(holeDb, 'anon', signature)).toBe(true);
    },
  );
});

describe('AC2: the new migration closes it without touching anything else', () => {
  it.each(PROTECTED_FUNCTION_SIGNATURES)('anon can no longer execute %s', async (signature) => {
    expect(await hasExecute(fixedDb, 'anon', signature)).toBe(false);
  });

  it('anon can still execute wallet_ready (D1 fallback, #140)', async () => {
    expect(await hasExecute(fixedDb, 'anon', 'public.wallet_ready()')).toBe(true);
  });

  it.each(PROTECTED_FUNCTION_SIGNATURES)('authenticated can still execute %s', async (signature) => {
    expect(await hasExecute(fixedDb, 'authenticated', signature)).toBe(true);
  });

  it('authenticated can still execute wallet_ready', async () => {
    expect(await hasExecute(fixedDb, 'authenticated', 'public.wallet_ready()')).toBe(true);
  });

  it('exactly one wallet_% function in public is executable by anon: wallet_ready', async () => {
    const result = await fixedDb.query<{ proname: string }>(`
      select p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname like 'wallet_%'
        and has_function_privilege('anon', p.oid, 'execute')
    `);
    expect(result.rows.map((row) => row.proname)).toEqual(['wallet_ready']);
  });

  it('anon calling wallet_get directly raises insufficient_privilege (42501)', async () => {
    await fixedDb.query('set role anon');
    try {
      await expect(fixedDb.query('select public.wallet_get()')).rejects.toMatchObject({ code: '42501' });
    } finally {
      await fixedDb.query('reset role');
    }
  });
});
