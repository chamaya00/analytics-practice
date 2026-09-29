// The real transport for #68: wires `track()` (tracking.ts) to the Supabase
// table ADR 0005 chose (docs/decisions/0005-hosted-event-store.md). One
// insert-only POST per event, over the Data API, with the publishable key
// only — the secret key never appears in this repository. When the store's
// URL or key is absent (CI, local dev, an unconfigured preview deploy),
// `initTracking` sets `track` to tracking.ts's no-op and drops whatever was
// queued before it ran (#245): no request is attempted, nothing throws, and
// the build needs neither value.
//
// The database enforces the ADR's anti-spam bounds itself (the migration in
// supabase/migrations/ is the source of truth); this module enforces the
// same shape, size, and bot bounds client-side too; before sending, not
// instead of the store's own check — a request this drops never has the
// chance to be refused, and one that slips past here still meets the
// database's own CHECK constraints, RLS policy, and rate limit.

import { applyInternalMarking, readIsInternal, sessionStartedProps, SESSION_STARTED_KEY } from './acquisition';
import { getSessionId, getVisitorId } from './order-store';
import { BUILD } from './build-stamp';
import { assignSeq, isValidEventProps, nextSeq, noopTrack, seqOf, setTrack, type EventName, type EventProps, type Track } from './tracking';

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
 * `is_internal` is the owner-traffic flag (#225, ADR 0013): true/false only.
 */
export function buildEventRow(
  eventName: EventName,
  props: EventProps,
  ids: { visitorId: string; sessionId: string; isInternal: boolean; seq?: number | null },
): Record<string, unknown> {
  return {
    id: crypto.randomUUID(),
    event_name: eventName,
    occurred_at: new Date().toISOString(),
    visitor_id: ids.visitorId,
    session_id: ids.sessionId,
    variant: null,
    is_internal: ids.isInternal,
    seq: ids.seq ?? null,
    build: BUILD,
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
      isInternal: readIsInternal(localStorage),
      seq: seqOf(props),
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

/** What the site-wide initialiser reads from the page it runs on. */
export interface PageContext {
  search: string;
  referrer: string;
  origin: string;
  localStorage: Storage | undefined;
  sessionStorage: Storage | undefined;
}

/**
 * Fires `session_started` once per session (#225, contract §6): only on
 * the page load that first sees a `session_id` it hasn't started yet. The
 * key is set as the event is handed to `send`. If sessionStorage is
 * unavailable nothing is sent, because the sender couldn't build a
 * `session_id` for it either.
 */
export function startSessionOnce(page: PageContext, send: Track): void {
  const storage = page.sessionStorage;
  if (!storage) return;
  try {
    const sessionId = getSessionId(storage);
    if (storage.getItem(SESSION_STARTED_KEY) === sessionId) return;
    storage.setItem(SESSION_STARTED_KEY, sessionId);
  } catch {
    return;
  }
  const props = sessionStartedProps(page.search, page.referrer, page.origin);
  assignSeq(props, nextSeq(storage));
  send('session_started', props);
}

/**
 * The site-wide initialiser's body, with the page passed in. In order: the
 * `?internal=` marking (always, before anything is sent), then — only when
 * the store is configured — `session_started` through the real sender, then
 * that sender installed, which flushes the calls page scripts queued before
 * this ran (#245). So `session_started` is the first event this page load
 * sends. With no store, `noopTrack` is installed and the queue is dropped.
 */
export function startTracking(
  config: Pick<SupabaseSenderConfig, 'url' | 'publishableKey' | 'fetchImpl'> | null,
  page: PageContext,
): void {
  applyInternalMarking(page.search, page.localStorage);
  if (!config) {
    setTrack(noopTrack);
    return;
  }
  const send = createSupabaseSender({
    ...config,
    localStorage: page.localStorage,
    sessionStorage: page.sessionStorage,
  });
  startSessionOnce(page, send);
  setTrack(send);
}

function storageOrUndefined(read: () => Storage): Storage | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

function currentPage(): PageContext {
  return {
    search: window.location.search,
    referrer: document.referrer,
    origin: window.location.origin,
    localStorage: storageOrUndefined(() => window.localStorage),
    sessionStorage: storageOrUndefined(() => window.sessionStorage),
  };
}

/**
 * Reads the store's URL and publishable key from the environment and, if
 * both are present, swaps `track` to send there. Absent either — CI, local
 * dev, an unconfigured preview deploy — `track` becomes the no-op:
 * "When the key or URL is absent, the sender does nothing" (ADR 0005).
 * `BaseLayout.astro` runs this on every page; see `startTracking` for the
 * `?internal=` marking and `session_started` it also does (#225).
 */
export function initTracking(): void {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const publishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  startTracking(url && publishableKey ? { url, publishableKey } : null, currentPage());
}
