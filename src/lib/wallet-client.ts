// Wallet balance and drip reads/writes over Supabase's Data API (ADR 0008,
// #145's `public.wallet_get()` and `public.wallet_claim_drip()`): plain
// `fetch` carrying the signed-in visitor's own access token as the
// `Authorization` bearer, not the SDK's RPC wrapper — the same "injectable
// client or fetch, the way tracking-transport.ts takes fetchImpl" split ADR
// 0008 names, so CI stubs this with no secrets and no real network.
//
// Every call here resolves to `null` on any failure — a non-2xx response, a
// network error, or a timeout — and never throws. That is deliberate: D1
// says an unreachable wallet store behaves exactly like one that was never
// configured, so the caller (wallet-dom.ts) treats `null` as "say nothing,"
// not as an error to surface.

/** #146 AC2's "failing or timing out": neither `wallet_get` nor `wallet_claim_drip` names its own timeout in ADR 0008 (only checkout's 3s config probe and the debit's 8s do) — this reuses the debit's 8s as the one other network-unreachable threshold the ADR states, rather than inventing a fourth number. */
const RPC_TIMEOUT_MS = 8000;

export interface WalletBalances {
  usdMinor: number;
  vndMinor: number;
  windowStart: string;
  nextWindowStart: string;
  claimedThisWindow: boolean;
}

export interface DripClaimResult {
  claimed: boolean;
  usdMinor: number;
  vndMinor: number;
  nextWindowStart: string;
}

interface RawWalletGet {
  usd_minor: number;
  vnd_minor: number;
  window_start: string;
  next_window_start: string;
  claimed_this_window: boolean;
}

interface RawDripClaim {
  claimed: boolean;
  usd_minor: number;
  vnd_minor: number;
  next_window_start: string;
}

function toBalances(raw: RawWalletGet): WalletBalances {
  return {
    usdMinor: raw.usd_minor,
    vndMinor: raw.vnd_minor,
    windowStart: raw.window_start,
    nextWindowStart: raw.next_window_start,
    claimedThisWindow: raw.claimed_this_window,
  };
}

function toDripResult(raw: RawDripClaim): DripClaimResult {
  return {
    claimed: raw.claimed,
    usdMinor: raw.usd_minor,
    vndMinor: raw.vnd_minor,
    nextWindowStart: raw.next_window_start,
  };
}

export interface WalletClientConfig {
  url: string;
  publishableKey: string;
  /** The signed-in visitor's own session token — `wallet_get`/`wallet_claim_drip` run as `authenticated` under RLS, never as the anonymous key events use. */
  accessToken: string;
  fetchImpl?: typeof fetch;
}

async function callRpc<T>(config: WalletClientConfig, fn: string): Promise<T | null> {
  const fetchImpl = config.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!fetchImpl) return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timeoutId = setTimeout(() => controller?.abort(), RPC_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${config.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      signal: controller?.signal,
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getWallet(config: WalletClientConfig): Promise<WalletBalances | null> {
  const raw = await callRpc<RawWalletGet>(config, 'wallet_get');
  return raw ? toBalances(raw) : null;
}

export async function claimDrip(config: WalletClientConfig): Promise<DripClaimResult | null> {
  const raw = await callRpc<RawDripClaim>(config, 'wallet_claim_drip');
  return raw ? toDripResult(raw) : null;
}
