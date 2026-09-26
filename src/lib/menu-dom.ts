// Restaurant screen (docs/design/80-two-city-brand-and-flow.md, screen 3): a
// menu rendered in named sections, each item showing a thumbnail photo,
// name, one-line description, and price in the restaurant's own city
// currency. "Add" becomes a quantity stepper once tapped, exactly as before.

import type { Restaurant } from './restaurants';
import { currencyForRestaurant } from './restaurants';
import { addToCart, cartItemCount, cartSubtotalMinor, getCart, setItemQuantity } from './order-store';
import { formatMoney } from './money';
import { initCartBadge } from './header-dom';
import { track } from './tracking';

export function renderMenu(root: HTMLElement, storage: Storage, restaurant: Restaurant): void {
  root.innerHTML = '';

  const cart = getCart(storage);
  const quantityByItem = new Map(cart.map((line) => [line.itemId, line.quantity]));
  const currency = currencyForRestaurant(restaurant);

  for (const section of restaurant.menu) {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'menu-section';
    sectionEl.setAttribute('data-testid', `menu-section-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);

    const heading = document.createElement('h2');
    heading.textContent = section.title;
    sectionEl.append(heading);

    const list = document.createElement('ul');
    list.className = 'menu-list';
    list.setAttribute('data-testid', `menu-list-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);

    for (const item of section.items) {
      const quantity = quantityByItem.get(item.id) ?? 0;

      const row = document.createElement('li');
      row.className = 'menu-item-row';
      row.setAttribute('data-testid', `menu-item-${item.id}`);

      const img = document.createElement('img');
      img.className = 'menu-item-photo';
      img.src = item.image;
      img.alt = '';
      img.loading = 'lazy';
      img.width = 64;
      img.height = 64;

      const textWrap = document.createElement('div');
      textWrap.className = 'menu-item-text';

      const name = document.createElement('span');
      name.className = 'menu-item-name';
      name.textContent = item.name;

      const description = document.createElement('span');
      description.className = 'menu-item-description';
      description.textContent = item.description;

      const price = document.createElement('span');
      price.className = 'menu-item-price';
      price.textContent = formatMoney(item.amountMinor, currency);

      textWrap.append(name, description, price);
      row.append(img, textWrap);

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
            amountMinor: item.amountMinor,
            currency,
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
            amountMinor: item.amountMinor,
            currency,
          });
          renderMenu(root, storage, restaurant);
          initCartBadge(document, storage);
        });
        row.append(add);
      }

      list.append(row);
    }

    sectionEl.append(list);
    root.append(sectionEl);
  }

  const wholeCart = getCart(storage);
  const itemCount = cartItemCount(wholeCart);
  if (itemCount > 0) {
    const summary = document.createElement('a');
    summary.href = '/cart/';
    summary.className = 'cart-summary';
    summary.setAttribute('data-testid', 'cart-summary');
    summary.textContent = `${itemCount} item${itemCount === 1 ? '' : 's'} — ${formatMoney(cartSubtotalMinor(wholeCart), currency)}`;
    root.append(summary);
  }
}

export function initMenuPage(root: HTMLElement, restaurant: Restaurant, storage: Storage = window.localStorage): void {
  renderMenu(root, storage, restaurant);
  track('restaurant_opened', { city: restaurant.city, restaurant_slug: restaurant.slug });
}
