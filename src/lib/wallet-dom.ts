// The wallet's home-page surfaces (docs/design/143-wallet.md; #146): the
// header's `.balance-slot` chip, the wallet sheet (both balances, the drip
// card, sign-out), and the OAuth-redirect return. This issue adds no way to
// *start* sign-in — #149 wires that at Place order — so everything here only
// ever reacts to a session that already exists or a redirect that has just
// landed.
//
// D1 (ADR 0008, binding): the wallet switches on only when auth config is
// present *and* the wallet RPC answers. Both gates are `return` statements
// in `initWallet` below, not a rendered error state — a dark wallet and a
// signed-out one render identically (an empty, untouched `.balance-slot`),
// exactly as docs/design/143-wallet.md's named-states table says.

import { CITY_NAMES, CITY_LOCALE, formatMoneyForCity, formatMoneyCompactForCity, type City } from './money';
import { readWalletEnvConfig, type WalletEnvConfig } from './wallet-config';
import {
  createSupabaseAuth,
  completeOAuthReturn,
  getCurrentSession,
  isOAuthReturn,
  signOutLocally,
  stripOAuthParams,
  type SupabaseAuthLike,
  type WalletSession,
} from './auth-client';
import { getWallet, claimDrip, type WalletBalances } from './wallet-client';

const DRIP_WINDOW_TIMES = '7:00 AM, 3:00 PM and 11:00 PM';

function amountForCity(balances: WalletBalances, city: City): number {
  return city === 'sf' ? balances.usdMinor : balances.vndMinor;
}

/** The mock's own 9-character threshold (the width of `600.000 ₫`) — past it, the chip switches to `Intl`'s compact notation (money.ts). */
export function formatChipAmount(balances: WalletBalances, city: City): { text: string; full: string } {
  const amountMinor = amountForCity(balances, city);
  const full = formatMoneyForCity(amountMinor, city);
  const text = full.length > 9 ? formatMoneyCompactForCity(amountMinor, city) : full;
  return { text, full };
}

export function formatDripClockTime(instantIso: string, city: City): string {
  return new Intl.DateTimeFormat(CITY_LOCALE[city], { hour: 'numeric', minute: '2-digit' }).format(new Date(instantIso));
}

/** Whether `instantIso` falls on a different local calendar day than `now` — the device's own timezone, since neither `Date` argument carries one (docs/design/143-wallet.md: "the device's own time zone"). */
export function isNextDayLocal(instantIso: string, now: number): boolean {
  return new Date(instantIso).toDateString() !== new Date(now).toDateString();
}

export function formatNextDripHeadline(instantIso: string, city: City, now: number): string {
  const time = formatDripClockTime(instantIso, city);
  return isNextDayLocal(instantIso, now) ? `Next drip tomorrow at ${time}` : `Next drip at ${time}`;
}

/** Coarse, rounded to the hour — computed once when the sheet opens and never ticks (docs/design/143-wallet.md, "the deliberate oddity"). */
export function formatRelativeToInstant(instantIso: string, now: number): string {
  const diffMs = new Date(instantIso).getTime() - now;
  const hours = Math.round(diffMs / 3_600_000);
  return hours <= 0 ? 'in under an hour' : `in about ${hours} hour${hours === 1 ? '' : 's'}`;
}

function providerLabel(provider: string): string {
  return provider.length === 0 ? provider : provider.charAt(0).toUpperCase() + provider.slice(1);
}

function renderChip(chipRoot: HTMLElement, city: City, balances: WalletBalances, onOpen: () => void): void {
  chipRoot.innerHTML = '';
  chipRoot.removeAttribute('aria-hidden');

  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'wallet-chip';
  chip.setAttribute('data-testid', 'wallet-chip');

  const { text, full } = formatChipAmount(balances, city);
  const dripAvailable = !balances.claimedThisWindow;
  chip.classList.toggle('wallet-chip--drip', dripAvailable);
  chip.setAttribute('aria-label', dripAvailable ? `Wallet, ${full}. Cash drip ready to collect.` : `Wallet, ${full}.`);

  const amount = document.createElement('span');
  amount.setAttribute('data-testid', 'wallet-chip-amount');
  amount.textContent = text;
  chip.append(amount);

  if (dripAvailable) {
    const badge = document.createElement('span');
    badge.className = 'wallet-chip-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = '+';
    chip.append(badge);
  }

  chip.addEventListener('click', onOpen);
  chipRoot.append(chip);
}

