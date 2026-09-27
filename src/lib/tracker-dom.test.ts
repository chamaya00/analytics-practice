import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initTrackerPage } from './tracker-dom';
import { addToCart, getLatestOrder, ORDER_KEY, placeOrder } from './order-store';
import { resetTrack, setTrack } from './tracking';
import { setStoredCity } from './location';

const LINE = {
  itemId: 'one-job-pizza-margherita',
  restaurantSlug: 'one-job-pizza',
  restaurantName: 'One Job Pizza',
  name: 'Margherita, carried flat',
  amountMinor: 1400,
  currency: 'USD' as const,
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

/** A fixed random source (`0.5`) makes `deliveryMs` an exact, computable
 * fraction of the estimate rather than a fresh draw every run — the same
 * "inject the random source" pattern flash-deal.test.ts already uses. */
function placeAnOrder() {
  addToCart(window.localStorage, LINE);
  return placeOrder(
    window.localStorage,
    {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
    },
    undefined,
    () => 0.5,
  );
}

describe('initTrackerPage — no active order (AC1, contract §4)', () => {
  it('shows the empty state, links to the home feed, and does not fire tracker_viewed', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();

    initTrackerPage(el, window.localStorage);

    expect(el.querySelector('[data-testid="tracker-empty"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="tracker-empty"] a')?.getAttribute('href')).toBe('/');
    expect(stub).not.toHaveBeenCalled();
  });
});

describe('initTrackerPage — active order (AC1, AC2, AC4)', () => {
  it('fires tracker_viewed once per load, view_number starting at 1 and incrementing on the next load', () => {
    const order = placeAnOrder();
    const stub = vi.fn();
    setTrack(stub);

    initTrackerPage(root(), window.localStorage);
    expect(stub).toHaveBeenCalledWith(
      'tracker_viewed',
      expect.objectContaining({ order_id: order.orderId, view_number: 1 }),
    );

    initTrackerPage(root(), window.localStorage);
    expect(stub).toHaveBeenCalledWith(
      'tracker_viewed',
      expect.objectContaining({ order_id: order.orderId, view_number: 2 }),
    );
  });

  it('shows a live countdown toward the estimate, ticking down every second', () => {
    const order = placeAnOrder();
    const el = root();

    initTrackerPage(el, window.localStorage);
    const first = el.querySelector('[data-testid="tracker-countdown"]')?.textContent;
    expect(first).toContain('until estimated arrival');

    vi.advanceTimersByTime(2000);
    const second = el.querySelector('[data-testid="tracker-countdown"]')?.textContent;
    expect(second).not.toBe(first);
    // The order's own deliveryMs (half the estimate, by the fixed 0.5 random
    // source above) is well short of the estimate itself, so the countdown
    // is still ticking down toward the estimate rather than gone yet.
    expect(order.deliveryMs).toBeLessThan(order.etaMinutes * 60_000);
  });

  it('moves through the realistic stages as elapsed time grows, stopping short of Delivered', () => {
    const order = placeAnOrder();
    // Comfortably inside the "On the way" bucket (between 4/7 and 1 of
    // deliveryMs), clear of either boundary regardless of rounding.
    vi.setSystemTime(Date.now() + Math.round(order.deliveryMs * 0.8));
    const el = root();

    initTrackerPage(el, window.localStorage);

    const labels = Array.from(el.querySelectorAll('.step-label')).map((node) => node.textContent);
    expect(labels).toEqual(['Placed', 'Preparing', 'Picked up', 'On the way', 'Delivered']);
    expect(el.querySelector('[data-testid="tracker-stepper"] li.current .step-label')?.textContent).toBe(
      'On the way',
    );
    expect(el.querySelector('[data-testid="rating-prompt"]')).toBeNull();
  });

  it('reopening the tracker after a refresh reads the same order and never resets to step one', () => {
    const order = placeAnOrder();
    vi.setSystemTime(Date.now() + Math.round(order.deliveryMs * 0.8));

    const first = root();
    initTrackerPage(first, window.localStorage);
    const second = root();
    initTrackerPage(second, window.localStorage);

    expect(first.querySelector('[data-testid="tracker-stepper"] li.current .step-label')?.textContent).toBe(
      second.querySelector('[data-testid="tracker-stepper"] li.current .step-label')?.textContent,
    );
  });
});

