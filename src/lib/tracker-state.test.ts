import { describe, expect, it } from 'vitest';
import {
  computeOrderStack,
  computeTrackerView,
  decideRatingPrompt,
  defaultOpenOrderId,
  isDelivered,
  isRatingFullyDone,
  RATING_PROMPT_WINDOW_MS,
} from './tracker-state';
import type { PlacedOrder } from './order-store';

// One fixed "now" for both the order's timestamp and the view computed from it.
// Reading Date.now() twice let a slow tick cross the 1ms boundary cases below.
const NOW = Date.parse('2026-09-27T12:00:00.000Z');

// A 20-minute estimate with a 6-minute (360_000ms) delivery time — comfortably
// at or under half the estimate (10 min), and round enough to make the
// proportional thresholds below easy to state exactly.
const ETA_MINUTES = 20;
const DELIVERY_MS = 6 * 60_000;
const PREPARING_MS = DELIVERY_MS / 14; // ~25.7s
const PICKED_UP_MS = (DELIVERY_MS * 2) / 7; // ~102.9s
const ON_THE_WAY_MS = (DELIVERY_MS * 4) / 7; // ~205.7s

function orderPlacedAt(
  msAgo: number,
  rating: PlacedOrder['rating'] = null,
  etaMinutes = ETA_MINUTES,
  deliveryMs = DELIVERY_MS,
  orderId = 'order-1',
  driverRating: PlacedOrder['driverRating'] = null,
  ratingPromptedAt: PlacedOrder['ratingPromptedAt'] = null,
): PlacedOrder {
  return {
    orderId,
    placedAt: new Date(NOW - msAgo).toISOString(),
    etaMinutes,
    deliveryMs,
    items: [],
    itemCount: 1,
    amountMinor: 1000,
    totalMinor: 1000,
    currency: 'USD',
    driver: { id: 'sf-driver-01', name: 'Sarah K.', rating: 4.9, ratingCount: 2143 },
    dropOffPreset: 'home',
    deliveryInstructions: 'hand_to_me',
    utensils: true,
    appliedVoucherIds: [],
    savedAmountMinor: 0,
    viewCount: 0,
    deliveredEventFired: false,
    rating,
    driverRating,
    ratingPromptedAt,
    walletPaid: false,
    thanksVoucherMinor: 0,
    vipCounted: false,
  };
}

describe('isDelivered', () => {
  it('is false before the stored delivery time and true at or after it', () => {
    expect(isDelivered(orderPlacedAt(DELIVERY_MS - 1), NOW)).toBe(false);
    expect(isDelivered(orderPlacedAt(DELIVERY_MS), NOW)).toBe(true);
    expect(isDelivered(orderPlacedAt(DELIVERY_MS + 60_000), NOW)).toBe(true);
  });
});