type DripCardState = 'available' | 'claiming' | 'claim-failed' | 'collected' | 'next';

function renderDripCard(
  container: HTMLElement,
  city: City,
  state: DripCardState,
  balances: WalletBalances,
  now: () => number,
  onCollect: () => void,
): void {
  container.innerHTML = '';
  container.className = 'wallet-drip-card';
  container.setAttribute('data-testid', 'wallet-drip-card');
  if (state === 'collected') container.setAttribute('role', 'status');
  else container.removeAttribute('role');

  const eyebrow = document.createElement('p');
  eyebrow.className = 'wallet-drip-eyebrow';

  if (state === 'available' || state === 'claiming' || state === 'claim-failed') {
    eyebrow.textContent = 'CASH DRIP · READY NOW';
    eyebrow.classList.add('wallet-drip-eyebrow--accent');

    const body = document.createElement('p');
    body.textContent = '$5.00 and 100.000 ₫, both in one tap.';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wallet-drip-collect';
    button.setAttribute('data-testid', 'wallet-drip-collect');
    button.textContent = state === 'claiming' ? 'Collecting…' : 'Collect $5.00 + 100.000 ₫';
    button.disabled = state === 'claiming';
    button.addEventListener('click', onCollect);

    const fine = document.createElement('p');
    fine.className = 'wallet-drip-fine';
    fine.textContent = `${DRIP_WINDOW_TIMES}. A missed drip doesn't carry over.`;

    container.append(eyebrow, body, button, fine);

    if (state === 'claim-failed') {
      const failNote = document.createElement('p');
      failNote.className = 'wallet-drip-fine';
      failNote.setAttribute('data-testid', 'wallet-drip-failed');
      failNote.textContent = "Couldn't collect just now. Try again.";
      container.append(failNote);
    }
  } else if (state === 'collected') {
    eyebrow.textContent = 'COLLECTED';

    const body = document.createElement('p');
    body.textContent = '$5.00 and 100.000 ₫ added to your wallet.';

    const next = document.createElement('p');
    next.className = 'wallet-drip-fine';
    next.setAttribute('data-testid', 'wallet-drip-next');
    next.textContent = `${formatNextDripHeadline(balances.nextWindowStart, city, now())}, ${formatRelativeToInstant(balances.nextWindowStart, now())}.`;

    container.append(eyebrow, body, next);
  } else {
    eyebrow.textContent = 'CASH DRIP';

    const headline = document.createElement('p');
    headline.className = 'wallet-drip-headline';
    headline.setAttribute('data-testid', 'wallet-drip-next');
    headline.textContent = formatNextDripHeadline(balances.nextWindowStart, city, now());

    const fine = document.createElement('p');
    fine.className = 'wallet-drip-fine';
    fine.textContent = `${formatRelativeToInstant(balances.nextWindowStart, now())}. You've collected this window's drip; drips open at ${DRIP_WINDOW_TIMES}.`;

    container.append(eyebrow, headline, fine);
  }
}

export interface WalletSheetHandle {
  close(): void;
}

interface WalletSheetDeps {
  url: string;
  publishableKey: string;
  fetchImpl?: typeof fetch;
  now: () => number;
}