describe('initTrackerPage — Delivered, unrated (AC1, AC2, AC4, AC5)', () => {
  it('ends at Delivered with the demo disclosure and an interactive rating prompt, no countdown shown', () => {
    const order = placeAnOrder();
    vi.setSystemTime(Date.now() + order.deliveryMs);
    const el = root();

    initTrackerPage(el, window.localStorage);

    expect(el.querySelector('[data-testid="tracker-stepper"] li.current .step-label')?.textContent).toBe(
      'Delivered',
    );
    expect(el.querySelector('[data-testid="tracker-countdown"]')).toBeNull();
    const disclosure = el.querySelector('[data-testid="demo-disclosure"]');
    const ratingPrompt = el.querySelector('[data-testid="rating-prompt"]');
    expect(disclosure).not.toBeNull();
    expect(ratingPrompt).not.toBeNull();
    expect(disclosure?.textContent).toContain('This is a demo. No payment is taken and no food is sent.');
    expect(disclosure?.querySelector('a')?.getAttribute('href')).toBe('/about/');
    // The disclosure sits directly above the rating prompt (AC4).
    const children = Array.from(el.children);
    expect(children.indexOf(disclosure as Element) + 1).toBe(children.indexOf(ratingPrompt as Element));
  });

  it('fires exactly one order_delivered, even across repeated renders/refreshes for the same order, with minutes_since_order reflecting the early-delivery distribution (AC5)', () => {
    const order = placeAnOrder();
    vi.setSystemTime(Date.now() + order.deliveryMs);
    const stub = vi.fn();
    setTrack(stub);

    initTrackerPage(root(), window.localStorage);
    initTrackerPage(root(), window.localStorage);

    const delivered = stub.mock.calls.filter(([name]) => name === 'order_delivered');
    expect(delivered).toHaveLength(1);
    expect(delivered[0][1]).toMatchObject({ order_id: order.orderId, minutes_since_order: expect.any(Number) });
    const minutesSinceOrder = (delivered[0][1] as { minutes_since_order: number }).minutes_since_order;
    expect(minutesSinceOrder).toBeCloseTo(order.deliveryMs / 60_000, 1);
  });

  it('reaching Delivered is detected even if the tracker was never mounted at the moment it happened (AC5)', () => {
    const order = placeAnOrder();
    // Advance well past the stored delivery time with nothing mounted at all.
    vi.setSystemTime(Date.now() + order.deliveryMs + 5 * 60_000);
    const stub = vi.fn();
    setTrack(stub);

    const el = root();
    initTrackerPage(el, window.localStorage);

    expect(el.querySelector('[data-testid="tracker-stepper"] li.current .step-label')?.textContent).toBe(
      'Delivered',
    );
    expect(stub.mock.calls.filter(([name]) => name === 'order_delivered')).toHaveLength(1);
  });

  it('never fires the retired order_abandoned event', () => {
    const order = placeAnOrder();
    vi.setSystemTime(Date.now() + order.deliveryMs);
    const stub = vi.fn();
    setTrack(stub);

    initTrackerPage(root(), window.localStorage);

    expect(stub.mock.calls.some(([name]) => name === 'order_abandoned')).toBe(false);
  });

  it('Submit is disabled until a star is picked, then fires rating_submitted with the chosen stars and tags', () => {
    const order = placeAnOrder();
    vi.setSystemTime(Date.now() + order.deliveryMs);
    const stub = vi.fn();
    setTrack(stub);
    const el = root();

    initTrackerPage(el, window.localStorage);

    const submit = el.querySelector<HTMLButtonElement>('[data-testid="rating-submit"]');
    expect(submit?.disabled).toBe(true);

    el.querySelector<HTMLButtonElement>('[data-testid="star-4"]')?.click();
    el.querySelector<HTMLButtonElement>('[data-testid="rating-tag-fast"]')?.click();
    expect(submit?.disabled).toBe(false);
    submit?.click();

    expect(stub).toHaveBeenCalledWith('rating_submitted', { order_id: order.orderId, stars: 4, tags: ['fast'] });
  });

  it('after submitting, re-renders as already-rated with no interactive controls', () => {
    const order = placeAnOrder();
    vi.setSystemTime(Date.now() + order.deliveryMs);
    const el = root();

    initTrackerPage(el, window.localStorage);
    el.querySelector<HTMLButtonElement>('[data-testid="star-5"]')?.click();
    el.querySelector<HTMLButtonElement>('[data-testid="rating-submit"]')?.click();

    expect(el.querySelector('[data-testid="rating-submit"]')).toBeNull();
    expect(el.textContent).toContain('Thanks for rating this order');
  });
});

