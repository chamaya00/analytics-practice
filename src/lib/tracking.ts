// The single injectable tracking function every funnel step fires through —
// docs/measurement/66-parody-event-contract.md is the contract this module
// mirrors client-side. Nothing here talks to a network: the default track
// is a no-op, and wiring a real sender is #68's job, not this issue's.
// `track()` validates a call's `props` against the same shape the store's
// own `event_is_valid` (ADR 0005) will check server-side, and drops a
// malformed call rather than forwarding it — a defensive mirror, not a
// replacement for the server-side check.

export type EventName =
  | 'landing_viewed'
  | 'restaurants_viewed'
  | 'restaurant_opened'
  | 'cart_viewed'
  | 'checkout_viewed'
  | 'order_placed'
  | 'tracker_viewed'
  | 'order_abandoned';

export type EventProps = Record<string, string | number | boolean>;

export type Track = (eventName: EventName, props: EventProps) => void;

export const DROP_OFF_SPOTS = ['couch', 'wherever_i_am', 'the_void', 'behind_you'] as const;
export type DropOffSpot = (typeof DROP_OFF_SPOTS)[number];

export const HANDLING_INSTRUCTIONS = ['guard_it', 'wing_it', 'two_hands', 'surprise_me'] as const;
export type HandlingInstructions = (typeof HANDLING_INSTRUCTIONS)[number];

export const TIP_PERCENTS = [0, 10, 15, 20] as const;
export type TipPercent = (typeof TIP_PERCENTS)[number];

export const PROMO_CODES = ['dont_drop10', 'still_here', 'clumsy15', 'gotcha'] as const;
export type PromoCode = (typeof PROMO_CODES)[number];

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

/**
 * Mirrors ADR 0005 §2's `event_is_valid(event_name, props)` for exactly the
 * shapes docs/measurement/66-parody-event-contract.md §4 defines. Returns
 * false for any prop set that check would refuse — an unknown enum value,
 * a missing key, an out-of-range number, or an extra key.
 */
export function isValidEventProps(eventName: EventName, props: EventProps): boolean {
  const keys = Object.keys(props);
  const hasOnly = (allowed: string[]): boolean =>
    keys.length === allowed.length && allowed.every((key) => key in props);

  switch (eventName) {
    case 'landing_viewed':
      return hasOnly(['has_active_order']) && isBoolean(props.has_active_order);
    case 'restaurants_viewed':
      return keys.length === 0;
    case 'restaurant_opened':
      return (
        hasOnly(['restaurant_slug']) &&
        typeof props.restaurant_slug === 'string' &&
        props.restaurant_slug.length >= 1 &&
        props.restaurant_slug.length <= 60 &&
        SLUG_RE.test(props.restaurant_slug)
      );
    case 'cart_viewed':
      return (
        hasOnly(['item_count', 'subtotal_cents']) &&
        isIntInRange(props.item_count, 0, 999) &&
        isIntInRange(props.subtotal_cents, 0, 100000)
      );
    case 'checkout_viewed':
      return (
        hasOnly(['item_count', 'subtotal_cents']) &&
        isIntInRange(props.item_count, 1, 999) &&
        isIntInRange(props.subtotal_cents, 1, 100000)
      );
    case 'order_placed':
      return (
        hasOnly([
          'order_id',
          'item_count',
          'subtotal_cents',
          'drop_off_spot',
          'handling_instructions',
          'utensils',
          'tip_percent',
          'promo_code',
        ]) &&
        isUuid(props.order_id) &&
        isIntInRange(props.item_count, 1, 999) &&
        isIntInRange(props.subtotal_cents, 1, 100000) &&
        isOneOf(props.drop_off_spot, DROP_OFF_SPOTS) &&
        isOneOf(props.handling_instructions, HANDLING_INSTRUCTIONS) &&
        isBoolean(props.utensils) &&
        isOneOf(props.tip_percent, TIP_PERCENTS) &&
        isOneOf(props.promo_code, PROMO_CODES)
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
