// City persistence — docs/design/80-two-city-brand-and-flow.md, "Location
// picker": persists via `localStorage`, the same "caller supplies the
// Storage" pattern order-store.ts already uses, so a test can hand it a
// `Storage` stub whose `setItem` throws (private browsing) without a real
// browser harness. An unrecognised or missing stored value falls back to the
// picker (returns `null`) rather than throwing or guessing a city — "there
// is no default city, deliberately" (#80).

import { isCity, type City } from './money';

export const CITY_KEY = 'parody.city';

export function getStoredCity(storage: Storage): City | null {
  let raw: string | null;
  try {
    raw = storage.getItem(CITY_KEY);
  } catch {
    return null;
  }
  return isCity(raw) ? raw : null;
}

/** Returns whether the choice actually persisted — false when storage throws (private browsing), so the caller can show the inline "won't be remembered" notice. */
export function setStoredCity(storage: Storage, city: City): boolean {
  try {
    storage.setItem(CITY_KEY, city);
    return true;
  } catch {
    return false;
  }
}
