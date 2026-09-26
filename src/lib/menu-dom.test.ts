import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initMenuPage } from './menu-dom';
import { getCart } from './order-store';
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
