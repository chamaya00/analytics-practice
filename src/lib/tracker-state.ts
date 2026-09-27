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
