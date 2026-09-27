import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimDrip, getWallet } from './wallet-client';

const config = (fetchImpl: typeof fetch) => ({
  url: 'https://abcdefgh.supabase.co',
  publishableKey: 'sb_publishable_test_key',
  accessToken: 'session-access-token',
  fetchImpl,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('getWallet (AC3: stubbed RPC returning 2000 cents and 600000 VND)', () => {
  it('POSTs to wallet_get with the access token as bearer and the publishable key as apikey', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usd_minor: 2000,
        vnd_minor: 600000,
        window_start: '2026-09-27T14:00:00.000Z',
        next_window_start: '2026-09-27T22:00:00.000Z',
        claimed_this_window: false,
      }),
    });

    const result = await getWallet(config(fetchImpl));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://abcdefgh.supabase.co/rest/v1/rpc/wallet_get');
    expect(init.method).toBe('POST');
    expect(init.headers.apikey).toBe('sb_publishable_test_key');
    expect(init.headers.Authorization).toBe('Bearer session-access-token');

    expect(result).toEqual({
      usdMinor: 2000,
      vndMinor: 600000,
      windowStart: '2026-09-27T14:00:00.000Z',
      nextWindowStart: '2026-09-27T22:00:00.000Z',
      claimedThisWindow: false,
    });
  });
});

describe('getWallet and claimDrip (AC2: failing or timing out — never throws, resolves null)', () => {
  it('resolves null on a non-2xx response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(getWallet(config(fetchImpl))).resolves.toBeNull();
  });

  it('resolves null when fetch itself rejects, and never throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(getWallet(config(fetchImpl))).resolves.toBeNull();
    await expect(claimDrip(config(fetchImpl))).resolves.toBeNull();
  });

  it('resolves null on a timeout, aborting the underlying request', async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          capturedSignal = init.signal ?? undefined;
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    const promise = getWallet(config(fetchImpl as unknown as typeof fetch));
    await vi.advanceTimersByTimeAsync(8000);

    await expect(promise).resolves.toBeNull();
    expect(capturedSignal?.aborted).toBe(true);
  });
});

describe('claimDrip (AC3: one tap calls the claim function once)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('POSTs to wallet_claim_drip and maps the response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        claimed: true,
        usd_minor: 2500,
        vnd_minor: 700000,
        next_window_start: '2026-09-28T06:00:00.000Z',
      }),
    });

    const result = await claimDrip(config(fetchImpl));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://abcdefgh.supabase.co/rest/v1/rpc/wallet_claim_drip');
    expect(result).toEqual({
      claimed: true,
      usdMinor: 2500,
      vndMinor: 700000,
      nextWindowStart: '2026-09-28T06:00:00.000Z',
    });
  });
});
