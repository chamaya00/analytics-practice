// #163's acceptance criteria: the rating sheet's own steps and win screen
// (unit-level, against openRatingSheet directly — a mock loadConfetti so
// nothing here depends on happy-dom's canvas support), plus the multi-order
// auto-open rule wired through initTrackerPage (integration-level, since
// that decision only exists at that seam).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initTrackerPage } from './tracker-dom';
import { openRatingSheet } from './rating-sheet-dom';
import { addToCart, findOrder, ORDERS_KEY, placeOrder, type PlacedOrder } from './order-store';
import { RATING_TAGS, resetTrack, setTrack } from './tracking';
import { getThanksVoucher, unlockThanksVoucher } from './thanks-voucher';

const LINE = {
  itemId: 'one-job-pizza-margherita',
  restaurantSlug: 'one-job-pizza',
  restaurantName: 'One Job Pizza',
  name: 'Margherita, carried flat',
  amountMinor: 1400,
  currency: 'USD' as const,
};

const LINE_B = {
  itemId: 'second-kitchen-bowl',
  restaurantSlug: 'second-kitchen',
  restaurantName: 'Second Kitchen',
  name: 'Rice bowl',
  amountMinor: 1600,
  currency: 'USD' as const,
};

const LINE_HCMC = {
  itemId: 'ben-thanh-banh-mi-banh-mi',
  restaurantSlug: 'ben-thanh-banh-mi',
  restaurantName: 'Bến Thành Bánh Mì',
  name: 'Bánh mì',
  amountMinor: 40000,
  currency: 'VND' as const,
};

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  resetTrack();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

