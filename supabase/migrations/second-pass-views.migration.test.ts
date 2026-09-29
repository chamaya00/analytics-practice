// @vitest-environment node
//
// Proves the `analytics` views of 20261003000000_second_pass_readiness.sql
// (#273) against a real Postgres (ADR 0006), for
// docs/measurement/270-analytics-readiness-second-pass.md §11.2-§11.4 and
// §14 S5 and S6 (AC3). Rows are seeded as the table owner with explicit
// `received_at`, because anon cannot set it; every payload is a shape the
// store accepts.
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

const SHA = 'b'.repeat(40);

// Browsers, tabs and orders.
const VA = 'a0000000-0000-4000-8000-000000000001'; // ordered twice, two tabs
const VB = 'b0000000-0000-4000-8000-000000000002'; // #81 client, no session_started
const VC = 'c0000000-0000-4000-8000-000000000003'; // two session_started, seq gap
const VI = 'd0000000-0000-4000-8000-000000000004'; // the owner's browser
const SA1 = 'a1000000-0000-4000-8000-000000000001';
const SA2 = 'a2000000-0000-4000-8000-000000000002';
const SB = 'b1000000-0000-4000-8000-000000000003';
const SC = 'c1000000-0000-4000-8000-000000000004';
const SI = 'd1000000-0000-4000-8000-000000000005';
const O1 = '01000000-0000-4000-8000-000000000001';
const O2 = '02000000-0000-4000-8000-000000000002';
const O3 = '03000000-0000-4000-8000-000000000003';
const O5 = '05000000-0000-4000-8000-000000000005';
const O9 = '09000000-0000-4000-8000-000000000009';

interface Seed {
  id?: string;
  visitor: string;
  session: string;
  name: string;
  occurred: string;
  received: string;
  props: unknown;
  seq?: number;
  build?: string;
  internal?: boolean;
}

let db: PGlite;
let n = 0;

const uid = () => `e${String(++n).padStart(7, '0')}-0000-4000-8000-000000000000`;

async function seed(row: Seed) {
  await db.query(
    `insert into public.events
       (id, visitor_id, session_id, event_name, occurred_at, received_at, props, variant, seq, build, is_internal)
     values ($1, $2, $3, $4, $5, $6, $7, null, $8, $9, $10)`,
    [
      row.id ?? uid(),
      row.visitor,
      row.session,
      row.name,
      row.occurred,
      row.received,
      JSON.stringify(row.props),
      row.seq ?? null,
      row.build ?? null,
      row.internal ?? false,
    ],
  );
}

const D1 = (time: string) => `2026-10-01T${time}Z`;
const D2 = (time: string) => `2026-10-02T${time}Z`;

