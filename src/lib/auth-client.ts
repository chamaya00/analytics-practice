// The auth half of #136's wallet (ADR 0008): session, the OAuth-redirect
// return, and sign-out. This issue does not add a way to *start* sign-in
// (#149's job, at Place order) — everything here only ever reacts to a
// session that already exists or a redirect that has just come back.
//
// Wrapped behind our own small interface, `SupabaseAuthLike`, rather than
// the real `@supabase/supabase-js` client throughout this module — the same
// "injectable client or fetch" split ADR 0008 asks for, matching
// tracking-transport.ts's `fetchImpl`. Every function below except
// `createSupabaseAuth` takes that interface as a plain argument, so a test
// stubs it with a hand-written fake and never touches the real SDK or the
// network. `createSupabaseAuth` is the one place the real package is
// loaded, by dynamic `import()`, and only ever called once config is known
// to be present (wallet-config.ts) — so an unconfigured build never
// imports it and never reaches an auth endpoint (AC1).

import type { WalletEnvConfig } from './wallet-config';

export interface RawAuthUser {
  id: string;
  email?: string | null;
  app_metadata?: { provider?: string };
}

export interface RawSession {
  access_token: string;
  user: RawAuthUser;
}

export interface WalletSession {
  userId: string;
  accessToken: string;
  provider: string;
  email: string | null;
}

/** The subset of `SupabaseClient['auth']` this module calls — see the file banner. */
export interface SupabaseAuthLike {
  getSession(): Promise<{ data: { session: RawSession | null } }>;
  exchangeCodeForSession(
    code: string,
  ): Promise<{ data: { session: RawSession | null }; error: { message: string } | null }>;
  signOut(options?: { scope?: 'local' | 'global' }): Promise<{ error: { message: string } | null }>;
}

function toWalletSession(raw: RawSession): WalletSession {
  return {
    userId: raw.user.id,
    accessToken: raw.access_token,
    provider: raw.user.app_metadata?.provider ?? 'unknown',
    email: raw.user.email ?? null,
  };
}

/** The query params Supabase's OAuth redirect can return, PKCE success or failure alike — stripped from the URL once handled (AC4) whether or not the return succeeded. */
const OAUTH_RETURN_PARAMS = ['code', 'state', 'error', 'error_code', 'error_description'];

/** Whether this URL is a landing from the OAuth round trip at all, success or failure — the caller uses this to decide whether to touch the URL or the auth client this page load. */
export function isOAuthReturn(url: URL): boolean {
  return url.searchParams.has('code') || url.searchParams.has('error');
}

/** A new URL with every OAuth-return param removed (AC4: "the auth parameters are removed from the URL") — never mutates its argument, so a caller still holding the original URL sees it unchanged. */
export function stripOAuthParams(url: URL): URL {
  const next = new URL(url.toString());
  for (const key of OAUTH_RETURN_PARAMS) next.searchParams.delete(key);
  return next;
}

export interface OAuthReturnResult {
  session: WalletSession | null;
  /** True for a provider error, a cancel (Supabase reports it the same way, ADR 0008/#143's own "can't reliably tell a cancel from a failure"), or an exchange that raised or came back empty — never thrown, so the caller never needs a try/catch of its own. */
  failed: boolean;
}

/**
 * Completes a PKCE return: exchanges `code` for a session, or reports a
 * provider `error` as failed without a network call. Assumes
 * `isOAuthReturn(url)` is already true; a URL carrying neither param is not
 * a meaningful call and reports as a no-op (AC4: "a cancelled or failed
 * sign-in leaves the visitor signed out with no error page" — a thrown
 * exchange is treated exactly like a provider error, not surfaced further).
 */
export async function completeOAuthReturn(auth: SupabaseAuthLike, url: URL): Promise<OAuthReturnResult> {
  if (url.searchParams.has('error')) return { session: null, failed: true };
  const code = url.searchParams.get('code');
  if (!code) return { session: null, failed: false };
  try {
    const { data, error } = await auth.exchangeCodeForSession(code);
    if (error || !data.session) return { session: null, failed: true };
    return { session: toWalletSession(data.session), failed: false };
  } catch {
    return { session: null, failed: true };
  }
}

/** The existing session, if any — `null` on no session and on any error, never thrown (D1: an unreachable auth store behaves exactly like a signed-out visitor). */
export async function getCurrentSession(auth: SupabaseAuthLike): Promise<WalletSession | null> {
  try {
    const { data } = await auth.getSession();
    return data.session ? toWalletSession(data.session) : null;
  } catch {
    return null;
  }
}

/**
 * `scope: 'local'` (ADR 0008: the library's default is `'global'`, which
 * would end the visitor's sessions on their other devices too). Best-effort:
 * an error here still lets the caller drop its own in-memory session state
 * and show the signed-out header, since nothing local depends on the
 * network call having succeeded.
 */
export async function signOutLocally(auth: SupabaseAuthLike): Promise<void> {
  try {
    await auth.signOut({ scope: 'local' });
  } catch {
    // Best-effort — see the comment above.
  }
}

/**
 * The one place `@supabase/supabase-js` is loaded (ADR 0008: "loaded by
 * dynamic import(), only when the build flag is on and a page needs it").
 * PKCE per the ADR; `detectSessionInUrl: false` because this module handles
 * the redirect return itself (`completeOAuthReturn`, `stripOAuthParams`)
 * rather than relying on the library's own URL parsing, which does not
 * clean a PKCE `?code=` query param the same way it cleans an implicit
 * flow's hash fragment.
 */
export async function createSupabaseAuth(config: WalletEnvConfig): Promise<SupabaseAuthLike> {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(config.url, config.publishableKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: true,
    },
  });
  return client.auth;
}
