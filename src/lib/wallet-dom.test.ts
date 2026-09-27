import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatChipAmount,
  formatDripClockTime,
  formatNextDripHeadline,
  formatRelativeToInstant,
  initWallet,
  isNextDayLocal,
} from './wallet-dom';
import type { WalletEnvConfig } from './wallet-config';
import type { RawSession, SupabaseAuthLike } from './auth-client';
import type { WalletBalances } from './wallet-client';

const CONFIG: WalletEnvConfig = { url: 'https://abcdefgh.supabase.co', publishableKey: 'sb_publishable_test_key' };

const RAW_SESSION: RawSession = {
  access_token: 'token-abc',
  user: { id: 'user-1', email: 'visitor@example.com', app_metadata: { provider: 'google' } },
};

const BALANCES: WalletBalances = {
  usdMinor: 2000,
  vndMinor: 600000,
  windowStart: '2026-09-27T14:00:00.000Z',
  nextWindowStart: '2026-09-27T22:00:00.000Z',
  claimedThisWindow: false,
};

function fakeAuth(overrides: Partial<SupabaseAuthLike> = {}): SupabaseAuthLike {
  return {
    getSession: vi.fn().mockResolvedValue({ data: { session: RAW_SESSION } }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: RAW_SESSION }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

function fetchReturning(body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => body }) as unknown as typeof fetch;
}

const RAW_BALANCES = {
  usd_minor: 2000,
  vnd_minor: 600000,
  window_start: '2026-09-27T14:00:00.000Z',
  next_window_start: '2026-09-27T22:00:00.000Z',
  claimed_this_window: false,
};

describe('formatChipAmount (docs/design/143-wallet.md, the compact rule)', () => {
  it('shows the full amount when it is 9 characters or fewer', () => {
    expect(formatChipAmount(BALANCES, 'sf').text).toBe('$20.00');
    // vi-VN's Intl output separates the figure from the đồng sign with a
    // non-breaking space (U+00A0), not a plain one — see money.test.ts.
    expect(formatChipAmount(BALANCES, 'hcmc').text).toBe('600.000 ₫');
  });

  it('switches to compact notation past 9 characters', () => {
    const big: WalletBalances = { ...BALANCES, usdMinor: 1_248_000 };
    const result = formatChipAmount(big, 'sf');
    expect(result.full).toBe('$12,480.00');
    expect(result.text.length).toBeLessThanOrEqual(9);
    expect(result.full.length).toBeGreaterThan(9);
  });
});

describe('drip time formatting (docs/design/143-wallet.md)', () => {
  it('formats the clock time in the city locale, device time zone', () => {
    expect(formatDripClockTime('2026-09-27T22:00:00.000Z', 'sf')).toMatch(/\d{1,2}:\d{2}/);
  });

  it('detects a different local calendar day', () => {
    const now = new Date('2026-09-27T12:00:00.000Z').getTime();
    expect(isNextDayLocal('2026-09-28T12:00:00.000Z', now)).toBe(true);
    expect(isNextDayLocal('2026-09-27T18:00:00.000Z', now)).toBe(false);
  });

  it('prefixes "tomorrow" only when the instant falls on a different local day', () => {
    const now = new Date('2026-09-27T12:00:00.000Z').getTime();
    expect(formatNextDripHeadline('2026-09-27T18:00:00.000Z', 'sf', now)).toMatch(/^Next drip at /);
    expect(formatNextDripHeadline('2026-09-28T12:00:00.000Z', 'sf', now)).toMatch(/^Next drip tomorrow at /);
  });

  it('rounds the relative phrase to the hour, coarse rather than exact', () => {
    const now = new Date('2026-09-27T12:00:00.000Z').getTime();
    expect(formatRelativeToInstant('2026-09-27T17:05:00.000Z', now)).toBe('in about 5 hours');
    expect(formatRelativeToInstant('2026-09-27T12:10:00.000Z', now)).toBe('in under an hour');
    expect(formatRelativeToInstant('2026-09-27T13:00:00.000Z', now)).toBe('in about 1 hour');
  });
});

describe('initWallet (AC1: no config, the CI build)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div data-testid="balance-slot" aria-hidden="true"></div>';
  });

  it('renders nothing and makes no auth call when config is null', async () => {
    const createAuth = vi.fn();
    const chipRoot = document.querySelector<HTMLElement>('[data-testid="balance-slot"]')!;

    await initWallet(chipRoot, document.body, () => 'sf', null, { createAuth });

    expect(createAuth).not.toHaveBeenCalled();
    expect(chipRoot.innerHTML).toBe('');
    expect(chipRoot.hasAttribute('aria-hidden')).toBe(true);
  });
});