function root(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function placeOrderFor(line: typeof LINE | typeof LINE_B | typeof LINE_HCMC) {
  addToCart(window.localStorage, line);
  return placeOrder(
    window.localStorage,
    { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true },
    line.restaurantSlug,
    () => 0.5,
  );
}

function patchOrder(orderId: string, patch: Partial<PlacedOrder>): void {
  const raw = JSON.parse(window.localStorage.getItem(ORDERS_KEY) ?? '[]') as PlacedOrder[];
  const next = raw.map((order) => (order.orderId === orderId ? { ...order, ...patch } : order));
  window.localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
}

/** A loadConfetti that never touches the real package or a canvas 2D context
 * (unsupported in happy-dom) — used by every test that reaches the win
 * screen with motion allowed but isn't itself testing the burst. */
function stubConfetti() {
  return vi.fn().mockResolvedValue(vi.fn().mockReturnValue(vi.fn()));
}

function mockMatchMedia(reducedMotion: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion') && reducedMotion,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('initTrackerPage — the rating sheet auto-opens once (AC1, docs/design/162-*, "The multi-order rule")', () => {
  it('opens the sheet on the driver step for an order seeded past its own deliveryMs', () => {
    const order = placeOrderFor(LINE);
    vi.setSystemTime(Date.now() + order.deliveryMs);

    initTrackerPage(root(), window.localStorage);
    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();
    vi.advanceTimersByTime(600); // already Delivered at load — a return visit

    expect(document.querySelector('[data-testid="rating-sheet"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="rating-sheet-step-label"]')?.textContent).toBe('1 of 2 · Driver');
    expect(document.querySelector('[data-testid="rating-sheet-driver-next"]')).not.toBeNull();
  });

  it('never opens for an order still active', () => {
    placeOrderFor(LINE);
    initTrackerPage(root(), window.localStorage);
    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();
  });

  it('does not reopen after being dismissed and the page reloaded', () => {
    const order = placeOrderFor(LINE);
    vi.setSystemTime(Date.now() + order.deliveryMs);

    initTrackerPage(root(), window.localStorage);
    vi.advanceTimersByTime(600);
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-close"]')?.click();
    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();

    initTrackerPage(root(), window.localStorage);
    vi.advanceTimersByTime(600);
    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();
    expect(findOrder(window.localStorage, order.orderId)?.ratingPromptedAt).not.toBeNull();
  });

  it('does not reopen after the driver step is skipped, the restaurant step is skipped, and the page is reloaded', () => {
    const order = placeOrderFor(LINE);
    vi.setSystemTime(Date.now() + order.deliveryMs);

    initTrackerPage(root(), window.localStorage);
    vi.advanceTimersByTime(600);
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-skip"]')?.click();
    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();

    initTrackerPage(root(), window.localStorage);
    vi.advanceTimersByTime(600);
    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();
  });

  it('does not reopen once both steps are submitted and the page is reloaded', () => {
    const order = placeOrderFor(LINE);
    vi.setSystemTime(Date.now() + order.deliveryMs);

    initTrackerPage(root(), window.localStorage);
    vi.advanceTimersByTime(600);
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-star-4"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-next"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();
    expect(document.querySelector('[data-testid="rating-sheet-win"]')).not.toBeNull();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-done"]')?.click();

    initTrackerPage(root(), window.localStorage);
    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();
  });

  it('two orders landing together: only one sheet ever exists, for the open card', () => {
    const orderA = placeOrderFor(LINE);
    const orderB = placeOrderFor(LINE_B);
    vi.setSystemTime(Date.now() + Math.max(orderA.deliveryMs, orderB.deliveryMs));

    initTrackerPage(root(), window.localStorage);
    // The open card defaults to the most recently placed order when nothing
    // is live (defaultOpenOrderId) — orderB — and the tie goes to it. orderA
    // is passed over and marked immediately, before orderB's own delay runs.
    expect(findOrder(window.localStorage, orderA.orderId)?.ratingPromptedAt).not.toBeNull();
    expect(document.querySelectorAll('[data-testid="rating-sheet"]')).toHaveLength(0);

    vi.advanceTimersByTime(600);
    expect(document.querySelectorAll('[data-testid="rating-sheet"]')).toHaveLength(1);
    expect(findOrder(window.localStorage, orderB.orderId)?.ratingPromptedAt).not.toBeNull();
  });

  it('returning to three delivered, unrated orders: the sheet opens once, and the DOM never holds more than one', () => {
    const a = placeOrderFor(LINE);
    patchOrder(a.orderId, { placedAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString() });
    const b = placeOrderFor(LINE_B);
    patchOrder(b.orderId, { placedAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString() });
    const c = placeOrderFor({ ...LINE, itemId: 'third-item', restaurantSlug: 'third-place', restaurantName: 'Third Place' });
    patchOrder(c.orderId, { placedAt: new Date(Date.now() - 1 * 60 * 60_000).toISOString() });
    vi.setSystemTime(Date.now() + Math.max(a.deliveryMs, b.deliveryMs, c.deliveryMs) + 4 * 60 * 60_000);

    initTrackerPage(root(), window.localStorage);
    vi.advanceTimersByTime(600);

    expect(document.querySelectorAll('[data-testid="rating-sheet"]')).toHaveLength(1);
    const prompted = [a, b, c].map((order) => findOrder(window.localStorage, order.orderId)?.ratingPromptedAt);
    expect(prompted.every((value) => value !== null && value !== undefined)).toBe(true);

    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-close"]')?.click();
    initTrackerPage(root(), window.localStorage);
    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();
  });

  it('a return visit (already Delivered at load) opens the sheet after 600ms, and not before', () => {
    const order = placeOrderFor(LINE);
    vi.setSystemTime(Date.now() + order.deliveryMs);

    initTrackerPage(root(), window.localStorage);
    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();

    vi.advanceTimersByTime(599);
    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();

    vi.advanceTimersByTime(1);
    expect(document.querySelector('[data-testid="rating-sheet"]')).not.toBeNull();
  });

  it('an order that becomes Delivered after load (watched landing) opens the sheet 1.4s after the tick that catches it, and not before', () => {
    const order = placeOrderFor(LINE);

    initTrackerPage(root(), window.localStorage);
    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();

    // The render tick (every 1s) is what notices Delivered — advance to the
    // first tick at or past the order's own deliveryMs.
    const tickThatCatchesIt = Math.ceil(order.deliveryMs / 1000) * 1000;
    vi.advanceTimersByTime(tickThatCatchesIt);
    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();

    vi.advanceTimersByTime(1399);
    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();

    vi.advanceTimersByTime(1);
    expect(document.querySelector('[data-testid="rating-sheet"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="rating-sheet-step-label"]')?.textContent).toBe('1 of 2 · Driver');
  });

  it('a second order landing while the sheet is open is marked prompted and never opens a second sheet, even after the first closes', () => {
    const orderA = placeOrderFor(LINE);
    vi.setSystemTime(Date.now() + orderA.deliveryMs); // A already Delivered at load — a return visit
    const orderB = placeOrderFor(LINE_B); // B not yet Delivered — B's own deliveryMs counts from B's own placedAt

    initTrackerPage(root(), window.localStorage);
    vi.advanceTimersByTime(600);
    expect(document.querySelectorAll('[data-testid="rating-sheet"]')).toHaveLength(1);
    expect(findOrder(window.localStorage, orderA.orderId)?.ratingPromptedAt).not.toBeNull();
    expect(findOrder(window.localStorage, orderB.orderId)?.ratingPromptedAt).toBeNull();

    // orderB lands while A's sheet is still open — marked prompted, no
    // second sheet queues.
    vi.advanceTimersByTime(Math.ceil(orderB.deliveryMs / 1000) * 1000 + 1400);
    expect(document.querySelectorAll('[data-testid="rating-sheet"]')).toHaveLength(1);
    expect(findOrder(window.localStorage, orderB.orderId)?.ratingPromptedAt).not.toBeNull();

    // Closing A's sheet doesn't retroactively open one for B, this load.
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-close"]')?.click();
    expect(document.querySelectorAll('[data-testid="rating-sheet"]')).toHaveLength(0);
    vi.advanceTimersByTime(5000);
    expect(document.querySelectorAll('[data-testid="rating-sheet"]')).toHaveLength(0);
  });
});

