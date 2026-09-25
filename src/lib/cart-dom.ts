// Cart screen (docs/design/65-parody-flow.md, screen 4): populated (line
// items, subtotal, Checkout CTA) or empty ("Nothing here yet." plus a CTA
// back to Restaurants — reachable either by never adding anything or by
// removing the last item, so it's an explicit state rather than an edge case).

import { cartItemCount, cartSubtotalCents, getCart, removeFromCart, setItemQuantity } from './order-store';
import { initCartBadge } from './header-dom';
import { track } from './tracking';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function renderCart(root: HTMLElement, storage: Storage): void {
  root.innerHTML = '';
  const lines = getCart(storage);

  if (lines.length === 0) {
    const empty = document.createElement('div');
    empty.setAttribute('data-testid', 'cart-empty');

    const message = document.createElement('p');
    message.textContent = 'Nothing here yet.';

    const link = document.createElement('a');
    link.href = '/restaurants/';
    link.className = 'add-button';
    link.textContent = 'Browse restaurants';

    empty.append(message, link);
    root.append(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'cart-list';
  list.setAttribute('data-testid', 'cart-list');

  for (const line of lines) {
    const row = document.createElement('li');
    row.className = 'cart-line';
    row.setAttribute('data-testid', `cart-line-${line.itemId}`);

    const name = document.createElement('span');
    name.className = 'cart-line-name';
    name.textContent = `${line.name} (${line.restaurantName})`;

    const stepper = document.createElement('div');
    stepper.className = 'quantity-stepper';

    const minus = document.createElement('button');
    minus.type = 'button';
    minus.setAttribute('data-testid', `decrement-${line.itemId}`);
    minus.setAttribute('aria-label', `Remove one ${line.name}`);
    minus.textContent = '−';
    minus.addEventListener('click', () => {
      setItemQuantity(storage, line.itemId, line.quantity - 1);
      renderCart(root, storage);
      initCartBadge(document, storage);
    });

    const count = document.createElement('span');
    count.className = 'quantity-count';
    count.setAttribute('data-testid', `quantity-${line.itemId}`);
    count.textContent = String(line.quantity);

    const plus = document.createElement('button');
    plus.type = 'button';
    plus.setAttribute('data-testid', `increment-${line.itemId}`);
    plus.setAttribute('aria-label', `Add one more ${line.name}`);
    plus.textContent = '+';
    plus.addEventListener('click', () => {
      setItemQuantity(storage, line.itemId, line.quantity + 1);
      renderCart(root, storage);
      initCartBadge(document, storage);
    });

    stepper.append(minus, count, plus);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-button';
    remove.setAttribute('data-testid', `remove-${line.itemId}`);
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      removeFromCart(storage, line.itemId);
      renderCart(root, storage);
      initCartBadge(document, storage);
    });

    const lineTotal = document.createElement('span');
    lineTotal.className = 'cart-line-total';
    lineTotal.textContent = formatCents(line.priceCents * line.quantity);

    row.append(name, stepper, remove, lineTotal);
    list.append(row);
  }

  const subtotal = document.createElement('p');
  subtotal.className = 'cart-subtotal';
  subtotal.setAttribute('data-testid', 'cart-subtotal');
  subtotal.textContent = `Subtotal: ${formatCents(cartSubtotalCents(lines))}`;

  const checkoutLink = document.createElement('a');
  checkoutLink.href = '/checkout/';
  checkoutLink.className = 'place-order';
  checkoutLink.setAttribute('data-testid', 'go-to-checkout');
  checkoutLink.textContent = 'Checkout';

  root.append(list, subtotal, checkoutLink);
}

export function initCartPage(root: HTMLElement, storage: Storage = window.localStorage): void {
  renderCart(root, storage);
  const lines = getCart(storage);
  track('cart_viewed', { item_count: cartItemCount(lines), subtotal_cents: cartSubtotalCents(lines) });
}
