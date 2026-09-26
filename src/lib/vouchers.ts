// The voucher catalogue and the stacking/tier engine — docs/design/
// 87-promo-offers-and-flash.md, "Stack groups," "Tier ladder," the two
// catalogue tables, and "The tier-unlock moment." No typed promo/code field
// anywhere (the parent issue's own settled decision, #80): a voucher is
// always one of these fixed catalogue rows, picked by checkbox.
//
// State here is deliberately a plain, persisted-and-recomputed object rather
// than a class with hidden fields — offers-store.ts round-trips it through
// `localStorage` the same way order-store.ts already does for the cart, so
// the Offers screen and checkout (two separate page loads) agree on what is
// applied without a live in-memory session between them.

import type { City } from './money';
import { flashSecondsRemaining, getFlashDraw, isFlashLive } from './flash-deal';

export type StackGroup = 'discount' | 'delivery';
export type Tier = 1 | 2 | 3 | 'entry' | 'flash';

export type VoucherId =
  | 'hcmc-delivery-entry'
  | 'hcmc-discount-t1'
  | 'hcmc-discount-t2'
  | 'hcmc-discount-t3'
  | 'hcmc-flash'
  | 'sf-delivery-entry'
  | 'sf-discount-t1'
  | 'sf-discount-t2'
  | 'sf-discount-t3'
  | 'sf-flash';

export const VOUCHER_IDS: readonly VoucherId[] = [
  'hcmc-delivery-entry',
  'hcmc-discount-t1',
  'hcmc-discount-t2',
  'hcmc-discount-t3',
  'hcmc-flash',
  'sf-delivery-entry',
  'sf-discount-t1',
  'sf-discount-t2',
  'sf-discount-t3',
  'sf-flash',
];

export interface CatalogueEntry {
  id: VoucherId;
  city: City;
  stackGroup: StackGroup;
  tier: Tier;
  label: string;
  minimumSpendMinor: number;
  /** Fixed discount amount for a `discount`-group entry; `null` for the `delivery` entry, whose saving is the restaurant's own delivery fee (computed dynamically, order-store.ts). */
  amountMinor: number | null;
  /** Minutes until expiry, used only to break a tie between two equal `discount` amounts (#87: "the one with the sooner expiry wins"). A day-scale figure for a standing tier voucher; always far smaller for a flash entry, built fresh per session by `flashCatalogueEntry` below. */
  expiryMinutes: number;
  expiryLabel: string;
}

const DAY_MINUTES = 24 * 60;

const HCMC_CATALOGUE: CatalogueEntry[] = [
  {
    id: 'hcmc-delivery-entry',
    city: 'hcmc',
    stackGroup: 'delivery',
    tier: 'entry',
    label: 'Free delivery',
    minimumSpendMinor: 50000,
    amountMinor: null,
    expiryMinutes: DAY_MINUTES,
    expiryLabel: 'Today',
  },
  {
    id: 'hcmc-discount-t1',
    city: 'hcmc',
    stackGroup: 'discount',
    tier: 1,
    label: '10.000 ₫ off',
    minimumSpendMinor: 100000,
    amountMinor: 10000,
    expiryMinutes: 3 * DAY_MINUTES,
    expiryLabel: '3 days',
  },
  {
    id: 'hcmc-discount-t2',
    city: 'hcmc',
    stackGroup: 'discount',
    tier: 2,
    label: '25.000 ₫ off',
    minimumSpendMinor: 200000,
    amountMinor: 25000,
    expiryMinutes: 3 * DAY_MINUTES,
    expiryLabel: '3 days',
  },
  {
    id: 'hcmc-discount-t3',
    city: 'hcmc',
    stackGroup: 'discount',
    tier: 3,
    label: '45.000 ₫ off',
    minimumSpendMinor: 350000,
    amountMinor: 45000,
    expiryMinutes: DAY_MINUTES,
    expiryLabel: '1 day',
  },
];

const SF_CATALOGUE: CatalogueEntry[] = [
  {
    id: 'sf-delivery-entry',
    city: 'sf',
    stackGroup: 'delivery',
    tier: 'entry',
    label: 'Free delivery',
    minimumSpendMinor: 1000,
    amountMinor: null,
    expiryMinutes: DAY_MINUTES,
    expiryLabel: 'Today',
  },
  {
    id: 'sf-discount-t1',
    city: 'sf',
    stackGroup: 'discount',
    tier: 1,
    label: '$2 off',
    minimumSpendMinor: 2000,
    amountMinor: 200,
    expiryMinutes: 3 * DAY_MINUTES,
    expiryLabel: '3 days',
  },
  {
    id: 'sf-discount-t2',
    city: 'sf',
    stackGroup: 'discount',
    tier: 2,
    label: '$5 off',
    minimumSpendMinor: 4000,
    amountMinor: 500,
    expiryMinutes: 3 * DAY_MINUTES,
    expiryLabel: '3 days',
  },
  {
    id: 'sf-discount-t3',
    city: 'sf',
    stackGroup: 'discount',
    tier: 3,
    label: '$8 off',
    minimumSpendMinor: 6000,
    amountMinor: 800,
    expiryMinutes: DAY_MINUTES,
    expiryLabel: '1 day',
  },
];

