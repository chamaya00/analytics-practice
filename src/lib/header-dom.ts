// Fills in the Cart tab's item-count badge from this browser's stored cart —
// Header.astro renders both badge slots empty and hidden at build time since
// cart contents are a client-only read (docs/design/65-parody-flow.md, Nav:
// "CartBadge — never renders at zero").

import { cartItemCount, getCart } from './order-store';

export function initCartBadge(root: ParentNode, storage: Storage = window.localStorage): void {
  const count = cartItemCount(getCart(storage));
  const badges = root.querySelectorAll<HTMLElement>('[data-testid="cart-badge"], [data-testid="cart-badge-phone"]');
  for (const badge of badges) {
    if (count > 0) {
      badge.textContent = String(count);
      badge.hidden = false;
    } else {
      badge.textContent = '';
      badge.hidden = true;
    }
  }
}
