// The real transport for #68: wires `track()` (tracking.ts) to the Supabase
// table ADR 0005 chose (docs/decisions/0005-hosted-event-store.md). One
// insert-only POST per event, over the Data API, with the publishable key
// only — the secret key never appears in this repository. When the store's
// URL or key is absent (CI, local dev, an unconfigured preview deploy),
// `initTracking` leaves `track` at its no-op default from tracking.ts: no
// request is attempted, nothing throws, and the build needs neither value.
//
// The database enforces the ADR's anti-spam bounds itself (the migration in
// supabase/migrations/ is the source of truth); this module enforces the
// same shape, size, and bot bounds client-side too; before sending, not
// instead of the store's own check — a request this drops never has the
// chance to be refused, and one that slips past here still meets the
// database's own CHECK constraints, RLS policy, and rate limit.

import { getSessionId, getVisitorId } from './order-store';
import { isValidEventProps, setTrack, type EventName, type EventProps, type Track } from './tracking';

const EVENTS_PATH = '/rest/v1/events';

// ADR 0005 §1: `props jsonb` checked to be an object of at most 1 KB.
const MAX_PROPS_BYTES = 1024;

// ADR 0005 §5: "the sender sends nothing when `navigator.webdriver` is true
// or the user agent matches a bot pattern (the user agent is not stored)".
const BOT_UA_RE = /bot|crawler|spider|headless|puppeteer|playwright|selenium|phantom/i;

function isLikelyBot(): boolean {
  if (typeof navigator === 'undefined') return true;
  if (navigator.webdriver) return true;
  return BOT_UA_RE.test(navigator.userAgent);
}

function propsByteLength(props: EventProps): number {
  return new TextEncoder().encode(JSON.stringify(props)).length;
}

export interface SupabaseSenderConfig {
  url: string;
  publishableKey: string;
  fetchImpl?: typeof fetch;
  localStorage?: Storage;
  sessionStorage?: Storage;
}

/**
 * Builds the row one insert sends — ADR 0005 §1's columns. `id` is the
 * client-generated retry key; `variant` is always null this round
 * (docs/measurement/66-parody-event-contract.md §3 — no experiment ships).
 */
export function buildEventRow(
  eventName: EventName,
  props: EventProps,
  ids: { visitorId: string; sessionId: string },
): Record<string, unknown> {
  return {
    id: crypto.randomUUID(),
    event_name: eventName,
    occurred_at: new Date().toISOString(),
    visitor_id: ids.visitorId,
    session_id: ids.sessionId,
    variant: null,
    props,
  };
}

/**
 * The real sender: an insert-only POST to Supabase's Data API, one event
 * per request, `Prefer: return=minimal` (ADR 0005). Best-effort and
 * non-blocking — nothing in the funnel may wait on it (event contract §7),
 * so a failed or rejected request is swallowed rather than surfaced.
 */
export function createSupabaseSender(config: SupabaseSenderConfig): Track {
  const fetchImpl = config.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  const localStorage = config.localStorage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  const sessionStorage =
    config.sessionStorage ?? (typeof window !== 'undefined' ? window.sessionStorage : undefined);

  return (eventName, props) => {
    if (!fetchImpl || !localStorage || !sessionStorage) return;
    if (isLikelyBot()) return;
    if (!isValidEventProps(eventName, props)) return;
    if (propsByteLength(props) > MAX_PROPS_BYTES) return;

    const row = buildEventRow(eventName, props, {
      visitorId: getVisitorId(localStorage),
      sessionId: getSessionId(sessionStorage),
    });

    fetchImpl(`${config.url}${EVENTS_PATH}`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    }).catch(() => {});
  };
}

/**
 * Reads the store's URL and publishable key from the environment and, if
 * both are present, swaps `track` to send there. Absent either — CI, local
 * dev, an unconfigured preview deploy — `track` stays the no-op default:
 * "When the key or URL is absent, the sender does nothing" (ADR 0005).
 */
export function initTracking(): void {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const publishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return;
  setTrack(createSupabaseSender({ url, publishableKey }));
}
