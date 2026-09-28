import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initTrackerPage } from './tracker-dom';
import { addToCart, findOrder, getCart, getLatestOrder, linesForRestaurant, ORDER_KEY, ORDERS_KEY, placeOrder, type PlacedOrder } from './order-store';
import { defaultOpenOrderId } from './tracker-state';
import { resetTrack, setTrack } from './tracking';
import { setStoredCity } from './location';
import { formatReviewCount } from './reviews';
import { cartPath } from './cart-routes';

const LINE = {
  itemId: 'one-job-pizza-margherita',
  restaurantSlug: 'one-job-pizza',
  restaurantName: 'One Job Pizza',
  name: 'Margherita, carried flat',
  amountMinor: 1400,
  currency: 'USD' as const,
};

// Two more fictional single-item restaurants (same pattern as `LINE` above,
// deliberately not in restaurants.ts — the tracker degrades to a placeholder
// thumb either way) so a multi-order test can tell orders apart by name.
const LINE_B = {
  itemId: 'second-kitchen-bowl',
  restaurantSlug: 'second-kitchen',
  restaurantName: 'Second Kitchen',
  name: 'Rice bowl',
  amountMinor: 1600,
  currency: 'USD' as const,
};

const LINE_C = {
  itemId: 'third-table-noodles',
  restaurantSlug: 'third-table',
  restaurantName: 'Third Table',
  name: 'Noodles',
  amountMinor: 1200,
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

/** Orders its own restaurant's cart (rather than the whole cart, as
 * `placeAnOrder` above does), so several orders can be placed side by side
 * without one's `placeOrder` clearing another's still-unordered lines. Same
 * fixed random source, for the same reason. */
function placeOrderFor(line: typeof LINE) {
  addToCart(window.localStorage, line);
  return placeOrder(
    window.localStorage,
    { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true },
    line.restaurantSlug,
    () => 0.5,
  );
}

/** Overwrites one stored order's fields directly, the same way
 * `storeLegacyOrder` below seeds a raw shape — used to pin `etaMinutes`/
 * `deliveryMs` to values a test controls exactly, rather than the range
 * `estimateEtaMinutes` draws from a visitor/restaurant hash. */
function patchOrder(orderId: string, patch: Partial<PlacedOrder>): void {
  const raw = JSON.parse(window.localStorage.getItem(ORDERS_KEY) ?? '[]') as PlacedOrder[];
  const next = raw.map((order) => (order.orderId === orderId ? { ...order, ...patch } : order));
  window.localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
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
    // The disclosure sits directly above the rating prompt (AC4), both inside
    // the open order card.
    const card = el.querySelector('[data-testid="tracker-open-card"]');
    const children = Array.from(card?.children ?? []);
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

describe('initTrackerPage — several live orders (#148 AC1, AC5)', () => {
  it('shows both live orders (an open card plus a switcher row), switches which is open on tap, and keeps a delivered order in history', () => {
    const delivered = placeOrderFor(LINE);
    vi.setSystemTime(Date.now() + delivered.deliveryMs + 1000);
    const orderA = placeOrderFor(LINE_B);
    const orderB = placeOrderFor(LINE_C);

    const el = root();
    initTrackerPage(el, window.localStorage);

    const openId = defaultOpenOrderId([orderA, orderB], Date.now());
    const [openLine, rowLine] = openId === orderA.orderId ? [LINE_B, LINE_C] : [LINE_C, LINE_B];

    expect(el.querySelector('[data-testid="tracker-open-card"] .tracker-card-name')?.textContent).toBe(
      openLine.restaurantName,
    );
    const row = el.querySelector('[data-testid="tracker-order-row"]');
    expect(row?.textContent).toContain(rowLine.restaurantName);
    expect(el.querySelector('[data-testid="tracker-history"]')?.textContent).toContain(LINE.restaurantName);

    row?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(el.querySelector('[data-testid="tracker-open-card"] .tracker-card-name')?.textContent).toBe(
      rowLine.restaurantName,
    );
    expect(el.querySelector('[data-testid="tracker-order-row"]')?.textContent).toContain(openLine.restaurantName);
  });

  it('fires tracker_viewed once per load, for the default-open order only — not for the other live order, and not again when a row is switched', () => {
    const orderA = placeOrderFor(LINE_B);
    const orderB = placeOrderFor(LINE_C);
    const stub = vi.fn();
    setTrack(stub);

    const el = root();
    initTrackerPage(el, window.localStorage);

    const viewedCalls = stub.mock.calls.filter(([name]) => name === 'tracker_viewed');
    expect(viewedCalls).toHaveLength(1);
    const expectedOpenId = defaultOpenOrderId([orderA, orderB], Date.now());
    expect(viewedCalls[0][1]).toMatchObject({ order_id: expectedOpenId });

    el.querySelector<HTMLButtonElement>('[data-testid="tracker-order-row"]')?.click();
    expect(stub.mock.calls.filter(([name]) => name === 'tracker_viewed')).toHaveLength(1);
  });
});

describe('initTrackerPage — driver card (#148 AC2)', () => {
  it('shows no driver before Picked up, then the stored avatar, name, rating and count from Picked up onward — the same driver on a later reload', () => {
    const order = placeAnOrder();
    const before = root();
    initTrackerPage(before, window.localStorage);
    expect(before.querySelector('[data-testid="tracker-driver-card"]')).toBeNull();
    expect(before.textContent).toContain('Finding your driver');

    vi.setSystemTime(Date.now() + Math.ceil(order.deliveryMs * (2 / 7)) + 1000);
    const after = root();
    initTrackerPage(after, window.localStorage);

    const card = after.querySelector('[data-testid="tracker-driver-card"]');
    expect(card?.getAttribute('data-driver-id')).toBe(order.driver.id);
    expect(after.querySelector('.tracker-driver-name')?.textContent).toBe(order.driver.name);
    const rating = after.querySelector('[data-testid="tracker-driver-rating"]')?.textContent;
    expect(rating).toContain(order.driver.rating.toFixed(1));
    expect(rating).toContain(`(${formatReviewCount(order.driver.ratingCount)})`);
    const avatar = after.querySelector<HTMLImageElement>('.tracker-driver-avatar');
    expect(avatar?.getAttribute('src')).toBe(`/avatars/drivers/${order.driver.id}.svg`);

    // Reloading (a fresh mount at the same moment) reads the same stored driver.
    const reload = root();
    initTrackerPage(reload, window.localStorage);
    expect(reload.querySelector('[data-testid="tracker-driver-card"]')?.getAttribute('data-driver-id')).toBe(
      order.driver.id,
    );
  });

  it('an HCMC order viewed with the city picker on SF still shows its own HCMC driver and a motorbike', () => {
    const HCMC_LINE = {
      itemId: 'ben-thanh-banh-mi-thit-nuong',
      restaurantSlug: 'ben-thanh-banh-mi',
      restaurantName: 'Bến Thành Bánh Mì',
      name: 'Bánh mì thịt nướng',
      amountMinor: 35000,
      currency: 'VND' as const,
    };
    setStoredCity(window.localStorage, 'hcmc');
    addToCart(window.localStorage, HCMC_LINE);
    const order = placeOrder(
      window.localStorage,
      { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true },
      undefined,
      () => 0.5,
    );
    setStoredCity(window.localStorage, 'sf');

    vi.setSystemTime(Date.now() + Math.ceil(order.deliveryMs * (2 / 7)) + 1000);
    const el = root();
    initTrackerPage(el, window.localStorage);

    expect(order.driver.id.startsWith('hcmc-driver-')).toBe(true);
    const card = el.querySelector('[data-testid="tracker-driver-card"]');
    expect(card?.getAttribute('data-driver-id')).toBe(order.driver.id);
    expect(el.querySelector('.tracker-driver-name')?.textContent).toBe(order.driver.name);
    const vehicle = card?.querySelector('.vehicle-icon');
    expect(vehicle?.getAttribute('data-vehicle')).toBe('motorbike');
  });
});

describe('initTrackerPage — history (#148 AC3)', () => {
  it('lists past orders newest first, each with restaurant, date, item count, stored total, status and driver, and no rating/tip/reorder controls', () => {
    const older = placeOrderFor(LINE);
    vi.setSystemTime(Date.now() + older.deliveryMs + 1000);
    const newer = placeOrderFor(LINE_B);
    vi.setSystemTime(Date.now() + newer.deliveryMs + 1000);
    // A third, still-active order so `older`/`newer` are both in Past orders
    // rather than one of them being kept as the live fallback.
    placeOrderFor(LINE_C);

    const el = root();
    initTrackerPage(el, window.localStorage);

    const rows = el.querySelectorAll('[data-testid="tracker-history-row"]');
    expect(rows).toHaveLength(2);

    const [newerRow, olderRow] = Array.from(rows);
    expect(newerRow.querySelector('.tracker-history-name')?.textContent).toBe(LINE_B.restaurantName);
    expect(olderRow.querySelector('.tracker-history-name')?.textContent).toBe(LINE.restaurantName);

    expect(newerRow.querySelector('.tracker-history-meta')?.textContent).toContain('1 item');
    expect(newerRow.querySelector('[data-testid="tracker-history-total"]')?.textContent).toBe('$16.00');
    expect(newerRow.textContent).toContain('Delivered');
    expect(newerRow.querySelector('.tracker-history-by')?.textContent).toContain(newer.driver.name);

    for (const row of [newerRow, olderRow]) {
      expect(row.querySelector('[data-testid="rating-prompt"]')).toBeNull();
      expect(row.querySelector('[data-testid="rating-submit"]')).toBeNull();
      expect(row.querySelector('.star')).toBeNull();
    }
  });

  it('a legacy order with no stored total shows its subtotal, labelled "subtotal"', () => {
    const legacy: PlacedOrder = {
      orderId: 'legacy-1',
      placedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      etaMinutes: 20,
      deliveryMs: 5000,
      items: [{ ...LINE, quantity: 1 }],
      itemCount: 1,
      amountMinor: 1400,
      totalMinor: null,
      currency: 'USD',
      driver: { id: 'sf-driver-01', name: 'Sarah K.', rating: 4.9, ratingCount: 2143 },
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 0,
      deliveredEventFired: true,
      rating: null,
      driverRating: null,
      ratingPromptedAt: null,
      walletPaid: false,
      thanksVoucherMinor: 0,
      vipCounted: false,
    };
    window.localStorage.setItem(ORDERS_KEY, JSON.stringify([legacy]));
    placeAnOrder(); // a live order, so `legacy` lands in Past orders rather than as the live fallback.

    const el = root();
    initTrackerPage(el, window.localStorage);

    const row = el.querySelector('[data-testid="tracker-history-row"]');
    expect(row?.querySelector('[data-testid="tracker-history-total"]')?.textContent).toContain('$14.00');
    expect(row?.querySelector('[data-testid="tracker-history-subtotal-label"]')?.textContent).toBe('subtotal');
  });
});

describe('initTrackerPage — Order again from history and Delivered (#165 AC3)', () => {
  const AL_PASTOR = {
    itemId: 'mission-taqueria-al-pastor',
    restaurantSlug: 'mission-taqueria',
    restaurantName: 'Mission Taqueria',
    name: 'Al pastor taco',
    amountMinor: 425,
    currency: 'USD' as const,
  };
  const CARNE_ASADA = {
    itemId: 'mission-taqueria-carne-asada',
    restaurantSlug: 'mission-taqueria',
    restaurantName: 'Mission Taqueria',
    name: 'Carne asada taco',
    amountMinor: 475,
    currency: 'USD' as const,
  };
  const DELISTED = {
    itemId: 'mission-taqueria-discontinued-item',
    restaurantSlug: 'mission-taqueria',
    restaurantName: 'Mission Taqueria',
    name: 'A dish no longer on the menu',
    amountMinor: 500,
    currency: 'USD' as const,
  };
  const PIZZA = {
    itemId: 'north-beach-pizzeria-margherita',
    restaurantSlug: 'north-beach-pizzeria',
    restaurantName: 'North Beach Pizzeria',
    name: 'Margherita',
    amountMinor: 1650,
    currency: 'USD' as const,
  };

  // The toast renders as a sibling of the tracker root, in document.body
  // (`root.parentElement ?? root` in tracker-dom.ts) rather than inside it,
  // so it survives past its own test unless removed explicitly here.
  afterEach(() => {
    document.querySelector('[data-testid="tracker-order-again-toast"]')?.remove();
  });

  /** Places an order for a real restaurant (unlike `placeOrderFor`'s
   * fictional `LINE`), so its Order again button actually renders — the
   * button is absent whenever `getRestaurant` can't resolve the slug. */
  function placeRealOrder(...lines: (typeof AL_PASTOR)[]) {
    for (const line of lines) addToCart(window.localStorage, line);
    return placeOrder(
      window.localStorage,
      { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true },
      lines[0].restaurantSlug,
      () => 0.5,
    );
  }

  it('from a history row, refills the order into that restaurant\'s cart at today\'s prices and shows the toast, firing no event', () => {
    const order = placeRealOrder(AL_PASTOR);
    vi.setSystemTime(Date.now() + order.deliveryMs + 1000);
    placeOrderFor(LINE_B); // still active — keeps `order` in Past orders

    const track = vi.fn();
    setTrack(track);
    const el = root();
    initTrackerPage(el, window.localStorage);
    track.mockClear(); // drop the page's own load-time events (tracker_viewed, order_delivered)

    const row = el.querySelector('[data-testid="tracker-history-row"]');
    expect(row?.textContent).toContain('Mission Taqueria');
    row?.querySelector<HTMLButtonElement>('[data-testid="tracker-history-order-again"]')?.click();

    const cart = linesForRestaurant(getCart(window.localStorage), 'mission-taqueria');
    expect(cart).toEqual([{ ...AL_PASTOR, quantity: 1 }]);

    const toast = document.querySelector('[data-testid="tracker-order-again-toast"]');
    expect(toast?.textContent).toContain('Order again: 1 item from Mission Taqueria are in your cart.');
    expect(toast?.querySelector('a')?.getAttribute('href')).toBe(cartPath('mission-taqueria'));

    expect(track).not.toHaveBeenCalled();
  });

  it('an item no longer on the menu is skipped, and the toast reads "N of M items are still on the menu"', () => {
    const order = placeRealOrder(AL_PASTOR, DELISTED);
    vi.setSystemTime(Date.now() + order.deliveryMs + 1000);
    placeOrderFor(LINE_B);

    const el = root();
    initTrackerPage(el, window.localStorage);
    const row = el.querySelector('[data-testid="tracker-history-row"]');
    row?.querySelector<HTMLButtonElement>('[data-testid="tracker-history-order-again"]')?.click();

    const cart = linesForRestaurant(getCart(window.localStorage), 'mission-taqueria');
    expect(cart).toEqual([{ ...AL_PASTOR, quantity: 1 }]);

    const toast = document.querySelector('[data-testid="tracker-order-again-toast"]');
    expect(toast?.textContent).toContain('1 of 2 items are still on the menu.');
  });

  it("a cart holding another restaurant's items is untouched — no confirm dialog, both restaurants' lines end up in the cart", () => {
    const order = placeRealOrder(AL_PASTOR);
    vi.setSystemTime(Date.now() + order.deliveryMs + 1000);
    placeOrderFor(LINE_B);
    addToCart(window.localStorage, PIZZA); // a different restaurant's cart, already populated

    const el = root();
    initTrackerPage(el, window.localStorage);
    const row = el.querySelector('[data-testid="tracker-history-row"]');
    row?.querySelector<HTMLButtonElement>('[data-testid="tracker-history-order-again"]')?.click();

    expect(document.querySelector('[data-testid="confirm-dialog"]')).toBeNull();
    const cart = getCart(window.localStorage);
    expect(linesForRestaurant(cart, 'north-beach-pizzeria')).toEqual([{ ...PIZZA, quantity: 1 }]);
    expect(linesForRestaurant(cart, 'mission-taqueria')).toEqual([{ ...AL_PASTOR, quantity: 1 }]);
  });

  it('from the Delivered card, goes straight to that restaurant\'s cart — no toast', () => {
    const order = placeRealOrder(AL_PASTOR, CARNE_ASADA);
    vi.setSystemTime(Date.now() + order.deliveryMs);

    const navigate = vi.fn();
    const el = root();
    initTrackerPage(el, window.localStorage, navigate);

    el.querySelector<HTMLButtonElement>('[data-testid="tracker-delivered-order-again"]')?.click();

    expect(navigate).toHaveBeenCalledWith(cartPath('mission-taqueria'));
    expect(document.querySelector('[data-testid="tracker-order-again-toast"]')).toBeNull();
    const cart = linesForRestaurant(getCart(window.localStorage), 'mission-taqueria');
    expect(cart).toEqual([
      { ...AL_PASTOR, quantity: 1 },
      { ...CARNE_ASADA, quantity: 1 },
    ]);
  });

  it('the button is absent, on both the Delivered card and the history row, once the restaurant slug no longer resolves', () => {
    const delivered = placeOrderFor(LINE); // LINE's slug is deliberately not in restaurants.ts
    vi.setSystemTime(Date.now() + delivered.deliveryMs);
    const el = root();
    initTrackerPage(el, window.localStorage);
    expect(el.querySelector('[data-testid="tracker-delivered-order-again"]')).toBeNull();

    vi.setSystemTime(Date.now() + 1000);
    placeOrderFor(LINE_B); // still active — pushes `delivered` into history
    const historyEl = root();
    initTrackerPage(historyEl, window.localStorage);
    const row = historyEl.querySelector('[data-testid="tracker-history-row"]');
    expect(row?.textContent).toContain(LINE.restaurantName);
    expect(row?.querySelector('[data-testid="tracker-history-order-again"]')).toBeNull();
  });
});

describe('initTrackerPage — events with several live orders (#148 AC5)', () => {
  it('rates the order on screen by its own id, even when a more recently placed order is not the one open', () => {
    const orderA = placeOrderFor(LINE_B);
    const orderB = placeOrderFor(LINE_C);
    // orderA arrives soonest (so it opens by default); orderB, placed after
    // it, arrives much later — the divergence the driver notes call out
    // between "the open order" and `getLatestOrder()`.
    patchOrder(orderA.orderId, { etaMinutes: 10, deliveryMs: 5 * 60_000 });
    patchOrder(orderB.orderId, { etaMinutes: 60, deliveryMs: 100_000_000 });
    expect(getLatestOrder(window.localStorage)?.orderId).toBe(orderB.orderId);

    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initTrackerPage(el, window.localStorage);
    expect(el.querySelector('[data-testid="tracker-open-card"] .tracker-card-name')?.textContent).toBe(
      LINE_B.restaurantName,
    );

    // Advance past orderA's own deliveryMs while it's the order being
    // watched — it stays open, rating prompt included ("Order stack rules").
    vi.advanceTimersByTime(5 * 60_000 + 2000);
    expect(el.querySelector('[data-testid="rating-prompt"]')).not.toBeNull();

    el.querySelector<HTMLButtonElement>('[data-testid="star-5"]')?.click();
    el.querySelector<HTMLButtonElement>('[data-testid="rating-submit"]')?.click();

    expect(stub).toHaveBeenCalledWith('rating_submitted', { order_id: orderA.orderId, stars: 5, tags: [] });
    expect(findOrder(window.localStorage, orderB.orderId)?.rating).toBeNull();
  });

  it('fires order_delivered for a live order that is not the one being viewed', () => {
    const orderA = placeOrderFor(LINE_B);
    const orderB = placeOrderFor(LINE_C);
    patchOrder(orderA.orderId, { etaMinutes: 5, deliveryMs: 100_000_000 });
    patchOrder(orderB.orderId, { etaMinutes: 8, deliveryMs: 5 * 60_000 });

    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initTrackerPage(el, window.localStorage);
    expect(el.querySelector('[data-testid="tracker-open-card"] .tracker-card-name')?.textContent).toBe(
      LINE_B.restaurantName,
    );

    vi.advanceTimersByTime(5 * 60_000 + 2000);

    const delivered = stub.mock.calls.filter(([name]) => name === 'order_delivered');
    expect(delivered).toHaveLength(1);
    expect(delivered[0][1]).toMatchObject({ order_id: orderB.orderId });
    // The open order (orderA) is unaffected; orderB moves to history.
    expect(el.querySelector('[data-testid="tracker-open-card"] .tracker-card-name')?.textContent).toBe(
      LINE_B.restaurantName,
    );
    expect(el.querySelector('[data-testid="tracker-history"]')?.textContent).toContain(LINE_C.restaurantName);
  });
});

describe('the VIP card (#174, docs/design/162-*, "The VIP card: where and what")', () => {
  it('is absent entirely with no orders at all', () => {
    const el = root();
    initTrackerPage(el, window.localStorage);
    expect(el.querySelector('[data-testid="vip-card"]')).toBeNull();
  });

  it('shows "Not VIP yet" with 2 of 3 progress once two orders have delivered', () => {
    placeAnOrder();
    const second = placeOrderFor(LINE_B);
    const third = placeOrderFor(LINE_C);
    for (const order of [second, third]) {
      patchOrder(order.orderId, {
        placedAt: new Date(Date.now() - 100_000).toISOString(),
        deliveryMs: 1000,
        deliveredEventFired: true,
      });
    }

    const el = root();
    initTrackerPage(el, window.localStorage);

    const card = el.querySelector('[data-testid="vip-card"]');
    expect(card?.querySelector('[data-testid="vip-card-heading"]')?.textContent).toBe('Not VIP yet');
    expect(card?.querySelector('[data-testid="vip-card-progress"]')?.textContent).toContain('1 order to Gold');
    expect(card?.querySelector('[data-testid="vip-card-progress"]')?.textContent).toContain('2 of 3 delivered orders');
    expect(card?.querySelector('[data-testid="vip-card-meter"]')).not.toBeNull();
  });

  it('shows Gold with a spend bar toward Platinum once 3 orders have delivered', () => {
    const live = placeAnOrder();
    const b = placeOrderFor(LINE_B);
    const c = placeOrderFor(LINE_C);
    for (const order of [live, b, c]) {
      patchOrder(order.orderId, {
        placedAt: new Date(Date.now() - 100_000).toISOString(),
        deliveryMs: 1000,
        deliveredEventFired: true,
        totalMinor: 1000,
      });
    }

    const el = root();
    initTrackerPage(el, window.localStorage);

    const card = el.querySelector('[data-testid="vip-card"]');
    expect(card?.querySelector('[data-testid="vip-card-heading"]')?.textContent).toContain('Gold');
    expect(card?.querySelector('[data-testid="vip-card-pill"]')?.textContent).toBe('Free delivery');
    expect(card?.querySelector('[data-testid="vip-card-progress"]')?.textContent).toContain('$30.00 of $60.00');
    expect(card?.querySelector('[data-testid="vip-card-progress"]')?.textContent).toContain('$30.00 to Platinum');
  });

  it('shows Platinum with no spend bar or pill once the spend floor is also reached', () => {
    const live = placeAnOrder();
    const b = placeOrderFor(LINE_B);
    const c = placeOrderFor(LINE_C);
    for (const order of [live, b, c]) {
      patchOrder(order.orderId, {
        placedAt: new Date(Date.now() - 100_000).toISOString(),
        deliveryMs: 1000,
        deliveredEventFired: true,
        totalMinor: 6000,
      });
    }

    const el = root();
    initTrackerPage(el, window.localStorage);

    const card = el.querySelector('[data-testid="vip-card"]');
    expect(card?.querySelector('[data-testid="vip-card-heading"]')?.textContent).toBe('Platinum');
    expect(card?.querySelector('[data-testid="vip-card-detail"]')?.textContent).toContain('10% off');
    expect(card?.querySelector('[data-testid="vip-card-pill"]')).toBeNull();
  });

  it('fires no event for a level reached while the tracker renders', () => {
    const stub = vi.fn();
    setTrack(stub);
    const live = placeAnOrder();
    const b = placeOrderFor(LINE_B);
    const c = placeOrderFor(LINE_C);
    for (const order of [live, b, c]) {
      patchOrder(order.orderId, {
        placedAt: new Date(Date.now() - 100_000).toISOString(),
        deliveryMs: 1000,
        deliveredEventFired: true,
        totalMinor: 6000,
      });
    }

    initTrackerPage(root(), window.localStorage);

    expect(stub.mock.calls.map(([name]) => name)).not.toContain('vip_level_changed');
  });
});
