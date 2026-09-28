import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initOrderPlacedPage, renderOrderPlaced } from './order-placed-dom';
import { addToCart, placeOrder } from './order-store';
import { setStoredCity } from './location';
import confetti from 'canvas-confetti';
import * as confettiLoader from './confetti-loader';

// #213: mocked file-wide, the same shape tracker-dom.test.ts's and
// rating-modal-dom.test.ts's own mocks use — happy-dom's canvas has no real
// 2D context, so the real library throws once its animation frame runs
// (docs/memory/engineer.md's #178 lesson).
vi.mock('canvas-confetti', () => {
  const cannon = Object.assign(vi.fn(), { create: vi.fn(() => vi.fn()), reset: vi.fn() });
  return { default: cannon };
});

const LINE = {
  itemId: 'one-job-pizza-margherita',
  restaurantSlug: 'one-job-pizza',
  restaurantName: 'One Job Pizza',
  name: 'Margherita, carried flat',
  amountMinor: 1400,
  currency: 'USD' as const,
};

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

function placeAnOrder() {
  addToCart(window.localStorage, LINE);
  return placeOrder(window.localStorage, {
    dropOffPreset: 'home',
    deliveryInstructions: 'hand_to_me',
    utensils: true,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  mockMatchMedia(false);
  vi.mocked(confetti).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  confettiLoader.resetConfettiCannon();
});

function root(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('initOrderPlacedPage (AC9)', () => {
  it('redirects home when no order is stored (direct nav, or Back after a cleared order)', () => {
    const navigate = vi.fn();
    initOrderPlacedPage(root(), window.localStorage, navigate);
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('renders a confirmation with a link to the order just placed (#147 "Order stack rules")', () => {
    addToCart(window.localStorage, LINE);
    const order = placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
    });

    const el = root();
    initOrderPlacedPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="track-order"]')?.getAttribute('href')).toBe(
      `/tracker/#order-${order.orderId}`,
    );
    expect(el.querySelector('[data-testid="order-placed-summary"]')?.textContent).toContain('One Job Pizza');
  });

  it('shows the total checkout charged, not the subtotal (soft-launch readiness QA)', () => {
    addToCart(window.localStorage, LINE);
    placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      totalMinor: 1700,
    });

    const el = root();
    initOrderPlacedPage(el, window.localStorage, vi.fn());

    const text = el.querySelector('[data-testid="order-placed-summary"]')?.textContent ?? '';
    expect(text).toContain('$17.00');
    expect(text).not.toContain('$14.00');
  });

  it('shows the order’s own stored estimate (AC2)', () => {
    addToCart(window.localStorage, LINE);
    const order = placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
    });

    const el = root();
    initOrderPlacedPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="order-placed-eta"]')?.textContent).toBe(
      `Arrives in about ${order.etaMinutes} min`,
    );
  });

  it('a vehicle icon precedes the estimate text, matching the order’s own restaurant’s city (#130 AC4)', () => {
    addToCart(window.localStorage, {
      itemId: 'ben-thanh-banh-mi-thit-nuong',
      restaurantSlug: 'ben-thanh-banh-mi',
      restaurantName: 'Bến Thành Bánh Mì',
      name: 'Bánh mì thịt nướng',
      amountMinor: 35000,
      currency: 'VND',
    });
    placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true });

    const el = root();
    initOrderPlacedPage(el, window.localStorage, vi.fn());

    const icon = el.querySelector('[data-testid="order-placed-eta"] .vehicle-icon');
    expect(icon?.getAttribute('data-vehicle')).toBe('motorbike');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('switching the stored city after ordering does not change the order’s own vehicle icon (#130 AC5)', () => {
    setStoredCity(window.localStorage, 'hcmc');
    addToCart(window.localStorage, {
      itemId: 'ben-thanh-banh-mi-thit-nuong',
      restaurantSlug: 'ben-thanh-banh-mi',
      restaurantName: 'Bến Thành Bánh Mì',
      name: 'Bánh mì thịt nướng',
      amountMinor: 35000,
      currency: 'VND',
    });
    placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true });

    // The visitor switches their city preference to SF after ordering.
    setStoredCity(window.localStorage, 'sf');

    const el = root();
    initOrderPlacedPage(el, window.localStorage, vi.fn());

    const icon = el.querySelector('[data-testid="order-placed-eta"] .vehicle-icon');
    expect(icon?.getAttribute('data-vehicle')).toBe('motorbike');
  });
});

