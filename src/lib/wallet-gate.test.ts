import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeWalletGate } from './wallet-gate';

const config = { url: 'https://abcdefgh.supabase.co', publishableKey: 'sb_publishable_test_key' };

function fetchStub(settings: { google?: boolean; apple?: boolean } | null, ready: boolean | null) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/auth/v1/settings')) {
      if (settings === null) return Promise.reject(new Error('network down'));
      return Promise.resolve({ ok: true, json: async () => ({ external: settings }) });
    }
    if (url.endsWith('/rest/v1/rpc/wallet_ready')) {
      if (ready === null) return Promise.reject(new Error('network down'));
      return Promise.resolve({ ok: true, json: async () => ready });
    }
    throw new Error(`unexpected url ${url}`);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('probeWalletGate (D1: on only when a provider is enabled and wallet_ready() answers)', () => {
  it('is ready with google when settings reports google and wallet_ready answers true', async () => {
    const result = await probeWalletGate(config, fetchStub({ google: true, apple: false }, true));
    expect(result).toEqual({ ready: true, providers: { google: true, apple: false } });
  });

  it('is ready with both when settings reports both', async () => {
    const result = await probeWalletGate(config, fetchStub({ google: true, apple: true }, true));
    expect(result).toEqual({ ready: true, providers: { google: true, apple: true } });
  });

  it('is dark when no provider is enabled, even though wallet_ready answers true', async () => {
    const result = await probeWalletGate(config, fetchStub({ google: false, apple: false }, true));
    expect(result).toEqual({ ready: false, providers: { google: false, apple: false } });
  });

  it('is dark when wallet_ready answers false, even though a provider is enabled', async () => {
    const result = await probeWalletGate(config, fetchStub({ google: true, apple: false }, false));
    expect(result).toEqual({ ready: false, providers: { google: false, apple: false } });
  });

  it('is dark, never throws, when the settings request errors', async () => {
    await expect(probeWalletGate(config, fetchStub(null, true))).resolves.toEqual({
      ready: false,
      providers: { google: false, apple: false },
    });
  });

  it('is dark, never throws, when the wallet_ready request errors', async () => {
    await expect(probeWalletGate(config, fetchStub({ google: true, apple: false }, null))).resolves.toEqual({
      ready: false,
      providers: { google: false, apple: false },
    });
  });

  it('is dark when either probe times out at 3s, aborting the underlying request', async () => {
    vi.useFakeTimers();
    const signals: (AbortSignal | undefined)[] = [];
    const fetchImpl = vi.fn().mockImplementation(
      (url: string, init: RequestInit) =>
        new Promise((resolve, reject) => {
          signals.push(init.signal ?? undefined);
          if (url.endsWith('/rest/v1/rpc/wallet_ready')) {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
            return; // never resolves on its own — only the timeout settles it
          }
          resolve({ ok: true, json: async () => ({ external: { google: true } }) });
        }),
    );

    const promise = probeWalletGate(config, fetchImpl as unknown as typeof fetch);
    await vi.advanceTimersByTimeAsync(3000);

    await expect(promise).resolves.toEqual({ ready: false, providers: { google: false, apple: false } });
    expect(signals.some((signal) => signal?.aborted)).toBe(true);
  });

  it('sends the publishable key as apikey on both requests, and POSTs an empty body to wallet_ready', async () => {
    const fetchImpl = fetchStub({ google: true, apple: false }, true);
    await probeWalletGate(config, fetchImpl);

    const settingsCall = fetchImpl.mock.calls.find(([url]) => (url as string).endsWith('/auth/v1/settings'))!;
    expect((settingsCall[1] as RequestInit).headers).toMatchObject({ apikey: 'sb_publishable_test_key' });

    const readyCall = fetchImpl.mock.calls.find(([url]) => (url as string).endsWith('/rest/v1/rpc/wallet_ready'))!;
    expect((readyCall[1] as RequestInit).method).toBe('POST');
    expect((readyCall[1] as RequestInit).body).toBe('{}');
  });
});
