// Acquisition and owner traffic, client side (#225):
// docs/measurement/219-analytics-readiness-contract.md §5 (the
// `?internal=1` marking and the `is_internal` column) and §6
// (`session_started` and its four props). The store checks the same
// patterns in 20261002000000_session_started_and_is_internal.sql.
//
// Privacy is the point of this module. It reads exactly four query
// parameters by name - `utm_source`, `utm_medium`, `utm_campaign` and
// `internal` - with `URLSearchParams.get()`, and never iterates the query
// string, so a click ID or any other parameter is never even read. From
// the referrer it keeps the host only. `internal` only ever sets or clears
// a localStorage key; it never goes into a row.

import type { EventProps } from './tracking';

/** `localStorage` key marking this browser as the owner's (contract §5). */
export const INTERNAL_KEY = 'parody.internal';

/** `sessionStorage` key holding the `session_id` `session_started` last fired for (contract §6). */
export const SESSION_STARTED_KEY = 'parody.sessionStarted';

export const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign'] as const;

const NONE = '(none)';
const SELF = '(self)';
const INVALID = '(invalid)';

export const REFERRER_SENTINELS = [NONE, SELF, INVALID] as const;
export const UTM_SENTINELS = [NONE, INVALID] as const;

export const HOST_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
export const UTM_VALUE_RE = /^[a-z0-9][a-z0-9._-]{0,49}$/;

/** A valid `referrer_host`: a sentinel, or a 1-253 character host matching the pattern. */
export function isValidReferrerHost(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if ((REFERRER_SENTINELS as readonly string[]).includes(value)) return true;
  return value.length >= 1 && value.length <= 253 && HOST_RE.test(value);
}

/** A valid `utm_*` value: a sentinel, or 1-50 characters matching the pattern. */
export function isValidUtmValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if ((UTM_SENTINELS as readonly string[]).includes(value)) return true;
  return UTM_VALUE_RE.test(value);
}

/**
 * `referrer_host` (contract §6), in the contract's order: empty gives
 * `(none)`, unparseable gives `(invalid)`, same origin gives `(self)`,
 * otherwise the lowercased hostname with one leading `www.` removed, kept
 * only if it matches the host pattern. Never the scheme, port, path, query
 * string, fragment or user info.
 */
export function referrerHost(referrer: string, origin: string): string {
  if (!referrer) return NONE;
  let parsed: URL;
  try {
    parsed = new URL(referrer);
  } catch {
    return INVALID;
  }
  if (parsed.origin === origin) return SELF;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  return host.length >= 1 && host.length <= 253 && HOST_RE.test(host) ? host : INVALID;
}

/** One `utm_*` value (contract §6): missing or blank gives `(none)`; otherwise trimmed, lowercased, and kept only if it matches. */
export function utmValue(raw: string | null): string {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return NONE;
  return UTM_VALUE_RE.test(value) ? value : INVALID;
}

/** The four `session_started` props. Reads the three utm_ names with `.get()` and nothing else from the query string. */
export function sessionStartedProps(search: string, referrer: string, origin: string): EventProps {
  const params = new URLSearchParams(search);
  return {
    referrer_host: referrerHost(referrer, origin),
    utm_source: utmValue(params.get('utm_source')),
    utm_medium: utmValue(params.get('utm_medium')),
    utm_campaign: utmValue(params.get('utm_campaign')),
  };
}

/**
 * The `?internal=` marking (contract §5), run on every page load before
 * any event from it is sent: `1` sets the key, `0` removes it, anything
 * else does nothing. Blocked storage is swallowed.
 */
export function applyInternalMarking(search: string, storage: Storage | undefined): void {
  const value = new URLSearchParams(search).get('internal');
  if (value !== '1' && value !== '0') return;
  try {
    if (value === '1') storage?.setItem(INTERNAL_KEY, '1');
    else storage?.removeItem(INTERNAL_KEY);
  } catch {
    // Blocked storage reads as unmarked; nothing to do.
  }
}

/** `is_internal` for a row, read at send time. Blocked storage reads as `false`. */
export function readIsInternal(storage: Storage | undefined): boolean {
  try {
    return storage?.getItem(INTERNAL_KEY) === '1';
  } catch {
    return false;
  }
}
