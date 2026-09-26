// Pure computation of what /tracker shows, from a stored order's placed
// timestamp and the current time — docs/design/80-two-city-brand-and-flow.md,
// "Tracker": five stages (Placed, Preparing, Picked up, On the way,
// Delivered), computed from elapsed time, never stalling. No DOM, no timers:
// tracker-dom.ts polls this on an interval and re-renders.

import type { PlacedOrder } from './order-store';
import type { RatingTag } from './tracking';

export const STEPS = ['Placed', 'Preparing', 'Picked up', 'On the way', 'Delivered'] as const;

/** Elapsed-time thresholds driving the stepper — a plausible pacing guess (design doc's "Guesses"), not a measured value. */
export const PREPARING_MS = 30_000;
export const PICKED_UP_MS = 2 * 60_000;
export const ON_THE_WAY_MS = 4 * 60_000;
export const DELIVERED_MS = 7 * 60_000;

/** One threshold per pre-Delivered step, in `STEPS` order — Delivered itself is handled separately below since reaching it changes `TrackerView`'s shape, not just its index. */
const STEP_THRESHOLDS_MS = [0, PREPARING_MS, PICKED_UP_MS, ON_THE_WAY_MS] as const;

export type TrackerView =
  | { kind: 'empty' }
  | { kind: 'active'; currentStepIndex: number }
  | { kind: 'delivered'; rated: false }
  | { kind: 'delivered'; rated: true; stars: number; tags: RatingTag[] };

/**
 * A pure function of the stored order and the current time — a refresh or a
 * later return visit calls this again with the same `placedAt` and gets the
 * same (or later) state back, never earlier: elapsed time only ever counts
 * up, and once `DELIVERED_MS` passes the result stays `delivered` permanently.
 */
export function computeTrackerView(order: PlacedOrder | null, now: number = Date.now()): TrackerView {
  if (!order) return { kind: 'empty' };

  const elapsedMs = Math.max(0, now - new Date(order.placedAt).getTime());

  if (elapsedMs >= DELIVERED_MS) {
    return order.rating
      ? { kind: 'delivered', rated: true, stars: order.rating.stars, tags: order.rating.tags }
      : { kind: 'delivered', rated: false };
  }

  let currentStepIndex = 0;
  for (let i = STEP_THRESHOLDS_MS.length - 1; i >= 0; i--) {
    if (elapsedMs >= STEP_THRESHOLDS_MS[i]) {
      currentStepIndex = i;
      break;
    }
  }
  return { kind: 'active', currentStepIndex };
}
