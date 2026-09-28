// The flash-deal sheet's own draw — docs/design/87-promo-offers-and-flash.md,
// "The flash-deal sheet": drawn once per browser session per city, not on a
// clock (the owner's round-2 decision, replacing round 1's fixed daily
// window outright). Stored under `sessionStorage`'s `flashDeal:<city>` key —
// the same session boundary the event contract's `session_id` uses — holding
// only what a pure function needs to recompute state (no personal data),
// matching order-store.ts's existing storage pattern.
//
// #119/#120: the draw grew from a fixed 2 restaurants to 5–6, to match the
// Grab-sized sheet's scrolling list. `flash_sheet_shown` carries the whole
// 5–6 draw since #238 (docs/measurement/219-analytics-readiness-contract.md
// §8), after going quiet from #120 until then.

import type { City } from './money';
import { restaurantsForCity } from './restaurants';

export const FLASH_WINDOW_MS = 15 * 60 * 1000;

export const FLASH_DRAW_SIZE_MIN = 5;
export const FLASH_DRAW_SIZE_MAX = 6;

const AMOUNT_STEPS_MINOR: Record<City, number[]> = {
  hcmc: [10000, 15000, 20000, 25000, 30000],
  sf: [200, 300, 400, 500, 600],
  la: [200, 300, 400, 500, 600],
};

export const FLASH_REDUCED_OFF_MINOR: Record<City, number> = { hcmc: 10000, sf: 200, la: 200 };

export type FlashFeeMode = 'free' | 'reduced';

export interface FlashRestaurantDraw {
  slug: string;
  feeMode: FlashFeeMode;
}

export interface FlashDraw {
  drawnAt: number;
  amountMinor: number;
  /** 5–6 distinct restaurants (#119/#120) — a fixed pair, previously. */
  restaurants: FlashRestaurantDraw[];
  /** True once the sheet has been dismissed into the collapsed reopen bar — persisted alongside the draw so the bar survives a reload of the home page while the window is still live (#120 AC2). Absent/false means the sheet, if ever shown, hasn't been collapsed (or the draw predates this field). */
  collapsed?: boolean;
  /** True once `flash_sheet_closed` has fired for this draw — checked before firing again so reopening the collapsed bar and dismissing a second time never double-fires the once-per-draw event (#120 AC7). */
  closedEventFired?: boolean;
}

function flashKey(city: City): string {
  return `flashDeal:${city}`;
}

function pickIndex(length: number, random: () => number): number {
  return Math.min(length - 1, Math.floor(random() * length));
}

/** Draws the session's flash deal for a city — a random amount at that city's own step, and 5–6 distinct restaurants from its catalogue, each independently drawn a fee mode. `random` is injectable so a test can seed the exact draw rather than asserting only "it's in range." */
export function drawFlashDeal(city: City, now: number, random: () => number = Math.random): FlashDraw {
  const amountMinor = AMOUNT_STEPS_MINOR[city][pickIndex(AMOUNT_STEPS_MINOR[city].length, random)];

  const size = FLASH_DRAW_SIZE_MIN + pickIndex(FLASH_DRAW_SIZE_MAX - FLASH_DRAW_SIZE_MIN + 1, random);
  const drawFeeMode = (): FlashFeeMode => (random() < 0.5 ? 'free' : 'reduced');

  // A restaurant whose delivery is already free has nothing for "free" to
  // waive or "reduced" to reduce — excluded from the pool outright, at the
  // source, rather than drawn and merely relabelled. That relabelling was
  // #126's first pass and it still left the restaurant sitting in the sheet
  // as a "deal" with no matching Flash badge on the feed, since
  // `flashFeeForRestaurant`'s null guard (below) also hides its badge — the
  // same non-deal the owner reported, one layer down. Each city keeps
  // enough non-zero-fee restaurants for a 5–6 draw either way.
  const pool = restaurantsForCity(city).filter((restaurant) => restaurant.deliveryFeeMinor > 0);
  const restaurants: FlashRestaurantDraw[] = [];
  for (let i = 0; i < size && pool.length > 0; i++) {
    const picked = pool.splice(pickIndex(pool.length, random), 1)[0];
    restaurants.push({ slug: picked.slug, feeMode: drawFeeMode() });
  }

  return {
    drawnAt: now,
    amountMinor,
    restaurants,
  };
}

function isFlashRestaurantDraw(value: unknown): value is FlashRestaurantDraw {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as FlashRestaurantDraw).slug === 'string' &&
    ((value as FlashRestaurantDraw).feeMode === 'free' || (value as FlashRestaurantDraw).feeMode === 'reduced')
  );
}

