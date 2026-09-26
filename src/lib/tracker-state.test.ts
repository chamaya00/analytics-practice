import { describe, expect, it } from 'vitest';
import {
  computeTrackerView,
  DELIVERED_MS,
  ON_THE_WAY_MS,
  PICKED_UP_MS,
  PREPARING_MS,
} from './tracker-state';
import type { PlacedOrder } from './order-store';

function orderPlacedAt(msAgo: number, rating: PlacedOrder['rating'] = null): PlacedOrder {
  return {
    orderId: 'order-1',
    placedAt: new Date(Date.now() - msAgo).toISOString(),
    items: [],
    itemCount: 1,
    amountMinor: 1000,
    currency: 'USD',
    dropOffPreset: 'home',
    deliveryInstructions: 'hand_to_me',
    utensils: true,
    appliedVoucherIds: [],
    savedAmountMinor: 0,
    viewCount: 0,
    deliveredEventFired: false,
    rating,
  };
}

describe('computeTrackerView (AC1)', () => {
  it('is empty with no order', () => {
    expect(computeTrackerView(null)).toEqual({ kind: 'empty' });
  });

  it('is at "Placed" (step 0) just after placing', () => {
    const view = computeTrackerView(orderPlacedAt(0));
    expect(view).toEqual({ kind: 'active', currentStepIndex: 0 });
  });

  it('advances to "Preparing" (step 1) at the preparing threshold', () => {
    const view = computeTrackerView(orderPlacedAt(PREPARING_MS));
    expect(view).toEqual({ kind: 'active', currentStepIndex: 1 });
  });

  it('is still on "Placed" one millisecond short of the preparing threshold', () => {
    const view = computeTrackerView(orderPlacedAt(PREPARING_MS - 1));
    expect(view).toEqual({ kind: 'active', currentStepIndex: 0 });
  });

  it('advances to "Picked up" (step 2) at the picked-up threshold', () => {
    const view = computeTrackerView(orderPlacedAt(PICKED_UP_MS));
    expect(view).toEqual({ kind: 'active', currentStepIndex: 2 });
  });

  it('advances to "On the way" (step 3) at the on-the-way threshold', () => {
    const view = computeTrackerView(orderPlacedAt(ON_THE_WAY_MS));
    expect(view).toEqual({ kind: 'active', currentStepIndex: 3 });
  });

  it('is still on "On the way", not yet delivered, one millisecond short of the delivered threshold', () => {
    const view = computeTrackerView(orderPlacedAt(DELIVERED_MS - 1));
    expect(view).toEqual({ kind: 'active', currentStepIndex: 3 });
  });

  it('reaches Delivered, unrated, at the delivered threshold', () => {
    const view = computeTrackerView(orderPlacedAt(DELIVERED_MS));
    expect(view).toEqual({ kind: 'delivered', rated: false });
  });

  it('stays Delivered arbitrarily long after the threshold — the tracker never stalls or resets', () => {
    const view = computeTrackerView(orderPlacedAt(DELIVERED_MS + 24 * 60 * 60 * 1000));
    expect(view).toEqual({ kind: 'delivered', rated: false });
  });

  it('reports the stored rating once one has been submitted', () => {
    const view = computeTrackerView(orderPlacedAt(DELIVERED_MS, { stars: 4, tags: ['fast'] }));
    expect(view).toEqual({ kind: 'delivered', rated: true, stars: 4, tags: ['fast'] });
  });

  it('reading the same stored order twice in a row never resets — elapsed time only ever counts up (AC1, "refresh never resets")', () => {
    const order = orderPlacedAt(ON_THE_WAY_MS);
    const first = computeTrackerView(order, Date.now());
    const second = computeTrackerView(order, Date.now() + 5000);
    expect(first).toEqual({ kind: 'active', currentStepIndex: 3 });
    expect(second.kind).toBe('active');
    if (first.kind === 'active' && second.kind === 'active') {
      expect(second.currentStepIndex).toBeGreaterThanOrEqual(first.currentStepIndex);
    }
  });
});
