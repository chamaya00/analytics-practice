// #275, contract #270 §5.2 and §5.5: the per-tab-session `seq` counter. One
// test per invariant Q1-Q6 (C4-C9), through the real sender.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTrack, setTrack, track } from './tracking';
import { createSupabaseSender, startTracking, type PageContext } from './tracking-transport';

const CONFIG = { url: 'https://abcdefgh.supabase.co', publishableKey: 'sb_publishable_test_key' };
const OTHER_SESSION = '99999999-9999-4999-8999-999999999999';

interface Sent {
  event_name: string;
  seq: number | null;
}

function sentRows(fetchImpl: ReturnType<typeof vi.fn>): Sent[] {
  return fetchImpl.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string) as Sent);
}

function install(fetchImpl: ReturnType<typeof vi.fn>): void {
  setTrack(
    createSupabaseSender({
      ...CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      localStorage: window.localStorage,
      sessionStorage: window.sessionStorage,
    }),
  );
}

const HOME = { city: 'sf' };
const BAD_HOME = { city: 'nowhere' };

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubGlobal('navigator', { webdriver: false, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
});

afterEach(() => {
  resetTrack();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('seq (#270 §5.5)', () => {
  it('Q1: three calls with the second invalid produce two rows, seq 1 and 3, and none with seq 2', () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    install(fetchImpl);

    track('home_viewed', HOME);
    track('home_viewed', BAD_HOME);
    track('home_viewed', HOME);

    expect(sentRows(fetchImpl).map((row) => row.seq)).toEqual([1, 3]);
  });

  it('Q2: a counter left by another session_id is ignored, so the next call is seq 1', () => {
    window.sessionStorage.setItem('parody.sessionId', '11111111-1111-4111-8111-111111111111');
    window.sessionStorage.setItem('parody.seq', JSON.stringify({ session_id: OTHER_SESSION, last: 7 }));
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    install(fetchImpl);

    track('home_viewed', HOME);

    expect(sentRows(fetchImpl).map((row) => row.seq)).toEqual([1]);
  });

  it('Q3: after a reload (a fresh module instance over the same sessionStorage) the next seq is last + 1', async () => {
    const first = vi.fn().mockResolvedValue({ ok: true });
    install(first);
    track('home_viewed', HOME);
    track('home_viewed', HOME);
    expect(sentRows(first).map((row) => row.seq)).toEqual([1, 2]);

    vi.resetModules();
    const fresh = await import('./tracking');
    const freshTransport = await import('./tracking-transport');
    const second = vi.fn().mockResolvedValue({ ok: true });
    fresh.setTrack(
      freshTransport.createSupabaseSender({
        ...CONFIG,
        fetchImpl: second,
        localStorage: window.localStorage,
        sessionStorage: window.sessionStorage,
      }),
    );
    fresh.track('home_viewed', HOME);

    expect(sentRows(second).map((row) => row.seq)).toEqual([3]);
    fresh.resetTrack();
  });

  it('Q4: calls made before setTrack keep their call-time seq after the queue flushes, and session_started differs from all of them', () => {
    track('home_viewed', HOME);
    track('home_viewed', HOME);
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const page: PageContext = {
      search: '',
      referrer: '',
      origin: 'https://example.test',
      localStorage: window.localStorage,
      sessionStorage: window.sessionStorage,
    };

    startTracking({ ...CONFIG, fetchImpl }, page);

    const rows = sentRows(fetchImpl);
    const started = rows.filter((row) => row.event_name === 'session_started');
    const others = rows.filter((row) => row.event_name !== 'session_started');
    expect(others.map((row) => row.seq)).toEqual([1, 2]);
    expect(started).toHaveLength(1);
    expect(started[0].seq).not.toBeNull();
    expect(others.map((row) => row.seq)).not.toContain(started[0].seq);
  });

  it('Q5: no two rows built from one sessionStorage share a seq', () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    install(fetchImpl);

    for (let i = 0; i < 12; i += 1) track('home_viewed', HOME);

    const seqs = sentRows(fetchImpl).map((row) => row.seq);
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(seqs).toHaveLength(12);
  });

  it('Q6: when sessionStorage.setItem throws, the row carries seq null and the send still happens', () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const store = new Map<string, string>([['parody.sessionId', '11111111-1111-4111-8111-111111111111']]);
    const blocked = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: (key: string) => void store.delete(key),
    } as unknown as Storage;
    vi.stubGlobal('sessionStorage', blocked);
    vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(blocked);
    setTrack(createSupabaseSender({ ...CONFIG, fetchImpl, localStorage: window.localStorage, sessionStorage: blocked }));

    track('home_viewed', HOME);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sentRows(fetchImpl)).toEqual([expect.objectContaining({ event_name: 'home_viewed', seq: null })]);
  });
});
