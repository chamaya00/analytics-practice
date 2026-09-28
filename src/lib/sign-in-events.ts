// The three sign-in events across the OAuth round trip (#238;
// docs/measurement/219-analytics-readiness-contract.md §7). Checkout
// (`surface: 'checkout'`) and the tracker's "Sign in to tip"
// (`surface: 'tip'`) both open the same sheet and both handle the return,
// so the event plumbing lives here once rather than in either screen.
//
// The header's wallet module (wallet-dom.ts) also sees the return but never
// claims the pending record: only the screen that opened the sheet reports
// how it ended, which is what keeps `sign_in_completed` to one per attempt.
//
// The #79 rule: the pending record and every prop below hold a provider, a
// surface and an outcome — never an email, a user id or an amount.

import type { OAuthProvider } from './auth-client';
import { SIGN_IN_PROVIDERS, SIGN_IN_SURFACES, track, type SignInSurface } from './tracking';

/** §7: the only state the return needs, written just before `sign_in_started`. */
export const PENDING_SIGN_IN_KEY = 'parody.pendingSignIn';

export interface PendingSignIn {
  provider: OAuthProvider;
  surface: SignInSurface;
}

/** `sign_in_prompt_shown`: once per opening of the sheet. */
export function trackSignInPromptShown(surface: SignInSurface): void {
  track('sign_in_prompt_shown', { surface });
}

/**
 * Wraps the navigation `beginSignIn` performs, so `sign_in_started` fires
 * only when a navigation actually follows (§7: `beginSignIn → false` fires
 * nothing, because it never calls `navigate`). The pending record is written
 * first, then the event is handed to the sender — whose `fetch` keeps
 * `keepalive: true`, so the send survives the page unloading.
 */
export function navigateWithSignInStarted(
  sessionStorage: Storage,
  provider: OAuthProvider,
  surface: SignInSurface,
  navigate: (url: string) => void,
): (url: string) => void {
  return (url) => {
    try {
      const pending: PendingSignIn = { provider, surface };
      sessionStorage.setItem(PENDING_SIGN_IN_KEY, JSON.stringify(pending));
    } catch {
      // Blocked storage: the return will find no record and fire nothing.
    }
    track('sign_in_started', { provider, surface });
    navigate(url);
  };
}

function isPendingSignIn(value: unknown): value is PendingSignIn {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (SIGN_IN_PROVIDERS as readonly unknown[]).includes(record.provider) &&
    (SIGN_IN_SURFACES as readonly unknown[]).includes(record.surface)
  );
}

/**
 * Reads the pending record and removes it in one synchronous step, before
 * the caller reaches any `await` (§7), so a second reader finds nothing.
 * `null` when there is no record, it can't be parsed, or storage is blocked
 * — and no record means no event.
 */
export function claimPendingSignIn(sessionStorage: Storage): PendingSignIn | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(PENDING_SIGN_IN_KEY);
    sessionStorage.removeItem(PENDING_SIGN_IN_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPendingSignIn(parsed) ? { provider: parsed.provider, surface: parsed.surface } : null;
  } catch {
    return null;
  }
}

/** `sign_in_completed`, once the outcome is known: `success` when the return produced a session, `failed` otherwise (a cancel looks the same, ADR 0008). */
export function trackSignInCompleted(pending: PendingSignIn, succeeded: boolean): void {
  track('sign_in_completed', {
    outcome: succeeded ? 'success' : 'failed',
    provider: pending.provider,
    surface: pending.surface,
  });
}
