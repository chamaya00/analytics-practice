// #225 AC2 (acquisition: `session_started`) and AC3 (the `?internal=`
// marking and `is_internal`), per
// docs/measurement/219-analytics-readiness-contract.md §5 and §6. Every
// page-load test runs the real site-wide initialiser, `initTracking()`,
// against happy-dom's own `location`, a faked `document.referrer`, and a
// stubbed `fetch`, and reads what would have been POSTed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyInternalMarking,
  INTERNAL_KEY,
  readIsInternal,
  referrerHost,
  SESSION_STARTED_KEY,
  sessionStartedProps,
  utmValue,
} from './acquisition';
import { initTracking, startTracking } from './tracking-transport';
import { resetTrack, track } from './tracking';

const ORIGIN = 'https://dontdropthatpromo.test';
const LAUNCH_URL = `${ORIGIN}/?utm_source=linkedin&gclid=X&fbclid=Y&li_fat_id=Z&internal=1`;

let fetchImpl: ReturnType<typeof vi.fn>;

function setReferrer(referrer: string) {
  Object.defineProperty(document, 'referrer', { value: referrer, configurable: true });
}

/** One page load: the URL and referrer it arrives with, then BaseLayout's initialiser. */
function loadPage(url: string, referrer = '') {
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(url);
  setReferrer(referrer);
  initTracking();
}

type SentRow = { event_name: string; is_internal: boolean; props: Record<string, unknown>; occurred_at: string };

const sentBodies = (): string[] => fetchImpl.mock.calls.map((call) => call[1].body as string);
const sentRows = (): SentRow[] => sentBodies().map((body) => JSON.parse(body) as SentRow);
const sessionStartedRows = () => sentRows().filter((row) => row.event_name === 'session_started');

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  // happy-dom's own user agent contains "HeadlessChrome", which the sender's bot check drops.
  vi.stubGlobal('navigator', { webdriver: false, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
  vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://abcdefgh.supabase.co');
  vi.stubEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');
  fetchImpl = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchImpl);
});