describe('initTrackerPage — an order stored before #121 (no etaMinutes/deliveryMs)', () => {
  /** Same shape `placeOrder` wrote before #121 added `etaMinutes`/`deliveryMs` — a
   * visitor's order already in progress on the live site when this shipped. */
  function storeLegacyOrder(): void {
    window.localStorage.setItem(
      ORDER_KEY,
      JSON.stringify({
        orderId: '11111111-1111-4111-8111-111111111111',
        placedAt: new Date().toISOString(),
        items: [LINE],
        itemCount: 1,
        amountMinor: 1400,
        currency: 'USD',
        dropOffPreset: 'home',
        deliveryInstructions: 'hand_to_me',
        utensils: true,
        appliedVoucherIds: [],
        savedAmountMinor: 0,
        viewCount: 0,
        deliveredEventFired: false,
        rating: null,
      }),
    );
  }

  it('shows a finite live countdown rather than "NaN:NaN"', () => {
    storeLegacyOrder();
    const el = root();

    initTrackerPage(el, window.localStorage);

    const countdown = el.querySelector('[data-testid="tracker-countdown"]')?.textContent;
    expect(countdown).not.toContain('NaN');
    expect(countdown).toContain('until estimated arrival');
  });

  it('reaches Delivered at the fixed 7-minute fallback, firing order_delivered exactly once', () => {
    storeLegacyOrder();
    vi.setSystemTime(Date.now() + 7 * 60_000);
    const stub = vi.fn();
    setTrack(stub);

    initTrackerPage(root(), window.localStorage);
    const el = root();
    initTrackerPage(el, window.localStorage);

    expect(el.querySelector('[data-testid="tracker-stepper"] li.current .step-label')?.textContent).toBe(
      'Delivered',
    );
    expect(stub.mock.calls.filter(([name]) => name === 'order_delivered')).toHaveLength(1);
  });
});

describe('initTrackerPage — already rated, return visit (AC1)', () => {
  it('shows the static thanks line, filled stars, and no inputs — a second Submit is impossible', () => {
    const order = placeAnOrder();
    vi.setSystemTime(Date.now() + order.deliveryMs);
    const stub = vi.fn();
    setTrack(stub);

    const firstVisit = root();
    initTrackerPage(firstVisit, window.localStorage);
    firstVisit.querySelector<HTMLButtonElement>('[data-testid="star-3"]')?.click();
    firstVisit.querySelector<HTMLButtonElement>('[data-testid="rating-submit"]')?.click();

    const secondVisit = root();
    initTrackerPage(secondVisit, window.localStorage);

    expect(secondVisit.textContent).toContain('Thanks for rating this order');
    expect(secondVisit.querySelector('[data-testid="rating-submit"]')).toBeNull();
    expect(secondVisit.querySelectorAll('.star.selected')).toHaveLength(3);

    const ratingCalls = stub.mock.calls.filter(([name]) => name === 'rating_submitted');
    expect(ratingCalls).toHaveLength(1);
  });
});

describe('AC3: the tracker completes with no error when the sender is unconfigured', () => {
  it('walks through opening the tracker, reaching Delivered, and submitting a rating with track left at its no-op default', () => {
    const order = placeAnOrder();
    vi.setSystemTime(Date.now() + order.deliveryMs);
    resetTrack();

    expect(() => {
      const el = root();
      initTrackerPage(el, window.localStorage);
      el.querySelector<HTMLButtonElement>('[data-testid="star-5"]')?.click();
      el.querySelector<HTMLButtonElement>('[data-testid="rating-submit"]')?.click();
    }).not.toThrow();

    expect(getLatestOrder(window.localStorage)?.rating).toEqual({ stars: 5, tags: [] });
  });
});

describe('initTrackerPage — vehicle icon on the countdown (#130 AC4, AC5)', () => {
  const HCMC_LINE = {
    itemId: 'ben-thanh-banh-mi-thit-nuong',
    restaurantSlug: 'ben-thanh-banh-mi',
    restaurantName: 'Bến Thành Bánh Mì',
    name: 'Bánh mì thịt nướng',
    amountMinor: 35000,
    currency: 'VND' as const,
  };

  it('a motorbike icon precedes the countdown text for an HCMC order', () => {
    addToCart(window.localStorage, HCMC_LINE);
    placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true }, undefined, () => 0.5);

    const el = root();
    initTrackerPage(el, window.localStorage);

    const icon = el.querySelector('[data-testid="tracker-countdown"] .vehicle-icon');
    expect(icon?.getAttribute('data-vehicle')).toBe('motorbike');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('switching the stored city after ordering does not change the order’s own vehicle icon', () => {
    setStoredCity(window.localStorage, 'hcmc');
    addToCart(window.localStorage, HCMC_LINE);
    placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true }, undefined, () => 0.5);

    setStoredCity(window.localStorage, 'sf');

    const el = root();
    initTrackerPage(el, window.localStorage);

    const icon = el.querySelector('[data-testid="tracker-countdown"] .vehicle-icon');
    expect(icon?.getAttribute('data-vehicle')).toBe('motorbike');
  });
});
