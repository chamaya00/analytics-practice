// Per-visitor, per-restaurant delivery estimate (#121, parent #117): replaces
// restaurants.ts's fixed etaMinMinutes/etaMaxMinutes range with one number
// that looks random but is actually a deterministic hash of the visitor id
// (order-store.ts) and the restaurant slug, so the same visitor sees the
// same "N min" for the same restaurant on every reload and on every screen
// (home, menu, flash rows, checkout, order placed, tracker) without a
// network round trip or its own storage key.

export const ETA_MIN_MINUTES = 10;
export const ETA_MAX_MINUTES = 25;

/** A small deterministic string hash (FNV-1a) — good enough for a stable-looking
 * spread across visitors and restaurants, not for anything security-sensitive. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A stable integer between ETA_MIN_MINUTES and ETA_MAX_MINUTES inclusive —
 * the same `visitorId`/`restaurantSlug` pair always hashes to the same
 * number, so the estimate never changes on reload or between screens (AC1).
 */
export function estimateEtaMinutes(visitorId: string, restaurantSlug: string): number {
  const span = ETA_MAX_MINUTES - ETA_MIN_MINUTES + 1;
  return ETA_MIN_MINUTES + (hash(`${visitorId}:${restaurantSlug}`) % span);
}

export function etaLabel(minutes: number): string {
  return `${minutes} min`;
}