const ORDER_270 = {
  amount_minor: 1800,
  applied_voucher_ids: [],
  city: 'sf',
  currency: 'USD',
  delivery_instructions: 'leave_at_door',
  drop_off_preset: 'home',
  item_count: 2,
  order_id: O1,
  restaurant_slug: 'pho-place',
  saved_amount_minor: 0,
  thanks_voucher_amount_minor: 0,
  utensils: false,
  vip_level: 'none',
  vip_saved_amount_minor: 0,
  wallet_paid: true,
};
const ORDER_219 = {
  amount_minor: 1500,
  applied_voucher_ids: ['la-discount-t1'],
  city: 'la',
  currency: 'USD',
  delivery_instructions: 'call_on_arrival',
  drop_off_preset: 'office',
  item_count: 1,
  order_id: O2,
  saved_amount_minor: 200,
  thanks_voucher_amount_minor: 0,
  utensils: true,
  vip_level: 'gold',
  vip_saved_amount_minor: 0,
  wallet_paid: false,
};
const ORDER_81 = {
  amount_minor: 395000,
  applied_voucher_ids: ['hcmc-discount-t2', 'hcmc-delivery-entry'],
  currency: 'VND',
  delivery_instructions: 'leave_at_door',
  drop_off_preset: 'home',
  item_count: 2,
  order_id: O3,
  saved_amount_minor: 40000,
  utensils: true,
};
const ACQ = { referrer_host: 'news.ycombinator.com', utm_source: 'linkedin', utm_medium: 'social', utm_campaign: 'launch' };
const NONE = { referrer_host: '(none)', utm_source: '(none)', utm_medium: '(none)', utm_campaign: '(none)' };

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  for (const file of MIGRATIONS) await db.exec(sql(file));

  // VA, tab SA1: a #270 order placed twice, then every post-order event
  // (two tips), then a #219 order with none, then an orphan order_delivered.
  // The first O1 row has the larger id and the first tip the larger id, so a
  // view that broke ties before time would pick the wrong row.
  await seed({ visitor: VA, session: SA1, name: 'session_started', occurred: D1('10:00:00'), received: D1('10:00:05'), props: ACQ, seq: 1, build: SHA });
  await seed({ visitor: VA, session: SA1, name: 'home_viewed', occurred: D1('10:01:00'), received: D1('10:01:01'), props: { city: 'sf' }, seq: 2, build: SHA });
  await seed({ id: 'ffffffff-0000-4000-8000-000000000001', visitor: VA, session: SA1, name: 'order_placed', occurred: D1('10:04:58'), received: D1('10:05:00'), props: ORDER_270, seq: 3, build: SHA });
  await seed({ id: '00000000-0000-4000-8000-000000000002', visitor: VA, session: SA1, name: 'order_placed', occurred: D1('10:05:58'), received: D1('10:06:00'), props: { ...ORDER_270, amount_minor: 2500, item_count: 5, restaurant_slug: 'other-place' }, seq: 4, build: SHA });
  await seed({ visitor: VA, session: SA1, name: 'order_delivered', occurred: D1('10:39:59'), received: D1('10:40:00'), props: { order_id: O1 }, seq: 5, build: SHA });
  await seed({ visitor: VA, session: SA1, name: 'rating_submitted', occurred: D1('10:40:59'), received: D1('10:41:00'), props: { order_id: O1, stars: 5, tags: [] }, seq: 6, build: SHA });
  await seed({ visitor: VA, session: SA1, name: 'driver_rating_submitted', occurred: D1('10:41:59'), received: D1('10:42:00'), props: { order_id: O1, stars: 4 }, seq: 7, build: SHA });
  await seed({ id: 'ffffffff-0000-4000-8000-000000000003', visitor: VA, session: SA1, name: 'tip_sent', occurred: D1('10:42:59'), received: D1('10:43:00'), props: { currency: 'USD', order_id: O1, tip_amount_minor: 100 }, seq: 8, build: SHA });
  await seed({ id: '00000000-0000-4000-8000-000000000004', visitor: VA, session: SA1, name: 'tip_sent', occurred: D1('10:43:59'), received: D1('10:44:00'), props: { currency: 'USD', order_id: O1, tip_amount_minor: 200 }, seq: 9, build: SHA });
  await seed({ visitor: VA, session: SA1, name: 'order_placed', occurred: D1('10:59:50'), received: D1('11:00:00'), props: ORDER_219 });
  await seed({ visitor: VA, session: SA1, name: 'order_delivered', occurred: D1('11:09:59'), received: D1('11:10:00'), props: { order_id: O9 } });
  // VA, second tab, the next day.
  await seed({ visitor: VA, session: SA2, name: 'home_viewed', occurred: D2('09:00:00'), received: D2('09:00:00'), props: { city: 'sf' }, seq: 1, build: SHA });

  // VB: an old client. No session_started, no seq, no build; a 9-key order.
  await seed({ visitor: VB, session: SB, name: 'home_viewed', occurred: D1('12:00:00'), received: D1('12:00:00'), props: { city: 'hcmc' } });
  await seed({ visitor: VB, session: SB, name: 'order_placed', occurred: D1('12:04:59'), received: D1('12:05:00'), props: ORDER_81 });

  // VC: two session_started rows, the one received first occurring later, and
  // seq 1, 2, 4, 4 (a duplicated tab).
  await seed({ visitor: VC, session: SC, name: 'session_started', occurred: D1('13:05:00'), received: D1('13:00:10'), props: { ...NONE, referrer_host: 'a.example.com' }, seq: 1, build: SHA });
  await seed({ visitor: VC, session: SC, name: 'session_started', occurred: D1('13:00:00'), received: D1('13:00:20'), props: { ...NONE, referrer_host: '(self)' }, seq: 2, build: SHA });
  await seed({ visitor: VC, session: SC, name: 'home_viewed', occurred: D1('13:00:59'), received: D1('13:01:00'), props: { city: 'la' }, seq: 4, build: SHA });
  await seed({ visitor: VC, session: SC, name: 'home_viewed', occurred: D1('13:01:09'), received: D1('13:01:10'), props: { city: 'la' }, seq: 4, build: SHA });

  // VI: the owner's browser, one flagged row among several. Absent from all.
  await seed({ visitor: VI, session: SI, name: 'home_viewed', occurred: D1('14:00:00'), received: D1('14:00:00'), props: { city: 'sf' }, seq: 1, build: SHA });
  await seed({ visitor: VI, session: SI, name: 'session_started', occurred: D1('14:00:01'), received: D1('14:00:01'), props: NONE, seq: 2, build: SHA, internal: true });
  await seed({ visitor: VI, session: SI, name: 'order_placed', occurred: D1('14:05:00'), received: D1('14:05:00'), props: { ...ORDER_270, order_id: O5 }, seq: 3, build: SHA });
  await seed({ visitor: VI, session: SI, name: 'order_delivered', occurred: D1('14:40:00'), received: D1('14:40:00'), props: { order_id: O5 }, seq: 4, build: SHA });
});

