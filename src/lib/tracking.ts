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
// `location_selected`, `home_viewed`, `restaurant_opened` (#82),
// `cart_viewed`, `checkout_viewed`, `order_placed` (#94),
// `flash_sheet_shown`/`flash_sheet_closed` and `order_placed`'s real voucher
// fields (#89), and `tracker_viewed` (unchanged), `order_delivered` and
// `rating_submitted` (#83) are all on the merged §7 contract. `order_abandoned`
// is retired outright (#83, contract §6) — its old name is no longer a case
// below, so a call using it falls to the `default: false` branch and is
// simply dropped by `isValidEventProps` rather than reaching the sender.

import { CITIES } from './money';
import { VOUCHER_IDS as CATALOGUE_VOUCHER_IDS } from './vouchers';

export type EventName =
  | 'location_selected'
  | 'home_viewed'
  | 'restaurant_opened'
  | 'cart_viewed'
  | 'checkout_viewed'
  | 'flash_sheet_shown'
  | 'flash_sheet_closed'
  | 'order_placed'
  | 'tracker_viewed'
  | 'order_delivered'
  | 'rating_submitted';

export type EventProps = Record<string, string | number | boolean | string[]>;

export type Track = (eventName: EventName, props: EventProps) => void;

export const DROP_OFF_PRESETS = ['home', 'office', 'front_desk'] as const;
export type DropOffPreset = (typeof DROP_OFF_PRESETS)[number];

export const DELIVERY_INSTRUCTIONS = ['leave_at_door', 'hand_to_me', 'meet_downstairs', 'call_on_arrival'] as const;
export type DeliveryInstructions = (typeof DELIVERY_INSTRUCTIONS)[number];

/** `rating_submitted.tags` (contract §7) — the tracker's Delivered-state rating prompt's optional preset tag chips. */
export const RATING_TAGS = ['fast', 'great_packaging', 'order_was_correct'] as const;
export type RatingTag = (typeof RATING_TAGS)[number];

/** The ten fixed catalogue voucher ids §7's `order_placed` row names, and `flash_sheet_shown`/`flash_sheet_closed`'s own `restaurant_slugs` draw from — vouchers.ts (#87's catalogue) is the single source, re-exported here so this shape mirror doesn't drift from it. */
export const VOUCHER_IDS = CATALOGUE_VOUCHER_IDS;

const FLASH_OUTCOMES = ['restaurant_tapped', 'dismissed', 'expired'] as const;

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

/** `rating_submitted.tags`: 0–3 known tags, no duplicates (contract §7). */
function isValidRatingTags(value: unknown): value is RatingTag[] {
  if (!Array.isArray(value) || value.length > 3) return false;
  if (!value.every((tag) => isOneOf(tag, RATING_TAGS))) return false;
  return new Set(value).size === value.length;
}

/** `restaurant_slugs`: exactly 2 valid slugs (contract §7, `flash_sheet_shown`). */
function isValidRestaurantSlugs(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((slug) => typeof slug === 'string' && slug.length >= 1 && slug.length <= 60 && SLUG_RE.test(slug))
  );
}

/** `flash_sheet_shown.amount_minor`: bounded to the city's own drawn range (contract §7), not the general per-currency bound. */
function isFlashAmountInRange(value: unknown, currency: unknown): boolean {
  if (currency === 'USD') return isIntInRange(value, 200, 600);
  if (currency === 'VND') return isIntInRange(value, 10000, 30000);
  return false;
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
    case 'flash_sheet_shown':
      return (
        hasOnly(['city', 'amount_minor', 'currency', 'restaurant_slugs']) &&
        isOneOf(props.city, CITIES) &&
        isOneOf(props.currency, ['USD', 'VND']) &&
        isFlashAmountInRange(props.amount_minor, props.currency) &&
        isValidRestaurantSlugs(props.restaurant_slugs)
      );
    case 'flash_sheet_closed':
      return (
        hasOnly(['city', 'outcome', 'seconds_remaining', 'restaurant_slug']) &&
        isOneOf(props.city, CITIES) &&
        isOneOf(props.outcome, FLASH_OUTCOMES) &&
        isIntInRange(props.seconds_remaining, 0, 900) &&
        typeof props.restaurant_slug === 'string' &&
        (props.outcome === 'restaurant_tapped'
          ? props.restaurant_slug !== 'none' &&
            SLUG_RE.test(props.restaurant_slug) &&
            props.restaurant_slug.length >= 1 &&
            props.restaurant_slug.length <= 60
          : props.restaurant_slug === 'none')
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
    case 'order_delivered':
      return (
        hasOnly(['order_id', 'minutes_since_order']) &&
        isUuid(props.order_id) &&
        isNumberAtLeast(props.minutes_since_order, 0)
      );
    case 'rating_submitted':
      return (
        hasOnly(['order_id', 'stars', 'tags']) &&
        isUuid(props.order_id) &&
        isIntInRange(props.stars, 1, 5) &&
        isValidRatingTags(props.tags)
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
