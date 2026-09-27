import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initOrderPlacedPage } from './order-placed-dom';
import { addToCart, placeOrder } from './order-store';
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
});

function root(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('initOrderPlacedPage (AC9)', () => {
  it('redirects to /restaurants/ when no order is stored (direct nav, or Back after a cleared order)', () => {
    const navigate = vi.fn();
    initOrderPlacedPage(root(), window.localStorage, navigate);
    expect(navigate).toHaveBeenCalledWith('/restaurants/');
  });

  it('renders a confirmation with a link to /tracker/ once an order exists', () => {
    addToCart(window.localStorage, LINE);
    placeOrder(window.localStorage, {
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
    });

    const el = root();
    initOrderPlacedPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="track-order"]')?.getAttribute('href')).toBe('/tracker/');
    expect(el.querySelector('[data-testid="order-placed-summary"]')?.textContent).toContain('One Job Pizza');
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
