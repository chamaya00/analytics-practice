// #275, contract #270 §5.3 and §5.5: the `build` stamp. B1 and B2 (C10-C11).
// `__BUILD_SHA__` is the build-time define from astro.config.mjs; a test
// stands in for the define with `vi.stubGlobal`, then loads a fresh module.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SHA = '0123456789abcdef0123456789abcdef01234567';

interface Sent {
  build: unknown;
}

async function sendTwoEvents(): Promise<Sent[]> {
  vi.resetModules();
  const { createSupabaseSender } = await import('./tracking-transport');
  const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
  const send = createSupabaseSender({
    url: 'https://abcdefgh.supabase.co',
    publishableKey: 'sb_publishable_test_key',
    fetchImpl,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
  });
  send('home_viewed', { city: 'sf' });
  send('home_viewed', { city: 'hcmc' });
  return fetchImpl.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string) as Sent);
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubGlobal('navigator', { webdriver: false, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('build (#270 §5.5)', () => {
  it('B1: two events from one page load carry equal build values', async () => {
    vi.stubGlobal('__BUILD_SHA__', SHA);
    const [a, b] = await sendTwoEvents();
    expect(a.build).toBe(SHA);
    expect(b.build).toBe(a.build);
  });

  it('B2: an upper-case 40-hex value is sent lowercased', async () => {
    vi.stubGlobal('__BUILD_SHA__', SHA.toUpperCase());
    const rows = await sendTwoEvents();
    expect(rows.map((row) => row.build)).toEqual([SHA, SHA]);
  });

  it('B2: an absent value is sent as (unknown), never null', async () => {
    vi.stubGlobal('__BUILD_SHA__', null);
    const rows = await sendTwoEvents();
    expect(rows.map((row) => row.build)).toEqual(['(unknown)', '(unknown)']);
  });

  it('B2: with no define at all (a bare test run) it is (unknown), never null', async () => {
    const rows = await sendTwoEvents();
    expect(rows.map((row) => row.build)).toEqual(['(unknown)', '(unknown)']);
  });

  it('B2: a malformed value (39 hex, or non-hex) is (unknown), never null', async () => {
    for (const bad of [SHA.slice(1), `${SHA}0`, 'g'.repeat(40), '']) {
      vi.stubGlobal('__BUILD_SHA__', bad);
      const rows = await sendTwoEvents();
      expect(rows.map((row) => row.build)).toEqual(['(unknown)', '(unknown)']);
    }
  });
});
