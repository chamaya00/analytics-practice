import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initTrackerPage } from './tracker-dom';
import { addToCart, getOrder, placeOrder } from './order-store';
import { DELIVERED_MS, ON_THE_WAY_MS } from './tracker-state';
import { resetTrack, setTrack } from './tracking';

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

function placeAnOrder() {
  addToCart(window.localStorage, LINE);
  return placeOrder(window.localStorage, {
    dropOffPreset: 'home',
    deliveryInstructions: 'hand_to_me',
    utensils: true,
  });
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

describe('initTrackerPage — active order (AC1, AC2)', () => {
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

  it('moves through the realistic stages as elapsed time grows, stopping short of Delivered', () => {
    placeAnOrder();
    vi.setSystemTime(Date.now() + ON_THE_WAY_MS);
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
    placeAnOrder();
    vi.setSystemTime(Date.now() + ON_THE_WAY_MS);

    const first = root();
    initTrackerPage(first, window.localStorage);
    const second = root();
    initTrackerPage(second, window.localStorage);

    expect(first.querySelector('[data-testid="tracker-stepper"] li.current .step-label')?.textContent).toBe(
      second.querySelector('[data-testid="tracker-stepper"] li.current .step-label')?.textContent,
    );
  });
});

describe('initTrackerPage — Delivered, unrated (AC1, AC2, AC4)', () => {
  it('ends at Delivered with the demo disclosure and an interactive rating prompt', () => {
    placeAnOrder();
    vi.setSystemTime(Date.now() + DELIVERED_MS);
    const el = root();

    initTrackerPage(el, window.localStorage);

    expect(el.querySelector('[data-testid="tracker-stepper"] li.current .step-label')?.textContent).toBe(
      'Delivered',
    );
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

  it('fires exactly one order_delivered, even across repeated renders/refreshes for the same order', () => {
    placeAnOrder();
    vi.setSystemTime(Date.now() + DELIVERED_MS);
    const stub = vi.fn();
    setTrack(stub);

    initTrackerPage(root(), window.localStorage);
    initTrackerPage(root(), window.localStorage);

    const delivered = stub.mock.calls.filter(([name]) => name === 'order_delivered');
    expect(delivered).toHaveLength(1);
    expect(delivered[0][1]).toMatchObject({ minutes_since_order: expect.any(Number) });
  });

  it('never fires the retired order_abandoned event', () => {
    placeAnOrder();
    vi.setSystemTime(Date.now() + DELIVERED_MS);
    const stub = vi.fn();
    setTrack(stub);

    initTrackerPage(root(), window.localStorage);

    expect(stub.mock.calls.some(([name]) => name === 'order_abandoned')).toBe(false);
  });

  it('Submit is disabled until a star is picked, then fires rating_submitted with the chosen stars and tags', () => {
    const order = placeAnOrder();
    vi.setSystemTime(Date.now() + DELIVERED_MS);
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
    placeAnOrder();
    vi.setSystemTime(Date.now() + DELIVERED_MS);
    const el = root();

    initTrackerPage(el, window.localStorage);
    el.querySelector<HTMLButtonElement>('[data-testid="star-5"]')?.click();
    el.querySelector<HTMLButtonElement>('[data-testid="rating-submit"]')?.click();

    expect(el.querySelector('[data-testid="rating-submit"]')).toBeNull();
    expect(el.textContent).toContain('Thanks for rating this order');
  });
});

describe('initTrackerPage — already rated, return visit (AC1)', () => {
  it('shows the static thanks line, filled stars, and no inputs — a second Submit is impossible', () => {
    placeAnOrder();
    vi.setSystemTime(Date.now() + DELIVERED_MS);
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
    placeAnOrder();
    vi.setSystemTime(Date.now() + DELIVERED_MS);
    resetTrack();

    expect(() => {
      const el = root();
      initTrackerPage(el, window.localStorage);
      el.querySelector<HTMLButtonElement>('[data-testid="star-5"]')?.click();
      el.querySelector<HTMLButtonElement>('[data-testid="rating-submit"]')?.click();
    }).not.toThrow();

    expect(getOrder(window.localStorage)?.rating).toEqual({ stars: 5, tags: [] });
  });
});
