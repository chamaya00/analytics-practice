// @vitest-environment node
//
// Runs docs/measurement/219-launch-queries.sql (#226) against a real Postgres
// (ADR 0006) with every migration through #225 applied and seeded rows, and
// asserts each of the 17 queries' exact output (contract §11, M1-M17).
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf-8');
const migration = (file: string) => read('supabase/migrations', file);

const QUERY_FILE = read('docs/measurement/219-launch-queries.sql');

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
const NAMES = Array.from({ length: 17 }, (_, i) => `M${i + 1}`);

let db: PGlite;

const run = async (name: string, query = QUERIES[name]) => (await db.query<Record<string, unknown>>(query)).rows;

// Visitors. Each sits in its own session(s), on the UTC days the seed comment says.
const V = { sf: randomUUID(), hcmc: randomUUID(), la: randomUUID(), old: randomUUID(), late: randomUUID(), owner: randomUUID() };
const S = {
  sfDay1: randomUUID(),
  sfDay2: randomUUID(),
  hcmc: randomUUID(),
  la: randomUUID(),
  old: randomUUID(),
  late: randomUUID(),
  owner: randomUUID(),
  ownerFlagged: randomUUID(),
};
const ORDER = { sf: randomUUID(), la: randomUUID(), old: randomUUID(), owner: randomUUID() };

interface SeedRow {
  visitor: string;
  session: string;
  name: string;
  at: string;
  props: unknown;
  internal?: boolean;
}
const rows: SeedRow[] = [];
const ev = (visitor: string, session: string, at: string, name: string, props: unknown, internal = false) =>
  rows.push({ visitor, session, name, at, props, internal });

const NONE = { referrer_host: '(none)', utm_source: '(none)', utm_medium: '(none)', utm_campaign: '(none)' };
const SLUGS = ['a-one', 'b-two', 'c-three', 'd-four', 'e-five'];
const newOrder = (o: {
  id: string;
  city: 'sf' | 'la';
  vouchers: string[];
  wallet: boolean;
  vip: string;
  thanks: number;
}) => ({
  amount_minor: 2500,
  applied_voucher_ids: o.vouchers,
  city: o.city,
  currency: 'USD',
  delivery_instructions: 'leave_at_door',
  drop_off_preset: 'home',
  item_count: 2,
  order_id: o.id,
  saved_amount_minor: o.vouchers.length ? 200 : 0,
  thanks_voucher_amount_minor: o.thanks,
  utensils: false,
  vip_level: o.vip,
  vip_saved_amount_minor: 0,
  wallet_paid: o.wallet,
});