function renderWalletSheet(
  root: HTMLElement,
  city: City,
  session: WalletSession,
  initialBalances: WalletBalances,
  auth: SupabaseAuthLike,
  deps: WalletSheetDeps,
  onBalancesChanged: (balances: WalletBalances) => void,
  onClosed: () => void,
  onSignedOut: () => void,
): WalletSheetHandle {
  const overlay = document.createElement('div');
  overlay.className = 'wallet-sheet-overlay';
  overlay.setAttribute('data-testid', 'wallet-sheet');

  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.setAttribute('data-testid', 'wallet-sheet-scrim');

  const panel = document.createElement('div');
  panel.className = 'sheet';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'wallet-sheet-heading');
  panel.tabIndex = -1;

  const dragHandle = document.createElement('div');
  dragHandle.className = 'drag-handle';
  dragHandle.setAttribute('aria-hidden', 'true');
  const dragHandleBar = document.createElement('span');
  dragHandleBar.className = 'drag-handle-bar';
  dragHandle.append(dragHandleBar);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'sheet-close';
  closeButton.setAttribute('data-testid', 'wallet-sheet-close');
  closeButton.setAttribute('aria-label', 'Close wallet');
  closeButton.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg>';

  const heading = document.createElement('h1');
  heading.id = 'wallet-sheet-heading';
  heading.textContent = 'Wallet';

  const kicker = document.createElement('p');
  kicker.className = 'wallet-sheet-kicker';
  kicker.textContent = 'Play money. San Francisco orders spend dollars.';

  const mainBalance = document.createElement('p');
  mainBalance.className = 'wallet-sheet-balance';
  mainBalance.setAttribute('data-testid', 'wallet-sheet-balance');

  const otherCity: City = city === 'sf' ? 'hcmc' : 'sf';
  const otherRow = document.createElement('div');
  otherRow.className = 'wallet-sheet-other-row';
  const otherCityLabel = document.createElement('span');
  otherCityLabel.className = 'wallet-sheet-other-city';
  otherCityLabel.textContent = CITY_NAMES[otherCity];
  const otherAmount = document.createElement('span');
  otherAmount.setAttribute('data-testid', 'wallet-sheet-other-balance');
  otherRow.append(otherCityLabel, otherAmount);

  const dripCard = document.createElement('div');

  const accountLine = document.createElement('div');
  accountLine.className = 'wallet-sheet-account';
  const accountText = document.createElement('span');
  accountText.className = 'wallet-sheet-account-text';
  accountText.textContent = `Signed in with ${providerLabel(session.provider)}${session.email ? ' · ' + session.email : ''}`;
  const signOutButton = document.createElement('button');
  signOutButton.type = 'button';
  signOutButton.className = 'wallet-sign-out';
  signOutButton.setAttribute('data-testid', 'wallet-sign-out');
  signOutButton.textContent = 'Sign out';
  accountLine.append(accountText, signOutButton);

  let currentBalances = initialBalances;
  let claiming = false;
  let claimFailed = false;
  let justCollected = false;

  function dripState(): DripCardState {
    if (claiming) return 'claiming';
    if (justCollected) return 'collected';
    if (claimFailed) return 'claim-failed';
    return currentBalances.claimedThisWindow ? 'next' : 'available';
  }

  function renderAll(): void {
    mainBalance.textContent = formatMoneyForCity(amountForCity(currentBalances, city), city);
    otherAmount.textContent = formatMoneyForCity(amountForCity(currentBalances, otherCity), otherCity);
    renderDripCard(dripCard, city, dripState(), currentBalances, deps.now, () => void handleCollect());
  }

  async function handleCollect(): Promise<void> {
    if (claiming) return;
    claiming = true;
    claimFailed = false;
    renderAll();

    const result = await claimDrip({
      url: deps.url,
      publishableKey: deps.publishableKey,
      accessToken: session.accessToken,
      fetchImpl: deps.fetchImpl,
    });

    claiming = false;
    if (!result) {
      claimFailed = true;
      renderAll();
      return;
    }

    currentBalances = {
      usdMinor: result.usdMinor,
      vndMinor: result.vndMinor,
      windowStart: currentBalances.windowStart,
      nextWindowStart: result.nextWindowStart,
      claimedThisWindow: true,
    };
    justCollected = result.claimed;
    onBalancesChanged(currentBalances);
    renderAll();
  }

  let closed = false;
  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') close();
  }

  function close(): void {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    onClosed();
  }

  scrim.addEventListener('click', close);
  closeButton.addEventListener('click', close);
  document.addEventListener('keydown', onKeydown);

  signOutButton.addEventListener('click', () => {
    void (async () => {
      await signOutLocally(auth);
      close();
      onSignedOut();
    })();
  });

  panel.append(dragHandle, closeButton, heading, kicker, mainBalance, otherRow, dripCard, accountLine);
  overlay.append(scrim, panel);
  root.append(overlay);

  renderAll();
  panel.focus();

  return { close };
}

