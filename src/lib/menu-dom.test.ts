import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initMenuPage } from './menu-dom';
import { getCart } from './order-store';
import { RESTAURANTS } from './restaurants';
import { resetTrack, setTrack } from './tracking';

const restaurant = RESTAURANTS[0];

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

describe('initMenuPage (AC1, AC3)', () => {
  it('fires restaurant_opened with this restaurant’s slug on load', () => {
    const stub = vi.fn();
    setTrack(stub);

    initMenuPage(root(), restaurant, window.localStorage);

    expect(stub).toHaveBeenCalledWith('restaurant_opened', { restaurant_slug: restaurant.slug });
  });

  it('every menu item starts with an Add button, not a stepper', () => {
    const el = root();
    initMenuPage(el, restaurant, window.localStorage);
    for (const item of restaurant.menu) {
      expect(el.querySelector(`[data-testid="add-${item.id}"]`)).not.toBeNull();
    }
  });

  it('tapping Add switches that row to a quantity stepper and adds the item to the stored cart', () => {
    const el = root();
    initMenuPage(el, restaurant, window.localStorage);
    const item = restaurant.menu[0];

    el.querySelector<HTMLButtonElement>(`[data-testid="add-${item.id}"]`)?.click();

    expect(el.querySelector(`[data-testid="add-${item.id}"]`)).toBeNull();
    expect(el.querySelector(`[data-testid="quantity-${item.id}"]`)?.textContent).toBe('1');
    expect(getCart(window.localStorage)).toHaveLength(1);
  });

  it('tapping + increments quantity; tapping − back to zero returns the row to an Add button', () => {
    const el = root();
    initMenuPage(el, restaurant, window.localStorage);
    const item = restaurant.menu[0];

    el.querySelector<HTMLButtonElement>(`[data-testid="add-${item.id}"]`)?.click();
    el.querySelector<HTMLButtonElement>(`[data-testid="increment-${item.id}"]`)?.click();
    expect(el.querySelector(`[data-testid="quantity-${item.id}"]`)?.textContent).toBe('2');

    el.querySelector<HTMLButtonElement>(`[data-testid="decrement-${item.id}"]`)?.click();
    el.querySelector<HTMLButtonElement>(`[data-testid="decrement-${item.id}"]`)?.click();
    expect(el.querySelector(`[data-testid="add-${item.id}"]`)).not.toBeNull();
  });
});
