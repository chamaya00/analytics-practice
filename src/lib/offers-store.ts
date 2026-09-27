// Persists the Offers screen's applied-voucher state across page loads — the
// Offers screen and checkout are two separate routes in this static site,
// not one SPA session, so what's applied has to round-trip through
// `localStorage` the same way order-store.ts already does for the cart
// (docs/design/87-promo-offers-and-flash.md's mechanics, #89).
//
// Kept per restaurant: every restaurant is its own cart (order-store.ts's
// `cartsByRestaurant`), so a voucher applied to one restaurant's order must
// not follow the visitor into another's checkout. One key per restaurant
// rather than one map under a single key, so a corrupt entry can only ever
// empty its own restaurant's selection.

import { EMPTY_OFFERS_STATE, type OffersState } from './vouchers';

/** The pre-split single-cart key. No longer read or written; cleared on the next placed order so it doesn't linger. */
export const LEGACY_OFFERS_STATE_KEY = 'parody.offersState';

export function offersStateKey(restaurantSlug: string): string {
  return `${LEGACY_OFFERS_STATE_KEY}.${restaurantSlug}`;
}

function isOffersState(value: unknown): value is OffersState {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as OffersState;
  return (
    (typeof candidate.discountId === 'string' || candidate.discountId === null) &&
    (typeof candidate.deliveryId === 'string' || candidate.deliveryId === null) &&
    Array.isArray(candidate.qualifyingDiscountIds) &&
    Array.isArray(candidate.qualifyingDeliveryIds)
  );
}

/** A stored state that can't be parsed is treated as empty rather than thrown — the caller resyncs from the current cart, same fallback flash-deal.ts uses for a corrupt draw. */
export function getOffersState(storage: Storage, restaurantSlug: string): OffersState {
  let raw: string | null;
  try {
    raw = storage.getItem(offersStateKey(restaurantSlug));
  } catch {
    return EMPTY_OFFERS_STATE;
  }
  if (!raw) return EMPTY_OFFERS_STATE;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isOffersState(parsed) ? parsed : EMPTY_OFFERS_STATE;
  } catch {
    return EMPTY_OFFERS_STATE;
  }
}

export function setOffersState(storage: Storage, restaurantSlug: string, state: OffersState): void {
  try {
    storage.setItem(offersStateKey(restaurantSlug), JSON.stringify(state));
  } catch {
    // Storage blocked (private browsing): the screen still functions for
    // this page load, same fallback location.ts uses.
  }
}

export function clearOffersState(storage: Storage, restaurantSlug: string): void {
  try {
    storage.removeItem(offersStateKey(restaurantSlug));
    storage.removeItem(LEGACY_OFFERS_STATE_KEY);
  } catch {
    // Same private-browsing fallback as setOffersState.
  }
}