afterAll(async () => {
  await db.close();
});

/** Timestamps and dates as ISO strings and bigints as numbers, so a row reads as it is written above. */
async function rows(query: string) {
  const { rows } = await db.query<Record<string, unknown>>(query);
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : typeof value === 'bigint' ? Number(value) : value,
      ]),
    ),
  );
}

const T = (iso: string) => `${iso}.000Z`;

describe('analytics.orders (§11.2, S5)', () => {
  it('has exactly the columns of §11.2, in order', async () => {
    const { rows: cols } = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'analytics' and table_name = 'orders' order by ordinal_position",
    );
    expect(cols.map((c) => c.column_name)).toEqual([
      'order_id', 'visitor_id', 'session_id', 'placed_at', 'placed_occurred_at', 'placed_day', 'build',
      'props_shape', 'placed_rows', 'city', 'currency', 'restaurant_slug', 'amount_minor', 'item_count',
      'applied_voucher_ids', 'applied_voucher_count', 'saved_amount_minor', 'thanks_voucher_amount_minor',
      'vip_level', 'vip_saved_amount_minor', 'wallet_paid', 'drop_off_preset', 'delivery_instructions',
      'utensils', 'delivery_seen_at', 'restaurant_rated_at', 'restaurant_stars', 'driver_rated_at',
      'driver_stars', 'tipped_at', 'tip_amount_minor',
    ]);
  });

  it('returns one row per placed order: the #270, the #219 and the #81, and nothing for the orphan or the owner', async () => {
    const result = await rows('select * from analytics.orders order by placed_at');
    expect(result).toEqual([
      {
        // The duplicate O1 row is collapsed to the earlier one: its amount,
        // item count and slug win, and placed_rows says there were two.
        order_id: O1,
        visitor_id: VA,
        session_id: SA1,
        placed_at: T('2026-10-01T10:05:00'),
        placed_occurred_at: T('2026-10-01T10:04:58'),
        placed_day: T('2026-10-01T00:00:00'),
        build: SHA,
        props_shape: '#270',
        placed_rows: 2,
        city: 'sf',
        currency: 'USD',
        restaurant_slug: 'pho-place',
        amount_minor: 1800,
        item_count: 2,
        applied_voucher_ids: [],
        applied_voucher_count: 0,
        saved_amount_minor: 0,
        thanks_voucher_amount_minor: 0,
        vip_level: 'none',
        vip_saved_amount_minor: 0,
        wallet_paid: true,
        drop_off_preset: 'home',
        delivery_instructions: 'leave_at_door',
        utensils: false,
        delivery_seen_at: T('2026-10-01T10:40:00'),
        restaurant_rated_at: T('2026-10-01T10:41:00'),
        restaurant_stars: 5,
        driver_rated_at: T('2026-10-01T10:42:00'),
        driver_stars: 4,
        // Two tips: the earliest by time is used, not the smaller id.
        tipped_at: T('2026-10-01T10:43:00'),
        tip_amount_minor: 100,
      },
      {
        // #219: no restaurant_slug, no build, and no post-order events, so
        // every post-order column is null rather than zero or false.
        order_id: O2,
        visitor_id: VA,
        session_id: SA1,
        placed_at: T('2026-10-01T11:00:00'),
        placed_occurred_at: T('2026-10-01T10:59:50'),
        placed_day: T('2026-10-01T00:00:00'),
        build: null,
        props_shape: '#219',
        placed_rows: 1,
        city: 'la',
        currency: 'USD',
        restaurant_slug: null,
        amount_minor: 1500,
        item_count: 1,
        applied_voucher_ids: ['la-discount-t1'],
        applied_voucher_count: 1,
        saved_amount_minor: 200,
        thanks_voucher_amount_minor: 0,
        vip_level: 'gold',
        vip_saved_amount_minor: 0,
        wallet_paid: false,
        drop_off_preset: 'office',
        delivery_instructions: 'call_on_arrival',
        utensils: true,
        delivery_seen_at: null,
        restaurant_rated_at: null,
        restaurant_stars: null,
        driver_rated_at: null,
        driver_stars: null,
        tipped_at: null,
        tip_amount_minor: null,
      },
      {
        // #81: city from R3 (VND is hcmc), and the four #219 fields null.
        order_id: O3,
        visitor_id: VB,
        session_id: SB,
        placed_at: T('2026-10-01T12:05:00'),
        placed_occurred_at: T('2026-10-01T12:04:59'),
        placed_day: T('2026-10-01T00:00:00'),
        build: null,
        props_shape: '#81',
        placed_rows: 1,
        city: 'hcmc',
        currency: 'VND',
        restaurant_slug: null,
        amount_minor: 395000,
        item_count: 2,
        applied_voucher_ids: ['hcmc-discount-t2', 'hcmc-delivery-entry'],
        applied_voucher_count: 2,
        saved_amount_minor: 40000,
        thanks_voucher_amount_minor: null,
        vip_level: null,
        vip_saved_amount_minor: null,
        wallet_paid: null,
        drop_off_preset: 'home',
        delivery_instructions: 'leave_at_door',
        utensils: true,
        delivery_seen_at: null,
        restaurant_rated_at: null,
        restaurant_stars: null,
        driver_rated_at: null,
        driver_stars: null,
        tipped_at: null,
        tip_amount_minor: null,
      },
    ]);
  });

  it('has no row for the orphan order_delivered or the internal browser\'s order', async () => {
    const result = await rows(`select order_id from analytics.orders where order_id in ('${O9}', '${O5}')`);
    expect(result).toEqual([]);
  });
});