afterEach(() => {
  resetTrack();
  setReferrer('');
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('session_started on the launch link (AC2)', () => {
  it('sends exactly one session_started, before any other event from that load, with exactly the four props', () => {
    loadPage(LAUNCH_URL, 'https://www.linkedin.com/feed/update/urn:li:activity:1?trk=abc');
    track('home_viewed', { city: 'sf' });

    const rows = sentRows();
    expect(rows.map((row) => row.event_name)).toEqual(['session_started', 'home_viewed']);
    expect(rows[0].props).toStrictEqual({
      referrer_host: 'linkedin.com',
      utm_source: 'linkedin',
      utm_medium: '(none)',
      utm_campaign: '(none)',
    });
  });

  it('puts none of X, Y, Z or the word internal into the serialised row', () => {
    loadPage(LAUNCH_URL, 'https://www.linkedin.com/');
    const [body] = sentBodies();
    const row = JSON.parse(body) as SentRow;

    // Two unavoidable exceptions, each checked for exactly what it is: the
    // ISO timestamp's UTC suffix "Z", and the `is_internal` column's name.
    expect(row.occurred_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const rest = body.replace(`"occurred_at":"${row.occurred_at}"`, '').replace('"is_internal":true', '');
    for (const forbidden of ['X', 'Y', 'Z', 'internal', 'gclid', 'fbclid', 'li_fat_id']) {
      expect(rest, `expected the row not to contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('never carries a click ID value, the path, or the query string, with distinctive values', () => {
    loadPage(
      `${ORIGIN}/about/?utm_source=linkedin&gclid=GCLIDVALUE&fbclid=FBCLIDVALUE&li_fat_id=LIFATVALUE&msclkid=MSVALUE&internal=1`,
      'https://www.linkedin.com/in/someone?secret=REFERRERQUERY#frag',
    );
    const body = sentBodies()[0];
    for (const forbidden of ['GCLIDVALUE', 'FBCLIDVALUE', 'LIFATVALUE', 'MSVALUE', 'REFERRERQUERY', 'someone', 'about', 'frag', '?', '&']) {
      expect(body, `expected the row not to contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('sends none on a second page load in the same session', () => {
    loadPage(LAUNCH_URL, 'https://www.linkedin.com/');
    resetTrack();
    loadPage(`${ORIGIN}/offers/`, `${ORIGIN}/`);
    track('home_viewed', { city: 'sf' });

    expect(sessionStartedRows()).toHaveLength(1);
    expect(sentRows().at(-1)?.event_name).toBe('home_viewed');
  });

  it('sends a new one when the session changes (a new tab)', () => {
    loadPage(LAUNCH_URL, '');
    window.sessionStorage.clear();
    loadPage(`${ORIGIN}/`, '');

    expect(sessionStartedRows()).toHaveLength(2);
  });

  it('sends nothing when sessionStorage is unavailable', () => {
    const blocked = new Proxy(window.sessionStorage, {
      get() {
        throw new Error('SecurityError');
      },
    });
    expect(() =>
      startTracking(
        { url: 'https://abcdefgh.supabase.co', publishableKey: 'sb_publishable_test_key', fetchImpl },
        { search: '?utm_source=linkedin', referrer: '', origin: ORIGIN, localStorage: window.localStorage, sessionStorage: blocked },
      ),
    ).not.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends nothing, and still applies the marking, when the store is not configured', () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', '');
    loadPage(LAUNCH_URL, '');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(SESSION_STARTED_KEY)).toBeNull();
    expect(window.localStorage.getItem(INTERNAL_KEY)).toBe('1');
  });
});

describe('referrer_host (AC2)', () => {
  it.each([
    ['an empty referrer', '', '(none)'],
    ['this site itself', `${ORIGIN}/restaurants/pho-place/`, '(self)'],
    ['an unparseable referrer', 'not a url', '(invalid)'],
    ['a www. host, stripped once and lowercased, with no port, path, query or user info', 'https://user:pw@WWW.Example.COM:8443/a/b?q=1#f', 'example.com'],
    ['only one leading www. is stripped', 'https://www.www.example.com/', 'www.example.com'],
    ['a host the pattern refuses (an IPv6 literal)', 'http://[::1]/', '(invalid)'],
    ['a same-host page on another port is not self', 'https://dontdropthatpromo.test:8443/', 'dontdropthatpromo.test'],
  ])('%s', (_label, referrer, expected) => {
    expect(referrerHost(referrer, ORIGIN)).toBe(expected);
  });

  it.each([
    ['(none)', ''],
    ['(self)', `${ORIGIN}/about/`],
    ['(invalid)', 'not a url'],
    ['news.ycombinator.com', 'https://www.news.ycombinator.com/item?id=1'],
  ])('the page load sends %s', (expected, referrer) => {
    loadPage(`${ORIGIN}/`, referrer);
    expect(sessionStartedRows()[0].props.referrer_host).toBe(expected);
  });
});

describe('utm_ values (AC2)', () => {
  it.each([
    [null, '(none)'],
    ['', '(none)'],
    ['   ', '(none)'],
    ['  LinkedIn ', 'linkedin'],
    ['launch_2026-10.v1', 'launch_2026-10.v1'],
    ['a'.repeat(50), 'a'.repeat(50)],
    ['a'.repeat(51), '(invalid)'],
    ['me@example.com', '(invalid)'],
    ['https://x.com/', '(invalid)'],
    ['a?b', '(invalid)'],
    ['(none)', '(invalid)'],
  ])('%j gives %s', (raw, expected) => {
    expect(utmValue(raw)).toBe(expected);
  });

  it('reads exactly the three utm_ names with get(), and never iterates the query string', () => {
    const proto = URLSearchParams.prototype;
    const get = vi.spyOn(proto, 'get');
    const iterators = [
      vi.spyOn(proto, 'entries'),
      vi.spyOn(proto, 'keys'),
      vi.spyOn(proto, 'values'),
      vi.spyOn(proto, 'forEach'),
      vi.spyOn(proto, 'getAll'),
      vi.spyOn(proto, 'has'),
      vi.spyOn(proto, 'toString'),
      vi.spyOn(proto, Symbol.iterator as never),
    ];

    sessionStartedProps('?utm_source=a&utm_medium=b&utm_campaign=c&gclid=X', '', ORIGIN);

    expect(get.mock.calls.map(([name]) => name).sort()).toEqual(['utm_campaign', 'utm_medium', 'utm_source']);
    for (const spy of iterators) expect(spy).not.toHaveBeenCalled();
  });

  it('the page load carries all three when the link has them', () => {
    loadPage(`${ORIGIN}/?utm_source=LinkedIn&utm_medium=social&utm_campaign=launch-oct`, '');
    expect(sessionStartedRows()[0].props).toStrictEqual({
      referrer_host: '(none)',
      utm_source: 'linkedin',
      utm_medium: 'social',
      utm_campaign: 'launch-oct',
    });
  });
});

describe('the ?internal= marking (AC3)', () => {
  it('?internal=1 sets parody.internal to "1", and that load\'s rows and every later row carry is_internal = true', () => {
    loadPage(LAUNCH_URL, '');
    track('home_viewed', { city: 'sf' });
    expect(window.localStorage.getItem(INTERNAL_KEY)).toBe('1');

    resetTrack();
    loadPage(`${ORIGIN}/offers/`, '');
    track('home_viewed', { city: 'hcmc' });

    const rows = sentRows();
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.is_internal)).toEqual([true, true, true]);
  });

  it('?internal=0 removes the key, and later rows carry false', () => {
    loadPage(`${ORIGIN}/?internal=1`, '');
    resetTrack();
    loadPage(`${ORIGIN}/?internal=0`, '');
    expect(window.localStorage.getItem(INTERNAL_KEY)).toBeNull();
    track('home_viewed', { city: 'sf' });

    const rows = sentRows();
    expect(rows[0].is_internal).toBe(true);
    expect(rows.at(-1)?.event_name).toBe('home_viewed');
    expect(rows.at(-1)?.is_internal).toBe(false);
  });

  it.each(['yes', 'true', '', '2', '01', ' 1'])('?internal=%j changes nothing, marked or not', (value) => {
    loadPage(`${ORIGIN}/?internal=${encodeURIComponent(value)}`, '');
    expect(window.localStorage.getItem(INTERNAL_KEY)).toBeNull();

    window.localStorage.setItem(INTERNAL_KEY, '1');
    resetTrack();
    loadPage(`${ORIGIN}/?internal=${encodeURIComponent(value)}`, '');
    expect(window.localStorage.getItem(INTERNAL_KEY)).toBe('1');
  });

  it('a row sent with no marking carries is_internal = false', () => {
    loadPage(`${ORIGIN}/`, '');
    expect(sentRows()[0].is_internal).toBe(false);
  });

  it('storage that throws on the flag gives rows carrying false, and marking never throws', () => {
    const real = window.localStorage;
    const throwsOnFlag = {
      getItem: (key: string) => {
        if (key === INTERNAL_KEY) throw new Error('SecurityError');
        return real.getItem(key);
      },
      setItem: (key: string, value: string) => {
        if (key === INTERNAL_KEY) throw new Error('SecurityError');
        real.setItem(key, value);
      },
      removeItem: (key: string) => {
        if (key === INTERNAL_KEY) throw new Error('SecurityError');
        real.removeItem(key);
      },
    } as unknown as Storage;

    expect(() =>
      startTracking(
        { url: 'https://abcdefgh.supabase.co', publishableKey: 'sb_publishable_test_key', fetchImpl },
        { search: '?internal=1', referrer: '', origin: ORIGIN, localStorage: throwsOnFlag, sessionStorage: window.sessionStorage },
      ),
    ).not.toThrow();
    track('home_viewed', { city: 'sf' });

    const rows = sentRows();
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.is_internal)).toEqual([false, false]);
  });

  it('fully blocked storage reads as unmarked and is never thrown through', () => {
    const blocked = new Proxy({} as Storage, {
      get() {
        throw new Error('SecurityError');
      },
    });
    expect(readIsInternal(blocked)).toBe(false);
    expect(readIsInternal(undefined)).toBe(false);
    expect(() => applyInternalMarking('?internal=1', blocked)).not.toThrow();
    expect(() => applyInternalMarking('?internal=0', blocked)).not.toThrow();
  });
});