describe('initWallet (AC2: config present, wallet RPC failing or timing out)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div data-testid="balance-slot" aria-hidden="true"></div>';
  });

  it('shows no balance and throws nothing when getWallet fails for a signed-in session', async () => {
    const chipRoot = document.querySelector<HTMLElement>('[data-testid="balance-slot"]')!;
    const auth = fakeAuth();
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(
      initWallet(chipRoot, document.body, () => 'sf', CONFIG, {
        createAuth: async () => auth,
        fetchImpl,
        locationHref: 'https://site.example/',
      }),
    ).resolves.toBeUndefined();

    expect(chipRoot.querySelector('[data-testid="wallet-chip"]')).toBeNull();
    expect(chipRoot.hasAttribute('aria-hidden')).toBe(true);
  });

  it('shows no balance and no error when there is no session at all (signed out looks the same as dark)', async () => {
    const chipRoot = document.querySelector<HTMLElement>('[data-testid="balance-slot"]')!;
    const auth = fakeAuth({ getSession: vi.fn().mockResolvedValue({ data: { session: null } }) });

    await initWallet(chipRoot, document.body, () => 'sf', CONFIG, {
      createAuth: async () => auth,
      locationHref: 'https://site.example/',
    });

    expect(chipRoot.querySelector('[data-testid="wallet-chip"]')).toBeNull();
  });
});

