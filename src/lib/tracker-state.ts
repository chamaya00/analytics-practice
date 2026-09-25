// Pure computation of what /tracker shows, from a stored order's placed
// timestamp and the current time — docs/design/65-parody-flow.md, screen 7
// (states 7a-7e) as reworded by docs/design/72-dontdropthatpromo-identity.md's
// replacement table. No DOM, no timers: tracker-dom.ts polls this on an
// interval and re-renders.

import type { PlacedOrder } from './order-store';
import { minutesSinceOrder } from './order-store';

export const STEPS = ['Placed', 'Preparing', 'Picked up', 'On the way'] as const;

/** How long the stepper spends visibly filling in before settling — design doc 7a, "a few seconds apart". */
export const STEP_INTERVAL_MS = 15_000;
/** First minute is state 7a; after it, the stepper is permanently stalled on "On the way" (7b/7c). */
export const FRESH_MS = 60_000;
/** Past this, the tracker gives up rather than showing "almost delivered" forever (7d) — design doc calls this "a plausible cut". */
export const GIVEN_UP_MS = 24 * 60 * 60 * 1000;
/** Below this, flavor text reads as "still the same visit" (7b) rather than counting elapsed time (7c). */
const SETTLED_STABLE_MS = 60 * 60 * 1000;
/** Past this, flavor text stops counting and calls it a record — design doc 7c. */
const RECORD_MS = 3 * 60 * 60 * 1000;

export type TrackerView =
  | { kind: 'empty' }
  | { kind: 'given-up' }
  | { kind: 'fresh'; currentStepIndex: number; flavorText: string }
  | { kind: 'settled'; flavorText: string };

export function computeTrackerView(order: PlacedOrder | null, now: number = Date.now()): TrackerView {
  if (!order) return { kind: 'empty' };

  const elapsedMs = Math.max(0, now - new Date(order.placedAt).getTime());

  if (elapsedMs >= GIVEN_UP_MS) return { kind: 'given-up' };

  if (elapsedMs < FRESH_MS) {
    const currentStepIndex = Math.min(STEPS.length - 1, Math.floor(elapsedMs / STEP_INTERVAL_MS));
    return {
      kind: 'fresh',
      currentStepIndex,
      flavorText: "Your promo is still in your hand. Don't jinx it.",
    };
  }

  if (elapsedMs < SETTLED_STABLE_MS) {
    return { kind: 'settled', flavorText: 'Still holding it. Still not dropped. That’s something.' };
  }

  if (elapsedMs < RECORD_MS) {
    const minutes = Math.floor(minutesSinceOrder(order, now));
    return { kind: 'settled', flavorText: `${minutes} minutes and counting` };
  }

  return { kind: 'settled', flavorText: 'New personal record' };
}