describe('order-placed confetti burst (#213)', () => {
  function stubBadgeGeometry(): void {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ left: 120, top: 60, width: 40, height: 40, right: 160, bottom: 100, x: 120, y: 60, toJSON: () => {} }) as DOMRect,
    );
    vi.stubGlobal('innerWidth', 400);
    vi.stubGlobal('innerHeight', 800);
  }

  // Real timers here (no fake-timer setup in this file) — a macrotask flush
  // clears every microtask the mocked dynamic import chains through
  // (loadConfettiCannon's own `.then()` plus celebrateOrder's), the same
  // pattern checkout-dom.test.ts and tracker-dom.test.ts already use for an
  // un-faked dynamic import.
  async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('AC2: bursts once from the badge, with the driver-set particle values, not a fixed centre origin', async () => {
    stubBadgeGeometry();
    const loadSpy = vi.spyOn(confettiLoader, 'loadConfettiCannon');
    placeAnOrder();

    const el = root();
    initOrderPlacedPage(el, window.localStorage, vi.fn());
    await flush();

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(confetti).toHaveBeenCalledTimes(1);
    expect(confetti).toHaveBeenCalledWith({
      particleCount: 40,
      spread: 70,
      startVelocity: 30,
      ticks: 120,
      origin: { x: (120 + 20) / 400, y: (60 + 20) / 800 },
    });
    expect(el.querySelector('[data-testid="order-placed-mark"]')).not.toBeNull();
  });

  it('AC2: the loader is never called when there is no stored order (the redirect path)', async () => {
    const loadSpy = vi.spyOn(confettiLoader, 'loadConfettiCannon');

    initOrderPlacedPage(root(), window.localStorage, vi.fn());
    await flush();

    expect(loadSpy).not.toHaveBeenCalled();
    expect(confetti).not.toHaveBeenCalled();
  });

  it('AC3: a reload of the same order (renderOrderPlaced run again) does not burst a second time', async () => {
    stubBadgeGeometry();
    placeAnOrder();

    initOrderPlacedPage(root(), window.localStorage, vi.fn());
    await flush();
    expect(confetti).toHaveBeenCalledTimes(1);

    renderOrderPlaced(root(), window.localStorage);
    await flush();
    expect(confetti).toHaveBeenCalledTimes(1);
  });

  it('AC3: a newer order bursts again', async () => {
    stubBadgeGeometry();
    placeAnOrder();

    initOrderPlacedPage(root(), window.localStorage, vi.fn());
    await flush();
    expect(confetti).toHaveBeenCalledTimes(1);

    placeAnOrder();
    initOrderPlacedPage(root(), window.localStorage, vi.fn());
    await flush();
    expect(confetti).toHaveBeenCalledTimes(2);
  });

  it('AC3: under reduced motion, the loader is never called and the page renders exactly as it does with motion allowed', async () => {
    mockMatchMedia(true);
    const loadSpy = vi.spyOn(confettiLoader, 'loadConfettiCannon');
    placeAnOrder();

    const el = root();
    initOrderPlacedPage(el, window.localStorage, vi.fn());
    await flush();

    expect(loadSpy).not.toHaveBeenCalled();
    expect(confetti).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="order-placed-mark"]')).not.toBeNull();
    expect(el.querySelector('h1')?.textContent).toBe('Order placed');
    expect(el.querySelector('[data-testid="track-order"]')).not.toBeNull();
  });
});