describe('initWallet (AC3: signed in, stubbed RPC returning 2000 cents and 600000 VND)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div data-testid="balance-slot" aria-hidden="true"></div>';
  });

  afterEach(() => {
    document.querySelectorAll('[data-testid="wallet-sheet"]').forEach((el) => el.remove());
  });

  it('shows the formatted balance in the chip and un-hides the slot', async () => {
    const chipRoot = document.querySelector<HTMLElement>('[data-testid="balance-slot"]')!;
    const auth = fakeAuth();
    const fetchImpl = fetchReturning(RAW_BALANCES);

    await initWallet(chipRoot, document.body, () => 'sf', CONFIG, {
      createAuth: async () => auth,
      fetchImpl,
      locationHref: 'https://site.example/',
    });

    const chip = chipRoot.querySelector('[data-testid="wallet-chip"]');
    expect(chip).not.toBeNull();
    expect(chip?.querySelector('[data-testid="wallet-chip-amount"]')?.textContent).toBe('$20.00');
    expect(chipRoot.hasAttribute('aria-hidden')).toBe(false);
  });

  it('opens the wallet sheet on a chip tap, claims the drip once on Collect, and updates the display', async () => {
    const chipRoot = document.querySelector<HTMLElement>('[data-testid="balance-slot"]')!;
    const auth = fakeAuth();

    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/rpc/wallet_get')) return { ok: true, json: async () => RAW_BALANCES };
      if (url.endsWith('/rpc/wallet_claim_drip')) {
        return {
          ok: true,
          json: async () => ({ claimed: true, usd_minor: 2500, vnd_minor: 700000, next_window_start: '2026-09-27T22:00:00.000Z' }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    await initWallet(chipRoot, document.body, () => 'sf', CONFIG, {
      createAuth: async () => auth,
      fetchImpl,
      locationHref: 'https://site.example/',
    });

    const chip = chipRoot.querySelector<HTMLButtonElement>('[data-testid="wallet-chip"]')!;
    chip.click();

    const sheet = document.querySelector('[data-testid="wallet-sheet"]');
    expect(sheet).not.toBeNull();

    const collectButton = sheet!.querySelector<HTMLButtonElement>('[data-testid="wallet-drip-collect"]')!;
    collectButton.click();
    await vi.waitFor(() => {
      expect(sheet!.querySelector('[data-testid="wallet-drip-card"]')?.getAttribute('role')).toBe('status');
    });

    const claimCalls = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls.filter(([url]: [string]) =>
      url.endsWith('/rpc/wallet_claim_drip'),
    );
    expect(claimCalls).toHaveLength(1);

    expect(sheet!.querySelector('[data-testid="wallet-sheet-balance"]')?.textContent).toBe('$25.00');
    expect(chipRoot.querySelector('[data-testid="wallet-chip-amount"]')?.textContent).toBe('$25.00');
  });

  it('shows the next window time once the drip is claimed', async () => {
    const chipRoot = document.querySelector<HTMLElement>('[data-testid="balance-slot"]')!;
    const auth = fakeAuth();
    const claimedRaw = { ...RAW_BALANCES, claimed_this_window: true };
    const fetchImpl = fetchReturning(claimedRaw);

    await initWallet(chipRoot, document.body, () => 'sf', CONFIG, {
      createAuth: async () => auth,
      fetchImpl,
      locationHref: 'https://site.example/',
      now: () => new Date('2026-09-27T17:00:00.000Z').getTime(),
    });

    chipRoot.querySelector<HTMLButtonElement>('[data-testid="wallet-chip"]')!.click();
    const sheet = document.querySelector('[data-testid="wallet-sheet"]')!;
    expect(sheet.querySelector('[data-testid="wallet-drip-next"]')?.textContent).toMatch(/^Next drip at /);
  });
});

describe('initWallet (AC4: the OAuth-redirect return)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div data-testid="balance-slot" aria-hidden="true"></div>';
  });

  it('establishes the session and removes the auth parameters from the URL', async () => {
    const chipRoot = document.querySelector<HTMLElement>('[data-testid="balance-slot"]')!;
    const auth = fakeAuth();
    const fetchImpl = fetchReturning(RAW_BALANCES);
    const replaceUrl = vi.fn();

    await initWallet(chipRoot, document.body, () => 'sf', CONFIG, {
      createAuth: async () => auth,
      fetchImpl,
      locationHref: 'https://site.example/checkout/?restaurant=a&code=xyz&state=s1',
      replaceUrl,
    });

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('xyz');
    expect(replaceUrl).toHaveBeenCalledTimes(1);
    const [nextUrl] = replaceUrl.mock.calls[0];
    expect(nextUrl).not.toContain('code=');
    expect(nextUrl).not.toContain('state=');
    expect(nextUrl).toContain('restaurant=a');
    expect(chipRoot.querySelector('[data-testid="wallet-chip"]')).not.toBeNull();
  });

  it('a cancelled or failed sign-in leaves the visitor signed out with no error page, and still cleans the URL', async () => {
    const chipRoot = document.querySelector<HTMLElement>('[data-testid="balance-slot"]')!;
    const auth = fakeAuth();
    const replaceUrl = vi.fn();

    await expect(
      initWallet(chipRoot, document.body, () => 'sf', CONFIG, {
        createAuth: async () => auth,
        locationHref: 'https://site.example/checkout/?restaurant=a&error=access_denied',
        replaceUrl,
      }),
    ).resolves.toBeUndefined();

    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(chipRoot.querySelector('[data-testid="wallet-chip"]')).toBeNull();
    const [nextUrl] = replaceUrl.mock.calls[0];
    expect(nextUrl).not.toContain('error=');
  });

  it('sign-out clears the session, returns the header to signed-out, and calls no wallet function', async () => {
    const chipRoot = document.querySelector<HTMLElement>('[data-testid="balance-slot"]')!;
    const auth = fakeAuth();
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/rpc/wallet_get')) return { ok: true, json: async () => RAW_BALANCES };
      throw new Error(`unexpected fetch during sign-out: ${url}`);
    }) as unknown as typeof fetch;

    await initWallet(chipRoot, document.body, () => 'sf', CONFIG, {
      createAuth: async () => auth,
      fetchImpl,
      locationHref: 'https://site.example/',
    });

    chipRoot.querySelector<HTMLButtonElement>('[data-testid="wallet-chip"]')!.click();
    const sheet = document.querySelector('[data-testid="wallet-sheet"]')!;
    const signOutButton = sheet.querySelector<HTMLButtonElement>('[data-testid="wallet-sign-out"]')!;
    signOutButton.click();

    await vi.waitFor(() => {
      expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(document.querySelector('[data-testid="wallet-sheet"]')).toBeNull();
    });

    expect(chipRoot.querySelector('[data-testid="wallet-chip"]')).toBeNull();
    expect(chipRoot.hasAttribute('aria-hidden')).toBe(true);
  });

  it('"start over" (clearOrder) calls no wallet function — it only touches order-store keys', async () => {
    const { clearOrder } = await import('./order-store');
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);
    clearOrder(window.localStorage);
    expect(fetchImpl).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
