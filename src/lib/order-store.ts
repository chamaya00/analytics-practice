// Cart and placed-order persistence — docs/design/65-parody-flow.md, "State
// & persistence": the current order (cart, and once placed, the order and
// its timestamp) lives in one keyed record per concern in the visitor's own
// browser storage, cleared only by an explicit "start over" action (never a
// refresh), the same pattern ADR 0004 established for the swipe poll.

import type { DeliveryInstructions, DropOffPreset } from './tracking';
import type { Currency } from './money';
import { SERVICE_FEE_MINOR } from './money';

export const VISITOR_ID_KEY = 'parody.visitorId';
export const SESSION_ID_KEY = 'parody.sessionId';
export const CART_KEY = 'parody.cart';
export const ORDER_KEY = 'parody.order';

export interface CartLine {
  itemId: string;
  restaurantSlug: string;
  restaurantName: string;
  name: string;
  /** The item's `amountMinor` (restaurants.ts) as committed to cart/checkout — cents for a USD item, whole đồng for a VND one, per its own `currency`. */
  amountMinor: number;
  currency: Currency;
  quantity: number;
}

export interface PlacedOrder {
  orderId: string;
  placedAt: string;
  items: CartLine[];
  itemCount: number;
  /** The subtotal — §2's `amount_minor`, not the total the breakdown shows. */
  amountMinor: number;
  currency: Currency;
  dropOffPreset: DropOffPreset;
  deliveryInstructions: DeliveryInstructions;
  utensils: boolean;
  /** 0–2 catalogue voucher ids (contract §7) — always `[]` for an order this child places; #89's to populate. */
  appliedVoucherIds: string[];
  /** 0 iff `appliedVoucherIds` is `[]` (contract §7's invariant, #89's to prove) — always 0 here. */
  savedAmountMinor: number;
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

export function cartSubtotalMinor(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.amountMinor * line.quantity, 0);
}

/** The cart's own currency — every line shares one (one city's catalogue at a time). `null` for an empty cart, since there's nothing to infer it from. */
export function cartCurrency(lines: CartLine[]): Currency | null {
  return lines[0]?.currency ?? null;
}

export interface CheckoutBreakdown {
  subtotalMinor: number;
  deliveryFeeMinor: number;
  serviceFeeMinor: number;
  totalMinor: number;
  currency: Currency;
}

/**
 * The checkout price breakdown (#80's "Price breakdown": Subtotal, Delivery
 * fee, Service fee, Total — no Offers/Discount/"You saved" line yet, #89's to
 * add). `null` for an empty cart, so the caller renders #80's empty state
 * rather than a $0 breakdown.
 */
export function computeCheckoutBreakdown(lines: CartLine[], deliveryFeeMinor: number): CheckoutBreakdown | null {
  if (lines.length === 0) return null;
  const currency = lines[0].currency;
  const subtotalMinor = cartSubtotalMinor(lines);
  const serviceFeeMinor = SERVICE_FEE_MINOR[currency];
  return {
    subtotalMinor,
    deliveryFeeMinor,
    serviceFeeMinor,
    totalMinor: subtotalMinor + deliveryFeeMinor + serviceFeeMinor,
    currency,
  };
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
  dropOffPreset: DropOffPreset;
  deliveryInstructions: DeliveryInstructions;
  utensils: boolean;
  /** 0–2 catalogue voucher ids — omitted (defaults to `[]`) by this issue's checkout, which has no Offers control yet; #89's to pass real values. */
  appliedVoucherIds?: string[];
  /** Defaults to 0 — must be 0 whenever `appliedVoucherIds` is `[]` (contract §7's invariant). */
  savedAmountMinor?: number;
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
    amountMinor: cartSubtotalMinor(items),
    currency: cartCurrency(items) ?? 'USD',
    dropOffPreset: fields.dropOffPreset,
    deliveryInstructions: fields.deliveryInstructions,
    utensils: fields.utensils,
    appliedVoucherIds: fields.appliedVoucherIds ?? [],
    savedAmountMinor: fields.savedAmountMinor ?? 0,
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
