// Cart and placed-order persistence — docs/design/65-parody-flow.md, "State
// & persistence": the current order (cart, and once placed, the order and
// its timestamp) lives in one keyed record per concern in the visitor's own
// browser storage, cleared only by an explicit "start over" action (never a
// refresh), the same pattern ADR 0004 established for the swipe poll.

import type { DeliveryInstructions, DropOffPreset, RatingTag } from './tracking';
import type { City, Currency } from './money';
import { SERVICE_FEE_MINOR } from './money';
import { estimateEtaMinutes } from './eta';
import { getMenuItem, getRestaurant } from './restaurants';
import { pickDriver, type Driver } from './drivers';
import { isDelivered } from './tracker-state';
import { applyDeliveredOrderToLedger, platinumDiscountMinor, readVipLedger, writeVipLedger, type VipLedger } from './vip-level';

export const VISITOR_ID_KEY = 'parody.visitorId';
export const SESSION_ID_KEY = 'parody.sessionId';
export const CART_KEY = 'parody.cart';
/** Superseded by `ORDERS_KEY` (#144) — read once, on migration, then removed. Kept exported so a test can seed the pre-migration shape directly. */
export const ORDER_KEY = 'parody.order';
/** Every stored order (#144), oldest first. Replaces the single-order `ORDER_KEY` — see ADR 0009. */
export const ORDERS_KEY = 'parody.orders';
/** The most orders kept on one device — see ADR 0009 for why this number. An order still live, or delivered with `order_delivered` not yet fired, is never dropped even past this cap (§5). */
export const ORDER_HISTORY_CAP = 20;

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
  /** This visitor's estimate for this restaurant (eta.ts, 10–25 minutes), taken at the moment the
   * order was placed — the same number checkout showed, so a later screen never has to re-derive it. */
  etaMinutes: number;
  /** Milliseconds after `placedAt` at which this order reaches Delivered — picked once, at random, at
   * or before half `etaMinutes` (#121: a delivery app under-promising and arriving early). The one
   * fact that makes reaching Delivered detectable from the stored order alone (tracker-state.ts,
   * delivery.ts). */
  deliveryMs: number;
  items: CartLine[];
  itemCount: number;
  /** The subtotal — §2's `amount_minor`, not the total the breakdown shows. */
  amountMinor: number;
  /** The checkout breakdown's `totalMinor` (subtotal + fees − discount) at the moment this order was placed — `null` only for an order migrated from before this field existed, since nothing recorded its total (#144 §5). */
  totalMinor: number | null;
  currency: Currency;
  /** Drawn once, at placeOrder, from the order's own restaurant's city pool (drivers.ts) — never the city picker (#129/#130's precedent). Stable for the life of the order. */
  driver: Driver;
  dropOffPreset: DropOffPreset;
  deliveryInstructions: DeliveryInstructions;
  utensils: boolean;
  /** 0–2 catalogue voucher ids (contract §7) — always `[]` for an order this child places; #89's to populate. */
  appliedVoucherIds: string[];
  /** 0 iff `appliedVoucherIds` is `[]` (contract §7's invariant, #89's to prove) — always 0 here. */
  savedAmountMinor: number;
  /** The last `tracker_viewed.view_number` fired for this order. */
  viewCount: number;
  /** Whether `order_delivered` has already fired for this order — the client's own idempotency guard, since the store enforces no such constraint (contract §10). */
  deliveredEventFired: boolean;
  /** The restaurant rating submitted from either the Delivered-state inline
   * prompt or the rating sheet's restaurant step, or `null` before either
   * submits — also what makes that state render as already-rated on a later
   * visit (contract §7's `rating_submitted` invariant). Its shape and guard
   * are unchanged by #163; it now represents the restaurant step only, since
   * the driver gets its own field below (docs/design/162-*, "Storage"). */
  rating: { stars: number; tags: RatingTag[] } | null;
  /** The rating sheet's driver step, or `null` before it is submitted or when
   * skipped — #163, docs/design/162-*, "Storage". Fires no event: only the
   * restaurant step's `rating_submitted` does. */
  driverRating: { stars: number } | null;
  /** Set the moment the rating sheet auto-opens for this order, or the moment
   * it is deliberately passed over by the multi-order rule — never cleared,
   * and never set by a manual open (docs/design/162-*, "The multi-order
   * rule"). `null` for an order the sheet has never considered, including
   * every legacy order (`withLegacyDefaults`), which the 24-hour rule then
   * marks prompted on first sight rather than opening for. */
  ratingPromptedAt: string | null;
  /** Whether the wallet paid for this order — `true` only when `wallet_debit`
   * answered `debited` or `already_debited` at Place order (#165,
   * docs/design/162-*, "Tips": "the order was paid from the wallet").
   * `false` for the D1 fallback, a dark wallet, and every legacy order:
   * exactly the set of orders the server would refuse a tip against (D14),
   * which is what #171's tippable check reads this for. */
  walletPaid: boolean;
  /** The thanks voucher's amount applied to this order, in minor units — 0
   * when none applied. Written only inside `placeOrder`'s own success path
   * (#166, docs/design/162-*, "The thanks voucher": "Consumed when the
   * order is written... If placing fails ... it is not consumed"), so a
   * failed write never reaches a caller that would clear it from storage. */
  thanksVoucherMinor: number;
  /** Whether this order has already been folded into `parody.vip` (#174,
   * docs/design/162-*, "The ledger: progress never goes backwards") — set by
   * `sweepVipLedger` the first time the order is seen delivered, and never
   * cleared. `false` for every legacy order, so the first sweep after this
   * shipped counts each of them exactly once (the doc's "Backfill"). This is
   * also the flag `capOrders` requires before an order can be dropped: an
   * order evicted before being counted would take its progress with it. */
  vipCounted: boolean;
}

