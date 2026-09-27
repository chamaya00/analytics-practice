// Pure computation of what /tracker shows, from a stored order's placed
// timestamp, its own delivery time, and the current time —
// docs/design/80-two-city-brand-and-flow.md, "Tracker": five stages
// (Placed, Preparing, Picked up, On the way, Delivered), computed from
// elapsed time, never stalling. No DOM, no timers: tracker-dom.ts polls this
// on an interval and re-renders.
//
// #121: the stepper used to reach Delivered at a fixed 7 minutes from four
// fixed thresholds. It now reaches Delivered at each order's own stored
// `deliveryMs` — picked once, at placeOrder, at or before half the
// restaurant's estimate (order-store.ts) — with the same four intermediate
// steps spaced at the same relative pacing, scaled to that order's own
// delivery time instead of a fixed total. The live countdown (`remainingMs`)
// counts down toward the *estimate* shown at checkout, not the (earlier)
// actual delivery time — the under-promise, arrive-early shape #117 asked
// for: the order can reach Delivered before its own countdown reaches zero.

import type { PlacedOrder } from './order-store';
import type { RatingTag } from './tracking';

export const STEPS = ['Placed', 'Preparing', 'Picked up', 'On the way', 'Delivered'] as const;

/** Same relative pacing as the original fixed thresholds (30s/2min/4min out
 * of a fixed 7-minute total), now expressed as fractions of each order's own
 * `deliveryMs` rather than of a fixed total. */
const PREPARING_FRACTION = 1 / 14;
const PICKED_UP_FRACTION = 2 / 7;
const ON_THE_WAY_FRACTION = 4 / 7;

export type TrackerView =
  | { kind: 'empty' }
  | { kind: 'active'; currentStepIndex: number; remainingMs: number }
  | { kind: 'delivered'; rated: false }
  | { kind: 'delivered'; rated: true; stars: number; tags: RatingTag[] };

/** Whether `order` has reached its own stored delivery time as of `now` — the
 * one comparison both `computeTrackerView` and delivery.ts's seam are built on. */
export function isDelivered(order: PlacedOrder, now: number): boolean {
  const elapsedMs = now - new Date(order.placedAt).getTime();
  return elapsedMs >= order.deliveryMs;
}

/** The moment an order is expected to arrive — `placedAt` plus the estimate
 * shown at checkout. Fixed per order (never reshuffles while ticking), so
 * it's the sort key both the order stack (#148) and the row switcher use. */
export function estimatedArrivalMs(order: PlacedOrder): number {
  return new Date(order.placedAt).getTime() + order.etaMinutes * 60_000;
}

export interface OrderStack {
  /** Every order not yet Delivered, plus the open order if it reached
   * Delivered while being watched (#148, "Order stack rules" — it stays open,
   * rating prompt included, until the page is left). Ascending estimated
   * arrival, so the stack never reshuffles while ticking. */
  live: PlacedOrder[];
  /** Every order not in `live`, newest `placedAt` first. Never overlaps
   * `live` — an order appears in exactly one of the two lists. */
  past: PlacedOrder[];
}

/**
 * Splits every stored order into "Live now" and "Past orders" (#148). An
 * order past its own `deliveryMs` still counts as live when it's the one
 * open on screen — that's the one exception the design doc names — which is
 * why this takes `openOrderId` rather than deriving live/past from
 * `isDelivered` alone.
 */
export function computeOrderStack(
  orders: PlacedOrder[],
  openOrderId: string | null,
  now: number = Date.now(),
): OrderStack {
  const live = orders.filter((order) => !isDelivered(order, now) || order.orderId === openOrderId);
  const liveIds = new Set(live.map((order) => order.orderId));
  const past = orders.filter((order) => !liveIds.has(order.orderId));
  live.sort((a, b) => estimatedArrivalMs(a) - estimatedArrivalMs(b));
  past.sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
  return { live, past };
}

/** The moment an order reaches Delivered — `placedAt` plus its own `deliveryMs`, the same instant `isDelivered` compares against. */
export function deliveredAtMs(order: PlacedOrder): number {
  return new Date(order.placedAt).getTime() + order.deliveryMs;
}

/** How long after delivery the rating sheet still auto-opens for an order
 * (#163, docs/design/162-*, "The multi-order rule" — a Guess, 24 hours). */