export function catalogueForCity(city: City): CatalogueEntry[] {
  return city === 'hcmc' ? HCMC_CATALOGUE : SF_CATALOGUE;
}

/** The cheapest minimum spend in a city's catalogue — the Offers screen's empty-state copy names this exact figure (#87). */
export function cheapestMinimumSpendMinor(city: City): number {
  return Math.min(...catalogueForCity(city).map((entry) => entry.minimumSpendMinor));
}

export const FLASH_MINIMUM_SPEND_MINOR: Record<City, number> = { hcmc: 80000, sf: 1000 };

/** Builds the flash voucher's own catalogue row for the current session's draw — its amount and expiry aren't fixed (#87), so this is assembled fresh rather than stored as a static table entry. */
export function flashCatalogueEntry(city: City, amountMinor: number, secondsRemaining: number): CatalogueEntry {
  const id: VoucherId = city === 'hcmc' ? 'hcmc-flash' : 'sf-flash';
  return {
    id,
    city,
    stackGroup: 'discount',
    tier: 'flash',
    label: city === 'hcmc' ? `${amountMinor.toLocaleString('vi-VN')} ₫ off flash deals` : `$${(amountMinor / 100).toFixed(2)} off flash deals`,
    minimumSpendMinor: FLASH_MINIMUM_SPEND_MINOR[city],
    amountMinor,
    expiryMinutes: secondsRemaining / 60,
    expiryLabel: formatCountdown(secondsRemaining),
  };
}