describe('initTrackerPage — Rate from a history row (#165 AC2)', () => {
  it('opens the sheet at the first unrated step for that order, and never marks it prompted — unlike the auto-open rule', () => {
    const orderA = placeOrderFor(LINE);
    // Outside the 24h auto-open window (qualifiesForRatingPrompt), so this
    // test isolates a manual Rate tap from the multi-order rule entirely.
    patchOrder(orderA.orderId, { placedAt: new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString() });
    placeOrderFor(LINE_B); // still active — the open card, pushing orderA into history

    const el = root();
    initTrackerPage(el, window.localStorage);
    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();
    const promptedBefore = findOrder(window.localStorage, orderA.orderId)?.ratingPromptedAt ?? null;

    const row = el.querySelector('[data-testid="tracker-history-row"]');
    expect(row?.textContent).toContain(LINE.restaurantName);
    row?.querySelector<HTMLButtonElement>('[data-testid="tracker-history-rate"]')?.click();

    expect(document.querySelector('[data-testid="rating-sheet"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="rating-sheet-step-label"]')?.textContent).toBe('1 of 2 · Driver');
    expect(findOrder(window.localStorage, orderA.orderId)?.ratingPromptedAt ?? null).toBe(promptedBefore);

    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-star-4"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-next"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();
    expect(findOrder(window.localStorage, orderA.orderId)?.ratingPromptedAt ?? null).toBe(promptedBefore);
  });

  it('a row with both steps rated shows the rated summary instead of Rate', () => {
    const orderA = placeOrderFor(LINE);
    vi.setSystemTime(Date.now() + orderA.deliveryMs);
    placeOrderFor(LINE_B); // still active — the open card

    const el = root();
    initTrackerPage(el, window.localStorage);
    vi.advanceTimersByTime(600); // the sheet auto-opens for orderA (the only qualifying order)
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-star-4"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-next"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-done"]')?.click();

    const row = el.querySelector('[data-testid="tracker-history-row"]');
    expect(row?.querySelector('[data-testid="tracker-history-rate"]')).toBeNull();
    expect(row?.querySelector('[data-testid="tracker-history-rated-summary"]')?.textContent).toBe(
      `${orderA.driver.name} ★★★★☆ · Food ★★★★★`,
    );
  });

  it('a skipped step never counts as rated, so Rate still shows and reopens at that step', () => {
    const orderA = placeOrderFor(LINE);
    vi.setSystemTime(Date.now() + orderA.deliveryMs);
    placeOrderFor(LINE_B);

    const el = root();
    initTrackerPage(el, window.localStorage);
    vi.advanceTimersByTime(600);
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-skip"]')?.click();
    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();

    const row = el.querySelector('[data-testid="tracker-history-row"]');
    expect(row?.querySelector('[data-testid="tracker-history-rate"]')).not.toBeNull();
    expect(row?.querySelector('[data-testid="tracker-history-rated-summary"]')).toBeNull();
  });

  it('the auto-opened sheet and a later history Rate together fire rating_submitted at most once per order_id', () => {
    const orderA = placeOrderFor(LINE);
    vi.setSystemTime(Date.now() + orderA.deliveryMs);
    placeOrderFor(LINE_B);
    const track = vi.fn();
    setTrack(track);

    const el = root();
    initTrackerPage(el, window.localStorage);
    vi.advanceTimersByTime(600); // auto-opens for orderA
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-4"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-done"]')?.click();
    expect(track.mock.calls.filter(([name]) => name === 'rating_submitted')).toHaveLength(1);

    // Driver step is still unrated (skipped) — Rate still shows and reopens
    // at that step, and a second restaurant Submit is guarded (already rated).
    const row = el.querySelector('[data-testid="tracker-history-row"]');
    row?.querySelector<HTMLButtonElement>('[data-testid="tracker-history-rate"]')?.click();
    expect(document.querySelector('[data-testid="rating-sheet-step-label"]')?.textContent).toBe('1 of 2 · Driver');
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();

    expect(track.mock.calls.filter(([name]) => name === 'rating_submitted')).toHaveLength(1);
  });
});