export const RATING_PROMPT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Both steps stored — a skipped step stays `null` forever, which is exactly
 * why "once per order" is keyed on `ratingPromptedAt` rather than on this
 * (#163, docs/design/162-*, "Storage"). */
export function isRatingFullyDone(order: PlacedOrder): boolean {
  return order.driverRating !== null && order.rating !== null;
}

/** Whether the rating sheet may auto-open for `order` at `now`: delivered,
 * never yet prompted, not fully rated, and delivered within the last 24
 * hours (#163, docs/design/162-*, "The multi-order rule"). */
function qualifiesForRatingPrompt(order: PlacedOrder, now: number): boolean {
  if (!isDelivered(order, now)) return false;
  if (order.ratingPromptedAt !== null) return false;
  if (isRatingFullyDone(order)) return false;
  return now - deliveredAtMs(order) <= RATING_PROMPT_WINDOW_MS;
}

export interface RatingPromptDecision {
  /** The one order to auto-open the rating sheet for, or `null` when nothing qualifies. */
  openOrderId: string | null;
  /** Every other qualifying order, deliberately passed over this tick — the caller marks each one prompted, alongside `openOrderId` itself. */
  passedOverOrderIds: string[];
}

/**
 * #163's multi-order rule, as a pure decision over every stored order at one
 * instant: at most one order opens, chosen from whichever currently qualify
 * (delivered, never prompted, not fully rated, within the 24-hour window) —
 * the open card's own order if it qualifies, otherwise the most recently
 * delivered qualifying order. Every other qualifying order is reported so the
 * caller can mark it prompted in the same tick, which is what stops it from
 * ever auto-opening later (docs/design/162-*, "Two orders landing together" /
 * "Returning to three delivered, unrated orders"). The caller is expected to
 * call this once per page load, not on every render tick — "at most once per
 * page load" is enforced by when this is called, not by anything in here.
 */
export function decideRatingPrompt(
  orders: PlacedOrder[],
  openCardOrderId: string | null,
  now: number = Date.now(),
): RatingPromptDecision {
  const qualifying = orders.filter((order) => qualifiesForRatingPrompt(order, now));
  if (qualifying.length === 0) return { openOrderId: null, passedOverOrderIds: [] };

  const openCard = openCardOrderId ? qualifying.find((order) => order.orderId === openCardOrderId) : undefined;
  const chosen =
    openCard ??
    qualifying.reduce((latest, order) => (deliveredAtMs(order) > deliveredAtMs(latest) ? order : latest));

  return {
    openOrderId: chosen.orderId,
    passedOverOrderIds: qualifying.filter((order) => order.orderId !== chosen.orderId).map((order) => order.orderId),
  };
}

/**
 * Which order the tracker opens by default (#148, "Order stack rules"): the
 * live order arriving soonest, because that's the one a person has to act on
 * first — or, when nothing is live, the most recently placed order in
 * whatever state it's in (today's exact single-order screen). `null` only
 * when nothing is stored at all.
 */
export function defaultOpenOrderId(orders: PlacedOrder[], now: number = Date.now()): string | null {
  if (orders.length === 0) return null;
  const liveOrders = orders.filter((order) => !isDelivered(order, now));
  if (liveOrders.length === 0) return orders[orders.length - 1].orderId;
  return liveOrders.reduce((soonest, order) =>
    estimatedArrivalMs(order) < estimatedArrivalMs(soonest) ? order : soonest,
  ).orderId;
}

/**
 * A pure function of the stored order and the current time — a refresh or a
 * later return visit calls this again with the same `placedAt` and gets the
 * same (or later) state back, never earlier: elapsed time only ever counts
 * up, and once `order.deliveryMs` passes the result stays `delivered`
 * permanently.
 */
export function computeTrackerView(order: PlacedOrder | null, now: number = Date.now()): TrackerView {
  if (!order) return { kind: 'empty' };

  const elapsedMs = Math.max(0, now - new Date(order.placedAt).getTime());

  if (isDelivered(order, now)) {
    return order.rating
      ? { kind: 'delivered', rated: true, stars: order.rating.stars, tags: order.rating.tags }
      : { kind: 'delivered', rated: false };
  }

  const stepThresholdsMs = [
    0,
    order.deliveryMs * PREPARING_FRACTION,
    order.deliveryMs * PICKED_UP_FRACTION,
    order.deliveryMs * ON_THE_WAY_FRACTION,
  ];
  let currentStepIndex = 0;
  for (let i = stepThresholdsMs.length - 1; i >= 0; i--) {
    if (elapsedMs >= stepThresholdsMs[i]) {
      currentStepIndex = i;
      break;
    }
  }

  const remainingMs = Math.max(0, order.etaMinutes * 60_000 - elapsedMs);
  return { kind: 'active', currentStepIndex, remainingMs };
}
