// Cart screen (docs/design/80-two-city-brand-and-flow.md, "Cart"). Every
// restaurant is its own cart (order-store.ts's `selectRestaurantCart`), so
// this screen shows one of three things:
//
// - empty: "Nothing in your cart yet." plus a CTA back to the home feed —
//   reachable either by never adding anything or by removing the last item,
//   so it's an explicit state rather than an edge case;
// - one restaurant's cart (the only one, or the one `?restaurant=` names):
//   its line items, subtotal, that restaurant's own delivery-fee preview and
//   "Go to checkout" for that restaurant alone;
// - "Your carts": one card per restaurant when there are several and none
//   was named, since they can't share a checkout (each has its own delivery
//   fee, vouchers and — across cities — currency).

import {
  cartSubtotalMinor,
  getCart,
  removeFromCart,
  selectRestaurantCart,
  setItemQuantity,
  type CartSelection,
  type RestaurantCart,
} from './order-store';
import { getMenuItem, getRestaurant } from './restaurants';
import { formatMoney, currencyForCity } from './money';
import { getStoredCity } from './location';
import { initCartBadge } from './header-dom';
import { track } from './tracking';
import { ALL_CARTS_PATH, cartPath, checkoutPath, restaurantSlugFromSearch } from './cart-routes';
import { attachSwipeRow } from './swipe-row';
import { openConfirmDialog } from './confirm-dialog-dom';

// 105-cart-single-sf.html's own icon: "Remove" reads from this plus its bold
// weight, not the danger fill alone.
const TRASH_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const CHEVRON_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 5 16 12 9 19" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function heading(text: string): HTMLElement {
  const h1 = document.createElement('h1');
  h1.setAttribute('data-testid', 'cart-heading');
  h1.tabIndex = -1;
  h1.textContent = text;
  return h1;
}

/** After a line is removed its controls are gone, so focus lands on the page heading rather than falling back to <body>. */
function focusHeading(root: HTMLElement): void {
  root.querySelector<HTMLElement>('[data-testid="cart-heading"]')?.focus();
}

function itemCountLabel(count: number): string {
  return `${count} item${count === 1 ? '' : 's'}`;
}

function renderEmpty(root: HTMLElement): void {
  const empty = document.createElement('div');
  empty.setAttribute('data-testid', 'cart-empty');

  const message = document.createElement('p');
  message.textContent = 'Nothing in your cart yet.';

  const link = document.createElement('a');
  link.href = '/';
  link.className = 'add-button';
  link.textContent = 'Browse restaurants';

  empty.append(message, link);
  root.append(heading('Cart'), empty);
}

function renderCartList(root: HTMLElement, carts: RestaurantCart[]): void {
  const note = document.createElement('p');
  note.className = 'cart-list-note';
  note.textContent = 'Each restaurant is its own order, checked out separately.';

  const list = document.createElement('ul');
  list.className = 'cart-cards';
  list.setAttribute('data-testid', 'cart-cards');

  for (const cart of carts) {
    const item = document.createElement('li');

    const card = document.createElement('a');
    card.className = 'restaurant-card cart-card';
    card.href = cartPath(cart.restaurantSlug);
    card.setAttribute('data-testid', `cart-card-${cart.restaurantSlug}`);

    const restaurant = getRestaurant(cart.restaurantSlug);
    if (restaurant) {
      const img = document.createElement('img');
      img.className = 'restaurant-card-photo cart-card-photo';
      img.src = restaurant.heroImage;
      img.alt = '';
      img.loading = 'lazy';
      img.width = 56;
      img.height = 56;
      card.append(img);
    }

    const body = document.createElement('div');
    body.className = 'restaurant-card-body';

    const name = document.createElement('span');
    name.className = 'restaurant-card-name';
    name.textContent = cart.restaurantName;

    const count = document.createElement('span');
    count.className = 'restaurant-card-meta';
    count.setAttribute('data-testid', `cart-card-count-${cart.restaurantSlug}`);
    count.textContent = itemCountLabel(cart.itemCount);

    body.append(name, count);

    const subtotal = document.createElement('span');
    subtotal.className = 'cart-card-subtotal';
    subtotal.setAttribute('data-testid', `cart-card-subtotal-${cart.restaurantSlug}`);
    subtotal.textContent = formatMoney(cart.subtotalMinor, cart.currency);

    const chevron = document.createElement('span');
    chevron.className = 'cart-card-chevron';
    chevron.innerHTML = CHEVRON_ICON;

    card.append(body, subtotal, chevron);
    item.append(card);
    list.append(item);
  }

  root.append(heading('Your carts'), note, list);
}