describe('computeTrackerView (AC4)', () => {
  it('is empty with no order', () => {
    expect(computeTrackerView(null)).toEqual({ kind: 'empty' });
  });

  it('is at "Placed" (step 0) just after placing, counting down toward the full estimate', () => {
    const view = computeTrackerView(orderPlacedAt(0), NOW);
    expect(view).toEqual({ kind: 'active', currentStepIndex: 0, remainingMs: ETA_MINUTES * 60_000 });
  });

  it('advances to "Preparing" (step 1) at this order’s own preparing threshold', () => {
    const view = computeTrackerView(orderPlacedAt(PREPARING_MS), NOW);
    expect(view.kind).toBe('active');
    expect(view.kind === 'active' && view.currentStepIndex).toBe(1);
  });

  it('is still on "Placed" one millisecond short of the preparing threshold', () => {
    const view = computeTrackerView(orderPlacedAt(PREPARING_MS - 1), NOW);
    expect(view.kind === 'active' && view.currentStepIndex).toBe(0);
  });

  it('advances to "Picked up" (step 2) at this order’s own picked-up threshold', () => {
    const view = computeTrackerView(orderPlacedAt(PICKED_UP_MS), NOW);
    expect(view.kind === 'active' && view.currentStepIndex).toBe(2);
  });

  it('advances to "On the way" (step 3) at this order’s own on-the-way threshold', () => {
    const view = computeTrackerView(orderPlacedAt(ON_THE_WAY_MS), NOW);
    expect(view.kind === 'active' && view.currentStepIndex).toBe(3);
  });

  it('is still on "On the way", not yet delivered, one millisecond short of its own delivery time', () => {
    const view = computeTrackerView(orderPlacedAt(DELIVERY_MS - 1), NOW);
    expect(view.kind === 'active' && view.currentStepIndex).toBe(3);
  });

  it('reaches Delivered, unrated, exactly at its own stored delivery time — which is at or before half the estimate, i.e. early', () => {
    const view = computeTrackerView(orderPlacedAt(DELIVERY_MS), NOW);
    expect(view).toEqual({ kind: 'delivered', rated: false });
    expect(DELIVERY_MS).toBeLessThanOrEqual((ETA_MINUTES * 60_000) / 2);
  });

  it('stays Delivered arbitrarily long after the threshold — the tracker never stalls or resets', () => {
    const view = computeTrackerView(orderPlacedAt(DELIVERY_MS + 24 * 60 * 60 * 1000), NOW);
    expect(view).toEqual({ kind: 'delivered', rated: false });
  });

  it('reports the stored rating once one has been submitted', () => {
    const view = computeTrackerView(orderPlacedAt(DELIVERY_MS, { stars: 4, tags: ['fast'] }), NOW);
    expect(view).toEqual({ kind: 'delivered', rated: true, stars: 4, tags: ['fast'] });
  });

  it('reading the same stored order twice in a row never resets — elapsed time only ever counts up (AC4, "refresh never resets")', () => {
    const order = orderPlacedAt(ON_THE_WAY_MS);
    const first = computeTrackerView(order, NOW);
    const second = computeTrackerView(order, NOW + 5000);
    expect(first.kind).toBe('active');
    expect(second.kind).toBe('active');
    if (first.kind === 'active' && second.kind === 'active') {
      expect(second.currentStepIndex).toBeGreaterThanOrEqual(first.currentStepIndex);
      expect(second.remainingMs).toBeLessThanOrEqual(first.remainingMs);
    }
  });

  it('the intermediate steps scale with each order’s own delivery time, not a fixed total (AC4)', () => {
    // The same one-minute elapsed time is already past the short order's own
    // preparing threshold (~26s) but well short of a much longer order's
    // (~171s) — each order's steps are paced off its own deliveryMs.
    const oneMinute = 60_000;
    const shortView = computeTrackerView(orderPlacedAt(oneMinute), NOW);
    const longDeliveryMs = 40 * 60_000;
    const longView = computeTrackerView(orderPlacedAt(oneMinute, null, 90, longDeliveryMs), NOW);
    expect(shortView.kind === 'active' && shortView.currentStepIndex).toBe(1);
    expect(longView.kind === 'active' && longView.currentStepIndex).toBe(0);
  });

  it('remainingMs never goes negative once elapsed time exceeds the estimate but delivery hasn’t yet triggered', () => {
    // Pathological but possible if the estimate and delivery time were ever
    // inconsistent: remainingMs still floors at 0 rather than going negative.
    const view = computeTrackerView(orderPlacedAt(ETA_MINUTES * 60_000 + 1, null, ETA_MINUTES, ETA_MINUTES * 60_000 + 60_000), NOW);
    expect(view.kind === 'active' && view.remainingMs).toBe(0);
  });
});