/** A stored draw from before #119/#120 (exactly 2 restaurants) fails this check on purpose — it doesn't match the current 5–6 shape, so `getFlashDraw` reports it absent and the caller redraws fresh rather than trying to reconcile the old shape (AC5). */
function isFlashDraw(value: unknown): value is FlashDraw {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as FlashDraw;
  return (
    typeof candidate.drawnAt === 'number' &&
    typeof candidate.amountMinor === 'number' &&
    Array.isArray(candidate.restaurants) &&
    candidate.restaurants.length >= FLASH_DRAW_SIZE_MIN &&
    candidate.restaurants.length <= FLASH_DRAW_SIZE_MAX &&
    candidate.restaurants.every(isFlashRestaurantDraw) &&
    (candidate.collapsed === undefined || typeof candidate.collapsed === 'boolean') &&
    (candidate.closedEventFired === undefined || typeof candidate.closedEventFired === 'boolean')
  );
}

/** A stored draw that can't be parsed (corrupt JSON, a shape from an older round) is treated as absent rather than thrown — the caller draws fresh. */
export function getFlashDraw(storage: Storage, city: City): FlashDraw | null {
  let raw: string | null;
  try {
    raw = storage.getItem(flashKey(city));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isFlashDraw(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setFlashDraw(storage: Storage, city: City, draw: FlashDraw): void {
  try {
    storage.setItem(flashKey(city), JSON.stringify(draw));
  } catch {
    // Storage blocked (private browsing): the sheet still functions for this
    // page load in memory, same fallback home-dom.ts already uses for the
    // location pick.
  }
}

/** Patches and re-persists `collapsed`/`closedEventFired` on an already-drawn draw, returning the updated value for the caller to keep using in memory — the same read-patch-write shape `setFlashDraw` itself uses, so the collapsed bar's state survives a reload the same way the draw itself does (#120 AC2, AC7). */
export function setFlashDrawState(
  storage: Storage,
  city: City,
  draw: FlashDraw,
  patch: Partial<Pick<FlashDraw, 'collapsed' | 'closedEventFired'>>,
): FlashDraw {
  const updated: FlashDraw = { ...draw, ...patch };
  setFlashDraw(storage, city, updated);
  return updated;
}

export interface EnsureFlashDealResult {
  draw: FlashDraw;
  /** True only the first time, this session, that this city drew — the caller's own signal to fire `flash_sheet_shown` and open the sheet (#87: "doesn't re-draw or reopen the sheet"). */
  isNewDraw: boolean;
}

export function ensureFlashDraw(
  storage: Storage,
  city: City,
  now: number,
  random: () => number = Math.random,
): EnsureFlashDealResult {
  const existing = getFlashDraw(storage, city);
  if (existing) return { draw: existing, isNewDraw: false };
  const draw = drawFlashDeal(city, now, random);
  setFlashDraw(storage, city, draw);
  return { draw, isNewDraw: true };
}

export function isFlashLive(draw: FlashDraw, now: number): boolean {
  return now < draw.drawnAt + FLASH_WINDOW_MS;
}

export function flashSecondsRemaining(draw: FlashDraw, now: number): number {
  return Math.max(0, Math.ceil((draw.drawnAt + FLASH_WINDOW_MS - now) / 1000));
}

/**
 * The restaurant-level flash fee, in minor units, or `null` when the window
 * has ended, this restaurant wasn't drawn, or its normal fee is already 0 —
 * #87's "effective delivery fee" ordering (rule 2): a flat reduction off the
 * restaurant's own normal fee, or a full waiver, never a third random
 * number. A restaurant with no delivery fee to begin with has nothing for
 * either mode to change, so this returns `null` rather than 0 — the same
 * "no effective flash price here" signal as an ended window, which is what
 * lets the caller skip the struck-through-₫0 line entirely (#126). `drawFlashDeal`
 * no longer puts such a restaurant in the draw at all, so this guard now only
 * matters for a draw already stored in a visitor's session from before that fix.
 */
export function flashFeeForRestaurant(
  draw: FlashDraw,
  city: City,
  slug: string,
  normalFeeMinor: number,
  now: number,
): number | null {
  if (!isFlashLive(draw, now)) return null;
  const match = draw.restaurants.find((restaurant) => restaurant.slug === slug);
  if (!match) return null;
  if (normalFeeMinor === 0) return null;
  if (match.feeMode === 'free') return 0;
  return Math.max(0, normalFeeMinor - FLASH_REDUCED_OFF_MINOR[city]);
}