function renderRestaurantCart(
  root: HTMLElement,
  storage: Storage,
  cart: RestaurantCart,
  hasOtherCarts: boolean,
  rerender: () => void,
): void {
  const { restaurantSlug, currency, lines } = cart;

  const topBar = document.createElement('div');
  topBar.className = 'top-bar';
  if (hasOtherCarts) {
    const back = document.createElement('a');
    back.className = 'back';
    back.href = ALL_CARTS_PATH;
    back.setAttribute('aria-label', 'All carts');
    back.setAttribute('data-testid', 'cart-back');
    back.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 5 8 12l7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    topBar.append(back);
  }
  topBar.append(heading(cart.restaurantName));

  const list = document.createElement('ul');
  list.className = 'cart-list';
  list.setAttribute('data-testid', 'cart-list');

  for (const line of lines) {
    // The row is two layers: the Remove action at the trailing edge, and
    // the line's own content on top of it, which a left swipe slides aside
    // (swipe-row.ts). The stepper's minus at quantity 1 is the other way to
    // remove a line, and asks first.
    const row = document.createElement('li');
    row.className = 'cart-row';
    row.setAttribute('data-testid', `cart-line-${line.itemId}`);

    const content = document.createElement('div');
    content.className = 'cart-line';
    content.setAttribute('data-testid', `cart-line-content-${line.itemId}`);

    // Same photo-tile treatment as the menu row this line was added from
    // (105-cart-single-sf.html) — looked up from the catalogue by itemId,
    // since a CartLine itself carries no image (a presentation lookup, not
    // a cart-shape change).
    const itemImage = getMenuItem(line.itemId)?.item.image;
    if (itemImage) {
      const photo = document.createElement('img');
      photo.className = 'menu-item-photo';
      photo.src = itemImage;
      photo.alt = '';
      photo.loading = 'lazy';
      photo.width = 84;
      photo.height = 84;
      content.append(photo);
    }

    const text = document.createElement('div');
    text.className = 'cart-line-text';

    const name = document.createElement('span');
    name.className = 'cart-line-name';
    name.setAttribute('data-testid', `cart-line-name-${line.itemId}`);
    name.textContent = line.name;

    const lineTotal = document.createElement('span');
    lineTotal.className = 'cart-line-total';
    lineTotal.textContent = formatMoney(line.amountMinor * line.quantity, line.currency);

    const stepper = document.createElement('div');
    stepper.className = 'quantity-stepper';

    const minus = document.createElement('button');
    minus.type = 'button';
    minus.setAttribute('data-testid', `decrement-${line.itemId}`);
    minus.setAttribute('aria-label', line.quantity === 1 ? `Remove ${line.name}` : `Remove one ${line.name}`);
    minus.textContent = '−';
    minus.addEventListener('click', () => {
      if (line.quantity > 1) {
        setItemQuantity(storage, line.itemId, line.quantity - 1);
        rerender();
        return;
      }
      openConfirmDialog({
        title: `Remove ${line.name}?`,
        body: `It'll be taken out of your ${cart.restaurantName} cart.`,
        confirmLabel: 'Remove',
        returnFocusTo: minus,
        onConfirm: () => {
          removeFromCart(storage, line.itemId);
          rerender();
          focusHeading(root);
        },
      });
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
      rerender();
    });

    stepper.append(minus, count, plus);
    // 105-cart-single-sf.html's own column: name, then the stepper, then the
    // line price, stacked beside the photo tile — not the stepper trailing
    // the row on its own.
    text.append(name, stepper, lineTotal);
    content.append(text);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'swipe-action';
    remove.setAttribute('data-testid', `swipe-remove-${line.itemId}`);
    remove.setAttribute('aria-label', `Remove ${line.name}`);
    remove.innerHTML = TRASH_ICON;
    remove.append(document.createTextNode('Remove'));
    remove.addEventListener('click', () => {
      removeFromCart(storage, line.itemId);
      rerender();
      focusHeading(root);
    });

    row.append(remove, content);
    attachSwipeRow(row, content, remove);
    list.append(row);
  }

  // #80's cart preview: subtotal, this restaurant's own delivery fee, and
  // one note pointing at checkout for the rest — never the full breakdown
  // twice. 105-cart-single-sf.html renders these as label/value rows, the
  // same .breakdown-row shape as Checkout's own breakdown, not bold text
  // lines.
  const breakdown = document.createElement('div');
  breakdown.className = 'cart-breakdown';

  function breakdownRow(testId: string, label: string, amountMinor: number): HTMLElement {
    const el = document.createElement('div');
    el.className = 'breakdown-row';
    el.setAttribute('data-testid', testId);
    const labelEl = document.createElement('span');
    labelEl.className = 'muted';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.textContent = formatMoney(amountMinor, currency);
    el.append(labelEl, valueEl);
    return el;
  }

  const deliveryFeeMinor = getRestaurant(restaurantSlug)?.deliveryFeeMinor ?? 0;
  const subtotal = breakdownRow('cart-subtotal', 'Subtotal', cartSubtotalMinor(lines));
  const deliveryPreview = breakdownRow('cart-delivery-preview', 'Delivery fee', deliveryFeeMinor);

  const feeNote = document.createElement('p');
  feeNote.className = 'cart-fee-note';
  feeNote.textContent = '+ service fee and any discount at checkout';

  breakdown.append(subtotal, deliveryPreview, feeNote);

  const checkoutLink = document.createElement('a');
  checkoutLink.href = checkoutPath(restaurantSlug);
  checkoutLink.className = 'place-order';
  checkoutLink.setAttribute('data-testid', 'go-to-checkout');
  checkoutLink.textContent = 'Go to checkout';

  root.append(topBar, list, breakdown, checkoutLink);
}

