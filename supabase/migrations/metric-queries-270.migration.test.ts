// @vitest-environment node
//
// Runs docs/measurement/270-metric-queries.sql (#277) against a real Postgres
// (ADR 0006) with every migration through #273's applied and seeded rows, and
// asserts each of the 20 queries' exact output (contract #270 §8, §9, §14
// C-Q1 and C-Q2). Rows are inserted as the table owner with an explicit
// `received_at`, because anon cannot set it. Every row the new client sends
// is checked against the client's own validator, so the seed never holds a
// shape the client cannot produce; the older-client rows are the shapes the
// store still accepts.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isValidEventProps, type EventProps } from '../../src/lib/tracking';

const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf-8');

const MIGRATIONS = [
  '20260925000000_events.sql',
  '20260926000000_two_city_event_contract.sql',
  '20261001000000_analytics_readiness_event_contract.sql',
  '20261002000000_session_started_and_is_internal.sql',
  '20261003000000_second_pass_readiness.sql',
];

const QUERY_FILE = read('docs/measurement/270-metric-queries.sql');

/** The file's `-- name: Mn` blocks, comments stripped. */
function parseQueries(text: string): Record<string, string> {
  const queries: Record<string, string> = {};
  const parts = text.split(/^-- name: (M\d+)\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    queries[parts[i]] = parts[i + 1]
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim();
  }
  return queries;
}

const QUERIES = parseQueries(QUERY_FILE);
const NAMES = Array.from({ length: 20 }, (_, i) => `M${i + 1}`);

let db: PGlite;

const run = async (name: string) => (await db.query<Record<string, unknown>>(QUERIES[name])).rows;

const SHA = 'c'.repeat(40);
const NONE = { referrer_host: '(none)', utm_source: '(none)', utm_medium: '(none)', utm_campaign: '(none)' };
const SLUGS = ['a-one', 'b-two', 'c-three', 'd-four', 'e-five'];

/** A browser and its tab. `old` is a client from before #275: no seq, no build. */
interface Who {
  v: string;
  s: string;
  old?: boolean;
}
const who = (old = false): Who => ({ v: randomUUID(), s: randomUUID(), old });

const A1 = who(); // sf, linkedin; its first tab, on D-7
const A2: Who = { v: A1.v, s: randomUUID() }; // the same browser, a tab on D, the whole funnel
const B0: Who = { v: randomUUID(), s: randomUUID() }; // hcmc browser, active on D-8 only before D
const B1: Who = { v: B0.v, s: randomUUID() }; // the same browser on D, abandons at checkout
const C = who(); // la, orders
const OLD = who(true); // #81 client: VND order, no session_started
const E = who(); // enters M5 through location_selected only
const F = who(); // seq gap: 1, 2, 4, 4
const G = who(); // opened a restaurant on the old bundle, ordered on the new
const H = who(); // R2: occurred 23:59:30 on D, received 00:00:10 on D+1
const T1 = who(); // wall / short balance, order at t0 + 23h59m
const T2 = who(); // order at t0 + 24h01m
const T3 = who(); // order before t0
const OWNER = who(); // internal

const ORDER = { a: randomUUID(), c: randomUUID(), old: randomUUID(), g: randomUUID(), t1: randomUUID(), t2: randomUUID(), t3: randomUUID(), owner: randomUUID() };

interface SeedRow {
  who: Who;
  name: string;
  occurred: string;
  received: string;
  props: unknown;
  seq: number | null;
  build: string | null;
  internal: boolean;
  old: boolean;
}
const rows: SeedRow[] = [];
const counters = new Map<string, number>();

const t = (day: string, time: string) => `2026-${day}T${time}Z`;

/** A row the client (or, with `old`, a pre-#275 client) sends; seq counts up per tab unless given. */
function ev(
  w: Who,
  received: string,
  name: string,
  props: unknown,
  o: { occurred?: string; seq?: number | null; old?: boolean; internal?: boolean } = {},
) {
  const old = o.old ?? w.old ?? false;
  let seq: number | null = null;
  if (o.seq !== undefined) seq = o.seq;
  else if (!old) {
    seq = (counters.get(w.s) ?? 0) + 1;
    counters.set(w.s, seq);
  }
  rows.push({ who: w, name, occurred: o.occurred ?? received, received, props, seq, build: old ? null : SHA, internal: o.internal ?? false, old });
}