describe('analytics.sessions (§11.3, S5)', () => {
  it('has exactly the columns of §11.3, in order', async () => {
    const { rows: cols } = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'analytics' and table_name = 'sessions' order by ordinal_position",
    );
    expect(cols.map((c) => c.column_name)).toEqual([
      'session_id', 'visitor_id', 'visitor_ids', 'started_at', 'session_day', 'last_received_at',
      'event_rows', 'session_started_rows', 'source', 'referrer_host', 'utm_source', 'utm_medium',
      'utm_campaign', 'ordered', 'orders', 'seq_max', 'seq_distinct', 'seq_lost',
    ]);
  });

  it('returns one row per tab, and none for the owner\'s', async () => {
    const result = await rows('select * from analytics.sessions order by started_at');
    expect(result).toEqual([
      {
        // Nulls in seq (the #219 order and the orphan) stay out of M18.
        session_id: SA1,
        visitor_id: VA,
        visitor_ids: 1,
        started_at: T('2026-10-01T10:00:05'),
        session_day: T('2026-10-01T00:00:00'),
        last_received_at: T('2026-10-01T11:10:00'),
        event_rows: 11,
        session_started_rows: 1,
        source: 'linkedin',
        referrer_host: 'news.ycombinator.com',
        utm_source: 'linkedin',
        utm_medium: 'social',
        utm_campaign: 'launch',
        ordered: true,
        orders: 2,
        seq_max: 9,
        seq_distinct: 9,
        seq_lost: 0,
      },
      {
        // No session_started: every acquisition column is (unknown), and no
        // seq means the three seq columns are null, not zero.
        session_id: SB,
        visitor_id: VB,
        visitor_ids: 1,
        started_at: T('2026-10-01T12:00:00'),
        session_day: T('2026-10-01T00:00:00'),
        last_received_at: T('2026-10-01T12:05:00'),
        event_rows: 2,
        session_started_rows: 0,
        source: '(unknown)',
        referrer_host: '(unknown)',
        utm_source: '(unknown)',
        utm_medium: '(unknown)',
        utm_campaign: '(unknown)',
        ordered: true,
        orders: 1,
        seq_max: null,
        seq_distinct: null,
        seq_lost: null,
      },
      {
        // Two session_started rows: the earlier by occurred_at is used, though
        // it was received second. seq 1, 2, 4, 4: max 4, three distinct, one lost.
        session_id: SC,
        visitor_id: VC,
        visitor_ids: 1,
        started_at: T('2026-10-01T13:00:10'),
        session_day: T('2026-10-01T00:00:00'),
        last_received_at: T('2026-10-01T13:01:10'),
        event_rows: 4,
        session_started_rows: 2,
        source: '(self)',
        referrer_host: '(self)',
        utm_source: '(none)',
        utm_medium: '(none)',
        utm_campaign: '(none)',
        ordered: false,
        orders: 0,
        seq_max: 4,
        seq_distinct: 3,
        seq_lost: 1,
      },
      {
        session_id: SA2,
        visitor_id: VA,
        visitor_ids: 1,
        started_at: T('2026-10-02T09:00:00'),
        session_day: T('2026-10-02T00:00:00'),
        last_received_at: T('2026-10-02T09:00:00'),
        event_rows: 1,
        session_started_rows: 0,
        source: '(unknown)',
        referrer_host: '(unknown)',
        utm_source: '(unknown)',
        utm_medium: '(unknown)',
        utm_campaign: '(unknown)',
        ordered: false,
        orders: 0,
        seq_max: 1,
        seq_distinct: 1,
        seq_lost: 0,
      },
    ]);
  });
});

