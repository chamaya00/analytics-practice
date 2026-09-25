import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initTrackerPage } from './tracker-dom';
import { addToCart, getOrder, placeOrder } from './order-store';
import { FRESH_MS, GIVEN_UP_MS } from './tracker-state';
import { resetTrack, setTrack } from './tracking';

const LINE = {
  itemId: 'one-job-pizza-margherita',
  restaurantSlug: 'one-job-pizza',
  restaurantName: 'One Job Pizza',
  name: 'Margherita, carried flat',
  priceCents: 1400,
};

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  resetTrack();
  vi.useRealTimers();
});

function root(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function placeAnOrder() {
  addToCart(window.localStorage, LINE);
  return placeOrder(window.localStorage, {
    dropOffSpot: 'couch',
    handlingInstructions: 'guard_it',
    utensils: true,
    tipPercent: 0,
    promoCode: 'gotcha',
  });
}

describe('initTrackerPage — no active order (AC1, contract §4)', () => {
  it('shows the empty state and does not fire tracker_viewed', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();

    initTrackerPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="tracker-empty"]')).not.toBeNull();
    expect(stub).not.toHaveBeenCalled();
  });
});

describe('initTrackerPage — active order (AC1, AC3)', () => {
  it('fires tracker_viewed once per load, view_number starting at 1 and incrementing on the next load', () => {
    const order = placeAnOrder();
    const stub = vi.fn();
    setTrack(stub);

    initTrackerPage(root(), window.localStorage, vi.fn());
    expect(stub).toHaveBeenCalledWith(
      'tracker_viewed',
      expect.objectContaining({ order_id: order.orderId, view_number: 1 }),
    );

    initTrackerPage(root(), window.localStorage, vi.fn());
    expect(stub).toHaveBeenCalledWith(
      'tracker_viewed',
      expect.objectContaining({ order_id: order.orderId, view_number: 2 }),
    );
  });

  it('never renders a fifth, delivered step — the stepper stops at "On the way"', () => {
    placeAnOrder();
    vi.setSystemTime(Date.now() + FRESH_MS + 1000);
    const el = root();

    initTrackerPage(el, window.localStorage, vi.fn());

    const labels = Array.from(el.querySelectorAll('.step-label')).map((node) => node.textContent);
    expect(labels).toEqual(['Placed', 'Preparing', 'Picked up', 'On the way']);
    expect(el.querySelector('[data-testid="tracker-stepper"] li.current .step-label')?.textContent).toBe(
      'On the way',
    );
  });

  it('reopening the tracker after a refresh reads the same order and never resets to step one', () => {
    placeAnOrder();
    vi.setSystemTime(Date.now() + FRESH_MS + 1000);

    const first = root();
    initTrackerPage(first, window.localStorage, vi.fn());
    const second = root();
    initTrackerPage(second, window.localStorage, vi.fn());

    expect(first.querySelector('[data-testid="tracker-stepper"] li.current .step-label')?.textContent).toBe(
      second.querySelector('[data-testid="tracker-stepper"] li.current .step-label')?.textContent,
    );
  });
});

describe('initTrackerPage — given up, 24h+ (AC1)', () => {
  it('shows the given-up screen with a Start over control instead of the stepper', () => {
    placeAnOrder();
    vi.setSystemTime(Date.now() + GIVEN_UP_MS);
    const el = root();

    initTrackerPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="tracker-given-up"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="tracker-stepper"]')).toBeNull();
  });

  it('Start over fires exactly one order_abandoned, clears the order, and navigates to /restaurants/', () => {
    placeAnOrder();
    vi.setSystemTime(Date.now() + GIVEN_UP_MS);
    const stub = vi.fn();
    setTrack(stub);
    const navigate = vi.fn();
    const el = root();

    initTrackerPage(el, window.localStorage, navigate);
    el.querySelector<HTMLButtonElement>('[data-testid="start-over"]')?.click();

    const abandonedCalls = stub.mock.calls.filter(([name]) => name === 'order_abandoned');
    expect(abandonedCalls).toHaveLength(1);
    expect(abandonedCalls[0][1]).toMatchObject({ view_count: 1 });
    expect(getOrder(window.localStorage)).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/restaurants/');
  });
});