/**
 * Renders whichever cart view the stored cart and `requestedSlug` resolve
 * to, and returns that resolution so the caller can decide what to track.
 * A change made on this screen re-renders with the same `requestedSlug`,
 * so emptying the named restaurant's cart falls back to the list (or the
 * only cart left, or the empty state) rather than a blank page.
 */
export function renderCart(root: HTMLElement, storage: Storage, requestedSlug: string | null = null): CartSelection {
  root.innerHTML = '';
  const lines = getCart(storage);
  const selection = selectRestaurantCart(lines, requestedSlug);

  const rerender = (): void => {
    renderCart(root, storage, requestedSlug);
    initCartBadge(document, storage);
  };

  if (selection.kind === 'empty') renderEmpty(root);
  else if (selection.kind === 'several') renderCartList(root, selection.carts);
  else {
    const hasOtherCarts = lines.some((line) => line.restaurantSlug !== selection.cart.restaurantSlug);
    renderRestaurantCart(root, storage, selection.cart, hasOtherCarts, rerender);
  }
  return selection;
}

/**
 * `cart_viewed` fires once per page load, for the one cart the visitor is
 * looking at: the empty cart exactly as before, or a single restaurant's
 * cart with that cart's own item_count/amount_minor/currency. The "Your
 * carts" list fires nothing — it spans restaurants and, across cities,
 * currencies, so there is no one cart for the event to describe. Tapping a
 * card there loads `/cart/?restaurant=<slug>`, which fires it.
 */
export function initCartPage(
  root: HTMLElement,
  storage: Storage = window.localStorage,
  search: string = window.location.search,
): void {
  const selection = renderCart(root, storage, restaurantSlugFromSearch(search));
  if (selection.kind === 'several') return;
  if (selection.kind === 'empty') {
    // #219 contract §8: the empty state's city is the stored one, `sf` if none.
    const city = getStoredCity(storage) ?? 'sf';
    track('cart_viewed', { item_count: 0, amount_minor: 0, city, currency: currencyForCity(city) });
    return;
  }
  const { cart } = selection;
  track('cart_viewed', {
    item_count: cart.itemCount,
    amount_minor: cart.subtotalMinor,
    city: getRestaurant(cart.restaurantSlug)?.city ?? (cart.currency === 'VND' ? 'hcmc' : 'sf'),
    currency: cart.currency,
  });
}
