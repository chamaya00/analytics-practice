// Checkout screen (docs/design/80-two-city-brand-and-flow.md, "Checkout"):
// two preset-choice fields (Drop-off, Delivery instructions), a utensils
// toggle, the Offers row and price breakdown (Subtotal, Delivery fee,
// Service fee, Discount, "You saved," Total — #87/#89), a demo disclosure
// directly above the CTA, and "Place order" — nothing typed anywhere.
// "Place order" disables itself on first tap (contract §7's invariant) so a
// double-tap cannot fire two order_placed events for one order_id.
//
// Checkout is for one restaurant's cart at a time (`?restaurant=<slug>`,
// order-store.ts's `selectRestaurantCart`): the delivery fee, flash fee,
// vouchers and breakdown are all that restaurant's alone, and placing the
// order clears only its lines. Opened with no slug and several carts
// stored, it sends the visitor to the "Your carts" list to pick one.
//
// #149 wires #136's wallet into Place order (ADR 0008, D1, docs/design/143-
// wallet.md's "Checkout at Place order"). D1, binding: unless the wallet's
// build flag is set *and* its RPCs answer, Place order behaves exactly as
// it always has — every branch below that touches the wallet only runs once
// `walletState` has actually resolved to something other than `dark`, and
// resolving to `dark` (no config, or any probe failing/timing out) takes
// the exact original synchronous path with no `await` in the way, so a
// wallet-off build's tests never see an async gap.

import {
  cartSubtotalMinor,
  computeCheckoutBreakdown,
  createOrderId,
  getCart,
  getVisitorId,
  placeOrder,
  selectRestaurantCart,
  sweepVipLedger,
  type CheckoutBreakdown,
  type RestaurantCart,
} from './order-store';
import { platinumSpendRemainingMinor, readVipLedger, type VipLedger, type VipLevel } from './vip-level';
import { ALL_CARTS_PATH, offersPath, restaurantSlugFromSearch } from './cart-routes';
import type { DeliveryInstructions, DropOffPreset } from './tracking';
import { track } from './tracking';
import { formatMoney, type Currency } from './money';
import { getRestaurant } from './restaurants';
import { estimateEtaMinutes } from './eta';
import { createVehicleIcon } from './vehicle-icon';
import { flashFeeForRestaurant, getFlashDraw } from './flash-deal';
import { clearOffersState, getOffersState, setOffersState } from './offers-store';
import { appliedDiscountAmountMinor, appliedVoucherIds, entriesForCity, syncOffersState } from './vouchers';
import { consumeThanksVoucher, getThanksVoucher, thanksVoucherDiscountMinor } from './thanks-voucher';
import type { City } from './money';
import { renderDemoDisclosure } from './demo-disclosure';
import { readWalletEnvConfig, type WalletEnvConfig } from './wallet-config';
import { probeWalletGate } from './wallet-gate';
import {
  createSupabaseAuth,
  completeOAuthReturn,
  getCurrentSession,
  isOAuthReturn,
  stripOAuthParams,
  beginSignIn,
  type SupabaseAuthLike,
  type WalletSession,
  type OAuthProvider,
} from './auth-client';
import { getWallet, claimDrip, debitWallet, type WalletBalances } from './wallet-client';
import { formatNextDripHeadline } from './wallet-dom';

interface ChoiceOption<T> {
  value: T;
  label: string;
}

const DROP_OFF_OPTIONS: ChoiceOption<DropOffPreset>[] = [
  { value: 'home', label: 'Home' },
  { value: 'office', label: 'Office' },
  { value: 'front_desk', label: 'Front desk' },
];

const DELIVERY_INSTRUCTIONS_OPTIONS: ChoiceOption<DeliveryInstructions>[] = [
  { value: 'leave_at_door', label: 'Leave at door' },
  { value: 'hand_to_me', label: 'Hand to me' },
  { value: 'meet_downstairs', label: 'Meet downstairs' },
  { value: 'call_on_arrival', label: 'Call on arrival' },
];

/** The chip button row itself, always one selected — must never render with nothing selected. Defaults to `initial`, or the first option when `initial` is absent or not one of `options`. */
function choiceButtons<T extends string | number>(
  legend: string,
  options: ChoiceOption<T>[],
  testIdPrefix: string,
  groupClass: string,
  initial?: T,
): { element: HTMLElement; getValue: () => T } {
  let selected = initial !== undefined && options.some((option) => option.value === initial) ? initial : options[0].value;

  const group = document.createElement('div');
  group.className = groupClass;
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', legend);

  const buttons = new Map<T, HTMLButtonElement>();
  const buttonClass = groupClass === 'chip-group' ? 'chip' : undefined;

  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    if (buttonClass) button.classList.add(buttonClass);
    button.textContent = option.label;
    button.setAttribute('data-testid', `${testIdPrefix}-${option.value}`);
    const isDefault = option.value === selected;
    button.classList.toggle('selected', isDefault);
    button.setAttribute('aria-pressed', String(isDefault));
    button.addEventListener('click', () => {
      selected = option.value;
      for (const [value, candidate] of buttons) {
        const isSelected = value === selected;
        candidate.classList.toggle('selected', isSelected);
        candidate.setAttribute('aria-pressed', String(isSelected));
      }
    });
    buttons.set(option.value, button);
    group.append(button);
  }

  return { element: group, getValue: () => selected };
}

/** A full checkout-field section: an `<h2>` heading above a choiceButtons group. */
function choiceField<T extends string | number>(
  legend: string,
  options: ChoiceOption<T>[],
  testIdPrefix: string,
  groupClass: string,
  initial?: T,
): { element: HTMLElement; getValue: () => T } {
  const wrapper = document.createElement('div');
  wrapper.className = 'checkout-field';
  wrapper.setAttribute('data-testid', `field-${testIdPrefix}`);

  const heading = document.createElement('h2');
  heading.className = 'section-title';
  heading.textContent = legend;

  const { element: group, getValue } = choiceButtons(legend, options, testIdPrefix, groupClass, initial);
  wrapper.append(heading, group);
  return { element: wrapper, getValue };
}

