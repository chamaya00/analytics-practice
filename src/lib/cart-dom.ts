// Cart screen (docs/design/80-two-city-brand-and-flow.md, "Cart"): populated
// (line items, subtotal, delivery-fee preview, "Go to checkout") or empty
// ("Nothing in your cart yet." plus a CTA back to the home feed — reachable
// either by never adding anything or by removing the last item, so it's an
// explicit state rather than an edge case).

import { cartItemCount, cartSubtotalMinor, getCart, removeFromCart, setItemQuantity } from './order-store';
import { getRestaurant } from './restaurants';
import { formatMoney, currencyForCity } from './money';
import { getStoredCity } from './location';
import { initCartBadge } from './header-dom';
import { track } from './tracking';

export function renderCart(root: HTMLElement, storage: Storage): void {
  root.innerHTML = '';
  const lines = getCart(storage);

  if (lines.length === 0) {
    const empty = document.createElement('div');
    empty.setAttribute('data-testid', 'cart-empty');

    const message = document.createElement('p');
    message.textContent = 'Nothing in your cart yet.';

    const link = document.createElement('a');
    link.href = '/';
    link.className = 'add-button';
    link.textContent = 'Browse restaurants';

    empty.append(message, link);
    root.append(empty);
    return;
  }

  const currency = lines[0].currency;

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
    lineTotal.textContent = formatMoney(line.amountMinor * line.quantity, line.currency);

    row.append(name, stepper, remove, lineTotal);
    list.append(row);
  }

  const subtotal = document.createElement('p');
  subtotal.className = 'cart-subtotal';
  subtotal.setAttribute('data-testid', 'cart-subtotal');
  subtotal.textContent = `Subtotal: ${formatMoney(cartSubtotalMinor(lines), currency)}`;

  // #80's cart preview: subtotal, delivery fee, and one note pointing at
  // checkout for the rest — never the full breakdown twice.
  const deliveryFeeMinor = getRestaurant(lines[0].restaurantSlug)?.deliveryFeeMinor ?? 0;
  const deliveryPreview = document.createElement('p');
  deliveryPreview.className = 'cart-delivery-preview';
  deliveryPreview.setAttribute('data-testid', 'cart-delivery-preview');
  deliveryPreview.textContent = `Delivery fee: ${formatMoney(deliveryFeeMinor, currency)}`;

  const feeNote = document.createElement('p');
  feeNote.className = 'cart-fee-note';
  feeNote.textContent = '+ service fee and any discount at checkout';

  const checkoutLink = document.createElement('a');
  checkoutLink.href = '/checkout/';
  checkoutLink.className = 'place-order';
  checkoutLink.setAttribute('data-testid', 'go-to-checkout');
  checkoutLink.textContent = 'Go to checkout';

  root.append(list, subtotal, deliveryPreview, feeNote, checkoutLink);
}

export function initCartPage(root: HTMLElement, storage: Storage = window.localStorage): void {
  renderCart(root, storage);
  const lines = getCart(storage);
  const currency = lines[0]?.currency ?? currencyForCity(getStoredCity(storage) ?? 'sf');
  track('cart_viewed', { item_count: cartItemCount(lines), amount_minor: cartSubtotalMinor(lines), currency });
}