function seed() {
  // ---- sf visitor: linkedin session on 2026-10-01, whole funnel and after-order events.
  const a = (t: string) => `2026-10-01T${t}Z`;
  ev(V.sf, S.sfDay1, a('10:00:00'), 'session_started', { ...NONE, utm_source: 'linkedin' });
  ev(V.sf, S.sfDay1, a('10:01:00'), 'location_selected', { city: 'sf', is_switch: false });
  ev(V.sf, S.sfDay1, a('10:02:00'), 'home_viewed', { city: 'sf' });
  ev(V.sf, S.sfDay1, a('10:02:30'), 'flash_sheet_shown', { amount_minor: 300, city: 'sf', currency: 'USD', restaurant_slugs: SLUGS });
  ev(V.sf, S.sfDay1, a('10:03:00'), 'flash_sheet_closed', { city: 'sf', outcome: 'restaurant_tapped', restaurant_slug: 'a-one', seconds_remaining: 800 });
  ev(V.sf, S.sfDay1, a('10:03:30'), 'restaurant_opened', { city: 'sf', restaurant_slug: 'a-one' });
  ev(V.sf, S.sfDay1, a('10:04:00'), 'cart_viewed', { amount_minor: 2500, city: 'sf', currency: 'USD', item_count: 2 });
  ev(V.sf, S.sfDay1, a('10:04:30'), 'checkout_viewed', { amount_minor: 2500, city: 'sf', currency: 'USD', item_count: 2 });
  ev(V.sf, S.sfDay1, a('10:05:00'), 'sign_in_prompt_shown', { surface: 'checkout' });
  ev(V.sf, S.sfDay1, a('10:05:10'), 'wallet_short_shown', { city: 'sf', surface: 'checkout' });
  ev(V.sf, S.sfDay1, a('10:05:20'), 'sign_in_started', { provider: 'google', surface: 'checkout' });
  ev(V.sf, S.sfDay1, a('10:06:00'), 'sign_in_completed', { outcome: 'success', provider: 'google', surface: 'checkout' });
  ev(V.sf, S.sfDay1, a('10:07:00'), 'order_placed', newOrder({ id: ORDER.sf, city: 'sf', vouchers: ['sf-discount-t1'], wallet: true, vip: 'gold', thanks: 0 }));
  ev(V.sf, S.sfDay1, a('10:40:00'), 'order_delivered', { minutes_since_order: 33, order_id: ORDER.sf });
  ev(V.sf, S.sfDay1, a('10:41:00'), 'rating_submitted', { order_id: ORDER.sf, stars: 5, tags: ['fast'] });
  ev(V.sf, S.sfDay1, a('10:42:00'), 'driver_rating_submitted', { order_id: ORDER.sf, stars: 4 });
  ev(V.sf, S.sfDay1, a('10:43:00'), 'sign_in_prompt_shown', { surface: 'tip' });
  ev(V.sf, S.sfDay1, a('10:43:10'), 'sign_in_started', { provider: 'google', surface: 'tip' });
  ev(V.sf, S.sfDay1, a('10:43:30'), 'sign_in_completed', { outcome: 'success', provider: 'google', surface: 'tip' });
  ev(V.sf, S.sfDay1, a('10:44:00'), 'tip_sent', { currency: 'USD', order_id: ORDER.sf, tip_amount_minor: 200 });
  // Same visitor again on 2026-10-02, a new session from Hacker News: returning that day only.
  const b = (t: string) => `2026-10-02T${t}Z`;
  ev(V.sf, S.sfDay2, b('09:00:00'), 'session_started', { ...NONE, referrer_host: 'news.ycombinator.com' });
  ev(V.sf, S.sfDay2, b('09:01:00'), 'home_viewed', { city: 'sf' });

  // ---- hcmc visitor: direct, gets to checkout, sees a short balance, never orders.
  ev(V.hcmc, S.hcmc, a('11:00:00'), 'session_started', NONE);
  ev(V.hcmc, S.hcmc, a('11:01:00'), 'location_selected', { city: 'hcmc', is_switch: true });
  ev(V.hcmc, S.hcmc, a('11:02:00'), 'home_viewed', { city: 'hcmc' });
  ev(V.hcmc, S.hcmc, a('11:02:30'), 'flash_sheet_shown', { amount_minor: 15000, city: 'hcmc', currency: 'VND', restaurant_slugs: SLUGS });
  ev(V.hcmc, S.hcmc, a('11:03:00'), 'flash_sheet_closed', { city: 'hcmc', outcome: 'dismissed', restaurant_slug: 'none', seconds_remaining: 700 });
  ev(V.hcmc, S.hcmc, a('11:03:30'), 'restaurant_opened', { city: 'hcmc', restaurant_slug: 'a-one' });
  ev(V.hcmc, S.hcmc, a('11:04:00'), 'cart_viewed', { amount_minor: 90000, city: 'hcmc', currency: 'VND', item_count: 1 });
  ev(V.hcmc, S.hcmc, a('11:04:30'), 'checkout_viewed', { amount_minor: 90000, city: 'hcmc', currency: 'VND', item_count: 1 });
  ev(V.hcmc, S.hcmc, a('11:05:00'), 'wallet_short_shown', { city: 'hcmc', surface: 'checkout' });

  // ---- LA visitor on 2026-10-02: referred from linkedin.com, reaches order_placed.
  ev(V.la, S.la, b('12:00:00'), 'session_started', { ...NONE, referrer_host: 'linkedin.com' });
  ev(V.la, S.la, b('12:01:00'), 'location_selected', { city: 'la', is_switch: false });
  ev(V.la, S.la, b('12:02:00'), 'home_viewed', { city: 'la' });
  ev(V.la, S.la, b('12:03:00'), 'restaurant_opened', { city: 'la', restaurant_slug: 'a-one' });
  ev(V.la, S.la, b('12:04:00'), 'cart_viewed', { amount_minor: 3000, city: 'la', currency: 'USD', item_count: 3 });
  ev(V.la, S.la, b('12:04:30'), 'checkout_viewed', { amount_minor: 3000, city: 'la', currency: 'USD', item_count: 3 });
  ev(V.la, S.la, b('12:05:00'), 'sign_in_prompt_shown', { surface: 'checkout' });
  ev(V.la, S.la, b('12:06:00'), 'order_placed', newOrder({ id: ORDER.la, city: 'la', vouchers: [], wallet: false, vip: 'none', thanks: 200 }));

  // ---- Old-client visitor (#81 shapes, no city, no session_started): a VND order, so R3 says hcmc.
  ev(V.old, S.old, a('13:00:00'), 'home_viewed', { city: 'hcmc' });
  ev(V.old, S.old, a('13:01:00'), 'restaurant_opened', { city: 'hcmc', restaurant_slug: 'a-one' });
  ev(V.old, S.old, a('13:02:00'), 'cart_viewed', { amount_minor: 80000, currency: 'VND', item_count: 1 });
  ev(V.old, S.old, a('13:03:00'), 'checkout_viewed', { amount_minor: 80000, currency: 'VND', item_count: 1 });
  ev(V.old, S.old, a('13:04:00'), 'order_placed', {
    amount_minor: 80000,
    applied_voucher_ids: [],
    currency: 'VND',
    delivery_instructions: 'hand_to_me',
    drop_off_preset: 'office',
    item_count: 1,
    order_id: ORDER.old,
    saved_amount_minor: 0,
    utensils: true,
  });
  ev(V.old, S.old, a('13:30:00'), 'order_delivered', { minutes_since_order: 26, order_id: ORDER.old });
  ev(V.old, S.old, a('13:31:00'), 'rating_submitted', { order_id: ORDER.old, stars: 3, tags: [] });

  // ---- Cross-midnight visitor: 2026-10-03 02:30 UTC is still 10-02 evening in San Francisco.
  ev(V.late, S.late, '2026-10-03T02:30:00Z', 'session_started', { ...NONE, referrer_host: '(self)' });
  ev(V.late, S.late, '2026-10-03T02:31:00Z', 'home_viewed', { city: 'sf' });
  ev(V.late, S.late, '2026-10-03T02:32:00Z', 'cart_viewed', { amount_minor: 0, city: 'sf', currency: 'USD', item_count: 0 });

  // ---- Owner: unflagged rows on 10-01, then one is_internal row on 10-02. Every row must vanish.
  ev(V.owner, S.owner, a('14:00:00'), 'session_started', { ...NONE, utm_source: 'linkedin' });
  ev(V.owner, S.owner, a('14:01:00'), 'home_viewed', { city: 'sf' });
  ev(V.owner, S.owner, a('14:02:00'), 'order_placed', newOrder({ id: ORDER.owner, city: 'sf', vouchers: ['sf-discount-t1'], wallet: true, vip: 'platinum', thanks: 100 }));
  ev(V.owner, S.ownerFlagged, b('15:00:00'), 'home_viewed', { city: 'sf' }, true);
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  for (const file of [
    '20260925000000_events.sql',
    '20260926000000_two_city_event_contract.sql',
    '20261001000000_analytics_readiness_event_contract.sql',
    '20261002000000_session_started_and_is_internal.sql',
  ]) {
    await db.exec(migration(file));
  }
  seed();
  // received_at = occurred_at keeps each row inside the store's one-day window
  // even though the seed dates are in the future.
  for (const r of rows) {
    await db.query(
      `insert into public.events (id, visitor_id, session_id, event_name, occurred_at, received_at, props, variant, is_internal)
       values ($1, $2, $3, $4, $5, $5, $6, null, $7)`,
      [randomUUID(), r.visitor, r.session, r.name, r.at, JSON.stringify(r.props), r.internal ?? false],
    );
  }
});

