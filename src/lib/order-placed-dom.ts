// Order-placed screen (docs/design/65-parody-flow.md, screen 6): a
// confirmation, not a toast, rendered only once an order exists to confirm
// — AC9: with no stored order (direct navigation, back/forward after a
// "start over"), this screen redirects to /restaurants instead of rendering
// an empty confirmation.

import { getOrder } from './order-store';

export interface OrderPlacedView {
  redirectedToRestaurants: boolean;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function renderOrderPlaced(
  root: HTMLElement,
  storage: Storage,
  navigate: (path: string) => void = (path) => {
    window.location.href = path;
  },
): OrderPlacedView {
  root.innerHTML = '';

  const order = getOrder(storage);
  if (!order) {
    navigate('/restaurants/');
    return { redirectedToRestaurants: true };
  }

  const mark = document.createElement('p');
  mark.className = 'order-placed-mark';
  mark.setAttribute('data-testid', 'order-placed-mark');
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML =
    '<svg width="28" height="42" viewBox="0 0 16 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 8C4 13 3 17 3 19C3 21.5 5.5 23 8 23C10.5 23 13 21.5 13 19C13 17 12 13 8 8Z" fill="currentColor" stroke="none"/></svg>';

  const restaurantNames = [...new Set(order.items.map((line) => line.restaurantName))].join(', ');
  const summary = document.createElement('p');
  summary.setAttribute('data-testid', 'order-placed-summary');
  summary.textContent = `${order.itemCount} item${order.itemCount === 1 ? '' : 's'} from ${restaurantNames}, ${formatCents(order.subtotalCents)}.`;

  const trackLink = document.createElement('a');
  trackLink.href = '/tracker/';
  trackLink.className = 'place-order';
  trackLink.setAttribute('data-testid', 'track-order');
  trackLink.textContent = 'Track your order';

  root.append(mark, summary, trackLink);
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
