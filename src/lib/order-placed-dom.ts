// Order-placed screen (docs/design/65-parody-flow.md, screen 6): a
// confirmation, not a toast, rendered only once an order exists to confirm
// — AC9: with no stored order (direct navigation, back/forward after a
// "start over"), this screen redirects to /restaurants instead of rendering
// an empty confirmation.

import { getLatestOrder } from './order-store';
import { formatMoney } from './money';
import { getRestaurant } from './restaurants';
import { createVehicleIcon } from './vehicle-icon';

export interface OrderPlacedView {
  redirectedToRestaurants: boolean;
}

// 105-order-placed.html's own checkmark, in a filled circular badge —
// replacing the earlier droplet mark, which sat outside any centered wrapper.
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 13l4 4 10-10" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function renderOrderPlaced(
  root: HTMLElement,
  storage: Storage,
  navigate: (path: string) => void = (path) => {
    window.location.href = path;
  },
): OrderPlacedView {
  root.innerHTML = '';

  const order = getLatestOrder(storage);
  if (!order) {
    navigate('/restaurants/');
    return { redirectedToRestaurants: true };
  }

  const wrap = document.createElement('div');
  wrap.className = 'order-placed-wrap';

  const badge = document.createElement('div');
  badge.className = 'order-placed-badge';
  badge.setAttribute('data-testid', 'order-placed-mark');
  badge.setAttribute('aria-hidden', 'true');
  badge.innerHTML = CHECK_ICON;

  const heading = document.createElement('h1');
  heading.textContent = 'Order placed';

  const restaurantNames = [...new Set(order.items.map((line) => line.restaurantName))].join(', ');
  const summary = document.createElement('p');
  summary.setAttribute('data-testid', 'order-placed-summary');
  summary.textContent = `${order.itemCount} item${order.itemCount === 1 ? '' : 's'} from ${restaurantNames}, ${formatMoney(order.amountMinor, order.currency)}.`;

  // The same estimate stored on the order at placeOrder (order-store.ts) —
  // not re-derived, so it can never drift from what checkout showed (AC2).
  const eta = document.createElement('p');
  eta.setAttribute('data-testid', 'order-placed-eta');
  // The order's own restaurant's city, not the current city picker (#130 AC5)
  // — a visitor who switches cities after ordering still sees this order's
  // own vehicle.
  const orderRestaurant = getRestaurant(order.items[0]?.restaurantSlug ?? '');
  if (orderRestaurant) eta.append(createVehicleIcon(orderRestaurant.city));
  eta.append(`Arrives in about ${order.etaMinutes} min`);

  const trackLink = document.createElement('a');
  // #147 "Order stack rules": arriving from here opens the order just
  // placed, not whichever order the tracker would default to on its own —
  // tracker-dom.ts reads this hash once, on load.
  trackLink.href = `/tracker/#order-${order.orderId}`;
  trackLink.className = 'order-placed-cta';
  trackLink.setAttribute('data-testid', 'track-order');
  trackLink.textContent = 'Track your order';

  wrap.append(badge, heading, summary, eta, trackLink);
  root.append(wrap);
  return { redirectedToRestaurants: false };
}

export function initOrderPlacedPage(
  root: HTMLElement,
  storage: Storage = window.localStorage,
  navigate: (path: string) => void = (path) => {
    window.location.href = path;
  },
): void {
  renderOrderPlaced(root, storage, navigate);
}