/** A fresh id in `placeOrder`'s own shape (#149: created before the wallet debit, so the debit and the order it pays for share one idempotency key — ADR 0008, "Source of truth"). */
export function createOrderId(): string {
  return generateId();
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

/**
 * One restaurant's cart. Storage keeps the single `parody.cart` array it
 * always has (no migration); a "cart" is simply the lines that share one
 * `restaurantSlug`, so every restaurant is checked out, priced and cleared
 * on its own — its own delivery fee, its own vouchers, its own order.
 */
export interface RestaurantCart {
  restaurantSlug: string;
  restaurantName: string;
  lines: CartLine[];
  itemCount: number;
  subtotalMinor: number;
  currency: Currency;
}

/** The lines belonging to one restaurant's cart, in stored order. */
export function linesForRestaurant(lines: CartLine[], restaurantSlug: string): CartLine[] {
  return lines.filter((line) => line.restaurantSlug === restaurantSlug);
}

/** Every restaurant's cart, in the order its first line was added. Empty for an empty cart. */
export function cartsByRestaurant(lines: CartLine[]): RestaurantCart[] {
  const order: string[] = [];
  for (const line of lines) {
    if (!order.includes(line.restaurantSlug)) order.push(line.restaurantSlug);
  }
  return order.map((slug) => {
    const own = linesForRestaurant(lines, slug);
    return {
      restaurantSlug: slug,
      restaurantName: own[0].restaurantName,
      lines: own,
      itemCount: cartItemCount(own),
      subtotalMinor: cartSubtotalMinor(own),
      currency: own[0].currency,
    };
  });
}

/**
 * Which cart a screen that works on one restaurant's cart (cart, checkout,
 * Offers) should show, given the `?restaurant=` it was opened with:
 *
 * - a requested slug that still has lines → that restaurant's cart;
 * - otherwise nothing stored → `empty`;
 * - otherwise exactly one restaurant's cart → that one;
 * - otherwise several → `several`, and the caller shows (or sends the
 *   visitor to) the "Your carts" list rather than guessing.
 *
 * An unknown, stale (its cart was just emptied) or missing slug falls
 * through to the last three rules, so no link can strand a visitor.
 */
export type CartSelection =
  | { kind: 'empty' }
  | { kind: 'single'; cart: RestaurantCart }
  | { kind: 'several'; carts: RestaurantCart[] };

export function selectRestaurantCart(lines: CartLine[], requestedSlug: string | null): CartSelection {
  const carts = cartsByRestaurant(lines);
  const requested = requestedSlug ? carts.find((cart) => cart.restaurantSlug === requestedSlug) : undefined;
  if (requested) return { kind: 'single', cart: requested };
  if (carts.length === 0) return { kind: 'empty' };
  if (carts.length === 1) return { kind: 'single', cart: carts[0] };
  return { kind: 'several', carts };
}

/** The cart's own currency — every line shares one (one city's catalogue at a time). `null` for an empty cart, since there's nothing to infer it from. */
export function cartCurrency(lines: CartLine[]): Currency | null {
  return lines[0]?.currency ?? null;
}

export interface CheckoutBreakdown {
  subtotalMinor: number;
  /** The fee actually charged — 0 whenever the delivery voucher is applied. */
  deliveryFeeMinor: number;
  /** The restaurant's normal fee, shown struck through, only when the charged fee above is lower than it (a live flash reduction and/or the delivery voucher) — `null` when the charged fee already is the normal fee. */
  deliveryFeeOriginalMinor: number | null;
  serviceFeeMinor: number;
  /** The discount-group voucher's amount — 0 when none is applied (no Discount line then, #87). */
  discountAmountMinor: number;
  /** Sum of every applied *catalogue* voucher's saving — 0 when nothing is
   * applied (no "You saved" line then, #87). Deliberately excludes the
   * thanks voucher below: this is also `order_placed.saved_amount_minor`
   * (contract §7), which only ever names a catalogue id (#166, docs/design/
   * 162-*, "Events"). The screen's own "You saved" line adds
   * `thanksVoucherAmountMinor` to this on top (checkout-dom.ts). */
  savedAmountMinor: number;
  /** The thanks voucher's amount actually applied — 0 when none is held, it
   * doesn't qualify at this subtotal, or it has expired (#166). Never part
   * of `savedAmountMinor` above; see that field's own note. */
  thanksVoucherAmountMinor: number;
  /** Whether VIP Gold or above is what zeroed the delivery fee this order —
   * `false` whenever a catalogue delivery voucher is what did it instead, or
   * the fee wasn't zero to begin with (#174). Drives the breakdown row's
   * "[Gold]"/"[Platinum]" tag; never both this and a catalogue delivery
   * voucher at once, since checkout-dom.ts forces `deliveryId` null the
   * moment Gold is reached (docs/design/162-*, "Gold's free delivery and the
   * delivery-group vouchers"). */
  vipDeliveryWaived: boolean;
  /** What Gold's free delivery saved, in minor units — 0 unless
   * `vipDeliveryWaived` is true and the otherwise-fee was nonzero. Kept out
   * of `savedAmountMinor` on purpose (a VIP perk is not a catalogue voucher,
   * and `order_placed.saved_amount_minor` stays catalogue-only); the
   * screen's own "You saved" line adds it on top, the same way it already
   * does for `thanksVoucherAmountMinor` (checkout-dom.ts). */
  vipDeliverySavedMinor: number;
  /** VIP Platinum's 10% off the subtotal, already floored per #162's
   * per-currency rounding (`platinumDiscountMinor`) — 0 when Platinum isn't
   * active. Also kept out of `savedAmountMinor` for the same reason as
   * `vipDeliverySavedMinor`. */
  vipPlatinumAmountMinor: number;
  totalMinor: number;
  currency: Currency;
}

/**
 * Applied-voucher effect on the breakdown (#87's "Offers" mechanics, #89) —
 * everything computeCheckoutBreakdown needs beyond the cart and the
 * restaurant's own normal fee, kept as one small object so the function
 * itself stays a pure arithmetic step over values the caller (checkout-dom.ts)
 * has already resolved from vouchers.ts/flash-deal.ts.
 */
export interface AppliedVoucherEffect {
  /** Whether the `delivery`-group voucher is currently applied. */
  deliveryVoucherApplied: boolean;
  /** The `discount`-group voucher's amount, in minor units — 0 when none is applied. */
  discountAmountMinor: number;
  /** The restaurant's own flash-window fee, in minor units, when a live flash window applies to it (#87, "The effective delivery fee, in order," rule 2) — `null` when no flash window is live for this restaurant. */
  flashDeliveryFeeMinor: number | null;
  /** The thanks voucher's amount, already resolved against the subtotal and expiry by the caller (`thanksVoucherDiscountMinor`, thanks-voucher.ts) — 0 when none applies. Kept out of the catalogue-shaped fields above on purpose: it is not a `VoucherId` (#166). */
  thanksVoucherAmountMinor?: number;
  /** VIP Gold or above (#174): forces the delivery fee to 0 regardless of any catalogue delivery voucher, and is what `vipDeliveryWaived`/`vipDeliverySavedMinor` on the breakdown report — the caller (checkout-dom.ts) is what suppresses the catalogue `delivery` group while this is true. */
  vipGoldActive?: boolean;
  /** VIP Platinum (#174): applies the 10% perk. The amount and its rounding are computed here, from the cart's own subtotal and currency, so the rounding rule lives in one place (`platinumDiscountMinor`, vip-level.ts) rather than being passed in pre-rounded. */
  vipPlatinumActive?: boolean;
}

export const NO_VOUCHERS_APPLIED: AppliedVoucherEffect = {
  deliveryVoucherApplied: false,
  discountAmountMinor: 0,
  flashDeliveryFeeMinor: null,
  thanksVoucherAmountMinor: 0,
  vipGoldActive: false,
  vipPlatinumActive: false,
};

/** The fee that would apply absent the delivery voucher — the restaurant's live flash fee if one is live, else its normal fee (#87, "the effective delivery fee," rules 2–3). Exported so the Offers screen's own "You saved" footer (offers-dom.ts) computes the identical figure checkout will show. */
export function otherwiseDeliveryFeeMinor(normalDeliveryFeeMinor: number, flashDeliveryFeeMinor: number | null): number {
  return flashDeliveryFeeMinor ?? normalDeliveryFeeMinor;
}

/**
 * The checkout price breakdown (#80's "Price breakdown," extended by #87/#89
 * with the Discount line and "You saved" sub-line). `null` for an empty
 * cart, so the caller renders #80's empty state rather than a $0 breakdown.
 *
 * `normalDeliveryFeeMinor` is the restaurant's own everyday fee (unchanged
 * from #94). `applied` resolves #87's "effective delivery fee, in order":
 * free if the delivery voucher is applied; otherwise the restaurant's live
 * flash fee; otherwise its normal fee — and the discount-group voucher's
 * fixed or drawn amount, subtracted once as its own Discount line.
 */
export function computeCheckoutBreakdown(
  lines: CartLine[],
  normalDeliveryFeeMinor: number,
  applied: AppliedVoucherEffect = NO_VOUCHERS_APPLIED,
): CheckoutBreakdown | null {
  if (lines.length === 0) return null;
  const currency = lines[0].currency;
  const subtotalMinor = cartSubtotalMinor(lines);
  const serviceFeeMinor = SERVICE_FEE_MINOR[currency];

  const otherwiseFeeMinor = otherwiseDeliveryFeeMinor(normalDeliveryFeeMinor, applied.flashDeliveryFeeMinor);
  const vipGoldActive = applied.vipGoldActive ?? false;
  const deliveryWaived = applied.deliveryVoucherApplied || vipGoldActive;
  const deliveryFeeMinor = deliveryWaived ? 0 : otherwiseFeeMinor;
  const deliveryFeeOriginalMinor = deliveryFeeMinor < normalDeliveryFeeMinor ? normalDeliveryFeeMinor : null;
  const deliverySavedMinor = applied.deliveryVoucherApplied ? otherwiseFeeMinor : 0;
  const vipDeliveryWaived = !applied.deliveryVoucherApplied && vipGoldActive;
  const vipDeliverySavedMinor = vipDeliveryWaived ? otherwiseFeeMinor : 0;
  const savedAmountMinor = deliverySavedMinor + applied.discountAmountMinor;
  const thanksVoucherAmountMinor = applied.thanksVoucherAmountMinor ?? 0;
  const vipPlatinumAmountMinor = applied.vipPlatinumActive ? platinumDiscountMinor(subtotalMinor, currency) : 0;

  return {
    subtotalMinor,
    deliveryFeeMinor,
    deliveryFeeOriginalMinor,
    serviceFeeMinor,
    discountAmountMinor: applied.discountAmountMinor,
    savedAmountMinor,
    thanksVoucherAmountMinor,
    vipDeliveryWaived,
    vipDeliverySavedMinor,
    vipPlatinumAmountMinor,
    totalMinor:
      subtotalMinor + deliveryFeeMinor + serviceFeeMinor - applied.discountAmountMinor - thanksVoucherAmountMinor - vipPlatinumAmountMinor,
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

/** Removes one restaurant's lines and keeps every other restaurant's cart intact. Returns what is left. */
export function clearRestaurantCart(storage: Storage, restaurantSlug: string): CartLine[] {
  const remaining = getCart(storage).filter((line) => line.restaurantSlug !== restaurantSlug);
  if (remaining.length === 0) clearCart(storage);
  else setCart(storage, remaining);
  return remaining;
}

/** Replaces one restaurant's lines with `lines`, keeping every other
 * restaurant's cart intact — Order again's "Replace" (#165, docs/design/
 * 162-*, "Order again"). `lines` is trusted to already share that
 * `restaurantSlug` (`orderAgainLines`' contract). */
export function setRestaurantCart(storage: Storage, restaurantSlug: string, lines: CartLine[]): CartLine[] {
  const others = getCart(storage).filter((line) => line.restaurantSlug !== restaurantSlug);
  const next = [...others, ...lines];
  setCart(storage, next);
  return next;
}

/** An order's items, repriced at today's menu (#165, docs/design/162-*,
 * "Order again": "The stored `amountMinor` is a record of what was paid, not
 * a price to reuse"). An item no longer on the menu is skipped rather than
 * carried over stale — `availableCount` is what's left, `totalCount` is what
 * the order originally held, and the caller (tracker-dom.ts) reads their gap
 * as "N of M items are still on the menu." Quantities are carried over
 * unchanged. */
export interface OrderAgainResult {
  lines: CartLine[];
  availableCount: number;
  totalCount: number;
}

export function orderAgainLines(order: PlacedOrder): OrderAgainResult {
  const lines: CartLine[] = [];
  for (const line of order.items) {
    const menuItem = getMenuItem(line.itemId);
    if (!menuItem) continue;
    lines.push({
      itemId: line.itemId,
      restaurantSlug: line.restaurantSlug,
      restaurantName: line.restaurantName,
      name: menuItem.item.name,
      amountMinor: menuItem.item.amountMinor,
      currency: line.currency,
      quantity: line.quantity,
    });
  }
  return { lines, availableCount: lines.length, totalCount: order.items.length };
}

/** The fixed delivery time every order used before #121 — the fallback for an
 * order stored under that shape, so it keeps behaving exactly as it did. */
const LEGACY_DELIVERY_MS = 7 * 60_000;

/**
 * Fills in whatever a pre-#144 record is missing: `etaMinutes`/`deliveryMs`
 * (pre-#121), and now `totalMinor`/`driver` (#144) — a visitor's order
 * already in progress on the live site when either shipped. Without the
 * first pair, `isDelivered`'s `elapsedMs >= order.deliveryMs` compares
 * against `undefined` and is never true, so the order never reaches
 * Delivered and the countdown reads NaN. `deliveryMs` falls back to the fixed
 * 7 minutes every order used to take; `etaMinutes` is re-derived the same
 * deterministic way a current order's is. `totalMinor` has nothing to fall
 * back to (the total was never stored), so it stays `null` (§5) rather than
 * guessing. `driver` is drawn once, from the order's own restaurant's city
 * pool, and persisted by the caller so it never redraws on a later read.
 */
function withLegacyDefaults(order: PlacedOrder, storage: Storage, random: () => number): PlacedOrder {
  const restaurantSlug = order.items[0]?.restaurantSlug ?? '';
  const city: City = getRestaurant(restaurantSlug)?.city ?? 'sf';
  return {
    ...order,
    etaMinutes: order.etaMinutes ?? estimateEtaMinutes(getVisitorId(storage), restaurantSlug),
    deliveryMs: order.deliveryMs ?? LEGACY_DELIVERY_MS,
    totalMinor: order.totalMinor ?? null,
    driver: order.driver ?? pickDriver(city, random),
    driverRating: order.driverRating ?? null,
    ratingPromptedAt: order.ratingPromptedAt ?? null,
    walletPaid: order.walletPaid ?? false,
    thanksVoucherMinor: order.thanksVoucherMinor ?? 0,
    vipCounted: order.vipCounted ?? false,
  };
}

/** Drops the oldest droppable order first once `orders` (oldest-first) exceeds `ORDER_HISTORY_CAP` — an order that's still live, or delivered but not yet fired, is never droppable (§5), so a cap breached entirely by protected orders is left over-cap rather than losing one of them. `vipCounted` joins that guard (#174): dropping an order the VIP ledger hasn't folded in yet would take its progress with it, which is why `placeOrder` always sweeps before this runs. */
function capOrders(orders: PlacedOrder[], now: number): PlacedOrder[] {
  const overflow = orders.length - ORDER_HISTORY_CAP;
  if (overflow <= 0) return orders;
  const droppable = (order: PlacedOrder): boolean => isDelivered(order, now) && order.deliveredEventFired && order.vipCounted;
  const result = [...orders];
  let toDrop = overflow;
  for (let i = 0; i < result.length && toDrop > 0; ) {
    if (droppable(result[i])) {
      result.splice(i, 1);
      toDrop -= 1;
    } else {
      i += 1;
    }
  }
  return result;
}

function setOrders(storage: Storage, orders: PlacedOrder[]): void {
  storage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

/** Backfills `driverRating`/`ratingPromptedAt`/`walletPaid` on an order
 * already stored under `ORDERS_KEY` from before those fields existed —
 * unlike `etaMinutes`/`totalMinor`/`driver`, which only ever needed
 * backfilling on the one-time `ORDER_KEY` migration, `ORDERS_KEY` itself
 * predates them, so a real stored array can be missing them without going
 * through `withLegacyDefaults` at all. `undefined` here reads exactly as
 * `null`/`false` (docs/design/162-*, "Storage": "Legacy orders read as
 * unrated" / "count as null"; #165's "Legacy orders read as not
 * wallet-paid"). */
function withRatingDefaults(order: PlacedOrder): PlacedOrder {
  return {
    ...order,
    driverRating: order.driverRating ?? null,
    ratingPromptedAt: order.ratingPromptedAt ?? null,
    walletPaid: order.walletPaid ?? false,
    thanksVoucherMinor: order.thanksVoucherMinor ?? 0,
    vipCounted: order.vipCounted ?? false,
  };
}

/**
 * Every stored order, oldest first, migrating the legacy single-order key
 * exactly once. Once `ORDERS_KEY` exists (even as `[]`), the legacy key is
 * never consulted again, which is what makes a second read a no-op rather
 * than a second migration — and the legacy key is removed the same time it's
 * migrated, since nothing reads it after that point (#144 §2 — the pull
 * request explains why removing rather than leaving it behind).
 * `random` is only ever consumed here to draw a migrated legacy order's
 * driver; it is otherwise unused.
 */
export function getOrders(storage: Storage, random: () => number = Math.random): PlacedOrder[] {
  const raw = storage.getItem(ORDERS_KEY);
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as PlacedOrder[]).map(withRatingDefaults) : [];
    } catch {
      return [];
    }
  }

  const legacyRaw = storage.getItem(ORDER_KEY);
  if (!legacyRaw) return [];
  try {
    const migrated = withLegacyDefaults(JSON.parse(legacyRaw) as PlacedOrder, storage, random);
    setOrders(storage, [migrated]);
    storage.removeItem(ORDER_KEY);
    return [migrated];
  } catch {
    return [];
  }
}

/** The most recently placed order — what `/order-placed/` and `/tracker/` show (§1). `null` with nothing stored. */
export function getLatestOrder(storage: Storage): PlacedOrder | null {
  const orders = getOrders(storage);
  return orders.length > 0 ? orders[orders.length - 1] : null;
}

/** One specific order by id, wherever it sits in storage — never assumed to be the latest (§3). `null` if no stored order carries this id. */
export function findOrder(storage: Storage, orderId: string): PlacedOrder | null {
  return getOrders(storage).find((order) => order.orderId === orderId) ?? null;
}

export interface PlaceOrderFields {
  dropOffPreset: DropOffPreset;
  deliveryInstructions: DeliveryInstructions;
  utensils: boolean;
  /** 0–2 catalogue voucher ids — omitted (defaults to `[]`) by this issue's checkout, which has no Offers control yet; #89's to pass real values. */
  appliedVoucherIds?: string[];
  /** Defaults to 0 — must be 0 whenever `appliedVoucherIds` is `[]` (contract §7's invariant). */
  savedAmountMinor?: number;
  /** The checkout breakdown's `totalMinor` (§5) — defaults to the subtotal for a caller with no breakdown to hand in (mostly tests unconcerned with the total). Every real caller (checkout-dom.ts) always has a breakdown and passes its `totalMinor`. */
  totalMinor?: number;
  /** A pre-made order id (#149: the wallet debit's idempotency key, created at the first Place-order tap and kept in `sessionStorage` until this order is written — ADR 0008, "Source of truth"). Defaults to a freshly generated one, as before, for every caller that doesn't pass one. */
  orderId?: string;
  /** Whether `wallet_debit` answered `debited` or `already_debited` for this
   * order — defaults to `false`, which is right for the dark path, the D1
   * fallback, and every caller unconcerned with the wallet (#165). */
  walletPaid?: boolean;
  /** The thanks voucher amount actually applied to this checkout, in minor units — defaults to 0, which is right for every caller not applying one (#166). */
  thanksVoucherMinor?: number;
}

/**
 * The delivery time picked at `placeOrder`, in milliseconds after `placedAt`
 * — at or before half `etaMinutes` (#121: the order arrives early), and
 * always at least 1ms so "has this order been delivered" is never true at
 * the instant it's placed. `random` is injectable so a test can assert the
 * exact value rather than only its bounds, the same pattern flash-deal.ts's
 * `drawFlashDeal` uses.
 */
export function pickDeliveryMs(etaMinutes: number, random: () => number = Math.random): number {
  const halfEtaMs = (etaMinutes * 60_000) / 2;
  return Math.max(1, Math.round(halfEtaMs * random()));
}

/**
 * Writes the placed-order record from one restaurant's cart and clears only
 * that restaurant's lines — "the cart clears when an order is placed" (issue
 * #67, AC9), now per restaurant, so any other restaurant's cart survives the
 * order. Without `restaurantSlug` it orders the whole stored cart, the
 * single-cart behaviour this had before carts were split. Does not fire any
 * event; the caller fires `order_placed` once, guarded against a double-tap
 * (see checkout-dom.ts).
 *
 * The restaurant's per-visitor estimate (eta.ts), its delivery time
 * (`pickDeliveryMs`) and its driver (`pickDriver`, drivers.ts) are derived
 * here, once, from the visitor id already stored under this same `storage`
 * and the restaurant every ordered line shares — not passed in by the
 * caller, so neither can ever drift from what checkout showed for the same
 * visitor/restaurant pair. `random` is injectable for the same reason
 * `pickDeliveryMs` takes it — consumed first for `deliveryMs`, then once
 * more for the driver draw, so a seeded sequence source predicts both.
 *
 * Every existing order is kept (#144: placing a second order no longer
 * replaces the first), appended after the new one, and the list is trimmed
 * to `ORDER_HISTORY_CAP` from its oldest droppable end.
 */
export function placeOrder(
  storage: Storage,
  fields: PlaceOrderFields,
  restaurantSlug?: string,
  random: () => number = Math.random,
): PlacedOrder {
  const all = getCart(storage);
  const items = restaurantSlug === undefined ? all : linesForRestaurant(all, restaurantSlug);
  const slug = restaurantSlug ?? items[0]?.restaurantSlug ?? '';
  const etaMinutes = estimateEtaMinutes(getVisitorId(storage), slug);
  const amountMinor = cartSubtotalMinor(items);
  const city: City = getRestaurant(slug)?.city ?? 'sf';
  const order: PlacedOrder = {
    orderId: fields.orderId ?? generateId(),
    placedAt: new Date().toISOString(),
    etaMinutes,
    deliveryMs: pickDeliveryMs(etaMinutes, random),
    items,
    itemCount: cartItemCount(items),
    amountMinor,
    totalMinor: fields.totalMinor ?? amountMinor,
    currency: cartCurrency(items) ?? 'USD',
    driver: pickDriver(city, random),
    dropOffPreset: fields.dropOffPreset,
    deliveryInstructions: fields.deliveryInstructions,
    utensils: fields.utensils,
    appliedVoucherIds: fields.appliedVoucherIds ?? [],
    savedAmountMinor: fields.savedAmountMinor ?? 0,
    viewCount: 0,
    deliveredEventFired: false,
    rating: null,
    driverRating: null,
    ratingPromptedAt: null,
    walletPaid: fields.walletPaid ?? false,
    thanksVoucherMinor: fields.thanksVoucherMinor ?? 0,
    vipCounted: false,
  };
  // #174: sweep before capOrders runs, so any order that has become
  // delivered since it was last swept is folded into the ledger and marked
  // vipCounted before eviction can consider it droppable — see capOrders's
  // own note above.
  sweepVipLedger(storage, Date.now());
  const orders = getOrders(storage, random);
  orders.push(order);
  setOrders(storage, capOrders(orders, Date.now()));
  if (restaurantSlug === undefined) clearCart(storage);
  else clearRestaurantCart(storage, restaurantSlug);
  return order;
}

/** Clears every stored order, matching ADR 0004's explicit-action pattern (never on a plain refresh). `visitor_id` is never cleared by it (docs/measurement/66-parody-event-contract.md §2). Not currently wired to any control — the tracker's old "give up" state this served (65's 7d) is retired now that the tracker always resolves (docs/design/80-two-city-brand-and-flow.md, "Tracker"; contract §6). */
export function clearOrder(storage: Storage): void {
  storage.removeItem(ORDERS_KEY);
  storage.removeItem(ORDER_KEY);
}

/** Increments and persists the view count for the named order, returning the new value — becomes `tracker_viewed.view_number`. Takes an explicit `orderId` (§3) rather than assuming "whichever is latest," since that could shift under it between the read that named the order and this write. */
export function recordTrackerView(storage: Storage, orderId: string): number {
  const orders = getOrders(storage);
  const order = orders.find((candidate) => candidate.orderId === orderId);
  if (!order) return 0;
  order.viewCount += 1;
  setOrders(storage, orders);
  return order.viewCount;
}

/** Marks `order_delivered` as already fired for the named order — delivery.ts's own guard against firing it twice for one `order_id`, since the store enforces no such constraint (contract §10). No-op if that id isn't stored. */
export function markOrderDelivered(storage: Storage, orderId: string): void {
  const orders = getOrders(storage);
  const order = orders.find((candidate) => candidate.orderId === orderId);
  if (!order || order.deliveredEventFired) return;
  order.deliveredEventFired = true;
  setOrders(storage, orders);
}

/**
 * Folds every stored order that is delivered (`isDelivered`) and not yet
 * `vipCounted` into `parody.vip`, once each, then marks them counted — #174,
 * docs/design/162-*, "The ledger: progress never goes backwards". Fires no
 * event. Idempotent: an order already `vipCounted` is left untouched, so
 * calling this repeatedly (the tracker's render, checkout mount, and here in
 * `placeOrder`) never double-counts one. Returns the ledger whether or not
 * anything was newly swept, so a caller can read the current level either way.
 */
export function sweepVipLedger(storage: Storage, now: number): VipLedger {
  const orders = getOrders(storage);
  const toCount = orders.filter((order) => isDelivered(order, now) && !order.vipCounted);
  if (toCount.length === 0) return readVipLedger(storage);

  let ledger = readVipLedger(storage);
  for (const order of toCount) ledger = applyDeliveredOrderToLedger(ledger, order);
  writeVipLedger(storage, ledger);

  const countedIds = new Set(toCount.map((order) => order.orderId));
  for (const order of orders) {
    if (countedIds.has(order.orderId)) order.vipCounted = true;
  }
  setOrders(storage, orders);

  return ledger;
}

/** Records the rating for the named order, the one write the tracker's Delivered state makes beyond reading it — `null` (a no-op) if that id isn't stored or is already rated, which is what makes a second "Submit" impossible (contract §7's `rating_submitted` invariant). */
export function submitRating(storage: Storage, orderId: string, stars: number, tags: RatingTag[]): PlacedOrder | null {
  const orders = getOrders(storage);
  const order = orders.find((candidate) => candidate.orderId === orderId);
  if (!order || order.rating) return null;
  order.rating = { stars, tags };
  setOrders(storage, orders);
  return order;
}

/** The rating sheet's driver step (#163) — the same "null if already rated"
 * guard as `submitRating`, and no event: only the restaurant step's Submit
 * fires `rating_submitted` (docs/design/162-*, "Events"). */
export function submitDriverRating(storage: Storage, orderId: string, stars: number): PlacedOrder | null {
  const orders = getOrders(storage);
  const order = orders.find((candidate) => candidate.orderId === orderId);
  if (!order || order.driverRating) return null;
  order.driverRating = { stars };
  setOrders(storage, orders);
  return order;
}

/** Marks the moment the rating sheet auto-opened for `orderId`, or the moment
 * it was deliberately passed over — `null` (a no-op) if that id isn't stored
 * or is already marked, since it is set once and never cleared (docs/design/
 * 162-*, "The multi-order rule"). */
export function markRatingPrompted(storage: Storage, orderId: string, now: number = Date.now()): PlacedOrder | null {
  const orders = getOrders(storage);
  const order = orders.find((candidate) => candidate.orderId === orderId);
  if (!order || order.ratingPromptedAt) return null;
  order.ratingPromptedAt = new Date(now).toISOString();
  setOrders(storage, orders);
  return order;
}

export function minutesSinceOrder(order: PlacedOrder, now: number = Date.now()): number {
  return Math.max(0, (now - new Date(order.placedAt).getTime()) / 60000);
}
