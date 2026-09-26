// The single injectable tracking function every funnel step fires through —
// docs/measurement/81-two-city-event-contract.md is the contract this module
// mirrors client-side (superseding docs/measurement/66-parody-event-
// contract.md). Nothing here talks to a network: the default track is a
// no-op; the real sender lives in tracking-transport.ts. `track()` validates
// a call's `props` against the same shape the store's own `event_is_valid`
// (ADR 0005/0007) will check server-side, and drops a malformed call rather
// than forwarding it — a defensive mirror, not a replacement for the
// server-side check.
//
// `location_selected`, `home_viewed`, `restaurant_opened` (#82) and now
// `cart_viewed`, `checkout_viewed`, `order_placed` (#94) below are on the
// merged §7 contract. `tracker_viewed` and `order_abandoned` are left in
// their pre-#81 shape for #83 to bring forward (#83 also owns retiring
// `order_abandoned` outright) — a call using the old shape is simply dropped
// by `isValidEventProps` below rather than reaching the sender.

import { CITIES } from './money';

export type EventName =
  | 'location_selected'
  | 'home_viewed'
  | 'restaurant_opened'
  | 'cart_viewed'
  | 'checkout_viewed'
  | 'order_placed'
  | 'tracker_viewed'
  | 'order_abandoned';

export type EventProps = Record<string, string | number | boolean | string[]>;

export type Track = (eventName: EventName, props: EventProps) => void;

export const DROP_OFF_PRESETS = ['home', 'office', 'front_desk'] as const;
export type DropOffPreset = (typeof DROP_OFF_PRESETS)[number];

export const DELIVERY_INSTRUCTIONS = ['leave_at_door', 'hand_to_me', 'meet_downstairs', 'call_on_arrival'] as const;
export type DeliveryInstructions = (typeof DELIVERY_INSTRUCTIONS)[number];

/**
 * The ten fixed catalogue voucher ids §7's `order_placed` row names —
 * #87/#89's to define and apply; this child only ever sends `[]`, but the
 * shape mirror validates the full set so a non-empty array #89 sends later
 * doesn't need this file touched again.
 */
export const VOUCHER_IDS = [
  'hcmc-delivery-entry',
  'hcmc-discount-t1',
  'hcmc-discount-t2',
  'hcmc-discount-t3',
  'hcmc-flash',
  'sf-delivery-entry',
  'sf-discount-t1',
  'sf-discount-t2',
  'sf-discount-t3',
  'sf-flash',
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isNumberAtLeast(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min;
}

function isOneOf<T extends readonly unknown[]>(value: unknown, allowed: T): value is T[number] {
  return (allowed as readonly unknown[]).includes(value);
}

/** Contract §2: one shared bound per currency, zero allowed only for cart's own column. */
function isAmountMinorInBounds(value: unknown, currency: unknown, allowZero: boolean): boolean {
  const hi = currency === 'USD' ? 100000 : currency === 'VND' ? 5000000 : undefined;
  if (hi === undefined) return false;
  return isIntInRange(value, allowZero ? 0 : 1, hi);
}

/** `applied_voucher_ids`: 0–2 known catalogue ids, no duplicates (contract §7). */
function isValidVoucherIds(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length > 2) return false;
  if (!value.every((id) => isOneOf(id, VOUCHER_IDS))) return false;
  return new Set(value).size === value.length;
}

/**
 * Mirrors ADR 0005/0007 §2's `event_is_valid(event_name, props)` for the
 * shapes docs/measurement/81-two-city-event-contract.md §7 defines (three
 * of them — see the module comment above for the rest). Returns false for
 * any prop set that check would refuse — an unknown enum value, a missing
 * key, an out-of-range number, or an extra key.
 */
export function isValidEventProps(eventName: EventName, props: EventProps): boolean {
  const keys = Object.keys(props);
  const hasOnly = (allowed: string[]): boolean =>
    keys.length === allowed.length && allowed.every((key) => key in props);

  switch (eventName) {
    case 'location_selected':
      return hasOnly(['city', 'is_switch']) && isOneOf(props.city, CITIES) && isBoolean(props.is_switch);
    case 'home_viewed':
      return hasOnly(['city']) && isOneOf(props.city, CITIES);
    case 'restaurant_opened':
      return (
        hasOnly(['city', 'restaurant_slug']) &&
        isOneOf(props.city, CITIES) &&
        typeof props.restaurant_slug === 'string' &&
        props.restaurant_slug.length >= 1 &&
        props.restaurant_slug.length <= 60 &&
        SLUG_RE.test(props.restaurant_slug)
      );
    case 'cart_viewed':
      return (
        hasOnly(['amount_minor', 'currency', 'item_count']) &&
        isOneOf(props.currency, ['USD', 'VND']) &&
        isIntInRange(props.item_count, 0, 999) &&
        isAmountMinorInBounds(props.amount_minor, props.currency, true)
      );
    case 'checkout_viewed':
      return (
        hasOnly(['amount_minor', 'currency', 'item_count']) &&
        isOneOf(props.currency, ['USD', 'VND']) &&
        isIntInRange(props.item_count, 1, 999) &&
        isAmountMinorInBounds(props.amount_minor, props.currency, false)
      );
    case 'order_placed':
      return (
        hasOnly([
          'amount_minor',
          'applied_voucher_ids',
          'currency',
          'delivery_instructions',
          'drop_off_preset',
          'item_count',
          'order_id',
          'saved_amount_minor',
          'utensils',
        ]) &&
        isUuid(props.order_id) &&
        isIntInRange(props.item_count, 1, 999) &&
        isOneOf(props.currency, ['USD', 'VND']) &&
        isAmountMinorInBounds(props.amount_minor, props.currency, false) &&
        isAmountMinorInBounds(props.saved_amount_minor, props.currency, true) &&
        isOneOf(props.drop_off_preset, DROP_OFF_PRESETS) &&
        isOneOf(props.delivery_instructions, DELIVERY_INSTRUCTIONS) &&
        isBoolean(props.utensils) &&
        isValidVoucherIds(props.applied_voucher_ids)
      );
    case 'tracker_viewed':
      return (
        hasOnly(['order_id', 'minutes_since_order', 'view_number']) &&
        isUuid(props.order_id) &&
        isNumberAtLeast(props.minutes_since_order, 0) &&
        isIntInRange(props.view_number, 1, Number.MAX_SAFE_INTEGER)
      );
    case 'order_abandoned':
      return (
        hasOnly(['order_id', 'minutes_since_order', 'view_count']) &&
        isUuid(props.order_id) &&
        isNumberAtLeast(props.minutes_since_order, 0) &&
        isIntInRange(props.view_count, 1, Number.MAX_SAFE_INTEGER)
      );
    default:
      return false;
  }
}

export const noopTrack: Track = () => {};

let currentTrack: Track = noopTrack;

/** Swaps the tracking function every call in this module goes through. Tests stub it; #68 will wire a real sender through it. */
export function setTrack(fn: Track): void {
  currentTrack = fn;
}

/** Restores the no-op default — call in `afterEach` so one test's stub never leaks into the next. */
export function resetTrack(): void {
  currentTrack = noopTrack;
}

/**
 * The one call every screen fires an event through. Silently drops a call
 * whose props don't match the contract's shape rather than forwarding it —
 * malformed data should never reach the injected sender, stub or real.
 */
export const track: Track = (eventName, props) => {
  if (!isValidEventProps(eventName, props)) return;
  currentTrack(eventName, props);
};