describe('analytics.visitors (§11.4, S5)', () => {
  it('has exactly the columns of §11.4, in order', async () => {
    const { rows: cols } = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'analytics' and table_name = 'visitors' order by ordinal_position",
    );
    expect(cols.map((c) => c.column_name)).toEqual([
      'visitor_id', 'first_seen_at', 'first_seen_day', 'last_seen_at', 'active_days', 'sessions',
      'first_touch_session_id', 'first_touch_at', 'first_touch_source', 'first_touch_referrer_host',
      'first_touch_utm_source', 'first_touch_utm_medium', 'first_touch_utm_campaign', 'orders',
      'first_order_id', 'first_order_at',
    ]);
  });

  it('returns one row per browser, and none for the owner', async () => {
    const result = await rows('select * from analytics.visitors order by first_seen_at');
    expect(result).toEqual([
      {
        visitor_id: VA,
        first_seen_at: T('2026-10-01T10:00:05'),
        first_seen_day: T('2026-10-01T00:00:00'),
        last_seen_at: T('2026-10-02T09:00:00'),
        active_days: 2,
        sessions: 2,
        first_touch_session_id: SA1,
        first_touch_at: T('2026-10-01T10:00:05'),
        first_touch_source: 'linkedin',
        first_touch_referrer_host: 'news.ycombinator.com',
        first_touch_utm_source: 'linkedin',
        first_touch_utm_medium: 'social',
        first_touch_utm_campaign: 'launch',
        orders: 2,
        first_order_id: O1,
        first_order_at: T('2026-10-01T10:05:00'),
      },
      {
        // An older client: no session_started, so no first touch.
        visitor_id: VB,
        first_seen_at: T('2026-10-01T12:00:00'),
        first_seen_day: T('2026-10-01T00:00:00'),
        last_seen_at: T('2026-10-01T12:05:00'),
        active_days: 1,
        sessions: 1,
        first_touch_session_id: null,
        first_touch_at: null,
        first_touch_source: '(unknown)',
        first_touch_referrer_host: '(unknown)',
        first_touch_utm_source: '(unknown)',
        first_touch_utm_medium: '(unknown)',
        first_touch_utm_campaign: '(unknown)',
        orders: 1,
        first_order_id: O3,
        first_order_at: T('2026-10-01T12:05:00'),
      },
      {
        // Never ordered: orders is 0, not null.
        visitor_id: VC,
        first_seen_at: T('2026-10-01T13:00:10'),
        first_seen_day: T('2026-10-01T00:00:00'),
        last_seen_at: T('2026-10-01T13:01:10'),
        active_days: 1,
        sessions: 1,
        first_touch_session_id: SC,
        first_touch_at: T('2026-10-01T13:00:20'),
        first_touch_source: '(self)',
        first_touch_referrer_host: '(self)',
        first_touch_utm_source: '(none)',
        first_touch_utm_medium: '(none)',
        first_touch_utm_campaign: '(none)',
        orders: 0,
        first_order_id: null,
        first_order_at: null,
      },
    ]);
  });
});

