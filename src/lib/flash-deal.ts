// The flash-deal sheet's own draw — docs/design/87-promo-offers-and-flash.md,
// "The flash-deal sheet": drawn once per browser session per city, not on a
// clock (the owner's round-2 decision, replacing round 1's fixed daily
// window outright). Stored under `sessionStorage`'s `flashDeal:<city>` key —
// the same session boundary the event contract's `session_id` uses — holding
// only what a pure function needs to recompute state (no personal data),
// matching order-store.ts's existing storage pattern.

import type { City } from './money';
import { restaurantsForCity } from './restaurants';

export const FLASH_WINDOW_MS = 15 * 60 * 1000;

const AMOUNT_STEPS_MINOR: Record<City, number[]> = {
  hcmc: [10000, 15000, 20000, 25000, 30000],
  sf: [200, 300, 400, 500, 600],
};

export const FLASH_REDUCED_OFF_MINOR: Record<City, number> = { hcmc: 10000, sf: 200 };

export type FlashFeeMode = 'free' | 'reduced';

export interface FlashRestaurantDraw {
  slug: string;
  feeMode: FlashFeeMode;
}

export interface FlashDraw {
  drawnAt: number;
  amountMinor: number;
  restaurants: [FlashRestaurantDraw, FlashRestaurantDraw];
}

function flashKey(city: City): string {
  return `flashDeal:${city}`;
}

function pickIndex(length: number, random: () => number): number {
  return Math.min(length - 1, Math.floor(random() * length));
}

/** Draws the session's flash deal for a city — a random amount at that city's own step, and two distinct restaurants from its catalogue, each independently drawn a fee mode. `random` is injectable so a test can seed the exact draw rather than asserting only "it's in range." */
export function drawFlashDeal(city: City, now: number, random: () => number = Math.random): FlashDraw {
  const amountMinor = AMOUNT_STEPS_MINOR[city][pickIndex(AMOUNT_STEPS_MINOR[city].length, random)];

  const pool = [...restaurantsForCity(city)];
  const first = pool.splice(pickIndex(pool.length, random), 1)[0];
  const second = pool.splice(pickIndex(pool.length, random), 1)[0];

  const drawFeeMode = (): FlashFeeMode => (random() < 0.5 ? 'free' : 'reduced');

  return {
    drawnAt: now,
    amountMinor,
    restaurants: [
      { slug: first.slug, feeMode: drawFeeMode() },
      { slug: second.slug, feeMode: drawFeeMode() },
    ],
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

function isFlashDraw(value: unknown): value is FlashDraw {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as FlashDraw;
  return (
    typeof candidate.drawnAt === 'number' &&
    typeof candidate.amountMinor === 'number' &&
    Array.isArray(candidate.restaurants) &&
    candidate.restaurants.length === 2 &&
    candidate.restaurants.every(isFlashRestaurantDraw)
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
 * has ended or this restaurant wasn't drawn — #87's "effective delivery fee"
 * ordering (rule 2): a flat reduction off the restaurant's own normal fee,
 * or a full waiver, never a third random number.
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
  if (match.feeMode === 'free') return 0;
  return Math.max(0, normalFeeMinor - FLASH_REDUCED_OFF_MINOR[city]);
}
