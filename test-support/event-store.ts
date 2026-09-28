// #238: proves the store accepts the exact object a client call site sends
// (docs/measurement/219-analytics-readiness-contract.md §14: "the same
// object and not a hand-written lookalike"). A DOM test captures the props a
// screen hands to `track()`, and passes that same object here. It goes
// through the real sender in tracking-transport.ts, so what is inserted is
// the parsed body of the POST the browser would make, and that row is
// inserted as `anon` into a PGlite database (ADR 0006) carrying every
// migration up to and including #225's, in order.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { vi } from 'vitest';
import { createSupabaseSender } from '../src/lib/tracking-transport';
import type { EventName, EventProps } from '../src/lib/tracking';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase/migrations');

/** The last migration the #219 client shapes depend on (#225). */
const LAST_MIGRATION = '20261002000000_session_started_and_is_internal.sql';

/** Every migration file up to `LAST_MIGRATION`, in the order Supabase applies them. */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d{14}_.*\.sql$/.test(file) && file <= LAST_MIGRATION)
    .sort();
}

// The wallet migrations need an `auth` schema and an `authenticated` role,
// which PGlite doesn't have: ADR 0008's test fixture, as in
// wallet.migration.test.ts.
const AUTH_FIXTURE_SQL = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(current_setting('request.jwt.claim.sub', true), (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')), '')::uuid
  $$;
  create role authenticated nologin;
`;

let dbPromise: Promise<PGlite> | null = null;

async function openStore(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(AUTH_FIXTURE_SQL);
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8'));
  }
  return db;
}

/** One database per test file, opened on first use. */
function store(): Promise<PGlite> {
  dbPromise ??= openStore();
  return dbPromise;
}

/**
 * Opens the database ahead of the first test that needs it. Booting PGlite
 * and applying every migration takes seconds, and longer with every test
 * file doing it in parallel, so a file calls this from `beforeAll` with its
 * own generous timeout rather than paying it inside one test's default 5s.
 */
export const EVENT_STORE_BOOT_TIMEOUT_MS = 60_000;

export async function openEventStore(): Promise<void> {
  await store();
}

export async function closeEventStore(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  dbPromise = null;
  await db.close();
}

function memoryStorage(): Storage {
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
}

export interface SentRow {
  id: string;
  visitor_id: string;
  session_id: string;
  event_name: string;
  occurred_at: string;
  variant: null;
  is_internal: boolean;
  props: EventProps;
}

/** The row the real sender would POST for this call, or `null` if the sender itself drops it. */
export function rowTheClientSends(eventName: EventName, props: EventProps): SentRow | null {
  const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
  // happy-dom's own navigator reads as automated to the sender's bot check,
  // so an ordinary browser's stands in for this one call, then the original
  // comes back — without touching any other global the calling test stubbed.
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { webdriver: false, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
  });
  try {
    createSupabaseSender({
      url: 'https://abcdefgh.supabase.co',
      publishableKey: 'sb_publishable_test_key',
      fetchImpl,
      localStorage: memoryStorage(),
      sessionStorage: memoryStorage(),
    })(eventName, props);
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
  }
  if (fetchImpl.mock.calls.length === 0) return null;
  return JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string) as SentRow;
}

/**
 * Sends `props` through the real sender, inserts the resulting row as
 * `anon`, and returns the `props` the store kept. Rejects when the sender
 * drops the call or the store refuses the row, with the reason.
 */
export async function storeWhatTheClientSends(eventName: EventName, props: EventProps): Promise<unknown> {
  const row = rowTheClientSends(eventName, props);
  if (!row) throw new Error(`the client's own sender dropped ${eventName} ${JSON.stringify(props)}`);
  const db = await store();
  await db.exec('set role anon;');
  try {
    await db.query(
      'insert into public.events (id, visitor_id, session_id, event_name, occurred_at, props, variant, is_internal) values ($1, $2, $3, $4, $5, $6, $7, $8)',
      [row.id, row.visitor_id, row.session_id, row.event_name, row.occurred_at, JSON.stringify(row.props), row.variant, row.is_internal],
    );
  } finally {
    await db.exec('reset role;');
  }
  const { rows } = await db.query<{ props: unknown }>('select props from public.events where id = $1', [row.id]);
  return rows[0]?.props;
}