const order = (o: { id: string; slug: string; city: 'sf' | 'la'; vouchers?: string[]; wallet: boolean; vip: string; thanks: number }) => ({
  amount_minor: 2500,
  applied_voucher_ids: o.vouchers ?? [],
  city: o.city,
  currency: 'USD',
  delivery_instructions: 'leave_at_door',
  drop_off_preset: 'home',
  item_count: 2,
  order_id: o.id,
  restaurant_slug: o.slug,
  saved_amount_minor: o.vouchers?.length ? 200 : 0,
  thanks_voucher_amount_minor: o.thanks,
  utensils: false,
  vip_level: o.vip,
  vip_saved_amount_minor: 0,
  wallet_paid: o.wallet,
});
const plainOrder = (id: string, slug: string) => order({ id, slug, city: 'sf', wallet: false, vip: 'none', thanks: 0 });
const cart = (city: string, currency: string, amount: number, items: number) => ({ amount_minor: amount, city, currency, item_count: items });

function seed() {
  const D = (time: string) => t('10-08', time);

  // A, D-7: a linkedin first touch, one tab.
  ev(A1, t('10-01', '10:00:00'), 'session_started', { ...NONE, utm_source: 'linkedin', utm_medium: 'social', utm_campaign: 'launch' });
  ev(A1, t('10-01', '10:01:00'), 'home_viewed', { city: 'sf' });

  // A, D: the whole funnel, a short balance that recovers, both sign-in walls, a tip. 20 rows.
  ev(A2, D('10:00:00'), 'session_started', { ...NONE, referrer_host: 'news.ycombinator.com' });
  ev(A2, D('10:01:00'), 'location_selected', { city: 'sf', is_switch: false });
  ev(A2, D('10:02:00'), 'home_viewed', { city: 'sf' });
  ev(A2, D('10:02:30'), 'flash_sheet_shown', {
    amount_minor: 300, city: 'sf', currency: 'USD', restaurant_slugs: SLUGS, fee_modes: ['free', 'reduced', 'free', 'free', 'reduced'],
  });
  ev(A2, D('10:03:00'), 'flash_sheet_closed', { city: 'sf', outcome: 'restaurant_tapped', restaurant_slug: 'a-one', seconds_remaining: 800 });
  ev(A2, D('10:03:30'), 'restaurant_opened', { city: 'sf', restaurant_slug: 'a-one' });
  ev(A2, D('10:04:00'), 'cart_viewed', cart('sf', 'USD', 2500, 2));
  ev(A2, D('10:04:30'), 'checkout_viewed', cart('sf', 'USD', 2500, 2));
  ev(A2, D('10:05:00'), 'sign_in_prompt_shown', { surface: 'checkout' });
  ev(A2, D('10:05:10'), 'wallet_short_shown', { city: 'sf', surface: 'checkout' });
  ev(A2, D('10:05:20'), 'sign_in_started', { provider: 'google', surface: 'checkout' });
  ev(A2, D('10:06:00'), 'sign_in_completed', { outcome: 'success', provider: 'google', surface: 'checkout' });
  ev(A2, D('10:07:00'), 'order_placed', order({ id: ORDER.a, slug: 'a-one', city: 'sf', vouchers: ['sf-discount-t1'], wallet: true, vip: 'gold', thanks: 0 }));
  ev(A2, D('10:40:00'), 'order_delivered', { minutes_since_order: 33, order_id: ORDER.a });
  ev(A2, D('10:41:00'), 'rating_submitted', { order_id: ORDER.a, stars: 5, tags: ['fast'] });
  ev(A2, D('10:42:00'), 'driver_rating_submitted', { order_id: ORDER.a, stars: 4 });
  ev(A2, D('10:43:00'), 'sign_in_prompt_shown', { surface: 'tip' });
  ev(A2, D('10:43:10'), 'sign_in_started', { provider: 'google', surface: 'tip' });
  ev(A2, D('10:43:30'), 'sign_in_completed', { outcome: 'success', provider: 'google', surface: 'tip' });
  ev(A2, D('10:44:00'), 'tip_sent', { currency: 'USD', order_id: ORDER.a, tip_amount_minor: 200 });

  // B, D-8: only a home view, before the window.
  ev(B0, t('09-30', '09:00:00'), 'home_viewed', { city: 'hcmc' });
  // B, D: a header-pill switch, an all-reduced flash sheet dismissed, a short balance, no order. 9 rows.
  ev(B1, D('11:00:00'), 'session_started', NONE);
  ev(B1, D('11:01:00'), 'location_selected', { city: 'hcmc', is_switch: true });
  ev(B1, D('11:02:00'), 'home_viewed', { city: 'hcmc' });
  ev(B1, D('11:02:30'), 'flash_sheet_shown', {
    amount_minor: 15000, city: 'hcmc', currency: 'VND', restaurant_slugs: SLUGS, fee_modes: SLUGS.map(() => 'reduced'),
  });
  ev(B1, D('11:03:00'), 'flash_sheet_closed', { city: 'hcmc', outcome: 'dismissed', restaurant_slug: 'none', seconds_remaining: 700 });
  ev(B1, D('11:03:30'), 'restaurant_opened', { city: 'hcmc', restaurant_slug: 'b-two' });
  ev(B1, D('11:04:00'), 'cart_viewed', cart('hcmc', 'VND', 90000, 1));
  ev(B1, D('11:04:30'), 'checkout_viewed', cart('hcmc', 'VND', 90000, 1));
  ev(B1, D('11:05:00'), 'wallet_short_shown', { city: 'hcmc', surface: 'checkout' });

  // C: la, referred by linkedin.com, orders a minute after the wall. 8 rows.
  ev(C, D('12:00:00'), 'session_started', { ...NONE, referrer_host: 'linkedin.com' });
  ev(C, D('12:01:00'), 'location_selected', { city: 'la', is_switch: false });
  ev(C, D('12:02:00'), 'home_viewed', { city: 'la' });
  ev(C, D('12:03:00'), 'restaurant_opened', { city: 'la', restaurant_slug: 'b-two' });
  ev(C, D('12:04:00'), 'cart_viewed', cart('la', 'USD', 3000, 3));
  ev(C, D('12:04:30'), 'checkout_viewed', cart('la', 'USD', 3000, 3));
  ev(C, D('12:05:00'), 'sign_in_prompt_shown', { surface: 'checkout' });
  ev(C, D('12:06:00'), 'order_placed', order({ id: ORDER.c, slug: 'b-two', city: 'la', wallet: false, vip: 'none', thanks: 200 }));

  // OLD: a #81 client. No city on cart/checkout (R3 says hcmc from VND), a 4-key flash sheet that is tapped, a 9-key order.
  ev(OLD, D('13:00:00'), 'home_viewed', { city: 'hcmc' });
  ev(OLD, D('13:00:30'), 'flash_sheet_shown', { amount_minor: 15000, city: 'hcmc', currency: 'VND', restaurant_slugs: SLUGS });
  ev(OLD, D('13:00:40'), 'flash_sheet_closed', { city: 'hcmc', outcome: 'restaurant_tapped', restaurant_slug: 'a-one', seconds_remaining: 600 });
  ev(OLD, D('13:01:00'), 'restaurant_opened', { city: 'hcmc', restaurant_slug: 'a-one' });
  ev(OLD, D('13:02:00'), 'cart_viewed', { amount_minor: 80000, currency: 'VND', item_count: 1 });
  ev(OLD, D('13:03:00'), 'checkout_viewed', { amount_minor: 80000, currency: 'VND', item_count: 1 });
  ev(OLD, D('13:04:00'), 'order_placed', {
    amount_minor: 80000,
    applied_voucher_ids: ['hcmc-discount-t2'],
    currency: 'VND',
    delivery_instructions: 'hand_to_me',
    drop_off_preset: 'office',
    item_count: 1,
    order_id: ORDER.old,
    saved_amount_minor: 40000,
    utensils: true,
  });
  ev(OLD, D('13:30:00'), 'order_delivered', { minutes_since_order: 26, order_id: ORDER.old });
  ev(OLD, D('13:31:00'), 'rating_submitted', { order_id: ORDER.old, stars: 3, tags: [] });

  // E: in la through location_selected only (no home_viewed), an empty cart. 4 rows.
  ev(E, D('15:00:00'), 'session_started', NONE);
  ev(E, D('15:01:00'), 'location_selected', { city: 'la', is_switch: true });
  ev(E, D('15:02:00'), 'restaurant_opened', { city: 'la', restaurant_slug: 'b-two' });
  ev(E, D('15:03:00'), 'cart_viewed', cart('la', 'USD', 0, 0));

  // F: reddit, abandons at checkout; a seq gap (1, 2, 4, 4: one lost, one duplicated tab).
  ev(F, D('16:00:00'), 'session_started', { ...NONE, referrer_host: 'reddit.com' }, { seq: 1 });
  ev(F, D('16:01:00'), 'home_viewed', { city: 'sf' }, { seq: 2 });
  ev(F, D('16:02:00'), 'cart_viewed', cart('sf', 'USD', 1200, 1), { seq: 4 });
  ev(F, D('16:03:00'), 'checkout_viewed', cart('sf', 'USD', 1200, 1), { seq: 4 });

  // G: home and restaurant on the old bundle (no seq, no build), then a reload onto the new bundle, which orders (seq 1).
  ev(G, D('17:00:00'), 'home_viewed', { city: 'sf' }, { old: true });
  ev(G, D('17:01:00'), 'restaurant_opened', { city: 'sf', restaurant_slug: 'a-one' }, { old: true });
  ev(G, D('17:05:00'), 'order_placed', plainOrder(ORDER.g, 'a-one'), { old: false });

  // H: the device clock ran 40 seconds behind midnight UTC; the server received it on D+1 (R2).
  ev(H, t('10-09', '00:00:10'), 'home_viewed', { city: 'sf' }, { occurred: D('23:59:30') });

  // T1-T3: a sign-in wall and a short balance at t0 = 10-03 10:00:00 UTC; the order lands at three offsets.
  for (const [w, id, orderAt, first] of [
    [T1, ORDER.t1, t('10-04', '09:59:00'), false], // t0 + 23h59m: counts
    [T2, ORDER.t2, t('10-04', '10:01:00'), false], // t0 + 24h01m: does not
    [T3, ORDER.t3, t('10-03', '09:00:00'), true], // before t0: does not
  ] as const) {
    ev(w, first ? t('10-03', '08:59:00') : t('10-03', '09:00:00'), 'session_started', NONE);
    if (first) ev(w, orderAt, 'order_placed', plainOrder(id, 'c-three'));
    ev(w, t('10-03', '10:00:00'), 'sign_in_prompt_shown', { surface: 'checkout' });
    ev(w, t('10-03', '10:00:00'), 'wallet_short_shown', { city: 'sf', surface: 'checkout' });
    if (!first) ev(w, orderAt, 'order_placed', plainOrder(id, 'c-three'));
  }

  // The owner: unflagged rows on D, one is_internal row on D+1. Every row must vanish from every query.
  ev(OWNER, D('18:00:00'), 'session_started', { ...NONE, utm_source: 'linkedin' });
  ev(OWNER, D('18:01:00'), 'home_viewed', { city: 'sf' });
  ev(OWNER, D('18:02:00'), 'sign_in_prompt_shown', { surface: 'checkout' });
  ev(OWNER, D('18:03:00'), 'wallet_short_shown', { city: 'sf', surface: 'checkout' });
  ev(OWNER, D('18:04:00'), 'order_placed', order({ id: ORDER.owner, slug: 'a-one', city: 'sf', wallet: true, vip: 'platinum', thanks: 100 }));
  ev(OWNER, t('10-09', '09:00:00'), 'home_viewed', { city: 'sf' }, { internal: true });
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  for (const file of MIGRATIONS) await db.exec(read('supabase/migrations', file));
  seed();
  for (const r of rows) {
    await db.query(
      `insert into public.events
         (id, visitor_id, session_id, event_name, occurred_at, received_at, props, variant, seq, build, is_internal)
       values ($1, $2, $3, $4, $5, $6, $7, null, $8, $9, $10)`,
      [randomUUID(), r.who.v, r.who.s, r.name, r.occurred, r.received, JSON.stringify(r.props), r.seq, r.build, r.internal],
    );
  }
});

