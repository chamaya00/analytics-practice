import { describe, expect, it, vi } from 'vitest';
import {
  completeOAuthReturn,
  getCurrentSession,
  isOAuthReturn,
  signOutLocally,
  stripOAuthParams,
  type SupabaseAuthLike,
} from './auth-client';

const RAW_SESSION = {
  access_token: 'token-abc',
  user: { id: 'user-1', email: 'visitor@example.com', app_metadata: { provider: 'google' } },
};

function fakeAuth(overrides: Partial<SupabaseAuthLike> = {}): SupabaseAuthLike {
  return {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

describe('isOAuthReturn', () => {
  it('is true when the URL carries a code param', () => {
    expect(isOAuthReturn(new URL('https://site.example/checkout/?restaurant=a&code=xyz'))).toBe(true);
  });

  it('is true when the URL carries an error param (cancelled or failed sign-in)', () => {
    expect(isOAuthReturn(new URL('https://site.example/checkout/?error=access_denied'))).toBe(true);
  });

  it('is false for an ordinary page load', () => {
    expect(isOAuthReturn(new URL('https://site.example/checkout/?restaurant=a'))).toBe(false);
  });
});

describe('stripOAuthParams (AC4: auth parameters removed from the URL)', () => {
  it('removes code, state and error params but keeps every other query param', () => {
    const url = new URL(
      'https://site.example/checkout/?restaurant=a&code=xyz&state=s1&error=x&error_code=y&error_description=z',
    );
    const stripped = stripOAuthParams(url);
    expect(stripped.searchParams.get('restaurant')).toBe('a');
    expect(stripped.searchParams.has('code')).toBe(false);
    expect(stripped.searchParams.has('state')).toBe(false);
    expect(stripped.searchParams.has('error')).toBe(false);
    expect(stripped.searchParams.has('error_code')).toBe(false);
    expect(stripped.searchParams.has('error_description')).toBe(false);
  });

  it('never mutates the URL it was given', () => {
    const url = new URL('https://site.example/checkout/?code=xyz');
    stripOAuthParams(url);
    expect(url.searchParams.has('code')).toBe(true);
  });
});

describe('completeOAuthReturn (AC4: the session is established from the redirect)', () => {
  it('exchanges the code and returns a WalletSession on success', async () => {
    const auth = fakeAuth({ exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: RAW_SESSION }, error: null }) });
    const result = await completeOAuthReturn(auth, new URL('https://site.example/checkout/?code=xyz'));
    expect(result.failed).toBe(false);
    expect(result.session).toEqual({
      userId: 'user-1',
      accessToken: 'token-abc',
      provider: 'google',
      email: 'visitor@example.com',
    });
  });

  it('reports failed, with no session, on a provider error param — no network call made', async () => {
    const auth = fakeAuth();
    const result = await completeOAuthReturn(auth, new URL('https://site.example/checkout/?error=access_denied'));
    expect(result).toEqual({ session: null, failed: true });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('reports failed when the exchange itself returns an error', async () => {
    const auth = fakeAuth({
      exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: null }, error: { message: 'invalid_grant' } }),
    });
    const result = await completeOAuthReturn(auth, new URL('https://site.example/checkout/?code=xyz'));
    expect(result).toEqual({ session: null, failed: true });
  });

  it('reports failed rather than throwing when the exchange rejects (a cancelled sign-in reads the same as a failure)', async () => {
    const auth = fakeAuth({ exchangeCodeForSession: vi.fn().mockRejectedValue(new Error('network down')) });
    await expect(completeOAuthReturn(auth, new URL('https://site.example/checkout/?code=xyz'))).resolves.toEqual({
      session: null,
      failed: true,
    });
  });
});

describe('getCurrentSession (D1: an unreachable auth store behaves like signed out)', () => {
  it('returns the mapped session when one exists', async () => {
    const auth = fakeAuth({ getSession: vi.fn().mockResolvedValue({ data: { session: RAW_SESSION } }) });
    await expect(getCurrentSession(auth)).resolves.toEqual({
      userId: 'user-1',
      accessToken: 'token-abc',
      provider: 'google',
      email: 'visitor@example.com',
    });
  });

  it('returns null with no session', async () => {
    await expect(getCurrentSession(fakeAuth())).resolves.toBeNull();
  });

  it('returns null rather than throwing when getSession rejects', async () => {
    const auth = fakeAuth({ getSession: vi.fn().mockRejectedValue(new Error('network down')) });
    await expect(getCurrentSession(auth)).resolves.toBeNull();
  });
});

describe('signOutLocally (ADR 0008: scope local, not the library default global)', () => {
  it('calls signOut with scope local', async () => {
    const auth = fakeAuth();
    await signOutLocally(auth);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('never throws even when signOut rejects', async () => {
    const auth = fakeAuth({ signOut: vi.fn().mockRejectedValue(new Error('network down')) });
    await expect(signOutLocally(auth)).resolves.toBeUndefined();
  });
});
