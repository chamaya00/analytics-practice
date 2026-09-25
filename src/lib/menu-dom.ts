// Items screen (docs/design/65-parody-flow.md, screen 3): a menu row per
// item, "Add" becoming a quantity stepper once tapped, and a persistent
// cart summary. States: empty-cart-on-this-page (every row shows "Add") and
// items-added (added rows show the stepper, summary appears) — both derived
// from the stored cart on every render, never a separate counter.

import type { Restaurant } from './restaurants';
import { addToCart, cartItemCount, cartSubtotalCents, getCart, setItemQuantity } from './order-store';
import { initCartBadge } from './header-dom';
import { track } from './tracking';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function renderMenu(root: HTMLElement, storage: Storage, restaurant: Restaurant): void {
  root.innerHTML = '';

  const cart = getCart(storage);
  const quantityByItem = new Map(cart.map((line) => [line.itemId, line.quantity]));

  const list = document.createElement('ul');
  list.className = 'menu-list';
  list.setAttribute('data-testid', 'menu-list');

  for (const item of restaurant.menu) {
    const quantity = quantityByItem.get(item.id) ?? 0;

    const row = document.createElement('li');
    row.className = 'menu-item-row';
    row.setAttribute('data-testid', `menu-item-${item.id}`);

    const name = document.createElement('span');
    name.className = 'menu-item-name';
    name.textContent = item.name;

    const price = document.createElement('span');
    price.className = 'menu-item-price';
    price.textContent = formatCents(item.priceCents);

    row.append(name, price);

    if (quantity > 0) {
      const stepper = document.createElement('div');
      stepper.className = 'quantity-stepper';

      const minus = document.createElement('button');
      minus.type = 'button';
      minus.setAttribute('data-testid', `decrement-${item.id}`);
      minus.setAttribute('aria-label', `Remove one ${item.name}`);
      minus.textContent = '−';
      minus.addEventListener('click', () => {
        setItemQuantity(storage, item.id, quantity - 1);
        renderMenu(root, storage, restaurant);
        initCartBadge(document, storage);
      });

      const count = document.createElement('span');
      count.className = 'quantity-count';
      count.setAttribute('data-testid', `quantity-${item.id}`);
      count.textContent = String(quantity);

      const plus = document.createElement('button');
      plus.type = 'button';
      plus.setAttribute('data-testid', `increment-${item.id}`);
      plus.setAttribute('aria-label', `Add one more ${item.name}`);
      plus.textContent = '+';
      plus.addEventListener('click', () => {
        addToCart(storage, {
          itemId: item.id,
          restaurantSlug: restaurant.slug,
          restaurantName: restaurant.name,
          name: item.name,
          priceCents: item.priceCents,
        });
        renderMenu(root, storage, restaurant);
        initCartBadge(document, storage);
      });

      stepper.append(minus, count, plus);
      row.append(stepper);
    } else {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'add-button';
      add.setAttribute('data-testid', `add-${item.id}`);
      add.textContent = 'Add';
      add.addEventListener('click', () => {
        addToCart(storage, {
          itemId: item.id,
          restaurantSlug: restaurant.slug,
          restaurantName: restaurant.name,
          name: item.name,
          priceCents: item.priceCents,
        });
        renderMenu(root, storage, restaurant);
        initCartBadge(document, storage);
      });
      row.append(add);
    }

    list.append(row);
  }

  root.append(list);

  const wholeCart = getCart(storage);
  const itemCount = cartItemCount(wholeCart);
  if (itemCount > 0) {
    const summary = document.createElement('a');
    summary.href = '/cart/';
    summary.className = 'cart-summary';
    summary.setAttribute('data-testid', 'cart-summary');
    summary.textContent = `${itemCount} item${itemCount === 1 ? '' : 's'} — ${formatCents(cartSubtotalCents(wholeCart))}`;
    root.append(summary);
  }
}

export function initMenuPage(root: HTMLElement, restaurant: Restaurant, storage: Storage = window.localStorage): void {
  renderMenu(root, storage, restaurant);
  track('restaurant_opened', { restaurant_slug: restaurant.slug });
}