function renderBreakdown(breakdown: CheckoutBreakdown): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'checkout-breakdown';
  wrapper.setAttribute('data-testid', 'checkout-breakdown');

  function row(testId: string, label: string, amountMinor: number, extraClass?: string): HTMLElement {
    const el = document.createElement('div');
    el.className = extraClass ? `breakdown-row ${extraClass}` : 'breakdown-row';
    el.setAttribute('data-testid', testId);
    const labelEl = document.createElement('span');
    labelEl.className = 'muted';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.textContent = formatMoney(amountMinor, breakdown.currency);
    el.append(labelEl, valueEl);
    return el;
  }

  wrapper.append(row('breakdown-subtotal', 'Subtotal', breakdown.subtotalMinor));

  const deliveryRow = document.createElement('div');
  deliveryRow.className = 'breakdown-row';
  deliveryRow.setAttribute('data-testid', 'breakdown-delivery-fee');
  const deliveryLabel = document.createElement('span');
  deliveryLabel.className = 'muted';
  deliveryLabel.textContent = 'Delivery fee';
  if (breakdown.vipDeliveryWaived) {
    const vipTag = document.createElement('span');
    vipTag.className = 'vip-tag';
    vipTag.setAttribute('data-testid', 'breakdown-delivery-vip-tag');
    vipTag.textContent = breakdown.vipPlatinumAmountMinor > 0 ? 'Platinum' : 'Gold';
    deliveryLabel.append(document.createTextNode(' '), vipTag);
  }
  const deliveryValue = document.createElement('span');
  if (breakdown.deliveryFeeOriginalMinor !== null) {
    const struck = document.createElement('span');
    struck.className = 'struck';
    struck.textContent = formatMoney(breakdown.deliveryFeeOriginalMinor, breakdown.currency);
    const current = document.createElement('span');
    current.className = 'free';
    current.textContent = breakdown.deliveryFeeMinor === 0 ? 'Free' : formatMoney(breakdown.deliveryFeeMinor, breakdown.currency);
    deliveryValue.append(struck, document.createTextNode(' '), current);
  } else {
    deliveryValue.textContent = formatMoney(breakdown.deliveryFeeMinor, breakdown.currency);
  }
  deliveryRow.append(deliveryLabel, deliveryValue);
  wrapper.append(deliveryRow, row('breakdown-service-fee', 'Service fee', breakdown.serviceFeeMinor));

  if (breakdown.discountAmountMinor > 0) {
    const discountRow = document.createElement('div');
    discountRow.className = 'breakdown-row discount';
    discountRow.setAttribute('data-testid', 'breakdown-discount');
    const labelEl = document.createElement('span');
    labelEl.innerHTML =
      '<svg class="icon-tag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2 20 2 20 10 11 19 3 11 12 2Z"/><circle cx="16" cy="6" r="1.4" fill="currentColor" stroke="none"/></svg>Discount';
    const valueEl = document.createElement('span');
    valueEl.textContent = formatMoney(-breakdown.discountAmountMinor, breakdown.currency);
    discountRow.append(labelEl, valueEl);
    wrapper.append(discountRow);
  }

  if (breakdown.thanksVoucherAmountMinor > 0) {
    const rewardRow = document.createElement('div');
    rewardRow.className = 'breakdown-row discount';
    rewardRow.setAttribute('data-testid', 'breakdown-thanks-voucher');
    const labelEl = document.createElement('span');
    labelEl.textContent = 'Thanks voucher · for rating';
    const valueEl = document.createElement('span');
    valueEl.textContent = formatMoney(-breakdown.thanksVoucherAmountMinor, breakdown.currency);
    rewardRow.append(labelEl, valueEl);
    wrapper.append(rewardRow);
  }

  if (breakdown.vipPlatinumAmountMinor > 0) {
    const platinumRow = document.createElement('div');
    platinumRow.className = 'breakdown-row discount';
    platinumRow.setAttribute('data-testid', 'breakdown-vip-platinum');
    const labelEl = document.createElement('span');
    labelEl.textContent = `Platinum 10% off · of ${formatMoney(breakdown.subtotalMinor, breakdown.currency)}`;
    const valueEl = document.createElement('span');
    valueEl.textContent = formatMoney(-breakdown.vipPlatinumAmountMinor, breakdown.currency);
    platinumRow.append(labelEl, valueEl);
    wrapper.append(platinumRow);
  }

  // The screen's own "You saved" adds the thanks voucher and any VIP perk on
  // top of the catalogue vouchers' saving — order_placed.saved_amount_minor
  // never does (docs/design/162-*, "Events": "a known, deliberate gap
  // between the screen's 'You saved' and the event"; #174 keeps perks out
  // the same way #166 kept the thanks voucher out).
  const displaySavedAmountMinor =
    breakdown.savedAmountMinor + breakdown.thanksVoucherAmountMinor + breakdown.vipDeliverySavedMinor + breakdown.vipPlatinumAmountMinor;
  if (displaySavedAmountMinor > 0) {
    const saved = document.createElement('div');
    saved.className = 'saved-line';
    saved.setAttribute('data-testid', 'breakdown-saved');
    saved.textContent = `You saved ${formatMoney(displaySavedAmountMinor, breakdown.currency)}`;
    wrapper.append(saved);
  }

  const total = document.createElement('div');
  total.className = 'breakdown-row total';
  total.setAttribute('data-testid', 'breakdown-total');
  const totalLabel = document.createElement('span');
  totalLabel.textContent = 'Total';
  const totalValue = document.createElement('span');
  totalValue.textContent = formatMoney(breakdown.totalMinor, breakdown.currency);
  total.append(totalLabel, totalValue);
  wrapper.append(total);

  return wrapper;
}