describe('privacy (§11.1, S6)', () => {
  it.each(['orders', 'sessions', 'visitors'])('anon cannot select analytics.%s', async (view) => {
    await db.exec('set role anon;');
    try {
      await expect(db.query(`select * from analytics.${view}`)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role;');
    }
  });

  it('holds on each view even where the schema is opened, and with Supabase-style default privileges', async () => {
    const supabaseLikeDb = new PGlite({ extensions: { pgcrypto } });
    await supabaseLikeDb.exec('create role anon nologin; create role authenticated nologin;');
    await supabaseLikeDb.exec(
      `alter default privileges grant all on tables to anon, authenticated;
       alter default privileges grant all on schemas to anon, authenticated;
       alter default privileges in schema public grant all on tables to anon, authenticated;`,
    );
    for (const file of MIGRATIONS) await supabaseLikeDb.exec(sql(file));
    for (const role of ['anon', 'authenticated']) {
      // A security_invoker view also fails on events_clean underneath, so the
      // views' own revokes are proved on the privilege itself.
      expect(
        (
          await supabaseLikeDb.query<{ ok: boolean }>(
            `select has_schema_privilege('${role}', 'analytics', 'usage') as ok
             union all select has_table_privilege('${role}', 'analytics.orders', 'select')
             union all select has_table_privilege('${role}', 'analytics.sessions', 'select')
             union all select has_table_privilege('${role}', 'analytics.visitors', 'select')`,
          )
        ).rows.map((r) => r.ok),
      ).toEqual([false, false, false, false]);
      // As if the schema's usage grant were ever added later: the views' own
      // revokes must still refuse.
      await supabaseLikeDb.exec(`grant usage on schema analytics to ${role}; grant usage on schema public to ${role};`);
      for (const relation of ['analytics.orders', 'analytics.sessions', 'analytics.visitors']) {
        await supabaseLikeDb.exec(`set role ${role};`);
        await expect(supabaseLikeDb.query(`select * from ${relation}`)).rejects.toThrow(/permission denied/);
        await supabaseLikeDb.exec('reset role;');
      }
      await supabaseLikeDb.exec(`revoke usage on schema analytics from ${role};`);
      await supabaseLikeDb.exec(`set role ${role};`);
      await expect(supabaseLikeDb.query('select * from analytics.orders')).rejects.toThrow(/permission denied for schema/);
      await supabaseLikeDb.exec('reset role;');
    }
    await supabaseLikeDb.close();
  });

  it('every view is security_invoker', async () => {
    const { rows: opts } = await db.query<{ relname: string; reloptions: string[] }>(
      `select c.relname, c.reloptions from pg_class c join pg_namespace s on s.oid = c.relnamespace
       where s.nspname = 'analytics' and c.relkind = 'v' order by 1`,
    );
    expect(opts.map((o) => o.relname)).toEqual(['orders', 'sessions', 'visitors']);
    for (const o of opts) expect(o.reloptions).toContain('security_invoker=true');
  });

  it('reads only public.events_clean and analytics views, never private, auth or a wallet relation', async () => {
    const { rows: usage } = await db.query<{ ref: string }>(
      `select distinct table_schema || '.' || table_name as ref
       from information_schema.view_table_usage where view_schema = 'analytics' order by 1`,
    );
    const refs = usage.map((u) => u.ref);
    expect(refs).toContain('public.events_clean');
    for (const ref of refs) {
      expect(ref === 'public.events_clean' || ref.startsWith('analytics.')).toBe(true);
    }
  });
});
