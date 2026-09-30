/* global process, console */
// Builds the one-paste setup files in supabase/setup/ from supabase/migrations/.
//
// The owner applies migrations by hand in Supabase's SQL Editor (ADR 0005,
// owner setup checklist). Six separate pastes, each followed by its own check,
// was slow and error-prone, so each bundle here is every migration it covers,
// verbatim and in order, wrapped in one transaction: if any statement fails,
// nothing is applied and the whole file can simply be run again. The last
// statement is one results table of checks, each PASS or FAIL.
//
// Never edit the files in supabase/setup/ by hand. Run
// `node scripts/build-setup-sql.mjs` after adding a migration, and
// setup-bundle.migration.test.ts fails if a bundle is out of date.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = path.join(ROOT, 'supabase/migrations');
const SETUP = path.join(ROOT, 'supabase/setup');

export const BUNDLES = [
  {
    file: '1-events.sql',
    title: 'Events store: the six event migrations (ADR 0005 owner setup, step 2)',
    migrations: [
      '20260925000000_events.sql',
      '20260926000000_two_city_event_contract.sql',
      '20260930000000_rate_limit_search_path.sql',
      '20261001000000_analytics_readiness_event_contract.sql',
      '20261002000000_session_started_and_is_internal.sql',
      '20261003000000_second_pass_readiness.sql',
    ],
    checks: [
      [
        'events table, events_clean view and the two private rate-limit tables exist',
        `(select count(*) from information_schema.tables where (table_schema, table_name) in
      (('public','events'),('public','events_clean'),('private','write_log'),('private','rate_limit_salt'))) = 4`,
      ],
      ['the rate-limit salt has exactly one row', `(select count(*) from private.rate_limit_salt) = 1`],
      [
        'the rate-limit trigger can find the hashing function (extensions on its search_path)',
        `(select array_to_string(proconfig, ',') like '%extensions%' from pg_proc where proname = 'enforce_write_rate_limit')`,
      ],
      [
        'the readiness events are accepted (driver_rating_submitted)',
        `(select pg_get_functiondef('public.event_is_valid_224(text, jsonb)'::regprocedure) like '%driver_rating_submitted%')`,
      ],
      [
        'session_started is accepted',
        `(select pg_get_functiondef('public.event_is_valid_225(text, jsonb)'::regprocedure) like '%session_started%')`,
      ],
      [
        'is_internal column: boolean, not null, default false',
        `exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'events'
      and column_name = 'is_internal' and data_type = 'boolean' and is_nullable = 'NO' and column_default = 'false')`,
      ],
      [
        'seq (integer) and build (text) columns exist and are optional',
        `(select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'events'
      and ((column_name = 'seq' and data_type = 'integer') or (column_name = 'build' and data_type = 'text'))
      and is_nullable = 'YES' and column_default is null) = 2`,
      ],
      [
        'the second-pass shapes are accepted (fee_modes)',
        `(select pg_get_functiondef('public.event_is_valid(text, jsonb)'::regprocedure) like '%fee_modes%')`,
      ],
      [
        'analytics views exist and the public key cannot read them',
        `not has_table_privilege('anon', 'analytics.orders', 'select') and (select count(*) from analytics.orders) >= 0`,
      ],
      [
        'the public key cannot read raw events',
        `not has_table_privilege('anon', 'public.events', 'select')`,
      ],
    ],
  },
  {
    file: '2-wallet.sql',
    title: 'Play-money wallet: the three wallet migrations (ADR 0008 owner setup, step 12). Only when switching the wallet on.',
    migrations: [
      '20260927000000_wallet.sql',
      '20260928000000_wallet_tip.sql',
      '20260929000000_wallet_revoke_anon_execute.sql',
    ],
    checks: [
      ['wallets table exists', `exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wallets')`],
      [
        'wallet functions exist',
        `(select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('wallet_get','wallet_claim_drip','wallet_debit','wallet_tip')) = 4`,
      ],
      [
        'the public key cannot call wallet functions (#217)',
        `not has_function_privilege('anon', 'public.wallet_debit(uuid, text, bigint)', 'execute')
      and not has_function_privilege('anon', 'public.wallet_tip(uuid, bigint)', 'execute')`,
      ],
      [
        'signed-in users can call wallet functions',
        `has_function_privilege('authenticated', 'public.wallet_debit(uuid, text, bigint)', 'execute')`,
      ],
    ],
  },
];

export function buildBundle(bundle) {
  const parts = [
    `-- ${bundle.title}`,
    '--',
    '-- GENERATED by scripts/build-setup-sql.mjs from supabase/migrations/. Do not edit.',
    '-- Paste the whole file into Supabase > SQL Editor > New query, and click Run once.',
    '-- Everything runs in one transaction: if any statement fails, nothing is',
    '-- applied, and the file can be run again after the problem is fixed.',
    '-- The last result is a table of checks. Every row should say PASS.',
    '',
    'begin;',
    '',
  ];
  for (const name of bundle.migrations) {
    const sql = readFileSync(path.join(MIGRATIONS, name), 'utf-8').trimEnd();
    parts.push(`-- ============================================================`);
    parts.push(`-- ${name}`);
    parts.push(`-- ============================================================`);
    parts.push(sql, '');
  }
  parts.push('commit;', '');
  parts.push('-- Checks: every row should say PASS.');
  const rows = bundle.checks.map(
    ([label, expr], i) => `  (${i + 1}, '${label.replace(/'/g, "''")}', ${expr})`,
  );
  parts.push(
    'select n as "#", check_name, case when ok then \'PASS\' else \'FAIL\' end as result',
    'from (values',
    rows.join(',\n'),
    ') as checks(n, check_name, ok)',
    'order by n;',
    '',
  );
  return parts.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // `--check` writes nothing and exits 1 if any committed bundle is stale.
  const check = process.argv.includes('--check');
  let stale = false;
  mkdirSync(SETUP, { recursive: true });
  for (const bundle of BUNDLES) {
    const target = path.join(SETUP, bundle.file);
    const want = buildBundle(bundle);
    if (check) {
      let have;
      try {
        have = readFileSync(target, 'utf-8');
      } catch {
        have = '';
      }
      if (have !== want) {
        stale = true;
        console.error(`supabase/setup/${bundle.file} is out of date: run node scripts/build-setup-sql.mjs`);
      }
    } else {
      writeFileSync(target, want);
      console.log(`wrote supabase/setup/${bundle.file}`);
    }
  }
  if (stale) process.exit(1);
}
