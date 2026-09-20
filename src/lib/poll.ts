// Pure event-log logic for the swipe-poll demo. Reads and writes only
// `poll.variant` and `poll.events` in the given Storage — see
// docs/design/3-swipe-poll.md and docs/decisions/0002-variant-seen-event.md.

export type Direction = 'left' | 'right';
export type Variant = 'a' | 'b';

export interface Pair {
  id: string;
  left: string;
  right: string;
}

export interface VoteEvent {
  id: string;
  type: 'vote';
  pairId: string;
  option: string;
  direction: Direction;
  variant: Variant;
  timestamp: string;
}

export interface VariantSeenEvent {
  id: string;
  type: 'variant_seen';
  variant: Variant;
  timestamp: string;
}

export type PollEvent = VoteEvent | VariantSeenEvent;

export const VARIANT_KEY = 'poll.variant';
export const EVENTS_KEY = 'poll.events';

export const PAIRS: Pair[] = [
  { id: 'pair-1', left: 'Coffee', right: 'Tea' },
  { id: 'pair-2', left: 'Cats', right: 'Dogs' },
  { id: 'pair-3', left: 'Beach', right: 'Mountains' },
  { id: 'pair-4', left: 'Morning person', right: 'Night owl' },
  { id: 'pair-5', left: 'Sweet', right: 'Savory' },
];

export const OPTIONS: string[] = PAIRS.flatMap((pair) => [pair.left, pair.right]);

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getVariant(storage: Storage): Variant | null {
  const value = storage.getItem(VARIANT_KEY);
  return value === 'a' || value === 'b' ? value : null;
}

/**
 * Reads `poll.variant`, assigning and persisting one with even odds on a
 * visitor's first read, and appending a `variant_seen` event to
 * `poll.events` at the moment of that first assignment only.
 */
export function assignVariant(storage: Storage): Variant {
  const existing = getVariant(storage);
  if (existing) return existing;

  const variant: Variant = Math.random() < 0.5 ? 'a' : 'b';
  storage.setItem(VARIANT_KEY, variant);
  appendEvent(storage, {
    id: generateId(),
    type: 'variant_seen',
    variant,
    timestamp: new Date().toISOString(),
  });
  return variant;
}

/**
 * Returns this browser to its first-visit state by removing both keys the
 * demo owns - the event log and the variant assignment - so the next
 * `assignVariant` re-rolls an arm and logs a fresh `variant_seen`. Both go
 * together on purpose: clearing the log alone would leave a persisted
 * `poll.variant` with no `variant_seen` event behind it, a combination no
 * ordinary visit can produce. See ADR 0004.
 */
export function resetPoll(storage: Storage): void {
  storage.removeItem(EVENTS_KEY);
  storage.removeItem(VARIANT_KEY);
}

export function getEvents(storage: Storage): PollEvent[] {
  const raw = storage.getItem(EVENTS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PollEvent[]) : [];
  } catch {
    return [];
  }
}

export function appendEvent(storage: Storage, event: PollEvent): PollEvent[] {
  const events = getEvents(storage);
  events.push(event);
  storage.setItem(EVENTS_KEY, JSON.stringify(events));
  return events;
}

export function voteEvents(events: PollEvent[]): VoteEvent[] {
  return events.filter((event): event is VoteEvent => event.type === 'vote');
}

/**
 * The first pair with no matching vote event, in PAIRS order. `null` once
 * every pair has one — the SwipeCard's End state.
 */
export function getCurrentPair(events: PollEvent[]): Pair | null {
  const voted = new Set(voteEvents(events).map((event) => event.pairId));
  return PAIRS.find((pair) => !voted.has(pair.id)) ?? null;
}

export function castVote(
  storage: Storage,
  pair: Pair,
  direction: Direction,
  variant: Variant,
): VoteEvent {
  const option = direction === 'left' ? pair.left : pair.right;
  const event: VoteEvent = {
    id: generateId(),
    type: 'vote',
    pairId: pair.id,
    option,
    direction,
    variant,
    timestamp: new Date().toISOString(),
  };
  appendEvent(storage, event);
  return event;
}

export interface Stats {
  total: number;
  perOption: Record<string, number>;
  perVariant: { a: number; b: number };
}

/**
 * Every number here is computed by reducing `events` fresh each call — no
 * separately maintained counter, per docs/design/3-swipe-poll.md.
 */
export function computeStats(events: PollEvent[]): Stats {
  const votes = voteEvents(events);
  const perOption: Record<string, number> = {};
  for (const option of OPTIONS) perOption[option] = 0;

  let a = 0;
  let b = 0;
  for (const vote of votes) {
    perOption[vote.option] = (perOption[vote.option] ?? 0) + 1;
    if (vote.variant === 'a') a += 1;
    else b += 1;
  }

  return { total: votes.length, perOption, perVariant: { a, b } };
}