function announceSignedOut(chipRoot: HTMLElement): void {
  const doc = chipRoot.ownerDocument;
  const region = doc.createElement('div');
  region.setAttribute('role', 'status');
  region.className = 'wallet-live-region';
  region.textContent = 'Signed out. Your wallet is saved to your account.';
  doc.body.append(region);
  setTimeout(() => region.remove(), 1000);

  const pill = doc.querySelector<HTMLElement>('[data-testid="location-bar"]');
  pill?.focus();
}

export interface WalletPageDeps {
  /** Injected in tests so no real `@supabase/supabase-js` client or network is ever touched. */
  createAuth?: (config: WalletEnvConfig) => Promise<SupabaseAuthLike>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  locationHref?: string;
  replaceUrl?: (url: string) => void;
}

/**
 * Wires the header chip, the wallet sheet and the OAuth-redirect return onto
 * one page. Every early return below is deliberate and silent — D1 says a
 * dark wallet, a signed-out visitor and an unreachable RPC all look exactly
 * like today's site, so none of them renders anything or throws (#146 AC1,
 * AC2).
 */
export async function initWallet(
  chipRoot: HTMLElement,
  sheetRoot: HTMLElement,
  getCity: () => City,
  config: WalletEnvConfig | null = readWalletEnvConfig(),
  deps: WalletPageDeps = {},
): Promise<void> {
  if (!config) return; // AC1: no config — nothing rendered, nothing requested.

  const createAuth = deps.createAuth ?? createSupabaseAuth;
  const now = deps.now ?? Date.now;
  const fetchImpl = deps.fetchImpl;
  const locationHref = deps.locationHref ?? window.location.href;
  const replaceUrl = deps.replaceUrl ?? ((next: string) => window.history.replaceState({}, '', next));

  let auth: SupabaseAuthLike;
  try {
    auth = await createAuth(config);
  } catch {
    return; // The SDK itself failed to load or construct — D1 treats this as dark, not an error.
  }

  const url = new URL(locationHref);
  let session: WalletSession | null;

  if (isOAuthReturn(url)) {
    const result = await completeOAuthReturn(auth, url);
    session = result.session;
    replaceUrl(stripOAuthParams(url).toString());
    // AC4: a cancelled or failed sign-in (`result.failed`) leaves the
    // visitor signed out with no error page — `session` is already null in
    // that case, so nothing further is needed to reach that state.
  } else {
    session = await getCurrentSession(auth);
  }

  if (!session) return; // Signed out (or dark) — the slot stays empty and invisible.

  const balances = await getWallet({
    url: config.url,
    publishableKey: config.publishableKey,
    accessToken: session.accessToken,
    fetchImpl,
  });
  if (!balances) return; // AC2: the wallet RPC failed or timed out — no balance, no error, nothing thrown.

  let liveBalances = balances;
  let sheetHandle: WalletSheetHandle | null = null;
  let liveSession: WalletSession | null = session;

  function openSheet(): void {
    if (sheetHandle || !liveSession) return;
    sheetHandle = renderWalletSheet(
      sheetRoot,
      getCity(),
      liveSession,
      liveBalances,
      auth,
      { url: config!.url, publishableKey: config!.publishableKey, fetchImpl, now },
      (updated) => {
        liveBalances = updated;
        renderChip(chipRoot, getCity(), liveBalances, openSheet);
      },
      () => {
        sheetHandle = null;
      },
      () => {
        liveSession = null;
        chipRoot.innerHTML = '';
        chipRoot.setAttribute('aria-hidden', 'true');
        announceSignedOut(chipRoot);
      },
    );
  }

  renderChip(chipRoot, getCity(), liveBalances, openSheet);
}