describe('the rating sheet — driver then restaurant (AC2, docs/design/162-*, "Step flow")', () => {
  function seedOrder(): PlacedOrder {
    const placed = placeOrderFor(LINE);
    return findOrder(window.localStorage, placed.orderId) as PlacedOrder;
  }

  it('Next on the driver step stores the driver rating and fires nothing', () => {
    const order = seedOrder();
    const track = vi.fn();
    setTrack(track);

    openRatingSheet({
      order,
      onSubmitDriverRating: (stars) => {
        // Mirrors tracker-dom.ts's own wiring for this test's purposes.
        const raw = JSON.parse(window.localStorage.getItem(ORDERS_KEY) ?? '[]') as PlacedOrder[];
        window.localStorage.setItem(
          ORDERS_KEY,
          JSON.stringify(raw.map((o) => (o.orderId === order.orderId ? { ...o, driverRating: { stars } } : o))),
        );
      },
      onSubmitRestaurant: () => {},
      loadConfetti: stubConfetti(),
    });

    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-star-4"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-next"]')?.click();

    expect(findOrder(window.localStorage, order.orderId)?.driverRating).toEqual({ stars: 4 });
    expect(track).not.toHaveBeenCalled();
    // Advances straight to the restaurant step, "2 of 2" since this order
    // started at the driver step.
    expect(document.querySelector('[data-testid="rating-sheet-step-label"]')?.textContent).toBe(
      '2 of 2 · Restaurant',
    );
  });

  it('Skip on the driver step goes straight to the restaurant step and stores nothing', () => {
    const order = seedOrder();
    const onSubmitDriverRating = vi.fn();
    openRatingSheet({ order, onSubmitDriverRating, onSubmitRestaurant: () => {}, loadConfetti: stubConfetti() });

    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();

    expect(onSubmitDriverRating).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="rating-sheet-step-label"]')?.textContent).toBe(
      '2 of 2 · Restaurant',
    );
    expect(findOrder(window.localStorage, order.orderId)?.driverRating).toBeNull();
  });

  it('Submit on the restaurant step stores the rating and fires rating_submitted once, tags a subset of RATING_TAGS', () => {
    const order = seedOrder();
    const track = vi.fn();
    setTrack(track);
    let stored: PlacedOrder['rating'] = null;

    openRatingSheet({
      order,
      onSubmitDriverRating: () => {},
      onSubmitRestaurant: (stars, tags) => {
        stored = { stars, tags };
        track('rating_submitted', { order_id: order.orderId, stars, tags });
      },
      loadConfetti: stubConfetti(),
    });

    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-tag-fast"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();

    expect(stored).toEqual({ stars: 5, tags: ['fast'] });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('rating_submitted', { order_id: order.orderId, stars: 5, tags: ['fast'] });
    const [, props] = track.mock.calls[0] as [string, { tags: string[] }];
    for (const tag of props.tags) expect(RATING_TAGS).toContain(tag);
  });

  it('Skip on the restaurant step fires nothing', () => {
    const order = seedOrder();
    const onSubmitRestaurant = vi.fn();
    openRatingSheet({ order, onSubmitDriverRating: () => {}, onSubmitRestaurant, loadConfetti: stubConfetti() });

    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-skip"]')?.click();

    expect(onSubmitRestaurant).not.toHaveBeenCalled();
  });

  it('a second restaurant submit for the same order, via the tracker-wired path, fires nothing (submitRating\'s own guard)', () => {
    const order = seedOrder();
    const track = vi.fn();
    setTrack(track);
    vi.setSystemTime(Date.now() + order.deliveryMs);

    initTrackerPage(root(), window.localStorage);
    vi.advanceTimersByTime(600);
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-done"]')?.click();

    // The tracker's own inline Delivered-card prompt is the "any surface"
    // half of this guard — it reads the same now-rated order and renders the
    // already-rated state instead, so its Submit no longer exists to press.
    expect(root().querySelector('[data-testid="rating-submit"]')).toBeNull();

    const ratingCalls = track.mock.calls.filter(([name]) => name === 'rating_submitted');
    expect(ratingCalls).toHaveLength(1);
  });

  it('dismissing mid-flow keeps whatever was already submitted and never shows the win', () => {
    const order = seedOrder();
    const track = vi.fn();
    setTrack(track);

    openRatingSheet({
      order,
      onSubmitDriverRating: () => {},
      onSubmitRestaurant: (stars, tags) => track('rating_submitted', { order_id: order.orderId, stars, tags }),
      loadConfetti: stubConfetti(),
    });

    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-star-3"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-next"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-close"]')?.click();

    expect(document.querySelector('[data-testid="rating-sheet"]')).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });

  it('opening for a part-rated order starts at the restaurant step, labelled "1 of 1"', () => {
    const order = seedOrder();
    patchOrder(order.orderId, { driverRating: { stars: 4 } });
    const reloaded = findOrder(window.localStorage, order.orderId) as PlacedOrder;

    openRatingSheet({
      order: reloaded,
      onSubmitDriverRating: () => {},
      onSubmitRestaurant: () => {},
      loadConfetti: stubConfetti(),
    });

    expect(document.querySelector('[data-testid="rating-sheet-step-label"]')?.textContent).toBe('1 of 1 · Restaurant');
  });
});

