// The single seam "reaching Delivered" goes through (#121, parent #117,
// AC5) — checked against the stored order's own `deliveryMs`
// (order-store.ts), so it needs nothing the tracker page itself has: calling
// this is what makes reaching Delivered detectable even if the tracker was
// never open at the moment it happened, the same way `isDelivered`
// (tracker-state.ts) is a pure function of the stored order rather than of
// anything the tracker page keeps in memory.
//
// A future server-side job would consume it the same way: once orders are
// persisted somewhere a scheduled function can read (rather than only this
// browser's storage), that job reads every order past its own delivery time
// and calls this same check-mark-and-fire shape per order — the
// `deliveredEventFired` guard is what stops it (or this client, reading the
// same order twice) from sending the email, or firing `order_delivered`,
// more than once. No email or server code is added by this issue.

import { getOrder, markOrderDelivered, minutesSinceOrder } from './order-store';
import { isDelivered } from './tracker-state';
import { track } from './tracking';

/**
 * Checks the stored order against `now`, marking and firing `order_delivered`
 * exactly once (guarded by `deliveredEventFired`) the first time this or any
 * other caller observes it past its own delivery time. Returns whether the
 * order is delivered right now — `false` with no stored order.
 */
export function checkDelivery(storage: Storage, now: number = Date.now()): boolean {
  const order = getOrder(storage);
  if (!order) return false;

  const delivered = isDelivered(order, now);
  if (delivered && !order.deliveredEventFired) {
    markOrderDelivered(storage);
    track('order_delivered', { order_id: order.orderId, minutes_since_order: minutesSinceOrder(order, now) });
  }
  return delivered;
}
