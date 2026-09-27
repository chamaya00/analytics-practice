import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimDrip, debitWallet, getWallet, tipWallet } from './wallet-client';

const config = (fetchImpl: typeof fetch) => ({
  url: 'https://abcdefgh.supabase.co',
  publishableKey: 'sb_publishable_test_key',
  accessToken: 'session-access-token',
  fetchImpl,
});

const debitConfig = (fetchImpl: typeof fetch) => ({
  ...config(fetchImpl),
  orderId: 'order-1',
  currency: 'USD' as const,
  amountMinor: 2100,
});

const tipConfig = (fetchImpl: typeof fetch) => ({
  ...config(fetchImpl),
  orderId: 'order-1',
  amountMinor: 200,
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

describe('debitWallet (ADR 0008 D8/"Source of truth")', () => {
  it('POSTs order id, currency and amount, and maps a debited answer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'debited', usd_minor: 900, vnd_minor: 750000, next_window_start: '2026-09-28T06:00:00.000Z' }),
    });

    const result = await debitWallet(debitConfig(fetchImpl));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://abcdefgh.supabase.co/rest/v1/rpc/wallet_debit');
    expect(JSON.parse(init.body)).toEqual({ p_order_id: 'order-1', p_currency: 'USD', p_amount_minor: 2100 });
    expect(result).toEqual({ kind: 'ok', status: 'debited', usdMinor: 900, vndMinor: 750000, nextWindowStart: '2026-09-28T06:00:00.000Z' });
  });

  it('maps an insufficient answer as a real, non-unreachable result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'insufficient', usd_minor: 900, vnd_minor: 750000, next_window_start: '2026-09-28T06:00:00.000Z' }),
    });
    const result = await debitWallet(debitConfig(fetchImpl));
    expect(result).toEqual({ kind: 'ok', status: 'insufficient', usdMinor: 900, vndMinor: 750000, nextWindowStart: '2026-09-28T06:00:00.000Z' });
  });

  it('reports a raised refusal (a 4xx, e.g. order_id_conflict) as blocked, not unreachable — one call only, no retry', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: 'order_id_conflict' }) });
    const result = await debitWallet(debitConfig(fetchImpl));
    expect(result).toEqual({ kind: 'blocked', message: 'order_id_conflict' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries once, with the same orderId, after a network error — and reports the retry\'s definitive answer', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'already_debited', usd_minor: 900, vnd_minor: 750000, next_window_start: '2026-09-28T06:00:00.000Z' }),
      });

    const result = await debitWallet(debitConfig(fetchImpl));

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [firstUrl, firstInit] = fetchImpl.mock.calls[0];
    const [secondUrl, secondInit] = fetchImpl.mock.calls[1];
    expect(firstUrl).toBe(secondUrl);
    expect(JSON.parse(firstInit.body)).toEqual(JSON.parse(secondInit.body));
    expect(result).toEqual({ kind: 'ok', status: 'already_debited', usdMinor: 900, vndMinor: 750000, nextWindowStart: '2026-09-28T06:00:00.000Z' });
  });

  it('reports unreachable after the retry also fails, and a 5xx counts as unreachable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(debitWallet(debitConfig(fetchImpl))).resolves.toEqual({ kind: 'unreachable' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const fetchImpl5xx = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(debitWallet(debitConfig(fetchImpl5xx))).resolves.toEqual({ kind: 'unreachable' });
    expect(fetchImpl5xx).toHaveBeenCalledTimes(2);
  });
});

describe('tipWallet (#164)', () => {
  it('POSTs order id and amount only (no currency — the server reads it from the order), and maps a tipped answer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'tipped', amount_minor: 200, currency: 'USD', usd_minor: 2800, vnd_minor: 750000 }),
    });

    const result = await tipWallet(tipConfig(fetchImpl));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://abcdefgh.supabase.co/rest/v1/rpc/wallet_tip');
    expect(JSON.parse(init.body)).toEqual({ p_order_id: 'order-1', p_amount_minor: 200 });
    expect(result).toEqual({ kind: 'ok', status: 'tipped', amountMinor: 200, currency: 'USD', usdMinor: 2800, vndMinor: 750000 });
  });

  it('maps an already_tipped answer as a real, non-unreachable result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'already_tipped', amount_minor: 200, currency: 'USD', usd_minor: 2800, vnd_minor: 750000 }),
    });
    const result = await tipWallet(tipConfig(fetchImpl));
    expect(result).toEqual({ kind: 'ok', status: 'already_tipped', amountMinor: 200, currency: 'USD', usdMinor: 2800, vndMinor: 750000 });
  });

  it('maps an insufficient answer as a real, non-unreachable result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'insufficient', amount_minor: 200, currency: 'USD', usd_minor: 50, vnd_minor: 750000 }),
    });
    const result = await tipWallet(tipConfig(fetchImpl));
    expect(result).toEqual({ kind: 'ok', status: 'insufficient', amountMinor: 200, currency: 'USD', usdMinor: 50, vndMinor: 750000 });
  });

  it('reports a raised refusal (a 4xx, e.g. order_not_debited or invalid_tip_amount) as blocked, not unreachable — one call only, no retry', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: 'order_not_debited' }) });
    const result = await tipWallet(tipConfig(fetchImpl));
    expect(result).toEqual({ kind: 'blocked', message: 'order_not_debited' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries once, with the same orderId, after a network error — and reports the retry's definitive answer", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'already_tipped', amount_minor: 200, currency: 'USD', usd_minor: 2800, vnd_minor: 750000 }),
      });

    const result = await tipWallet(tipConfig(fetchImpl));

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [firstUrl, firstInit] = fetchImpl.mock.calls[0];
    const [secondUrl, secondInit] = fetchImpl.mock.calls[1];
    expect(firstUrl).toBe(secondUrl);
    expect(JSON.parse(firstInit.body)).toEqual(JSON.parse(secondInit.body));
    expect(result).toEqual({ kind: 'ok', status: 'already_tipped', amountMinor: 200, currency: 'USD', usdMinor: 2800, vndMinor: 750000 });
  });

  it('reports unreachable after the retry also fails, and a 5xx counts as unreachable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(tipWallet(tipConfig(fetchImpl))).resolves.toEqual({ kind: 'unreachable' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const fetchImpl5xx = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(tipWallet(tipConfig(fetchImpl5xx))).resolves.toEqual({ kind: 'unreachable' });
    expect(fetchImpl5xx).toHaveBeenCalledTimes(2);
  });
});