describe('computeOrderStack (#148, "Order stack rules")', () => {
  it('every order not yet Delivered is live, sorted by ascending estimated arrival; delivered orders are past, newest placedAt first', () => {
    // etaMinutes 30 placed 5min ago -> arrives in 25min; etaMinutes 10 placed
    // 1min ago -> arrives in 9min, so it sorts first despite being placed later.
    const soonest = orderPlacedAt(60_000, null, 10, DELIVERY_MS, 'soonest');
    const later = orderPlacedAt(5 * 60_000, null, 30, DELIVERY_MS, 'later');
    const delivered = orderPlacedAt(DELIVERY_MS, null, 20, DELIVERY_MS, 'delivered');
    const stack = computeOrderStack([later, delivered, soonest], null, NOW);
    expect(stack.live.map((o) => o.orderId)).toEqual(['soonest', 'later']);
    expect(stack.past.map((o) => o.orderId)).toEqual(['delivered']);
  });

  it('an order past its own delivery time stays live when it is the open order, until the page is left', () => {
    const delivered = orderPlacedAt(DELIVERY_MS, null, 20, DELIVERY_MS, 'watched');
    const stack = computeOrderStack([delivered], 'watched', NOW);
    expect(stack.live.map((o) => o.orderId)).toEqual(['watched']);
    expect(stack.past).toEqual([]);
  });

  it('every order appears in exactly one of live/past, never both', () => {
    const a = orderPlacedAt(0, null, 20, DELIVERY_MS, 'a');
    const b = orderPlacedAt(DELIVERY_MS, null, 20, DELIVERY_MS, 'b');
    const stack = computeOrderStack([a, b], null, NOW);
    const liveIds = new Set(stack.live.map((o) => o.orderId));
    const pastIds = new Set(stack.past.map((o) => o.orderId));
    expect([...liveIds].some((id) => pastIds.has(id))).toBe(false);
    expect(liveIds.size + pastIds.size).toBe(2);
  });

  it('hides the past section by returning an empty array when nothing is delivered yet', () => {
    const a = orderPlacedAt(0, null, 20, DELIVERY_MS, 'a');
    expect(computeOrderStack([a], 'a', NOW).past).toEqual([]);
  });
});

describe('defaultOpenOrderId (#148, "Which order is open by default")', () => {
  it('is null with nothing stored', () => {
    expect(defaultOpenOrderId([], NOW)).toBeNull();
  });

  it('opens the live order arriving soonest, not the one placed most recently', () => {
    const soonest = orderPlacedAt(60_000, null, 10, DELIVERY_MS, 'soonest');
    const later = orderPlacedAt(5 * 60_000, null, 30, DELIVERY_MS, 'later');
    expect(defaultOpenOrderId([later, soonest], NOW)).toBe('soonest');
  });

  it('falls back to the most recently placed order when nothing is live — today’s single-order screen', () => {
    const older = orderPlacedAt(DELIVERY_MS + 60_000, null, 20, DELIVERY_MS, 'older');
    const newer = orderPlacedAt(DELIVERY_MS, null, 20, DELIVERY_MS, 'newer');
    expect(defaultOpenOrderId([older, newer], NOW)).toBe('newer');
  });
});

describe('isRatingFullyDone (#163, docs/design/162-*, "Storage")', () => {
  it('is false until both steps are stored, true once both are — a skipped step stays null forever', () => {
    expect(isRatingFullyDone(orderPlacedAt(DELIVERY_MS))).toBe(false);
    expect(isRatingFullyDone(orderPlacedAt(DELIVERY_MS, { stars: 5, tags: [] }))).toBe(false);
    expect(
      isRatingFullyDone(orderPlacedAt(DELIVERY_MS, null, ETA_MINUTES, DELIVERY_MS, 'order-1', { stars: 4 })),
    ).toBe(false);
    expect(
      isRatingFullyDone(
        orderPlacedAt(DELIVERY_MS, { stars: 5, tags: [] }, ETA_MINUTES, DELIVERY_MS, 'order-1', { stars: 4 }),
      ),
    ).toBe(true);
  });
});