/** The VIP line above the breakdown (docs/design/162-*, "Checkout: the perks and the voucher as lines") — absent at no level, so a caller renders it only when non-null. */
function renderVipCheckoutLine(level: VipLevel, ledger: VipLedger, currency: Currency): HTMLElement | null {
  if (level === 'none') return null;

  const el = document.createElement('p');
  el.className = 'vip-checkout-line';
  el.setAttribute('data-testid', 'checkout-vip-line');

  const stamp = document.createElement('span');
  stamp.className = `vip-stamp vip-stamp--${level}`;
  stamp.setAttribute('aria-hidden', 'true');
  el.append(stamp, document.createTextNode(' '));

  const strong = document.createElement('strong');
  if (level === 'platinum') {
    strong.textContent = 'Platinum';
    el.append(strong, document.createTextNode(' · free delivery and 10% off are on this order.'));
  } else {
    strong.textContent = 'Gold';
    const remainingMinor = platinumSpendRemainingMinor(ledger, currency);
    el.append(strong, document.createTextNode(` · free delivery is on this order. ${formatMoney(remainingMinor, currency)} more spend to Platinum.`));
  }

  return el;
}

export interface CheckoutView {
  /** True whenever no checkout form rendered — an empty cart, or several carts and none named. */
  cartIsEmpty: boolean;
  /** The one restaurant's cart this checkout is for, `null` whenever `cartIsEmpty`. */
  cart: RestaurantCart | null;
}

function defaultRedirect(path: string): void {
  // replace, not assign: Back from the list must not land on a checkout URL
  // that immediately redirects to the list again.
  window.location.replace(path);
}

// --- Wallet plumbing (#149; ADR 0008, docs/design/143-wallet.md) ---

/** New accounts' one-time preload (ADR 0008, amended by #145; owner, 2026-09-27, O6). Used only in the sign-in prompt's own copy. */
const STARTING_BALANCE_TEXT = '$30.00 and 750.000 ₫';

/** The drip's own fixed amounts (ADR 0008) — used only for the short-balance block's "adds …" copy, never sent anywhere. */
const DRIP_MINOR: Record<Currency, number> = { USD: 500, VND: 100000 };

const PENDING_ORDER_PREFIX = 'parody.pendingOrder.';

function pendingOrderKey(restaurantSlug: string): string {
  return `${PENDING_ORDER_PREFIX}${restaurantSlug}`;
}

/**
 * Kept in `sessionStorage` from the first Place-order tap while the wallet
 * is live, until the order this `orderId` pays for is actually written
 * locally (ADR 0008, "Source of truth"). Carries the three in-memory
 * checkout choices across the OAuth round trip's full-page navigation
 * (`checkout-dom.ts:63` in #136's driver notes), and the total at the
 * moment sign-in started, so the return can say whether it changed.
 */
interface PendingOrder {
  orderId: string;
  dropOffPreset: DropOffPreset;
  deliveryInstructions: DeliveryInstructions;
  utensils: boolean;
  totalMinorAtSignIn: number;
  provider: OAuthProvider | null;
}

function readPendingOrder(sessionStorage: Storage, restaurantSlug: string): PendingOrder | null {
  const raw = sessionStorage.getItem(pendingOrderKey(restaurantSlug));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingOrder;
  } catch {
    return null;
  }
}

function writePendingOrder(sessionStorage: Storage, restaurantSlug: string, pending: PendingOrder): void {
  sessionStorage.setItem(pendingOrderKey(restaurantSlug), JSON.stringify(pending));
}

function clearPendingOrder(sessionStorage: Storage, restaurantSlug: string): void {
  sessionStorage.removeItem(pendingOrderKey(restaurantSlug));
}

type WalletCheckoutState =
  | { kind: 'dark' }
  | { kind: 'signed-out'; auth: SupabaseAuthLike; providers: { google: boolean; apple: boolean } }
  | { kind: 'signed-in'; auth: SupabaseAuthLike; session: WalletSession; balances: WalletBalances };

export interface CheckoutWalletDeps {
  /** Injected in tests so no real config, network or `@supabase/supabase-js` client is ever touched. `undefined` (the default) reads the real env; pass `null` explicitly for "wallet off." */
  config?: WalletEnvConfig | null;
  createAuth?: (config: WalletEnvConfig) => Promise<SupabaseAuthLike>;
  fetchImpl?: typeof fetch;
  locationHref?: string;
  /** Cleans the OAuth-return query params off the URL after completing the round trip — never the same call as `navigateToOAuth`, which starts it. */
  replaceUrl?: (next: string) => void;
  /** Starts the OAuth redirect — a real `window.location.href = url` by default, injected in tests so nothing actually navigates. */
  navigateToOAuth?: (url: string) => void;
}

async function resolveWalletState(
  url: URL,
  replaceUrl: (next: string) => void,
  config: WalletEnvConfig,
  createAuth: (config: WalletEnvConfig) => Promise<SupabaseAuthLike>,
  fetchImpl: typeof fetch | undefined,
): Promise<{ state: WalletCheckoutState; oauthReturned: boolean; oauthFailed: boolean }> {
  const oauthReturned = isOAuthReturn(url);

  const gate = await probeWalletGate(config, fetchImpl);
  if (!gate.ready) return { state: { kind: 'dark' }, oauthReturned, oauthFailed: false };

  let auth: SupabaseAuthLike;
  try {
    auth = await createAuth(config);
  } catch {
    return { state: { kind: 'dark' }, oauthReturned, oauthFailed: false };
  }

  let session: WalletSession | null;
  let oauthFailed = false;
  if (oauthReturned) {
    const result = await completeOAuthReturn(auth, url);
    session = result.session;
    oauthFailed = result.failed;
    replaceUrl(stripOAuthParams(url).toString());
  } else {
    session = await getCurrentSession(auth);
  }

  if (!session) return { state: { kind: 'signed-out', auth, providers: gate.providers }, oauthReturned, oauthFailed };

  const balances = await getWallet({
    url: config.url,
    publishableKey: config.publishableKey,
    accessToken: session.accessToken,
    fetchImpl,
  });
  // AC1/D1: the wallet RPC failing here is "the RPC failing... at Place
  // order" — the same fallback as an absent config, not a stuck signed-out
  // screen with no way to tell the visitor anything is wrong.
  if (!balances) return { state: { kind: 'dark' }, oauthReturned, oauthFailed: false };

  return { state: { kind: 'signed-in', auth, session, balances }, oauthReturned, oauthFailed };
}