afterAll(async () => {
  await db.close();
});

describe('the query file (AC1)', () => {
  it('holds exactly 17 named queries, M1 to M17, in order', () => {
    expect(Object.keys(QUERIES)).toEqual(NAMES);
    for (const name of NAMES) expect(QUERIES[name].length).toBeGreaterThan(0);
  });

  it('reads public.events_clean in every query and public.events in none', () => {
    for (const name of NAMES) {
      expect(QUERIES[name], name).toContain('public.events_clean');
      expect(QUERIES[name], name).not.toMatch(/public\.events\b/);
      expect(QUERIES[name], name).not.toMatch(/\bfrom\s+events\b/i);
    }
  });

  it('is a single statement per query, so the dashboard runs it whole', () => {
    for (const name of NAMES) expect(QUERIES[name].replace(/;\s*$/, ''), name).not.toContain(';');
  });
});

describe('the seed (AC2)', () => {
  it('spans three UTC days, all three cities, and the owner visitor really has rows in the raw table', async () => {
    const days = await db.query<{ d: string }>(
      `select distinct (occurred_at at time zone 'UTC')::date::text as d from public.events order by 1`,
    );
    expect(days.rows.map((r) => r.d)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    const cities = await db.query<{ c: string }>(
      `select distinct props->>'city' as c from public.events where event_name = 'home_viewed' order by 1`,
    );
    expect(cities.rows.map((r) => r.c)).toEqual(['hcmc', 'la', 'sf']);
    const owner = await db.query<{ n: number }>(`select count(*)::int as n from public.events where visitor_id = $1`, [V.owner]);
    expect(owner.rows[0].n).toBe(4);
    const clean = await db.query<{ n: number }>(`select count(*)::int as n from public.events_clean where visitor_id = $1`, [V.owner]);
    expect(clean.rows[0].n).toBe(0);
  });
});

describe('the 17 queries, run against the seed (AC2)', () => {
  it('M1 visitors by day: the cross-midnight row counts on its UTC date, the owner nowhere', async () => {
    expect(await run('M1')).toEqual([
      { day: '2026-10-01', visitors: 3 },
      { day: '2026-10-02', visitors: 2 },
      { day: '2026-10-03', visitors: 1 },
    ]);
  });

  it('M2 sessions by day', async () => {
    expect(await run('M2')).toEqual([
      { day: '2026-10-01', sessions: 3 },
      { day: '2026-10-02', sessions: 2 },
      { day: '2026-10-03', sessions: 1 },
    ]);
  });

  it('M3 returning visitors: the two-day visitor is returning on 10-02 only', async () => {
    expect(await run('M3')).toEqual([
      { day: '2026-10-01', visitors: 3, returning_visitors: 0, returning_share: 0 },
      { day: '2026-10-02', visitors: 2, returning_visitors: 1, returning_share: 0.5 },
      { day: '2026-10-03', visitors: 1, returning_visitors: 0, returning_share: 0 },
    ]);
  });

  it('M4 home-to-order funnel', async () => {
    expect(await run('M4')).toEqual([
      { step: 1, event_name: 'home_viewed', visitors: 5, step_conversion: null, checkout_conversion: 1 },
      { step: 2, event_name: 'restaurant_opened', visitors: 4, step_conversion: 0.8, checkout_conversion: 0.8 },
      { step: 3, event_name: 'cart_viewed', visitors: 4, step_conversion: 1, checkout_conversion: 0.8 },
      { step: 4, event_name: 'checkout_viewed', visitors: 4, step_conversion: 1, checkout_conversion: 0.8 },
      { step: 5, event_name: 'order_placed', visitors: 3, step_conversion: 0.75, checkout_conversion: 0.6 },
    ]);
  });

  it('M5 funnel by city: an la row, and the old-shape VND order lands in hcmc by R3', async () => {
    const out = await run('M5');
    expect(out).toEqual([
      { city: 'hcmc', step: 1, event_name: 'home_viewed', pairs: 2, step_conversion: null, conversion_by_city: 1 },
      { city: 'hcmc', step: 2, event_name: 'restaurant_opened', pairs: 2, step_conversion: 1, conversion_by_city: 1 },
      { city: 'hcmc', step: 3, event_name: 'cart_viewed', pairs: 2, step_conversion: 1, conversion_by_city: 1 },
      { city: 'hcmc', step: 4, event_name: 'checkout_viewed', pairs: 2, step_conversion: 1, conversion_by_city: 1 },
      { city: 'hcmc', step: 5, event_name: 'order_placed', pairs: 1, step_conversion: 0.5, conversion_by_city: 0.5 },
      { city: 'la', step: 1, event_name: 'home_viewed', pairs: 1, step_conversion: null, conversion_by_city: 1 },
      { city: 'la', step: 2, event_name: 'restaurant_opened', pairs: 1, step_conversion: 1, conversion_by_city: 1 },
      { city: 'la', step: 3, event_name: 'cart_viewed', pairs: 1, step_conversion: 1, conversion_by_city: 1 },
      { city: 'la', step: 4, event_name: 'checkout_viewed', pairs: 1, step_conversion: 1, conversion_by_city: 1 },
      { city: 'la', step: 5, event_name: 'order_placed', pairs: 1, step_conversion: 1, conversion_by_city: 1 },
      { city: 'sf', step: 1, event_name: 'home_viewed', pairs: 2, step_conversion: null, conversion_by_city: 1 },
      { city: 'sf', step: 2, event_name: 'restaurant_opened', pairs: 1, step_conversion: 0.5, conversion_by_city: 0.5 },
      { city: 'sf', step: 3, event_name: 'cart_viewed', pairs: 1, step_conversion: 1, conversion_by_city: 0.5 },
      { city: 'sf', step: 4, event_name: 'checkout_viewed', pairs: 1, step_conversion: 1, conversion_by_city: 0.5 },
      { city: 'sf', step: 5, event_name: 'order_placed', pairs: 1, step_conversion: 1, conversion_by_city: 0.5 },
    ]);
    expect(out.some((r) => r.city === 'la')).toBe(true);
  });

  it('M6 acquisition: a linkedin source and an (unknown) source, none dropped', async () => {
    const out = await run('M6');
    expect(out).toEqual([
      { part: 'a', day: '2026-10-01', source: '(direct)', utm_medium: '(none)', utm_campaign: '(none)', numerator: 1, base: 3, rate: 0.3333 },
      { part: 'a', day: '2026-10-01', source: '(unknown)', utm_medium: '(unknown)', utm_campaign: '(unknown)', numerator: 1, base: 3, rate: 0.3333 },
      { part: 'a', day: '2026-10-01', source: 'linkedin', utm_medium: '(none)', utm_campaign: '(none)', numerator: 1, base: 3, rate: 0.3333 },
      { part: 'a', day: '2026-10-02', source: 'linkedin.com', utm_medium: '(none)', utm_campaign: '(none)', numerator: 1, base: 2, rate: 0.5 },
      { part: 'a', day: '2026-10-02', source: 'news.ycombinator.com', utm_medium: '(none)', utm_campaign: '(none)', numerator: 1, base: 2, rate: 0.5 },
      { part: 'a', day: '2026-10-03', source: '(self)', utm_medium: '(none)', utm_campaign: '(none)', numerator: 1, base: 1, rate: 1 },
      { part: 'b', day: null, source: '(direct)', utm_medium: '(none)', utm_campaign: '(none)', numerator: 0, base: 1, rate: 0 },
      { part: 'b', day: null, source: '(self)', utm_medium: '(none)', utm_campaign: '(none)', numerator: 0, base: 1, rate: 0 },
      { part: 'b', day: null, source: '(unknown)', utm_medium: '(unknown)', utm_campaign: '(unknown)', numerator: 1, base: 1, rate: 1 },
      { part: 'b', day: null, source: 'linkedin', utm_medium: '(none)', utm_campaign: '(none)', numerator: 1, base: 1, rate: 1 },
      { part: 'b', day: null, source: 'linkedin.com', utm_medium: '(none)', utm_campaign: '(none)', numerator: 1, base: 1, rate: 1 },
      { part: 'b', day: null, source: 'news.ycombinator.com', utm_medium: '(none)', utm_campaign: '(none)', numerator: 0, base: 1, rate: 0 },
      { part: 'c', day: null, source: '(direct)', utm_medium: '(none)', utm_campaign: '(none)', numerator: 0, base: 1, rate: 0 },
      { part: 'c', day: null, source: '(self)', utm_medium: '(none)', utm_campaign: '(none)', numerator: 0, base: 1, rate: 0 },
      { part: 'c', day: null, source: 'linkedin', utm_medium: '(none)', utm_campaign: '(none)', numerator: 1, base: 1, rate: 1 },
      { part: 'c', day: null, source: 'linkedin.com', utm_medium: '(none)', utm_campaign: '(none)', numerator: 1, base: 1, rate: 1 },
    ]);
    expect(out.some((r) => r.source === 'linkedin')).toBe(true);
    expect(out.some((r) => r.source === '(unknown)')).toBe(true);
  });

  it('M7 completion rate', async () => {
    expect(await run('M7')).toEqual([{ placed: 3, delivered: 2, completion_rate: 0.6667 }]);
  });

  it('M8 rating rates', async () => {
    expect(await run('M8')).toEqual([
      { delivered: 2, restaurant_rated: 2, restaurant_rate: 1, driver_rated: 1, driver_rate: 0.5 },
    ]);
  });

  it('M9 sign-in wall, both surfaces', async () => {
    expect(await run('M9')).toEqual([
      { surface: 'checkout', sessions: 2, started: 1, start_rate: 0.5, passed: 1, pass_rate: 0.5, converted: 2, wall_to_action_rate: 1 },
      { surface: 'tip', sessions: 1, started: 1, start_rate: 1, passed: 1, pass_rate: 1, converted: 1, wall_to_action_rate: 1 },
    ]);
  });

  it('M10 wallet-paid share counts only rows with the key (R4): the #81-shape order is out', async () => {
    expect(await run('M10')).toEqual([{ orders: 2, wallet_paid_orders: 1, wallet_paid_share: 0.5 }]);
  });

  it('M11 short-balance recovery', async () => {
    expect(await run('M11')).toEqual([{ sessions: 2, recovered: 1, recovery_rate: 0.5 }]);
  });

  it('M12 tip rate', async () => {
    expect(await run('M12')).toEqual([{ eligible_orders: 1, tipped_orders: 1, tip_rate: 1 }]);
  });

  it('M13 VIP mix', async () => {
    expect(await run('M13')).toEqual([
      { vip_level: 'gold', orders: 1, all_orders: 2, share: 0.5 },
      { vip_level: 'none', orders: 1, all_orders: 2, share: 0.5 },
    ]);
  });

  it('M14 thanks-voucher use', async () => {
    expect(await run('M14')).toEqual([{ orders: 2, thanks_voucher_orders: 1, thanks_voucher_share: 0.5 }]);
  });

  it('M15 voucher attachment reads both order shapes', async () => {
    expect(await run('M15')).toEqual([{ orders: 3, orders_with_voucher: 1, voucher_attachment: 0.3333 }]);
  });

  it('M16 flash view-to-action', async () => {
    expect(await run('M16')).toEqual([{ sheets_shown: 2, restaurant_tapped: 1, view_to_action: 0.5 }]);
  });

  it('M17 location switch rate', async () => {
    expect(await run('M17')).toEqual([{ visitors_selecting: 3, visitors_switching: 1, switch_rate: 0.3333 }]);
  });
});

describe('cross-cutting rules (AC2)', () => {
  it('R3 gives the old-shape order to hcmc by its currency, not to sf', async () => {
    const hcmc = (await run('M5')).find((r) => r.city === 'hcmc' && r.event_name === 'order_placed');
    const sf = (await run('M5')).find((r) => r.city === 'sf' && r.event_name === 'order_placed');
    expect(hcmc?.pairs).toBe(1);
    expect(sf?.pairs).toBe(1); // the sf visitor's own new-shape order, not the VND one
  });

  it('the owner visitor appears in no output: totals match the seed without their rows', async () => {
    // The owner had a linkedin session, a home view and an order on 10-01; none of it is counted.
    expect((await run('M1'))[0]).toEqual({ day: '2026-10-01', visitors: 3 });
    expect((await run('M15'))[0].orders).toBe(3);
    const linkedin = (await run('M6')).filter((r) => r.source === 'linkedin');
    expect(linkedin.map((r) => [r.part, r.numerator, r.base])).toEqual([['a', 1, 3], ['b', 1, 1], ['c', 1, 1]]);
  });

  it('windows are half-open: a row exactly at w_end is out, exactly at w_start is in', async () => {
    const at = (start: string, end: string) =>
      QUERIES.M1.replace('2026-10-01 00:00:00+00', start).replace('2026-11-01 00:00:00+00', end);
    // The 10-03 02:30:00 row is the only one at that instant.
    const excluded = await run('M1', at('2026-10-03 00:00:00+00', '2026-10-03 02:30:00+00'));
    expect(excluded).toEqual([]);
    const included = await run('M1', at('2026-10-03 02:30:00+00', '2026-10-03 02:30:01+00'));
    expect(included).toEqual([{ day: '2026-10-03', visitors: 1 }]);
  });

  it('an empty window returns no invented numbers', async () => {
    const empty = (name: string) =>
      QUERIES[name].replace('2026-10-01 00:00:00+00', '2027-01-01 00:00:00+00').replace('2026-11-01 00:00:00+00', '2027-02-01 00:00:00+00');
    expect(await run('M1', empty('M1'))).toEqual([]);
    expect(await run('M7', empty('M7'))).toEqual([{ placed: 0, delivered: 0, completion_rate: null }]);
  });
});