describe('the rating sheet — win and reduced motion (AC3, docs/design/162-*, "The animation")', () => {
  function seedOrder(): PlacedOrder {
    const placed = placeOrderFor(LINE);
    return findOrder(window.localStorage, placed.orderId) as PlacedOrder;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('plays the confetti burst on submit and leaves a clearly marked, empty slot for #166\'s reward unlock', async () => {
    mockMatchMedia(false);
    const order = seedOrder();
    const burst = vi.fn();
    const create = vi.fn().mockReturnValue(burst);
    const loadConfetti = vi.fn().mockResolvedValue(create);

    openRatingSheet({
      order,
      onSubmitDriverRating: () => {},
      onSubmitRestaurant: () => {},
      loadConfetti,
    });

    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();

    expect(document.querySelector('[data-testid="rating-sheet-win"]')).not.toBeNull();
    const rewardSlot = document.querySelector('[data-testid="rating-sheet-reward-slot"]');
    expect(rewardSlot).not.toBeNull();
    expect(rewardSlot?.textContent).toBe('');

    // loadConfetti().then(...) resolves on the microtask queue, which fake
    // timers never touch — one flush is enough for it to have already run.
    await Promise.resolve();
    await Promise.resolve();

    expect(loadConfetti).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(document.querySelector('[data-testid="rating-sheet-confetti"]'), {
      resize: true,
    });
    expect(burst).toHaveBeenCalledTimes(1);
  });

  it('under prefers-reduced-motion, shows the still and never invokes the confetti library', () => {
    mockMatchMedia(true);
    const order = seedOrder();
    const loadConfetti = vi.fn();

    openRatingSheet({
      order,
      onSubmitDriverRating: () => {},
      onSubmitRestaurant: () => {},
      loadConfetti,
    });

    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-4"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();

    expect(document.querySelector('[data-testid="rating-sheet-win-still"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="rating-sheet-win"]')).toBeNull();
    expect(document.querySelector('[data-testid="rating-sheet-confetti"]')).toBeNull();
    expect(loadConfetti).not.toHaveBeenCalled();
  });
});

describe('the rating sheet — the reward slot renders the thanks voucher unlock (#166)', () => {
  function seedOrder(): PlacedOrder {
    const placed = placeOrderFor(LINE);
    return findOrder(window.localStorage, placed.orderId) as PlacedOrder;
  }

  it('reads getThanksVoucherUnlock at the win and shows the ticket, role="status", not aria-hidden', () => {
    mockMatchMedia(true); // the still frame is enough; this test is about the slot, not the burst
    const order = seedOrder();
    const unlock = unlockThanksVoucher(window.localStorage, 'sf', order.orderId, Date.now());

    openRatingSheet({
      order,
      onSubmitDriverRating: () => {},
      onSubmitRestaurant: () => {},
      getThanksVoucherUnlock: () => unlock,
    });

    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();

    const rewardSlot = document.querySelector('[data-testid="rating-sheet-reward-slot"]');
    expect(rewardSlot?.hasAttribute('aria-hidden')).toBe(false);
    const ticket = document.querySelector('[data-testid="rating-sheet-reward-ticket"]');
    expect(ticket?.getAttribute('role')).toBe('status');
    const expiryText = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
      new Date(unlock.voucher.expiresAt),
    );
    expect(ticket?.textContent).toBe(
      `Unlocked · $3.00 off · Thanks voucher · For your next San Francisco order over $15.00. Applies by itself at checkout. · Expires ${expiryText} · one per city`,
    );
  });

  it('reads "Topped up" when the unlock result says so', () => {
    mockMatchMedia(true);
    const order = seedOrder();
    const unlock = { ...unlockThanksVoucher(window.localStorage, 'sf', order.orderId, Date.now()), toppedUp: true };

    openRatingSheet({
      order,
      onSubmitDriverRating: () => {},
      onSubmitRestaurant: () => {},
      getThanksVoucherUnlock: () => unlock,
    });

    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();

    expect(document.querySelector('[data-testid="rating-sheet-reward-ticket"]')?.textContent).toContain('Topped up ·');
  });

  it('with no getThanksVoucherUnlock option at all, the slot stays empty and aria-hidden (unchanged from #163)', () => {
    mockMatchMedia(true);
    const order = seedOrder();

    openRatingSheet({ order, onSubmitDriverRating: () => {}, onSubmitRestaurant: () => {} });

    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();

    const rewardSlot = document.querySelector('[data-testid="rating-sheet-reward-slot"]');
    expect(rewardSlot?.getAttribute('aria-hidden')).toBe('true');
    expect(rewardSlot?.textContent).toBe('');
  });
});

