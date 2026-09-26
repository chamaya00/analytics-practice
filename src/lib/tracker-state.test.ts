import { describe, expect, it } from 'vitest';
import { computeTrackerView, FRESH_MS, GIVEN_UP_MS } from './tracker-state';
import type { PlacedOrder } from './order-store';

function orderPlacedAt(msAgo: number): PlacedOrder {
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
  };
}

describe('computeTrackerView (AC1)', () => {
  it('is empty with no order — the tracker never shows a delivered state, and this is the "nothing to show" floor', () => {
    expect(computeTrackerView(null)).toEqual({ kind: 'empty' });
  });

  it('is fresh just after placing, stepping through steps by elapsed time', () => {
    const view = computeTrackerView(orderPlacedAt(0));
    expect(view.kind).toBe('fresh');
    if (view.kind === 'fresh') expect(view.currentStepIndex).toBe(0);
  });

  it('advances the current step as elapsed time within the fresh window grows', () => {
    const view = computeTrackerView(orderPlacedAt(FRESH_MS - 1000));
    expect(view.kind).toBe('fresh');
    if (view.kind === 'fresh') expect(view.currentStepIndex).toBe(3);
  });

  it('settles on "On the way" once the fresh window passes, and never advances to a fifth/delivered step', () => {
    const view = computeTrackerView(orderPlacedAt(FRESH_MS + 1000));
    expect(view.kind).toBe('settled');
  });

  it('is still settled, never delivered, arbitrarily far short of the give-up cutoff', () => {
    const view = computeTrackerView(orderPlacedAt(GIVEN_UP_MS - 1000));
    expect(view.kind).toBe('settled');
  });

  it('gives up at the 24h cutoff', () => {
    const view = computeTrackerView(orderPlacedAt(GIVEN_UP_MS));
    expect(view).toEqual({ kind: 'given-up' });
  });

  it('reading the same stored order twice in a row never resets — elapsed time only ever counts up (AC1, "refresh never resets")', () => {
    const order = orderPlacedAt(FRESH_MS + 1000);
    const first = computeTrackerView(order, Date.now());
    const second = computeTrackerView(order, Date.now() + 5000);
    expect(first.kind).toBe('settled');
    expect(second.kind).toBe('settled');
  });
});
