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

export interface DebitConfig extends WalletClientConfig {
  /** The idempotency key (ADR 0008) — created before the debit, at the first Place-order tap. */
  orderId: string;
  currency: 'USD' | 'VND';
  amountMinor: number;
}

interface RawDebit {
  status: 'debited' | 'already_debited' | 'insufficient';
  usd_minor: number;
  vnd_minor: number;
  next_window_start: string;
}

export interface DebitBalances {
  usdMinor: number;
  vndMinor: number;
  nextWindowStart: string;
}

export type DebitResult =
  /** `wallet_debit` answered definitively — `insufficient` included, since it's a real answer from the ledger, not a failure. */
  | ({ kind: 'ok'; status: RawDebit['status'] } & DebitBalances)
  /** A raised, non-retryable refusal (ADR 0008's table: below the floor, a conflicting `order_id` for someone else, not authenticated). Distinct from `unreachable` — this is a definitive "no". */
  | { kind: 'blocked'; message: string }
  /** Network error, timeout, or HTTP 5xx (ADR 0008, D1) — the caller applies the fallback: place the order as today, without a debit. */
  | { kind: 'unreachable' };

async function postDebit(config: DebitConfig): Promise<DebitResult> {
  const fetchImpl = config.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!fetchImpl) return { kind: 'unreachable' };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timeoutId = setTimeout(() => controller?.abort(), RPC_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${config.url}/rest/v1/rpc/wallet_debit`, {
      method: 'POST',
      signal: controller?.signal,
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_order_id: config.orderId,
        p_currency: config.currency,
        p_amount_minor: config.amountMinor,
      }),
    });

    if (response.ok) {
      const raw = (await response.json()) as RawDebit;
      return { kind: 'ok', status: raw.status, usdMinor: raw.usd_minor, vndMinor: raw.vnd_minor, nextWindowStart: raw.next_window_start };
    }
    if (response.status >= 500) return { kind: 'unreachable' };
    const body: unknown = await response.json().catch(() => ({}));
    const message =
      typeof body === 'object' && body !== null && 'message' in body && typeof (body as { message: unknown }).message === 'string'
        ? (body as { message: string }).message
        : 'refused';
    return { kind: 'blocked', message };
  } catch {
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * `wallet_debit`, ADR 0008's D8/§"Source of truth". A network-level failure
 * (a rejected fetch, a timeout, or a 5xx) is retried exactly once with the
 * same `orderId` before being reported as `unreachable` — the request may
 * have already landed, and `order_id` is the primary key `wallet_debit`
 * checks first, so asking again is safe and resolves the ambiguity instead
 * of assuming failure and letting D1's fallback place the order for free.
 * Only a second failure is genuinely unreachable.
 */
export async function debitWallet(config: DebitConfig): Promise<DebitResult> {
  const first = await postDebit(config);
  if (first.kind !== 'unreachable') return first;
  return postDebit(config);
}

export interface TipConfig extends WalletClientConfig {
  /** `wallet_tip`'s idempotency key — one tip per order. */
  orderId: string;
  /** One of #162's presets for the order's own currency. The server, not this call, decides which currency that is. */
  amountMinor: number;
}

interface RawTip {
  status: 'tipped' | 'already_tipped' | 'insufficient';
  amount_minor: number;
  currency: 'USD' | 'VND';
  usd_minor: number;
  vnd_minor: number;
}

export interface TipBalances {
  usdMinor: number;
  vndMinor: number;
}

export type TipResult =
  /** `wallet_tip` answered definitively — `insufficient` included, since it's a real answer from the ledger, not a failure. */
  | ({ kind: 'ok'; status: RawTip['status']; amountMinor: number; currency: RawTip['currency'] } & TipBalances)
  /** A raised, non-retryable refusal (no debit row for this caller's order, an amount that isn't one of the presets, not authenticated). Distinct from `unreachable` — this is a definitive "no". */
  | { kind: 'blocked'; message: string }
  /** Network error, timeout, or HTTP 5xx — the caller shows "couldn't send the tip, nothing was taken" and leaves the panel open. */
  | { kind: 'unreachable' };

async function postTip(config: TipConfig): Promise<TipResult> {
  const fetchImpl = config.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!fetchImpl) return { kind: 'unreachable' };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timeoutId = setTimeout(() => controller?.abort(), RPC_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${config.url}/rest/v1/rpc/wallet_tip`, {
      method: 'POST',
      signal: controller?.signal,
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_order_id: config.orderId,
        p_amount_minor: config.amountMinor,
      }),
    });

    if (response.ok) {
      const raw = (await response.json()) as RawTip;
      return {
        kind: 'ok',
        status: raw.status,
        amountMinor: raw.amount_minor,
        currency: raw.currency,
        usdMinor: raw.usd_minor,
        vndMinor: raw.vnd_minor,
      };
    }
    if (response.status >= 500) return { kind: 'unreachable' };
    const body: unknown = await response.json().catch(() => ({}));
    const message =
      typeof body === 'object' && body !== null && 'message' in body && typeof (body as { message: unknown }).message === 'string'
        ? (body as { message: string }).message
        : 'refused';
    return { kind: 'blocked', message };
  } catch {
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * `wallet_tip` (#164). A network-level failure (a rejected fetch, a timeout,
 * or a 5xx) is retried exactly once with the same `orderId` before being
 * reported as `unreachable`, the same reasoning as `debitWallet`: the
 * request may have already landed, and `order_id` is the key `wallet_tip`
 * checks first, so a retry is safe and resolves the ambiguity rather than
 * assuming failure.
 */
export async function tipWallet(config: TipConfig): Promise<TipResult> {
  const first = await postTip(config);
  if (first.kind !== 'unreachable') return first;
  return postTip(config);
}