describe('the rating sheet — the win\'s VIP nudge reads a read-only ledger snapshot (#169, docs/design/162-*, "The win\'s VIP nudge")', () => {
  function seedOrder(): PlacedOrder {
    const placed = placeOrderFor(LINE);
    return findOrder(window.localStorage, placed.orderId) as PlacedOrder;
  }

  function submitBothSteps(): void {
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();
  }

  it('shows the Gold meter below Gold, the remaining spend to Platinum at Gold, and nothing at Platinum', () => {
    mockMatchMedia(true); // the still frame is enough; this is about the nudge, not the burst

    openRatingSheet({
      order: seedOrder(),
      onSubmitDriverRating: () => {},
      onSubmitRestaurant: () => {},
      getVipLedger: () => ({ v: 1, deliveredCount: 2, spendMinor: { USD: 0, VND: 0 }, level: 'none' }),
    });
    submitBothSteps();
    expect(document.querySelector('[data-testid="rating-sheet-vip-nudge-slot"]')?.hasAttribute('aria-hidden')).toBe(
      false,
    );
    expect(document.querySelector('[data-testid="rating-sheet-vip-nudge-meter"]')?.getAttribute('aria-label')).toBe(
      '2 of 3 delivered orders',
    );
    expect(document.querySelector('.rating-sheet-vip-nudge-text')?.textContent).toBe('1 more delivered order to Gold');

    openRatingSheet({
      order: seedOrder(),
      onSubmitDriverRating: () => {},
      onSubmitRestaurant: () => {},
      getVipLedger: () => ({ v: 1, deliveredCount: 3, spendMinor: { USD: 5230, VND: 0 }, level: 'gold' }),
    });
    submitBothSteps();
    expect(document.querySelector('[data-testid="rating-sheet-vip-nudge-meter"]')).toBeNull();
    expect(document.querySelector('.rating-sheet-vip-nudge-text')?.textContent).toBe('$7.70 to Platinum');

    openRatingSheet({
      order: seedOrder(),
      onSubmitDriverRating: () => {},
      onSubmitRestaurant: () => {},
      getVipLedger: () => ({ v: 1, deliveredCount: 5, spendMinor: { USD: 6000, VND: 0 }, level: 'platinum' }),
    });
    submitBothSteps();
    expect(document.querySelector('[data-testid="rating-sheet-vip-nudge-slot"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('with no getVipLedger option at all, the slot stays empty and aria-hidden', () => {
    mockMatchMedia(true);

    openRatingSheet({ order: seedOrder(), onSubmitDriverRating: () => {}, onSubmitRestaurant: () => {} });
    submitBothSteps();

    const nudgeSlot = document.querySelector('[data-testid="rating-sheet-vip-nudge-slot"]');
    expect(nudgeSlot?.getAttribute('aria-hidden')).toBe('true');
    expect(nudgeSlot?.textContent).toBe('');
  });
});

describe('initTrackerPage — the first rating step submitted unlocks the thanks voucher (#166)', () => {
  it('driver Next, as the first step, unlocks a voucher in this order\'s city, shown in the win', () => {
    const order = placeOrderFor(LINE);
    vi.setSystemTime(Date.now() + order.deliveryMs);
    initTrackerPage(root(), window.localStorage);
    vi.advanceTimersByTime(600);

    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-next"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-skip"]')?.click();

    expect(document.querySelector('[data-testid="rating-sheet-reward-ticket"]')?.textContent).toContain('Unlocked ·');
    const voucher = getThanksVoucher(window.localStorage, 'sf', Date.now());
    expect(voucher?.sourceOrderId).toBe(order.orderId);
  });

  it('a restaurant Submit that is the first step (driver skipped) also unlocks one', () => {
    const order = placeOrderFor(LINE_HCMC);
    vi.setSystemTime(Date.now() + order.deliveryMs);
    initTrackerPage(root(), window.localStorage);
    vi.advanceTimersByTime(600);

    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-4"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();

    expect(document.querySelector('[data-testid="rating-sheet-reward-ticket"]')?.textContent).toContain('Unlocked ·');
    expect(getThanksVoucher(window.localStorage, 'hcmc', Date.now())?.sourceOrderId).toBe(order.orderId);
    // Never in the other city.
    expect(getThanksVoucher(window.localStorage, 'sf', Date.now())).toBeNull();
  });

  it('the restaurant step, as the second step for the same order, unlocks nothing more', () => {
    const order = placeOrderFor(LINE);
    vi.setSystemTime(Date.now() + order.deliveryMs);
    initTrackerPage(root(), window.localStorage);
    vi.advanceTimersByTime(600);

    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-next"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();

    // Still reads "Unlocked" (the driver step's own unlock, held over), not
    // a second "Topped up" from the restaurant submit that followed it.
    expect(document.querySelector('[data-testid="rating-sheet-reward-ticket"]')?.textContent).toContain('Unlocked ·');
  });

  it('a later order rated in a city that already holds one tops it up rather than unlocking a second', () => {
    const first = placeOrderFor(LINE);
    const second = placeOrderFor(LINE_B);
    patchOrder(first.orderId, { rating: { stars: 5, tags: [] }, driverRating: { stars: 5 } });
    unlockThanksVoucher(window.localStorage, 'sf', first.orderId, Date.now());
    vi.setSystemTime(Date.now() + Math.max(first.deliveryMs, second.deliveryMs));

    // first is already fully rated, so the multi-order rule's only eligible
    // candidate is second — it auto-opens (already delivered at load: 600ms).
    initTrackerPage(root(), window.localStorage);
    vi.advanceTimersByTime(600);
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-next"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();

    // Same city, already held: this is the "topped up," not "unlocked," case.
    expect(document.querySelector('[data-testid="rating-sheet-reward-ticket"]')?.textContent).toContain('Topped up ·');
    expect(getThanksVoucher(window.localStorage, 'sf', Date.now())?.sourceOrderId).toBe(second.orderId);
  });
});