afterAll(async () => {
  await db.close();
});

/** Rows in a fixed order, so a result does not depend on the database's collation. */
const sorted = (result: Record<string, unknown>[], ...keys: string[]) =>
  [...result].sort((a, b) => {
    for (const key of keys) {
      const x = String(a[key] ?? '');
      const y = String(b[key] ?? '');
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  });

describe('the query file', () => {
  it('holds exactly 20 named queries, M1 to M20, in order', () => {
    expect(Object.keys(QUERIES)).toEqual(NAMES);
    for (const name of NAMES) expect(QUERIES[name].length).toBeGreaterThan(0);
  });

  it('is a single statement per query, so the dashboard runs it whole', () => {
    for (const name of NAMES) expect(QUERIES[name].replace(/;\s*$/, ''), name).not.toContain(';');
  });

  it('reads the source §13 names for each metric, and never the raw table', () => {
    const orders = ['M7', 'M8', 'M10', 'M12', 'M13', 'M14', 'M15'];
    const sessions = ['M2', 'M6', 'M18'];
    for (const name of NAMES) {
      const q = QUERIES[name];
      expect(q, name).not.toMatch(/public\.events\b(?!_clean)/);
      expect(q, name).not.toMatch(/\bfrom\s+events\b/i);
      expect(/analytics\.orders/.test(q), `${name} reads analytics.orders`).toBe(orders.includes(name));
      expect(/analytics\.sessions/.test(q), `${name} reads analytics.sessions`).toBe(sessions.includes(name));
      expect(/analytics\.visitors/.test(q), `${name} reads analytics.visitors`).toBe(name === 'M6');
      if (!orders.includes(name) && !sessions.includes(name) && name !== 'M6') expect(q, name).toContain('public.events_clean');
    }
  });

  it('windows on received_at (R2), never on occurred_at', () => {
    for (const name of NAMES) {
      expect(QUERIES[name], name).not.toMatch(/occurred_at\s*(>=|<)\s*w_/);
      expect(QUERIES[name], name).not.toMatch(/occurred_at at time zone/);
    }
  });
});

describe('the seed (C-Q1)', () => {
  it('holds only shapes the client can produce, apart from the older-client rows', () => {
    const fresh = rows.filter((r) => !r.old);
    expect(fresh.length).toBe(68);
    for (const r of fresh) expect(isValidEventProps(r.name as never, r.props as EventProps), `${r.name} ${JSON.stringify(r.props)}`).toBe(true);
    expect(rows.filter((r) => r.old).length).toBe(11);
  });

  it('covers three cities, an owner browser really in the raw table but absent from events_clean, and a null-build row', async () => {
    const cities = await db.query<{ c: string }>(`select distinct props->>'city' as c from public.events where event_name = 'home_viewed' order by 1`);
    expect(cities.rows.map((r) => r.c)).toEqual(['hcmc', 'la', 'sf']);
    const raw = await db.query<{ n: number }>('select count(*)::int as n from public.events where visitor_id = $1', [OWNER.v]);
    expect(raw.rows[0].n).toBe(6);
    const clean = await db.query<{ n: number }>('select count(*)::int as n from public.events_clean where visitor_id = $1', [OWNER.v]);
    expect(clean.rows[0].n).toBe(0);
    const nulls = await db.query<{ n: number }>(`select count(*)::int as n from public.events where event_name = 'restaurant_opened' and build is null`);
    expect(nulls.rows[0].n).toBe(2);
  });
});

describe('the 20 queries, run against the seed (C-Q1)', () => {
  it('M1 browsers by day: the late-arriving row counts on D+1, the owner nowhere', async () => {
    expect(await run('M1')).toEqual([
      { day: '2026-10-01', browsers: 1 },
      { day: '2026-10-03', browsers: 3 },
      { day: '2026-10-04', browsers: 2 },
      { day: '2026-10-08', browsers: 7 },
      { day: '2026-10-09', browsers: 1 },
    ]);
  });

  it('M2 tab sessions by day', async () => {
    expect(await run('M2')).toEqual([
      { day: '2026-10-01', tab_sessions: 1 },
      { day: '2026-10-03', tab_sessions: 3 },
      { day: '2026-10-08', tab_sessions: 7 },
      { day: '2026-10-09', tab_sessions: 1 },
    ]);
  });

  it('M3 returning browsers, with the browsers and returning counts beside the share', async () => {
    expect(await run('M3')).toEqual([
      { day: '2026-10-01', browsers: 1, returning_browsers: 0, returning_share: 0 },
      { day: '2026-10-03', browsers: 3, returning_browsers: 0, returning_share: 0 },
      { day: '2026-10-04', browsers: 2, returning_browsers: 2, returning_share: 1 },
      { day: '2026-10-08', browsers: 7, returning_browsers: 1, returning_share: 0.1429 },
      { day: '2026-10-09', browsers: 1, returning_browsers: 0, returning_share: 0 },
    ]);
  });

  it('M4 home-to-order funnel: home-to-order conversion 4/7, checkout-to-order 4/5', async () => {
    const r = (step: number, event_name: string, browsers: number, den: number | null, conv: number | null, share: number, h: number | null, c: number | null) => ({
      step, event_name, browsers, step_denominator: den, step_conversion: conv, s1_browsers: 7, share_of_s1: share, home_to_order_conversion: h, checkout_to_order_conversion: c,
    });
    expect(await run('M4')).toEqual([
      r(1, 'home_viewed', 7, null, null, 1, null, null),
      r(2, 'restaurant_opened', 5, 7, 0.7143, 0.7143, null, null),
      r(3, 'cart_viewed', 5, 5, 1, 0.7143, null, null),
      r(4, 'checkout_viewed', 5, 5, 1, 0.7143, null, null),
      r(5, 'order_placed', 4, 5, 0.8, 0.5714, 0.5714, 0.8),
    ]);
  });

  it('M5 funnel by city: the location_selected-only browser is in la S1, and an empty cart is not step 3', async () => {
    const r = (city: string, step: number, event_name: string, pairs: number, den: number | null, conv: number | null, s1: number, byCity: number | null) => ({
      city, step, event_name, pairs, step_denominator: den, step_conversion: conv, s1_pairs: s1, conversion_by_city: byCity,
    });
    const S1 = 'home_viewed or location_selected';
    expect(await run('M5')).toEqual([
      r('hcmc', 1, S1, 2, null, null, 2, null),
      r('hcmc', 2, 'restaurant_opened', 2, 2, 1, 2, null),
      r('hcmc', 3, 'cart_viewed', 2, 2, 1, 2, null),
      r('hcmc', 4, 'checkout_viewed', 2, 2, 1, 2, null),
      r('hcmc', 5, 'order_placed', 1, 2, 0.5, 2, 0.5),
      r('la', 1, S1, 2, null, null, 2, null),
      r('la', 2, 'restaurant_opened', 2, 2, 1, 2, null),
      r('la', 3, 'cart_viewed', 1, 2, 0.5, 2, null),
      r('la', 4, 'checkout_viewed', 1, 1, 1, 2, null),
      r('la', 5, 'order_placed', 1, 1, 1, 2, 0.5),
      r('sf', 1, S1, 4, null, null, 4, null),
      r('sf', 2, 'restaurant_opened', 2, 4, 0.5, 4, null),
      r('sf', 3, 'cart_viewed', 2, 2, 1, 4, null),
      r('sf', 4, 'checkout_viewed', 2, 2, 1, 4, null),
      r('sf', 5, 'order_placed', 2, 2, 1, 4, 0.5),
    ]);
  });

  it('M6 acquisition by source: shares by session day, tab-session conversion, first-touch browser conversion', async () => {
    const r = (part: string, day: string | null, source: string, num: number, base: number, rate: number, medium = '(none)', campaign = '(none)') => ({
      part, day, source, utm_medium: medium, utm_campaign: campaign, numerator: num, base, rate,
    });
    const U = '(unknown)';
    expect(sorted(await run('M6'), 'part', 'day', 'source')).toEqual([
      r('a', '2026-10-01', 'linkedin', 1, 1, 1, 'social', 'launch'),
      r('a', '2026-10-03', '(direct)', 3, 3, 1),
      r('a', '2026-10-08', '(direct)', 2, 7, 0.2857),
      r('a', '2026-10-08', '(unknown)', 2, 7, 0.2857, U, U),
      r('a', '2026-10-08', 'linkedin.com', 1, 7, 0.1429),
      r('a', '2026-10-08', 'news.ycombinator.com', 1, 7, 0.1429),
      r('a', '2026-10-08', 'reddit.com', 1, 7, 0.1429),
      r('a', '2026-10-09', '(unknown)', 1, 1, 1, U, U),
      r('b', null, '(direct)', 3, 5, 0.6),
      r('b', null, '(unknown)', 2, 3, 0.6667, U, U),
      r('b', null, 'linkedin', 0, 1, 0, 'social', 'launch'),
      r('b', null, 'linkedin.com', 1, 1, 1),
      r('b', null, 'news.ycombinator.com', 1, 1, 1),
      r('b', null, 'reddit.com', 0, 1, 0),
      r('c', null, '(direct)', 3, 5, 0.6),
      r('c', null, 'linkedin', 1, 1, 1, 'social', 'launch'),
      r('c', null, 'linkedin.com', 1, 1, 1),
      r('c', null, 'reddit.com', 0, 1, 0),
    ]);
  });

  it('M7 tracker return rate', async () => {
    expect(await run('M7')).toEqual([{ orders: 7, delivery_seen: 2, tracker_return_rate: 0.2857 }]);
  });

  it('M8 rating rates share the delivery-seen denominator', async () => {
    expect(await run('M8')).toEqual([
      { delivery_seen_orders: 2, restaurant_rated: 2, restaurant_rate: 1, driver_rated: 1, driver_rate: 0.5 },
    ]);
  });

  it('M9 sign-in wall: start and pass by tab session, wall-to-order by browser within 24 hours', async () => {
    expect(await run('M9')).toEqual([
      { surface: 'checkout', sessions: 5, started: 1, start_rate: 0.2, passed: 1, pass_rate: 0.2, browsers: 5, converted: 3, wall_to_order_rate: 0.6 },
      { surface: 'tip', sessions: 1, started: 1, start_rate: 1, passed: 1, pass_rate: 1, browsers: 1, converted: 1, wall_to_order_rate: 1 },
    ]);
  });

  it('M10 wallet-paid share leaves the #81 order out of numerator and denominator', async () => {
    expect(await run('M10')).toEqual([{ orders: 6, wallet_paid_orders: 1, wallet_paid_share: 0.1667 }]);
  });

  it('M11 short-balance recovery, per browser within 24 hours', async () => {
    expect(await run('M11')).toEqual([{ browsers: 5, recovered: 2, recovery_rate: 0.4 }]);
  });

  it('M12 tip rate', async () => {
    expect(await run('M12')).toEqual([{ eligible_orders: 1, tipped_orders: 1, tip_rate: 1 }]);
  });

  it('M13 VIP mix', async () => {
    expect(await run('M13')).toEqual([
      { vip_level: 'gold', orders: 1, all_orders: 6, share: 0.1667 },
      { vip_level: 'none', orders: 5, all_orders: 6, share: 0.8333 },
    ]);
  });

  it('M14 thanks-voucher use', async () => {
    expect(await run('M14')).toEqual([{ orders: 6, thanks_voucher_orders: 1, thanks_voucher_share: 0.1667 }]);
  });

  it('M15 voucher attachment counts every order, both shapes', async () => {
    expect(await run('M15')).toEqual([{ orders: 7, orders_with_voucher: 2, voucher_attachment: 0.2857 }]);
  });

  it('M16 flash view-to-action', async () => {
    expect(await run('M16')).toEqual([{ sheets_shown: 3, restaurant_tapped: 2, view_to_action: 0.6667 }]);
  });

  it('M17 location switch rate', async () => {
    expect(await run('M17')).toEqual([{ browsers_selecting: 4, browsers_switching: 2, switch_rate: 0.5 }]);
  });

  it('M18 loss rate: the gap tab loses one of 46 slots on D, the old-client tab is outside', async () => {
    expect(await run('M18')).toEqual([
      { day: '2026-10-01', sessions: 1, seq_max_sum: 2, seq_lost_sum: 0, loss_rate: 0 },
      { day: '2026-10-03', sessions: 3, seq_max_sum: 12, seq_lost_sum: 0, loss_rate: 0 },
      { day: '2026-10-08', sessions: 6, seq_max_sum: 46, seq_lost_sum: 1, loss_rate: 0.0217 },
      { day: '2026-10-09', sessions: 1, seq_max_sum: 1, seq_lost_sum: 0, loss_rate: 0 },
    ]);
  });

  it('M19 flash tap-through: a by fee mode over the new shape only, b by amount over both shapes', async () => {
    expect(await run('M19')).toEqual([
      { part: 'a', city: 'hcmc', fee_mode: 'reduced', amount_minor: null, shown: 5, tapped: 0, tap_through: 0 },
      { part: 'a', city: 'sf', fee_mode: 'free', amount_minor: null, shown: 3, tapped: 1, tap_through: 0.3333 },
      { part: 'a', city: 'sf', fee_mode: 'reduced', amount_minor: null, shown: 2, tapped: 0, tap_through: 0 },
      { part: 'b', city: 'hcmc', fee_mode: null, amount_minor: 15000, shown: 2, tapped: 1, tap_through: 0.5 },
      { part: 'b', city: 'sf', fee_mode: null, amount_minor: 300, shown: 1, tapped: 1, tap_through: 1 },
    ]);
  });

  it('M20 restaurant conversion', async () => {
    expect(await run('M20')).toEqual([
      { restaurant_slug: 'a-one', browsers_opened: 1, browsers_ordered: 1, conversion: 1 },
      { restaurant_slug: 'b-two', browsers_opened: 3, browsers_ordered: 1, conversion: 0.3333 },
    ]);
  });
});

describe('the boundaries (C-Q2)', () => {
  it('M3: D-7 counts as returning and D-8 does not (one of the two browsers, the D-7 one, is returning on D)', async () => {
    const seen = await db.query<{ v: string; day: string }>(
      `select visitor_id as v, (received_at at time zone 'UTC')::date::text as day from public.events_clean
       where visitor_id in ($1, $2) and (received_at at time zone 'UTC')::date < '2026-10-08' order by 1, 2`,
      [A1.v, B0.v],
    );
    expect(seen.rows.filter((r) => r.v === A1.v).map((r) => r.day)).toEqual(['2026-10-01', '2026-10-01']);
    expect(seen.rows.filter((r) => r.v === B0.v).map((r) => r.day)).toEqual(['2026-09-30']);
    const d = (await run('M3')).find((r) => r.day === '2026-10-08');
    expect(d).toMatchObject({ browsers: 7, returning_browsers: 1 });
    // A is the only browser with a row in [D-7, D-1]; counting D-8 would make 2, dropping D-7 would make 0.
    const returning = await db.query<{ n: number }>(
      `select count(*)::int as n from public.events_clean
       where visitor_id = $1 and (received_at at time zone 'UTC')::date between '2026-10-08'::date - 7 and '2026-10-08'::date - 1`,
      [A1.v],
    );
    expect(returning.rows[0].n).toBeGreaterThan(0);
  });

  it('M9: an order at t0 + 23h59m counts, t0 + 24h01m does not, one before t0 does not', async () => {
    const [checkout] = (await run('M9')).filter((r) => r.surface === 'checkout');
    // Converted: A and C (minutes after their walls) and T1. Not T2, not T3.
    expect(checkout).toMatchObject({ browsers: 5, converted: 3, wall_to_order_rate: 0.6 });
  });

  it('M11: the same three offsets around a short balance', async () => {
    expect(await run('M11')).toEqual([{ browsers: 5, recovered: 2, recovery_rate: 0.4 }]);
  });

  it('M20: a restaurant_opened with build null is outside R(r), and so is that browser\'s order', async () => {
    const rowsForA = (await run('M20')).find((r) => r.restaurant_slug === 'a-one');
    // OLD and G opened a-one on the old bundle (build null); G then ordered a-one on the new one. Only A is in R.
    expect(rowsForA).toEqual({ restaurant_slug: 'a-one', browsers_opened: 1, browsers_ordered: 1, conversion: 1 });
  });

  it('R2: occurred 23:59:30 on D, received 00:00:10 on D+1, counts on D+1 in M1, M2 and M3', async () => {
    const m1 = await run('M1');
    expect(m1.find((r) => r.day === '2026-10-08')).toEqual({ day: '2026-10-08', browsers: 7 });
    expect(m1.find((r) => r.day === '2026-10-09')).toEqual({ day: '2026-10-09', browsers: 1 });
    expect((await run('M2')).find((r) => r.day === '2026-10-09')).toEqual({ day: '2026-10-09', tab_sessions: 1 });
    expect((await run('M18')).find((r) => r.day === '2026-10-09')).toMatchObject({ sessions: 1 });
  });
});
