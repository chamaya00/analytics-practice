// Landing screen (docs/design/65-parody-flow.md, screen 1): a static hero
// plus one client-only element — the order-in-progress banner, a presence/
// absence check against stored order, not a fetch.

import { getOrder } from './order-store';
import { track } from './tracking';

export function renderLandingBanner(root: HTMLElement, storage: Storage): void {
  root.innerHTML = '';
  const order = getOrder(storage);
  if (!order) return;

  const banner = document.createElement('a');
  banner.href = '/tracker/';
  banner.className = 'order-banner';
  banner.setAttribute('data-testid', 'order-banner');
  banner.textContent = 'Your order is still out there →';
  root.append(banner);
}

export function initLandingPage(root: HTMLElement, storage: Storage = window.localStorage): void {
  const hasActiveOrder = getOrder(storage) !== null;
  renderLandingBanner(root, storage);
  track('landing_viewed', { has_active_order: hasActiveOrder });
}
