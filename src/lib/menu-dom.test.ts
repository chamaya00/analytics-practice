import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initMenuPage } from './menu-dom';
import { addToCart, getCart } from './order-store';
import { formatMoney } from './money';
import { restaurantsForCity } from './restaurants';
import { resetTrack, setTrack } from './tracking';

const restaurant = restaurantsForCity('sf')[0];
const allItems = restaurant.menu.flatMap((section) => section.items);
const firstItem = allItems[0];

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  resetTrack();
});

function root(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('initMenuPage (AC1, AC2, AC5)', () => {
  it('fires restaurant_opened with this restaurant’s city and slug on load', () => {
    const stub = vi.fn();
    setTrack(stub);

    initMenuPage(root(), restaurant, window.localStorage);

    expect(stub).toHaveBeenCalledWith('restaurant_opened', { city: restaurant.city, restaurant_slug: restaurant.slug });
  });

  it('renders every menu section and every item starts with an Add button, not a stepper', () => {
    const el = root();
    initMenuPage(el, restaurant, window.localStorage);
    for (const section of restaurant.menu) {
      const testId = `menu-section-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      expect(el.querySelector(`[data-testid="${testId}"]`)).not.toBeNull();
    }
    for (const item of allItems) {
      expect(el.querySelector(`[data-testid="add-${item.id}"]`)).not.toBeNull();
    }
  });

  it('every menu item shows a photo', () => {
    const el = root();
    initMenuPage(el, restaurant, window.localStorage);
    for (const item of allItems) {
      const row = el.querySelector(`[data-testid="menu-item-${item.id}"]`);
      expect(row?.querySelector('img.menu-item-photo')).not.toBeNull();
    }
  });

  it('tapping Add switches that row to a quantity stepper and adds the item to the stored cart', () => {
    const el = root();
    initMenuPage(el, restaurant, window.localStorage);

    el.querySelector<HTMLButtonElement>(`[data-testid="add-${firstItem.id}"]`)?.click();

    expect(el.querySelector(`[data-testid="add-${firstItem.id}"]`)).toBeNull();
    expect(el.querySelector(`[data-testid="quantity-${firstItem.id}"]`)?.textContent).toBe('1');
    expect(getCart(window.localStorage)).toHaveLength(1);
  });

  it('tapping + increments quantity; tapping − back to zero returns the row to an Add button', () => {
    const el = root();
    initMenuPage(el, restaurant, window.localStorage);

    el.querySelector<HTMLButtonElement>(`[data-testid="add-${firstItem.id}"]`)?.click();
    el.querySelector<HTMLButtonElement>(`[data-testid="increment-${firstItem.id}"]`)?.click();
    expect(el.querySelector(`[data-testid="quantity-${firstItem.id}"]`)?.textContent).toBe('2');

    el.querySelector<HTMLButtonElement>(`[data-testid="decrement-${firstItem.id}"]`)?.click();
    el.querySelector<HTMLButtonElement>(`[data-testid="decrement-${firstItem.id}"]`)?.click();
    expect(el.querySelector(`[data-testid="add-${firstItem.id}"]`)).not.toBeNull();
  });
});

describe('the restaurant-meta line’s per-visitor ETA (AC1, AC2)', () => {
  it('fills the restaurant-eta span with "N min", stable across repeated calls', () => {
    const span = document.createElement('span');
    span.setAttribute('data-testid', 'restaurant-eta');
    document.body.appendChild(span);

    initMenuPage(root(), restaurant, window.localStorage);
    const first = span.textContent;
    expect(first).toMatch(/^\d+ min$/);

    initMenuPage(root(), restaurant, window.localStorage);
    expect(span.textContent).toBe(first);

    span.remove();
  });

  it('does nothing when the page has no restaurant-eta span (e.g. a bare test root)', () => {
    expect(() => initMenuPage(root(), restaurant, window.localStorage)).not.toThrow();
  });
});

describe('the menu’s cart summary counts only this restaurant’s cart', () => {
  it('ignores another restaurant’s lines and links to this restaurant’s own cart', () => {
    const other = restaurantsForCity('sf')[1];
    const otherItem = other.menu[0].items[0];
    addToCart(window.localStorage, {
      itemId: otherItem.id,
      restaurantSlug: other.slug,
      restaurantName: other.name,
      name: otherItem.name,
      amountMinor: otherItem.amountMinor,
      currency: 'USD',
    });

    const el = root();
    initMenuPage(el, restaurant, window.localStorage);
    expect(el.querySelector('[data-testid="cart-summary"]')).toBeNull();

    el.querySelector<HTMLButtonElement>(`[data-testid="add-${firstItem.id}"]`)?.click();

    const summary = el.querySelector<HTMLAnchorElement>('[data-testid="cart-summary"]');
    expect(summary?.querySelector('.summary-text')?.textContent).toBe(`1 item — ${formatMoney(firstItem.amountMinor, 'USD')}`);
    expect(summary?.querySelector('.view-cart')?.textContent).toBe('View cart');
    expect(summary?.getAttribute('href')).toBe(`/cart/?restaurant=${restaurant.slug}`);
  });
});