export function formatCountdown(secondsRemaining: number): string {
  const clamped = Math.max(0, Math.floor(secondsRemaining));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export interface VoucherView {
  entry: CatalogueEntry;
  qualifies: boolean;
  /** Minimum spend minus the live subtotal — meaningful only when `qualifies` is false (#87's "Spend X more" nudge). */
  nudgeAmountMinor: number;
}

export function voucherView(entry: CatalogueEntry, subtotalMinor: number): VoucherView {
  const qualifies = subtotalMinor >= entry.minimumSpendMinor;
  return { entry, qualifies, nudgeAmountMinor: qualifies ? 0 : entry.minimumSpendMinor - subtotalMinor };
}

/** #87's default-selection rule: the largest qualifying amount wins; a tie breaks toward the sooner expiry. `delivery`-group entries have no fixed amount, so they compare as equal and only ever contain one candidate in practice. */
export function pickLargest(qualifying: CatalogueEntry[]): VoucherId | null {
  if (qualifying.length === 0) return null;
  let best = qualifying[0];
  for (const candidate of qualifying.slice(1)) {
    const candidateAmount = candidate.amountMinor ?? 0;
    const bestAmount = best.amountMinor ?? 0;
    if (candidateAmount > bestAmount) {
      best = candidate;
    } else if (candidateAmount === bestAmount && candidate.expiryMinutes < best.expiryMinutes) {
      best = candidate;
    }
  }
  return best.id;
}

/** This city's static catalogue plus, only while a flash window is live, that session's own flash entry — never included once its window has ended (#87, "At 00:00": the row disappears outright rather than ever showing greyed). The one function both the Offers screen and checkout build their entry list from, so the two routes never disagree about what's currently offerable. */
export function entriesForCity(city: City, sessionStorage: Storage, now: number): CatalogueEntry[] {
  const entries = [...catalogueForCity(city)];
  const draw = getFlashDraw(sessionStorage, city);
  if (draw && isFlashLive(draw, now)) {
    entries.push(flashCatalogueEntry(city, draw.amountMinor, flashSecondsRemaining(draw, now)));
  }
  return entries;
}

export interface OffersState {
  discountId: VoucherId | null;
  deliveryId: VoucherId | null;
  qualifyingDiscountIds: VoucherId[];
  qualifyingDeliveryIds: VoucherId[];
}

export const EMPTY_OFFERS_STATE: OffersState = {
  discountId: null,
  deliveryId: null,
  qualifyingDiscountIds: [],
  qualifyingDeliveryIds: [],
};

function sortedIds(entries: CatalogueEntry[]): VoucherId[] {
  return entries.map((entry) => entry.id).sort();
}

/** True when `next` contains an id `previous` didn't — an "unlock," #87's own trigger for auto-select. A voucher merely dropping out of the qualifying set is not a gain, and does not reselect a replacement (the doc's HCMC error-scenario worked example: dropping below t2's minimum leaves t1 qualifying-but-unchecked, not auto-applied). */
function gainedMember(previous: VoucherId[], next: VoucherId[]): boolean {
  return next.some((id) => !previous.includes(id));
}

export interface SyncResult {
  state: OffersState;
  /** True iff a previously-applied discount voucher was dropped because the cart fell back below its minimum — the signal for #87's "Discount removed" notice. */
  discountDropped: boolean;
  deliveryDropped: boolean;
  discountViews: VoucherView[];
  deliveryViews: VoucherView[];
}

/**
 * Recomputes qualification and the applied set against the current subtotal
 * — the one function both the Offers screen and checkout call on mount, so
 * a cart edited elsewhere (the Cart page has no voucher UI of its own) is
 * reconciled the next time either is opened. `entries` is this city's static
 * catalogue plus, only while a flash window is live, that session's own
 * flash entry (`flashCatalogueEntry`) — omit it once the window has expired
 * so the flash voucher is dropped outright rather than ever shown greyed
 * (#87, "At 00:00").
 */
export function syncOffersState(previous: OffersState, entries: CatalogueEntry[], subtotalMinor: number): SyncResult {
  const discountEntries = entries.filter((entry) => entry.stackGroup === 'discount');
  const deliveryEntries = entries.filter((entry) => entry.stackGroup === 'delivery');

  const qualifyingDiscount = discountEntries.filter((entry) => subtotalMinor >= entry.minimumSpendMinor);
  const qualifyingDelivery = deliveryEntries.filter((entry) => subtotalMinor >= entry.minimumSpendMinor);
  const qualifyingDiscountIds = sortedIds(qualifyingDiscount);
  const qualifyingDeliveryIds = sortedIds(qualifyingDelivery);

  const discountGained = gainedMember(previous.qualifyingDiscountIds, qualifyingDiscountIds);
  const deliveryGained = gainedMember(previous.qualifyingDeliveryIds, qualifyingDeliveryIds);

  let discountId = previous.discountId;
  const discountDropped = discountId !== null && !qualifyingDiscountIds.includes(discountId);
  if (discountDropped) discountId = null;
  if (discountGained) discountId = pickLargest(qualifyingDiscount);

  let deliveryId = previous.deliveryId;
  const deliveryDropped = deliveryId !== null && !qualifyingDeliveryIds.includes(deliveryId);
  if (deliveryDropped) deliveryId = null;
  if (deliveryGained) deliveryId = pickLargest(qualifyingDelivery);

  return {
    state: { discountId, deliveryId, qualifyingDiscountIds, qualifyingDeliveryIds },
    discountDropped,
    deliveryDropped,
    discountViews: discountEntries.map((entry) => voucherView(entry, subtotalMinor)),
    deliveryViews: deliveryEntries.map((entry) => voucherView(entry, subtotalMinor)),
  };
}

/** A checkbox tap: applies the given qualifying voucher, or removes it if it was already applied — unchecking whichever other voucher in the same stack group was previously checked, since at most one per group ever applies (#87). Ignored for a voucher that isn't currently qualifying (the Offers screen never wires this to a disabled checkbox, but a stale id is still refused here rather than trusted). */
export function manualSelect(state: OffersState, id: VoucherId, group: StackGroup): OffersState {
  if (group === 'discount') {
    if (!state.qualifyingDiscountIds.includes(id)) return state;
    return { ...state, discountId: state.discountId === id ? null : id };
  }
  if (!state.qualifyingDeliveryIds.includes(id)) return state;
  return { ...state, deliveryId: state.deliveryId === id ? null : id };
}

export function appliedVoucherIds(state: OffersState): VoucherId[] {
  return [state.discountId, state.deliveryId].filter((id): id is VoucherId => id !== null);
}

/** The discount-group voucher's fixed (or drawn) amount, 0 when none is applied — feeds the checkout Discount line and `order_placed.saved_amount_minor` (contract §7). */
export function appliedDiscountAmountMinor(state: OffersState, entries: CatalogueEntry[]): number {
  if (!state.discountId) return 0;
  return entries.find((entry) => entry.id === state.discountId)?.amountMinor ?? 0;
}
