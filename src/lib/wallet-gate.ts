// The D1 checkout gate (ADR 0008; #136 driver comment 2026-09-27 17:31Z,
// restated as binding on this issue): the wallet is on for checkout only
// when the build flag is set (wallet-config.ts) *and* `/auth/v1/settings`
// reports at least one provider *and* `public.wallet_ready()` answers. The
// two RPCs are probed in parallel, each with its own 3s timeout — if either
// hasn't answered in time, that Place-order tap is treated as dark (D1:
// unreachable behaves exactly like off).
//
// This is checkout's own gate, separate from wallet-dom.ts's (#146): the
// header widget only ever reacts to a session that already exists, so it can
// tell "off" from "on" just by trying `getWallet`. Checkout has to know
// whether the wallet is on *before* any session exists, to decide whether a
// signed-out tap shows the sign-in prompt at all.

import type { WalletEnvConfig } from './wallet-config';

const GATE_TIMEOUT_MS = 3000;

export interface WalletGate {
  ready: boolean;
  providers: { google: boolean; apple: boolean };
}

const DARK_GATE: WalletGate = { ready: false, providers: { google: false, apple: false } };

interface AuthSettings {
  external?: { google?: boolean; apple?: boolean };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timeoutId = setTimeout(() => controller?.abort(), GATE_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: controller?.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchProviders(
  config: WalletEnvConfig,
  fetchImpl: typeof fetch,
): Promise<{ google: boolean; apple: boolean }> {
  try {
    const response = await fetchWithTimeout(
      `${config.url}/auth/v1/settings`,
      { headers: { apikey: config.publishableKey } },
      fetchImpl,
    );
    if (!response.ok) return { google: false, apple: false };
    const settings = (await response.json()) as AuthSettings;
    return { google: settings.external?.google === true, apple: settings.external?.apple === true };
  } catch {
    return { google: false, apple: false };
  }
}

async function fetchWalletReady(config: WalletEnvConfig, fetchImpl: typeof fetch): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${config.url}/rest/v1/rpc/wallet_ready`,
      { method: 'POST', headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' }, body: '{}' },
      fetchImpl,
    );
    if (!response.ok) return false;
    return (await response.json()) === true;
  } catch {
    return false;
  }
}

/**
 * D1's checkout gate. Never throws: any failure on either probe, or either
 * one's own 3s timeout, resolves toward `{ ready: false, ... }` — dark,
 * exactly like an absent build flag (checkout-dom.ts treats the two
 * identically).
 */
export async function probeWalletGate(
  config: WalletEnvConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<WalletGate> {
  const [providers, ready] = await Promise.all([
    fetchProviders(config, fetchImpl),
    fetchWalletReady(config, fetchImpl),
  ]);
  if (!ready || (!providers.google && !providers.apple)) return DARK_GATE;
  return { ready: true, providers };
}
