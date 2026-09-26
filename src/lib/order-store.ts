// Cart and placed-order persistence — docs/design/65-parody-flow.md, "State
// & persistence": the current order (cart, and once placed, the order and
// its timestamp) lives in one keyed record per concern in the visitor's own
// browser storage, cleared only by an explicit "start over" action (never a
// refresh), the same pattern ADR 0004 established for the swipe poll.

import type { DropOffSpot, HandlingInstructions, PromoCode, TipPercent } from './tracking';

export const VISITOR_ID_KEY = 'parody.visitorId';
export const SESSION_ID_KEY = 'parody.sessionId';
export const CART_KEY = 'parody.cart';
export const ORDER_KEY = 'parody.order';

export interface CartLine {
  itemId: string;
  restaurantSlug: string;
  restaurantName: string;
  name: string;
  /**
   * Despite the name, this is the item's `amountMinor` (restaurants.ts) as
   * committed to cart/checkout unchanged — cents for a USD item, whole đồng
   * for a VND one. Renaming this and PlacedOrder's `subtotalCents`, and
   * fixing cart/checkout's own display to format per currency, is #94's
   * (cart, checkout and vouchers are that issue's scope, not #82's).
   */
  priceCents: number;
  quantity: number;
}

export interface PlacedOrder {
  orderId: string;
  placedAt: string;
  items: CartLine[];
  itemCount: number;
  subtotalCents: number;
  dropOffSpot: DropOffSpot;
  handlingInstructions: HandlingInstructions;
  utensils: boolean;
  tipPercent: TipPercent;
  promoCode: PromoCode;
  /** The last `tracker_viewed.view_number` fired for this order — carried into `order_abandoned.view_count`. */
  viewCount: number;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback for a test environment without a full Web Crypto shim — still
  // matches the contract's uuid shape, never used by a real browser.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getVisitorId(storage: Storage): string {
  const existing = storage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;
  const id = generateId();
  storage.setItem(VISITOR_ID_KEY, id);
  return id;
}

export function getSessionId(storage: Storage): string {
  const existing = storage.getItem(SESSION_ID_KEY);
  if (existing) return existing;
  const id = generateId();
  storage.setItem(SESSION_ID_KEY, id);
  return id;
}

export function getCart(storage: Storage): CartLine[] {
  const raw = storage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

function setCart(storage: Storage, lines: CartLine[]): void {
  storage.setItem(CART_KEY, JSON.stringify(lines));
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function cartSubtotalCents(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.priceCents * line.quantity, 0);
}

/** Adds one unit of an item, or increments its quantity if already in the cart. */
export function addToCart(
  storage: Storage,
  line: Omit<CartLine, 'quantity'>,
): CartLine[] {
  const lines = getCart(storage);
  const existing = lines.find((candidate) => candidate.itemId === line.itemId);
  if (existing) {
    existing.quantity += 1;
  } else {
    lines.push({ ...line, quantity: 1 });
  }
  setCart(storage, lines);
  return lines;
}

export function setItemQuantity(storage: Storage, itemId: string, quantity: number): CartLine[] {
  const lines = getCart(storage);
  const next = quantity <= 0 ? lines.filter((line) => line.itemId !== itemId) : lines;
  if (quantity > 0) {
    const existing = next.find((line) => line.itemId === itemId);
    if (existing) existing.quantity = quantity;
  }
  setCart(storage, next);
  return next;
}

export function removeFromCart(storage: Storage, itemId: string): CartLine[] {
  return setItemQuantity(storage, itemId, 0);
}

export function clearCart(storage: Storage): void {
  storage.removeItem(CART_KEY);
}

export function getOrder(storage: Storage): PlacedOrder | null {
  const raw = storage.getItem(ORDER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlacedOrder;
  } catch {
    return null;
  }
}

function setOrder(storage: Storage, order: PlacedOrder): void {
  storage.setItem(ORDER_KEY, JSON.stringify(order));
}

export interface PlaceOrderFields {
  dropOffSpot: DropOffSpot;
  handlingInstructions: HandlingInstructions;
  utensils: boolean;
  tipPercent: TipPercent;
  promoCode: PromoCode;
}

/**
 * Writes the placed-order record from the current cart and clears the cart —
 * "the cart clears when an order is placed" (issue #67, AC9). Does not fire
 * any event; the caller fires `order_placed` once, guarded against a
 * double-tap (see checkout-dom.ts).
 */
export function placeOrder(storage: Storage, fields: PlaceOrderFields): PlacedOrder {
  const items = getCart(storage);
  const order: PlacedOrder = {
    orderId: generateId(),
    placedAt: new Date().toISOString(),
    items,
    itemCount: cartItemCount(items),
    subtotalCents: cartSubtotalCents(items),
    ...fields,
    viewCount: 0,
  };
  setOrder(storage, order);
  clearCart(storage);
  return order;
}

/** The "Start over" control on the tracker's given-up state (7d) — clears the stored order only, matching ADR 0004's explicit-action pattern. `visitor_id` is never cleared by it (docs/measurement/66-parody-event-contract.md §2). */
export function clearOrder(storage: Storage): void {
  storage.removeItem(ORDER_KEY);
}

/** Increments and persists the view count for the stored order, returning the new value — becomes both `tracker_viewed.view_number` and the `order_abandoned.view_count` carried later. */
export function recordTrackerView(storage: Storage): number {
  const order = getOrder(storage);
  if (!order) return 0;
  order.viewCount += 1;
  setOrder(storage, order);
  return order.viewCount;
}

export function minutesSinceOrder(order: PlacedOrder, now: number = Date.now()): number {
  return Math.max(0, (now - new Date(order.placedAt).getTime()) / 60000);
}