function renderSignInPrompt(
  providers: { google: boolean; apple: boolean },
  onProvider: (provider: OAuthProvider) => void,
  onClose: () => void,
): { close: () => void; element: HTMLElement } {
  const overlay = document.createElement('div');
  overlay.className = 'sign-in-sheet-overlay';
  overlay.setAttribute('data-testid', 'sign-in-prompt');

  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.setAttribute('data-testid', 'sign-in-prompt-scrim');

  const panel = document.createElement('div');
  panel.className = 'sheet';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'sign-in-prompt-heading');
  panel.tabIndex = -1;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'sheet-close';
  closeButton.setAttribute('data-testid', 'sign-in-prompt-close');
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg>';

  const heading = document.createElement('h1');
  heading.id = 'sign-in-prompt-heading';
  heading.textContent = 'Sign in to place your order';

  const body = document.createElement('p');
  body.textContent = `Orders spend play money from a wallet. New accounts start with ${STARTING_BALANCE_TEXT}. Your cart and offers stay as they are.`;

  const buttons = document.createElement('div');
  buttons.className = 'sign-in-provider-buttons';

  function providerButton(provider: OAuthProvider, label: string, testId: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `sign-in-provider sign-in-provider--${provider}`;
    button.setAttribute('data-testid', testId);
    button.textContent = label;
    button.addEventListener('click', () => onProvider(provider));
    return button;
  }

  if (providers.google) buttons.append(providerButton('google', 'Continue with Google', 'google-signin'));
  if (providers.apple) buttons.append(providerButton('apple', 'Continue with Apple', 'apple-signin'));

  const fine = document.createElement('p');
  fine.className = 'sign-in-prompt-fine';
  fine.textContent = 'We keep the email Google or Apple shares with us, to hold your wallet. No payment is taken.';

  const notNow = document.createElement('button');
  notNow.type = 'button';
  notNow.className = 'sign-in-not-now';
  notNow.setAttribute('data-testid', 'sign-in-not-now');
  notNow.textContent = 'Not now';

  let closed = false;
  function close(): void {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    onClose();
  }
  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') close();
  }
  scrim.addEventListener('click', close);
  closeButton.addEventListener('click', close);
  notNow.addEventListener('click', close);
  document.addEventListener('keydown', onKeydown);

  panel.append(closeButton, heading, body, buttons, fine, notNow);
  overlay.append(scrim, panel);

  return { close, element: overlay };
}

