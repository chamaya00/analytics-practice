import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEventRow, createSupabaseSender, initTracking } from './tracking-transport';
import { resetTrack, track } from './tracking';

const ORDER_ID = '11111111-2222-4333-8444-555555555555';
const VALID_ORDER_PLACED = {
  order_id: ORDER_ID,
  item_count: 2,
  amount_minor: 1800,
  currency: 'USD',
  drop_off_preset: 'home',
  delivery_instructions: 'hand_to_me',
  utensils: true,
  applied_voucher_ids: [],
  saved_amount_minor: 0,
};

const NORMAL_NAVIGATOR = { webdriver: false, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' };

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  // happy-dom's own default userAgent contains "HeadlessChrome", which the
  // sender's own bot pattern would otherwise match — stub a normal one so
  // tests exercise the sending path, and override it in the bot tests below.
  vi.stubGlobal('navigator', NORMAL_NAVIGATOR);
});

afterEach(() => {
  resetTrack();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createSupabaseSender (AC1: publishable-key transport call shape)', () => {
  it('POSTs an insert-only row to the store URL using only the publishable key, with Prefer: return=minimal', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const sender = createSupabaseSender({
      url: 'https://abcdefgh.supabase.co',
      publishableKey: 'sb_publishable_test_key',
      fetchImpl,
      localStorage: window.localStorage,
      sessionStorage: window.sessionStorage,
    });

    sender('restaurant_opened', { city: 'sf', restaurant_slug: 'north-beach-pizzeria' });
    await Promise.resolve();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://abcdefgh.supabase.co/rest/v1/events');
    expect(init.method).toBe('POST');
    expect(init.headers.apikey).toBe('sb_publishable_test_key');
    expect(init.headers.Authorization).toBe('Bearer sb_publishable_test_key');
    expect(init.headers.Prefer).toBe('return=minimal');

    const body = JSON.parse(init.body);
    expect(body.event_name).toBe('restaurant_opened');
    expect(body.props).toEqual({ city: 'sf', restaurant_slug: 'north-beach-pizzeria' });
    expect(body.variant).toBeNull();
    expect(typeof body.id).toBe('string');
    expect(typeof body.visitor_id).toBe('string');
    expect(typeof body.session_id).toBe('string');
    expect(typeof body.occurred_at).toBe('string');
  });

  it('never sends a service/admin key — the config shape only accepts one key, used as both apikey and bearer token', () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const sender = createSupabaseSender({
      url: 'https://abcdefgh.supabase.co',
      publishableKey: 'sb_publishable_test_key',
      fetchImpl,
      localStorage: window.localStorage,
      sessionStorage: window.sessionStorage,
    });
    sender('home_viewed', { city: 'sf' });
    const [, init] = fetchImpl.mock.calls[0];
    expect(Object.values(init.headers)).not.toContain(expect.stringMatching(/service_role|secret/i));
  });

  it('reuses one visitor id and session id across multiple sends', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const sender = createSupabaseSender({
      url: 'https://abcdefgh.supabase.co',
      publishableKey: 'sb_publishable_test_key',
      fetchImpl,
      localStorage: window.localStorage,
      sessionStorage: window.sessionStorage,
    });
    sender('home_viewed', { city: 'sf' });
    sender('cart_viewed', { item_count: 0, amount_minor: 0, currency: 'USD' });

    const first = JSON.parse(fetchImpl.mock.calls[0][1].body);
    const second = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(first.visitor_id).toBe(second.visitor_id);
    expect(first.session_id).toBe(second.session_id);
    expect(first.id).not.toBe(second.id);
  });
});

describe('buildEventRow', () => {
  it('always sets variant to null (docs/measurement/81-two-city-event-contract.md §5: no experiment ships)', () => {
    const row = buildEventRow('home_viewed', { city: 'sf' }, { visitorId: 'v', sessionId: 's' });
    expect(row.variant).toBeNull();
  });
});

describe('anti-spam bounds enforced before sending (AC3)', () => {
  const config = () => ({
    url: 'https://abcdefgh.supabase.co',
    publishableKey: 'sb_publishable_test_key',
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
  });

  it('does not send an oversized props payload', () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const sender = createSupabaseSender({ ...config(), fetchImpl });
    // order_placed has no free-text field long enough to legitimately exceed
    // 1 KB — this shape is exactly the "shouldn't be reachable" case the
    // event contract's checkout_viewed invariant describes for item_count: 0.
    sender('restaurant_opened', { restaurant_slug: 'a'.repeat(2000) });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not send a malformed event (fails the shape the store would also refuse)', () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const sender = createSupabaseSender({ ...config(), fetchImpl });
    sender('order_placed', { ...VALID_ORDER_PLACED, drop_off_preset: 'not_a_real_preset' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not send when navigator.webdriver signals an automated browser (bot exclusion)', () => {
    vi.stubGlobal('navigator', { webdriver: true, userAgent: 'Mozilla/5.0' });
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const sender = createSupabaseSender({ ...config(), fetchImpl });
    sender('home_viewed', { city: 'sf' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not send when the user agent matches a bot pattern', () => {
    vi.stubGlobal('navigator', { webdriver: false, userAgent: 'Googlebot/2.1' });
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const sender = createSupabaseSender({ ...config(), fetchImpl });
    sender('home_viewed', { city: 'sf' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never throws when the request itself rejects — best-effort, non-blocking', () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const sender = createSupabaseSender({ ...config(), fetchImpl });
    expect(() => sender('home_viewed', { city: 'sf' })).not.toThrow();
  });
});

describe('initTracking (AC2: env var absent leaves track at its no-op default)', () => {
  it('sends nothing and throws nothing when PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY are unset', () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);

    expect(() => initTracking()).not.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('wires the real sender when both are set', () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://abcdefgh.supabase.co');
    vi.stubEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchImpl);

    initTracking();
    track('home_viewed', { city: 'sf' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://abcdefgh.supabase.co/rest/v1/events');
  });
});

describe('the three events this issue sends still complete with no error when the store env vars are unset (AC5)', () => {
  it('location_selected, home_viewed, and restaurant_opened all call track() without throwing or reaching the network', () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);
    initTracking();

    expect(() => track('location_selected', { city: 'sf', is_switch: false })).not.toThrow();
    expect(() => track('home_viewed', { city: 'sf' })).not.toThrow();
    expect(() => track('restaurant_opened', { city: 'sf', restaurant_slug: 'north-beach-pizzeria' })).not.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('#94’s three events still complete with no error when the store env vars are unset (AC3)', () => {
  it('cart_viewed, checkout_viewed, and order_placed all call track() without throwing or reaching the network', () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);
    initTracking();

    expect(() => track('cart_viewed', { item_count: 0, amount_minor: 0, currency: 'USD' })).not.toThrow();
    expect(() => track('checkout_viewed', { item_count: 1, amount_minor: 1800, currency: 'USD' })).not.toThrow();
    expect(() => track('order_placed', VALID_ORDER_PLACED)).not.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('#83’s tracker events still complete with no error when the store env vars are unset (AC3)', () => {
  it('tracker_viewed, order_delivered, and rating_submitted all call track() without throwing or reaching the network', () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);
    initTracking();

    expect(() =>
      track('tracker_viewed', { order_id: ORDER_ID, minutes_since_order: 0, view_number: 1 }),
    ).not.toThrow();
    expect(() => track('order_delivered', { order_id: ORDER_ID, minutes_since_order: 7 })).not.toThrow();
    expect(() =>
      track('rating_submitted', { order_id: ORDER_ID, stars: 5, tags: ['fast'] }),
    ).not.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