describe('decideRatingPrompt (#163, docs/design/162-*, "The multi-order rule")', () => {
  it('opens nothing with no stored orders', () => {
    expect(decideRatingPrompt([], null, NOW)).toEqual({ openOrderId: null, passedOverOrderIds: [] });
  });

  it('opens a single order delivered, unprompted, unrated order and passes over nothing', () => {
    const order = orderPlacedAt(DELIVERY_MS, null, ETA_MINUTES, DELIVERY_MS, 'a');
    expect(decideRatingPrompt([order], null, NOW)).toEqual({ openOrderId: 'a', passedOverOrderIds: [] });
  });

  it('never opens for an order still active (not yet delivered)', () => {
    const order = orderPlacedAt(DELIVERY_MS - 1, null, ETA_MINUTES, DELIVERY_MS, 'a');
    expect(decideRatingPrompt([order], null, NOW).openOrderId).toBeNull();
  });

  it('never opens for an order already marked prompted, whether or not it is rated', () => {
    const order = orderPlacedAt(
      DELIVERY_MS,
      null,
      ETA_MINUTES,
      DELIVERY_MS,
      'a',
      null,
      new Date(NOW - DELIVERY_MS).toISOString(),
    );
    expect(decideRatingPrompt([order], null, NOW)).toEqual({ openOrderId: null, passedOverOrderIds: [] });
  });

  it('never opens for an order both steps of which are already stored', () => {
    const order = orderPlacedAt(DELIVERY_MS, { stars: 5, tags: [] }, ETA_MINUTES, DELIVERY_MS, 'a', { stars: 4 });
    expect(decideRatingPrompt([order], null, NOW).openOrderId).toBeNull();
  });

  it('never opens for an order delivered more than 24 hours ago', () => {
    const justOutside = orderPlacedAt(DELIVERY_MS + RATING_PROMPT_WINDOW_MS + 1, null, ETA_MINUTES, DELIVERY_MS, 'a');
    expect(decideRatingPrompt([justOutside], null, NOW).openOrderId).toBeNull();
  });

  it('still opens for an order delivered exactly 24 hours ago (the window is inclusive)', () => {
    const atTheEdge = orderPlacedAt(DELIVERY_MS + RATING_PROMPT_WINDOW_MS, null, ETA_MINUTES, DELIVERY_MS, 'a');
    expect(decideRatingPrompt([atTheEdge], null, NOW).openOrderId).toBe('a');
  });

  it('two orders landing together: the tie goes to the open card, and the other is passed over', () => {
    const first = orderPlacedAt(DELIVERY_MS, null, ETA_MINUTES, DELIVERY_MS, 'first');
    const second = orderPlacedAt(DELIVERY_MS, null, ETA_MINUTES, DELIVERY_MS, 'second');
    const decision = decideRatingPrompt([first, second], 'second', NOW);
    expect(decision).toEqual({ openOrderId: 'second', passedOverOrderIds: ['first'] });
  });

  it('the sheet never chains: an order landing while another qualifies but isn’t the open card is passed over, not queued', () => {
    const openCard = orderPlacedAt(DELIVERY_MS, null, ETA_MINUTES, DELIVERY_MS, 'open');
    const other = orderPlacedAt(DELIVERY_MS, null, ETA_MINUTES, DELIVERY_MS, 'other');
    const decision = decideRatingPrompt([openCard, other], 'open', NOW);
    expect(decision).toEqual({ openOrderId: 'open', passedOverOrderIds: ['other'] });
  });

  it('returning to three delivered, unrated orders: opens once for the most recently delivered, the other two are passed over', () => {
    const oldest = orderPlacedAt(DELIVERY_MS + 3 * 60 * 60_000, null, ETA_MINUTES, DELIVERY_MS, 'oldest');
    const middle = orderPlacedAt(DELIVERY_MS + 2 * 60 * 60_000, null, ETA_MINUTES, DELIVERY_MS, 'middle');
    const newest = orderPlacedAt(DELIVERY_MS + 60 * 60_000, null, ETA_MINUTES, DELIVERY_MS, 'newest');
    const decision = decideRatingPrompt([oldest, middle, newest], null, NOW);
    expect(decision.openOrderId).toBe('newest');
    expect(decision.passedOverOrderIds.sort()).toEqual(['middle', 'oldest']);
  });

  it('prefers the open card over the most recently delivered order when both qualify', () => {
    const olderOpenCard = orderPlacedAt(DELIVERY_MS + 60 * 60_000, null, ETA_MINUTES, DELIVERY_MS, 'open');
    const newerOther = orderPlacedAt(DELIVERY_MS, null, ETA_MINUTES, DELIVERY_MS, 'other');
    const decision = decideRatingPrompt([olderOpenCard, newerOther], 'open', NOW);
    expect(decision).toEqual({ openOrderId: 'open', passedOverOrderIds: ['other'] });
  });

  it('falls back to the most recently delivered order when the open card does not qualify (already prompted)', () => {
    const openCard = orderPlacedAt(
      DELIVERY_MS,
      null,
      ETA_MINUTES,
      DELIVERY_MS,
      'open',
      null,
      new Date(NOW - DELIVERY_MS).toISOString(),
    );
    const other = orderPlacedAt(DELIVERY_MS + 60_000, null, ETA_MINUTES, DELIVERY_MS, 'other');
    const decision = decideRatingPrompt([openCard, other], 'open', NOW);
    expect(decision).toEqual({ openOrderId: 'other', passedOverOrderIds: [] });
  });
});