export function renderCheckout(
  root: HTMLElement,
  storage: Storage,
  navigate: (path: string) => void = (path) => {
    window.location.href = path;
  },
  sessionStorage: Storage = window.sessionStorage,
  now: number = Date.now(),
  requestedSlug: string | null = null,
  redirect: (path: string) => void = defaultRedirect,
  walletDeps: CheckoutWalletDeps = {},
): CheckoutView {
  root.innerHTML = '';

  const selection = selectRestaurantCart(getCart(storage), requestedSlug);
  if (selection.kind === 'several') {
    // No single cart to check out: send the visitor to the list, with an
    // inline link as the fallback if the redirect doesn't happen.
    const message = document.createElement('p');
    message.setAttribute('data-testid', 'checkout-choose-cart');
    message.textContent = 'You have carts from more than one restaurant. ';
    const link = document.createElement('a');
    link.href = ALL_CARTS_PATH;
    link.textContent = 'Choose one to check out';
    message.append(link);
    root.append(message);
    redirect(ALL_CARTS_PATH);
    return { cartIsEmpty: true, cart: null };
  }
  if (selection.kind === 'empty') {
    // #80's checkout "Empty" state: an inline message and a CTA back to the
    // home feed, never a $0.00/₫0 breakdown that looks like a bug.
    const empty = document.createElement('div');
    empty.setAttribute('data-testid', 'checkout-empty');

    const message = document.createElement('p');
    message.textContent = 'Your cart is empty.';

    const link = document.createElement('a');
    link.href = '/';
    link.className = 'add-button';
    link.textContent = 'Browse restaurants';

    empty.append(message, link);
    root.append(empty);
    return { cartIsEmpty: true, cart: null };
  }

  const { cart } = selection;
  const { lines, restaurantSlug } = cart;

  // #149: restore the three in-memory choices across the OAuth round trip,
  // from whatever was persisted at the tap that led to sign-in.
  const pendingOnLoad = readPendingOrder(sessionStorage, restaurantSlug);

  const dropOff = choiceField('Drop-off', DROP_OFF_OPTIONS, 'drop-off', 'chip-group', pendingOnLoad?.dropOffPreset);
  const deliveryInstructions = choiceField(
    'Delivery instructions',
    DELIVERY_INSTRUCTIONS_OPTIONS,
    'delivery-instructions',
    'chip-group',
    pendingOnLoad?.deliveryInstructions,
  );

  const UTENSILS_OPTIONS: ChoiceOption<'yes' | 'no'>[] = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ];

  function miniField<T extends string | number>(
    labelText: string,
    options: ChoiceOption<T>[],
    testIdPrefix: string,
    testId: string,
    initial?: T,
  ): { element: HTMLElement; getValue: () => T } {
    const wrapper = document.createElement('div');
    wrapper.className = 'mini-field';
    wrapper.setAttribute('data-testid', testId);
    const label = document.createElement('span');
    label.className = 'mini-label';
    label.textContent = labelText;
    const { element: group, getValue } = choiceButtons(labelText, options, testIdPrefix, 'chip-group', initial);
    wrapper.append(label, group);
    return { element: wrapper, getValue };
  }

  const utensilsField = miniField(
    'Utensils & napkins',
    UTENSILS_OPTIONS,
    'utensils',
    'field-utensils',
    pendingOnLoad ? (pendingOnLoad.utensils ? 'yes' : 'no') : undefined,
  );

  const miniFields = document.createElement('section');
  miniFields.className = 'checkout-field';
  miniFields.append(utensilsField.element);

  const city: City = lines[0].currency === 'VND' ? 'hcmc' : 'sf';
  const subtotalMinor = cartSubtotalMinor(lines);

  // #174: sweep before reading the ledger, so a level reached since the last
  // render (or the last placeOrder) is what this checkout perks against —
  // docs/design/162-*, "The ledger": "It runs on the tracker's render, on
  // checkout mount, and inside placeOrder before capOrders."
  sweepVipLedger(storage, now);
  const vipLedger = readVipLedger(storage);
  const vipLevel: VipLevel = vipLedger.level;
  const vipGoldActive = vipLevel === 'gold' || vipLevel === 'platinum';
  const vipPlatinumActive = vipLevel === 'platinum';

  const entries = entriesForCity(city, sessionStorage, now);
  const previousOffers = getOffersState(storage, restaurantSlug);
  const sync = syncOffersState(previousOffers, entries, subtotalMinor);
  // Gold's free delivery suppresses the delivery-group voucher entirely
  // (docs/design/162-*, "Gold's free delivery and the delivery-group
  // vouchers"): forcing it null here, before it's persisted or read again
  // below, keeps a stale delivery voucher id from ever stacking with Gold's
  // own perk in the breakdown, in `applied_voucher_ids`, or in
  // `saved_amount_minor`.
  const offersState = vipGoldActive ? { ...sync.state, deliveryId: null } : sync.state;
  setOffersState(storage, restaurantSlug, offersState);

  // #166's thanks voucher: outside the catalogue entirely, so it never goes
  // through syncOffersState/OffersState — it applies by itself, with no
  // checkbox, whenever this city holds an unexpired one and the subtotal
  // clears its own minimum (docs/design/162-*, "The thanks voucher").
  const thanksVoucher = getThanksVoucher(storage, city, now);
  const thanksVoucherAmountMinor = thanksVoucherDiscountMinor(thanksVoucher, subtotalMinor);

  const restaurant = getRestaurant(restaurantSlug);
  const normalDeliveryFeeMinor = restaurant?.deliveryFeeMinor ?? 0;
  const flashDraw = getFlashDraw(sessionStorage, city);
  const flashDeliveryFeeMinor =
    restaurant && flashDraw ? flashFeeForRestaurant(flashDraw, city, restaurant.slug, normalDeliveryFeeMinor, now) : null;

  const breakdown = computeCheckoutBreakdown(lines, normalDeliveryFeeMinor, {
    deliveryVoucherApplied: offersState.deliveryId !== null,
    discountAmountMinor: appliedDiscountAmountMinor(offersState, entries),
    flashDeliveryFeeMinor,
    thanksVoucherAmountMinor,
    vipGoldActive,
    vipPlatinumActive,
  });
  if (breakdown === null) return { cartIsEmpty: true, cart: null };
  const breakdownEl = renderBreakdown(breakdown);
  const vipLineEl = renderVipCheckoutLine(vipLevel, vipLedger, breakdown.currency);

  const offersRow = document.createElement('button');
  offersRow.type = 'button';
  offersRow.className = 'offers-row';
  offersRow.setAttribute('data-testid', 'offers-row');

  const offersLabel = document.createElement('span');
  offersLabel.className = 'label';
  offersLabel.textContent = 'Offers';

  const offersSummary = document.createElement('span');
  offersSummary.className = 'summary';
  const appliedCount = appliedVoucherIds(offersState).length;
  offersSummary.append(
    document.createTextNode(
      appliedCount === 0
        ? 'Select an offer'
        : `${appliedCount} applied · You saved ${formatMoney(breakdown.savedAmountMinor, breakdown.currency)}`,
    ),
  );
  const chevron = document.createElement('span');
  chevron.innerHTML =
    '<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 5 16 12 9 19" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  offersSummary.append(chevron.firstElementChild!);

  offersRow.append(offersLabel, offersSummary);
  offersRow.addEventListener('click', () => navigate(offersPath(restaurantSlug)));

  const dropNotice = document.createElement('p');
  dropNotice.className = 'offers-drop-notice';
  dropNotice.setAttribute('data-testid', 'offers-drop-notice');
  if (sync.discountDropped || sync.deliveryDropped) {
    dropNotice.textContent = 'Discount removed — it no longer qualifies at this subtotal.';
  } else {
    dropNotice.hidden = true;
  }

  const disclosure = renderDemoDisclosure();

  // #149: the wallet area sits between the breakdown and the disclosure —
  // a notice from the OAuth return, the "Pays from wallet" row, or the
  // short-balance block, per docs/design/143-wallet.md's "Checkout at Place
  // order". Empty and untouched while the wallet is dark or still resolving.
  const walletNotice = document.createElement('div');
  walletNotice.hidden = true;
  const walletRow = document.createElement('div');
  walletRow.hidden = true;
  const shortBalanceBlock = document.createElement('div');
  shortBalanceBlock.hidden = true;

  const placeOrderButton = document.createElement('button');
  placeOrderButton.type = 'button';
  placeOrderButton.className = 'place-order';
  placeOrderButton.setAttribute('data-testid', 'place-order');
  placeOrderButton.textContent = 'Place order';

  let placing = false;
  let shortBalanceActive = false;

  function currentFields() {
    return {
      dropOffPreset: dropOff.getValue(),
      deliveryInstructions: deliveryInstructions.getValue(),
      utensils: utensilsField.getValue() === 'yes',
    };
  }

  /**
   * Writes the order and fires `order_placed` — the exact original flow
   * from before #149, unchanged when called with no `orderId` (the dark
   * path). Also the last step whenever a debit succeeds or the wallet is
   * unreachable at Place order (D1 fallback), passing the pre-made
   * `orderId` from the pending record so the two share one idempotency key.
   *
   * If a debit already succeeded and this local write then fails or is
   * interrupted, the `catch` leaves the pending record in `sessionStorage`
   * rather than clearing it — ADR 0008's "Source of truth": the `orderId`
   * survives for a retry to reuse and get `already_debited`, instead of the
   * money being spent with no way back to the order it paid for.
   *
   * `walletPaid` records whether `wallet_debit` actually answered `debited`/
   * `already_debited` for this order (#165, docs/design/162-*, "Tips") —
   * `false` for every other caller: the dark path, the D1 fallback, and a
   * debit's `blocked`/`insufficient` answers, none of which reach here.
   */
  function writeOrderAndTrack(orderId?: string, walletPaid = false): void {
    try {
      const order = placeOrder(
        storage,
        {
          ...currentFields(),
          appliedVoucherIds: appliedVoucherIds(offersState),
          savedAmountMinor: breakdown!.savedAmountMinor,
          thanksVoucherMinor: breakdown!.thanksVoucherAmountMinor,
          totalMinor: breakdown!.totalMinor,
          orderId,
          walletPaid,
        },
        restaurantSlug,
      );
      clearOffersState(storage, restaurantSlug);
      clearPendingOrder(sessionStorage, restaurantSlug);
      // Consumed only here, on a write that actually succeeded (docs/design/
      // 162-*, "Consumed": a failed placement or a refused debit never
      // reaches this line, so the voucher is not spent then).
      if (breakdown!.thanksVoucherAmountMinor > 0) consumeThanksVoucher(storage, city);

      track('order_placed', {
        order_id: order.orderId,
        item_count: order.itemCount,
        amount_minor: order.amountMinor,
        currency: order.currency,
        drop_off_preset: order.dropOffPreset,
        delivery_instructions: order.deliveryInstructions,
        utensils: order.utensils,
        applied_voucher_ids: order.appliedVoucherIds,
        saved_amount_minor: order.savedAmountMinor,
      });

      navigate('/order-placed/');
    } catch {
      // See the doc comment above — deliberately silent.
    }
  }

  // --- Wallet wiring ---

  let resolvedState: WalletCheckoutState | null = null;
  /**
   * `null` only when there is no config to probe in the first place — the
   * click handler's signal that "still unresolved" means "genuinely dark,"
   * not "a live probe is still in flight." Set once, right after `walletConfig`
   * is read below, and never reassigned.
   */
  let walletStateReady: Promise<WalletCheckoutState> | null = null;
  let currentBalances: WalletBalances | null = null;
  let signInPromptHandle: { close: () => void; element: HTMLElement } | null = null;
  let debitInFlight = false;

  function cityBalanceMinor(balances: WalletBalances): number {
    return breakdown!.currency === 'USD' ? balances.usdMinor : balances.vndMinor;
  }

  function isShort(balances: WalletBalances): boolean {
    return cityBalanceMinor(balances) < breakdown!.totalMinor;
  }

  function renderShortBalance(balances: WalletBalances): void {
    shortBalanceBlock.innerHTML = '';
    shortBalanceBlock.className = 'wallet-short-balance';
    shortBalanceBlock.setAttribute('data-testid', 'wallet-short-balance');
    shortBalanceBlock.setAttribute('role', 'alert');
    shortBalanceBlock.tabIndex = -1;
    shortBalanceBlock.hidden = false;

    const balanceMinor = cityBalanceMinor(balances);
    const shortfallMinor = breakdown!.totalMinor - balanceMinor;

    const lead = document.createElement('p');
    lead.className = 'wallet-short-balance-lead';
    lead.setAttribute('data-testid', 'wallet-short-balance-shortfall');
    lead.textContent = `${formatMoney(shortfallMinor, breakdown!.currency)} short`;

    const detail = document.createElement('p');
    detail.textContent = `Your wallet has ${formatMoney(balanceMinor, breakdown!.currency)}; this order is ${formatMoney(breakdown!.totalMinor, breakdown!.currency)}.`;

    shortBalanceBlock.append(lead, detail);

    const dripMinor = DRIP_MINOR[breakdown!.currency];
    const fix = document.createElement('p');
    fix.setAttribute('data-testid', 'wallet-short-balance-fix');
    if (!balances.claimedThisWindow) {
      const covers = dripMinor >= shortfallMinor;
      fix.textContent = `Today's drip adds ${formatMoney(dripMinor, breakdown!.currency)}, which ${covers ? 'covers it' : "isn't enough on its own"}.`;
      shortBalanceBlock.append(fix);

      const collectButton = document.createElement('button');
      collectButton.type = 'button';
      collectButton.setAttribute('data-testid', 'wallet-short-balance-collect');
      collectButton.textContent = 'Collect';
      collectButton.addEventListener('click', () => void handleCollect());
      shortBalanceBlock.append(collectButton);
    } else {
      fix.textContent = `${formatNextDripHeadline(balances.nextWindowStart, city, now)} adds ${formatMoney(dripMinor, breakdown!.currency)}.`;
      shortBalanceBlock.append(fix);
    }

    // The demo disclosure is hidden in this state only (docs/design/143-wallet.md).
    disclosure.hidden = true;
    shortBalanceActive = true;
    placeOrderButton.setAttribute('aria-disabled', 'true');
  }

  function renderWalletRow(balances: WalletBalances): void {
    walletRow.innerHTML = '';
    walletRow.className = 'wallet-pays-row';
    walletRow.setAttribute('data-testid', 'wallet-pays-row');
    walletRow.hidden = false;
    const label = document.createElement('span');
    label.textContent = 'Pays from wallet';
    const amount = document.createElement('span');
    amount.setAttribute('data-testid', 'wallet-pays-amount');
    amount.textContent = formatMoney(cityBalanceMinor(balances), breakdown!.currency);
    walletRow.append(label, amount);
  }

  function clearShortBalance(): void {
    shortBalanceActive = false;
    shortBalanceBlock.hidden = true;
    shortBalanceBlock.innerHTML = '';
    disclosure.hidden = false;
    placeOrderButton.removeAttribute('aria-disabled');
  }

  function renderWalletArea(state: Extract<WalletCheckoutState, { kind: 'signed-in' }>): void {
    currentBalances = state.balances;
    if (isShort(state.balances)) {
      walletRow.hidden = true;
      renderShortBalance(state.balances);
    } else {
      clearShortBalance();
      renderWalletRow(state.balances);
    }
  }

  async function handleCollect(): Promise<void> {
    if (resolvedState?.kind !== 'signed-in' || !currentBalances) return;
    const result = await claimDrip({
      url: walletConfig!.url,
      publishableKey: walletConfig!.publishableKey,
      accessToken: resolvedState.session.accessToken,
      fetchImpl: walletDeps.fetchImpl,
    });
    if (!result) return; // best-effort — the block simply stays as it was (matches wallet-dom's claim-failed posture closely enough for checkout's purpose)
    const updated: WalletBalances = {
      usdMinor: result.usdMinor,
      vndMinor: result.vndMinor,
      windowStart: currentBalances.windowStart,
      nextWindowStart: result.nextWindowStart,
      claimedThisWindow: true,
    };
    resolvedState = { ...resolvedState, balances: updated };
    renderWalletArea(resolvedState);
  }

  function showSignInPrompt(providers: { google: boolean; apple: boolean }): void {
    if (signInPromptHandle) return;
    signInPromptHandle = renderSignInPrompt(
      providers,
      (provider) => void handleProviderTap(provider),
      () => {
        signInPromptHandle = null;
        placing = false;
        placeOrderButton.disabled = false;
      },
    );
    root.append(signInPromptHandle.element);
    signInPromptHandle.element.querySelector<HTMLElement>('.sheet')?.focus();
  }

  async function handleProviderTap(provider: OAuthProvider): Promise<void> {
    if (resolvedState?.kind !== 'signed-out') return;
    const pending: PendingOrder = {
      orderId: createOrderId(),
      ...currentFields(),
      totalMinorAtSignIn: breakdown!.totalMinor,
      provider,
    };
    writePendingOrder(sessionStorage, restaurantSlug, pending);

    const currentHref = walletDeps.locationHref ?? window.location.href;
    const started = await beginSignIn(resolvedState.auth, provider, redirectUrlFor(currentHref, restaurantSlug), walletNavigate);
    if (!started) {
      // Never observed in practice against Supabase, but kept honest: leave
      // checkout exactly as it was rather than sending the visitor nowhere.
      placing = false;
      placeOrderButton.disabled = false;
    }
  }

  function walletNavigate(url: string): void {
    if (walletDeps.navigateToOAuth) walletDeps.navigateToOAuth(url);
    else window.location.href = url;
  }

  function redirectUrlFor(currentHref: string, slug: string): string {
    const url = new URL(currentHref);
    url.searchParams.set('restaurant', slug);
    return url.toString();
  }

  async function handleSignedInPlaceOrder(state: Extract<WalletCheckoutState, { kind: 'signed-in' }>): Promise<void> {
    const pending: PendingOrder = readPendingOrder(sessionStorage, restaurantSlug) ?? {
      orderId: createOrderId(),
      ...currentFields(),
      totalMinorAtSignIn: breakdown!.totalMinor,
      provider: null,
    };
    writePendingOrder(sessionStorage, restaurantSlug, pending);

    debitInFlight = true;
    const result = await debitWallet({
      url: walletConfig!.url,
      publishableKey: walletConfig!.publishableKey,
      accessToken: state.session.accessToken,
      fetchImpl: walletDeps.fetchImpl,
      orderId: pending.orderId,
      currency: breakdown!.currency,
      amountMinor: breakdown!.totalMinor,
    });
    debitInFlight = false;

    if (result.kind === 'unreachable') {
      // D1 fallback: place the order as today, without a debit.
      writeOrderAndTrack(pending.orderId);
      return;
    }

    if (result.kind === 'blocked') {
      placing = false;
      placeOrderButton.disabled = false;
      walletNotice.hidden = false;
      walletNotice.className = 'wallet-notice';
      walletNotice.setAttribute('data-testid', 'wallet-debit-blocked');
      walletNotice.setAttribute('role', 'status');
      walletNotice.textContent = "Couldn't place your order just now. Tap Place order to try again.";
      return;
    }

    const updatedBalances: WalletBalances = {
      usdMinor: result.usdMinor,
      vndMinor: result.vndMinor,
      windowStart: currentBalances?.windowStart ?? '',
      nextWindowStart: result.nextWindowStart,
      claimedThisWindow: currentBalances?.claimedThisWindow ?? false,
    };
    resolvedState = { ...state, balances: updatedBalances };
    currentBalances = updatedBalances;

    if (result.status === 'insufficient') {
      placing = false;
      placeOrderButton.disabled = false;
      renderWalletArea(resolvedState);
      shortBalanceBlock.focus();
      return;
    }

    renderWalletRow(updatedBalances);
    writeOrderAndTrack(pending.orderId, true);
  }

  function dispatchPlaceOrder(state: WalletCheckoutState): void {
    if (state.kind === 'dark') {
      writeOrderAndTrack();
      return;
    }
    if (state.kind === 'signed-out') {
      showSignInPrompt(state.providers);
      return;
    }
    void handleSignedInPlaceOrder(state);
  }

  placeOrderButton.addEventListener('click', () => {
    if (shortBalanceActive) {
      shortBalanceBlock.focus();
      return;
    }
    if (placing || debitInFlight) return;
    // The guard against a double-tap firing two order_placed events for one
    // order_id: disable synchronously, on the very first click, before
    // anything else runs.
    placing = true;
    placeOrderButton.disabled = true;
    walletNotice.hidden = true;

    if (resolvedState !== null) {
      // Already known — dark resolves here with no config at all (AC1: the
      // exact original synchronous path, no `await` reached), and every
      // other case resolves here once its probe has actually answered.
      dispatchPlaceOrder(resolvedState);
      return;
    }
    if (walletStateReady === null) {
      // No config was ever probed — permanently dark.
      writeOrderAndTrack();
      return;
    }
    // A config exists and its probe is still in flight (docs/design/143-
    // wallet.md's "loading" state): wait for the real answer rather than
    // guessing dark, keeping the button disabled the same way a double-tap
    // does until it resolves. Read back through `resolvedState` (set by the
    // same chain just before it settles) rather than this `.then`'s own
    // value, in case a later resolution already moved it on.
    void walletStateReady.then(() => dispatchPlaceOrder(resolvedState!));
  });

  const walletConfig = walletDeps.config === undefined ? readWalletEnvConfig() : walletDeps.config;

  const beforeBreakdown = vipLineEl ? [dropNotice, vipLineEl] : [dropNotice];
  root.append(
    restaurantLineEl(),
    etaLineEl(),
    dropOff.element,
    deliveryInstructions.element,
    miniFields,
    offersRow,
    ...beforeBreakdown,
    breakdownEl,
    walletNotice,
    walletRow,
    shortBalanceBlock,
    disclosure,
    placeOrderButton,
  );

  function restaurantLineEl(): HTMLElement {
    const restaurantLine = document.createElement('p');
    restaurantLine.className = 'checkout-restaurant';
    restaurantLine.setAttribute('data-testid', 'checkout-restaurant');
    restaurantLine.textContent = `Your order from ${cart.restaurantName}`;
    return restaurantLine;
  }

  function etaLineEl(): HTMLElement {
    const etaLine = document.createElement('p');
    etaLine.className = 'checkout-restaurant';
    etaLine.setAttribute('data-testid', 'checkout-eta');
    const etaMinutes = estimateEtaMinutes(getVisitorId(storage), restaurantSlug);
    if (restaurant) etaLine.append(createVehicleIcon(restaurant.city));
    etaLine.append(`Arrives in about ${etaMinutes} min`);
    return etaLine;
  }

  if (walletConfig) {
    const url = new URL(walletDeps.locationHref ?? window.location.href);
    const createAuth = walletDeps.createAuth ?? createSupabaseAuth;
    const replaceUrl =
      walletDeps.replaceUrl ??
      ((next: string) => window.history.replaceState({}, '', next));

    walletStateReady = resolveWalletState(url, replaceUrl, walletConfig, createAuth, walletDeps.fetchImpl).then(({ state, oauthReturned, oauthFailed }) => {
      resolvedState = state;

      if (oauthReturned) {
        if (oauthFailed) {
          const pending = readPendingOrder(sessionStorage, restaurantSlug);
          walletNotice.hidden = false;
          walletNotice.className = 'wallet-notice';
          walletNotice.setAttribute('data-testid', 'wallet-signin-failed');
          walletNotice.setAttribute('role', 'status');
          walletNotice.textContent =
            pending?.provider === 'apple'
              ? "Apple sign-in isn't working right now; try Google."
              : "Sign-in didn't finish, so nothing was ordered. Your cart is still here; tap Place order to try again.";
        } else if (state.kind === 'signed-in') {
          const pending = readPendingOrder(sessionStorage, restaurantSlug);
          walletNotice.hidden = false;
          walletNotice.className = 'wallet-notice';
          walletNotice.setAttribute('data-testid', 'wallet-returned-notice');
          walletNotice.setAttribute('role', 'status');
          if (pending && pending.totalMinorAtSignIn !== breakdown.totalMinor) {
            walletNotice.textContent = `Welcome back. The total is now ${formatMoney(breakdown.totalMinor, breakdown.currency)} (was ${formatMoney(pending.totalMinorAtSignIn, breakdown.currency)}).`;
          } else {
            walletNotice.textContent = 'Signed in. Your cart and offers are as you left them.';
          }
        }
      }

      if (state.kind === 'signed-in') renderWalletArea(state);
      return state;
    });
  }

  return { cartIsEmpty: false, cart };
}

/** `checkout_viewed` describes the one restaurant's cart being checked out — never the whole stored cart, and never fired for the empty state or the several-carts redirect. */
export function initCheckoutPage(
  root: HTMLElement,
  storage: Storage = window.localStorage,
  navigate: (path: string) => void = (path) => {
    window.location.href = path;
  },
  sessionStorage: Storage = window.sessionStorage,
  search: string = window.location.search,
  redirect: (path: string) => void = defaultRedirect,
  walletDeps: CheckoutWalletDeps = {},
): void {
  const view = renderCheckout(
    root,
    storage,
    navigate,
    sessionStorage,
    Date.now(),
    restaurantSlugFromSearch(search),
    redirect,
    walletDeps,
  );
  if (view.cartIsEmpty || view.cart === null) return;

  track('checkout_viewed', {
    item_count: view.cart.itemCount,
    amount_minor: view.cart.subtotalMinor,
    currency: view.cart.currency,
  });
}
