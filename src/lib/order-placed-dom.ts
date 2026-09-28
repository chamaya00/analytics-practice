// Order-placed screen (docs/design/65-parody-flow.md, screen 6): a
// confirmation, not a toast, rendered only once an order exists to confirm
// — AC9: with no stored order (direct navigation, back/forward after a
// "start over"), this screen redirects to /restaurants instead of rendering
// an empty confirmation.

import { getLatestOrder } from './order-store';
import { formatMoney } from './money';
import { getRestaurant } from './restaurants';
import { createVehicleIcon } from './vehicle-icon';
import { loadConfettiCannon } from './confetti-loader';

export interface OrderPlacedView {
  redirectedToRestaurants: boolean;
}

// 105-order-placed.html's own checkmark, in a filled circular badge —
// replacing the earlier droplet mark, which sat outside any centered wrapper.
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 13l4 4 10-10" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// #213: which order's badge has already burst, so a reload or back/forward
// onto the same order shows the static page rather than replaying it — the
// same "once per order" shape as tracker-dom.ts's own
// `deliveredHeroResolved`, kept here as a plain stored id since this page
// renders once and never loops the way the tracker's does.
const ORDER_PLACED_CELEBRATED_KEY = 'parody.orderPlacedCelebrated';

/** #163's own reduced-motion check — the same `matchMedia` guard
 * rating-sheet-dom.ts and tracker-dom.ts each already use, kept local rather
 * than shared since neither of those imports this module or vice versa. */
function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** One burst from the badge's own position (never the library's default
 * full-page canvas or a fixed centre origin), loaded through the same
 * shared loader tracker-dom.ts's Delivered burst and rating-sheet-dom.ts's
 * win burst already use (#189 AC4) — so the module is fetched at most once
 * per page load however many bursts actually play. Never reached at all
 * under reduced motion (no dynamic import), and never replayed for an order
 * already recorded as celebrated. A failed import is swallowed: the
 * confirmation itself has already rendered without it. */
function celebrateOrder(storage: Storage, orderId: string, badge: HTMLElement): void {
  if (prefersReducedMotion()) return;
  if (storage.getItem(ORDER_PLACED_CELEBRATED_KEY) === orderId) return;
  storage.setItem(ORDER_PLACED_CELEBRATED_KEY, orderId);

  loadConfettiCannon()
    .then((cannon) => {
      if (!badge.isConnected) return;
      const rect = badge.getBoundingClientRect();
      cannon({
        particleCount: 40,
        spread: 70,
        startVelocity: 30,
        ticks: 120,
        origin: {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        },
      });
    })
    .catch(() => {});
}

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
    // `/` rather than `/restaurants/`: this static site has no restaurants
    // index page, so that path was a 404 (soft-launch readiness QA).
    navigate('/');
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
  // The total checkout charged (`totalMinor`: subtotal + fees - discounts),
  // not `amountMinor`, which is the subtotal - showing that here disagreed
  // with checkout and the tracker. An order stored before `totalMinor`
  // existed has it null, and falls back to the subtotal it always showed.
  summary.textContent = `${order.itemCount} item${order.itemCount === 1 ? '' : 's'} from ${restaurantNames}, ${formatMoney(order.totalMinor ?? order.amountMinor, order.currency)}.`;

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

  celebrateOrder(storage, order.orderId, badge);

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
