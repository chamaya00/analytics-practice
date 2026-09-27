import { afterEach, describe, expect, it, vi } from 'vitest';
import { readWalletEnvConfig } from './wallet-config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('readWalletEnvConfig (AC1: no config, the CI build)', () => {
  it('returns null when all three of the flag, url and key are unset', () => {
    vi.stubEnv('PUBLIC_WALLET_ENABLED', '');
    vi.stubEnv('PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    expect(readWalletEnvConfig()).toBeNull();
  });

  it('returns null when the flag is absent even though the url and key are set (already true for events)', () => {
    vi.stubEnv('PUBLIC_WALLET_ENABLED', '');
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://abcdefgh.supabase.co');
    vi.stubEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');
    expect(readWalletEnvConfig()).toBeNull();
  });

  it('returns null when the flag is anything other than the literal string "true"', () => {
    vi.stubEnv('PUBLIC_WALLET_ENABLED', 'yes');
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://abcdefgh.supabase.co');
    vi.stubEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');
    expect(readWalletEnvConfig()).toBeNull();
  });

  it('returns the url and key once all three are present', () => {
    vi.stubEnv('PUBLIC_WALLET_ENABLED', 'true');
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://abcdefgh.supabase.co');
    vi.stubEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');
    expect(readWalletEnvConfig()).toEqual({
      url: 'https://abcdefgh.supabase.co',
      publishableKey: 'sb_publishable_test_key',
    });
  });
});
