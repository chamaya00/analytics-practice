import { beforeEach, describe, expect, it } from 'vitest';
import {
  EVENTS_KEY,
  OPTIONS,
  PAIRS,
  VARIANT_KEY,
  assignVariant,
  castVote,
  computeStats,
  generateId,
  getCurrentPair,
  getEvents,
  getVariant,
  resetPoll,
  type VoteEvent,
} from './poll';

function voteEvent(pairId: string, option: string, direction: 'left' | 'right', variant: 'a' | 'b'): VoteEvent {
  return {
    id: generateId(),
    type: 'vote',
    pairId,
    option,
    direction,
    variant,
    timestamp: new Date().toISOString(),
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('computeStats', () => {
  it('shows zero rows for every option when there are no votes yet', () => {
    const stats = computeStats([]);
    expect(stats.total).toBe(0);
    for (const option of OPTIONS) expect(stats.perOption[option]).toBe(0);
    expect(stats.perVariant).toEqual({ a: 0, b: 0 });
  });

  it('computes total, per-option, and per-variant counts from the event log (AC3)', () => {
    const events = [
      voteEvent('pair-1', 'Coffee', 'left', 'a'),
      voteEvent('pair-1', 'Coffee', 'left', 'a'),
      voteEvent('pair-2', 'Dogs', 'right', 'b'),
    ];

    const stats = computeStats(events);

    expect(stats.total).toBe(3);
    expect(stats.perOption.Coffee).toBe(2);
    expect(stats.perOption.Dogs).toBe(1);
    expect(stats.perOption.Tea).toBe(0);
    expect(stats.perVariant).toEqual({ a: 2, b: 1 });
  });
});

describe('assignVariant', () => {
  it('persists the assigned variant across a reload and records exactly one variant_seen event (AC4)', () => {
    const storage = window.localStorage;

    const first = assignVariant(storage);
    expect(['a', 'b']).toContain(first);
    expect(getVariant(storage)).toBe(first);

    // Simulate a reload: a fresh call reading the same persisted storage.
    const second = assignVariant(storage);
    expect(second).toBe(first);

    const events = getEvents(storage);
    const seen = events.filter((event) => event.type === 'variant_seen');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ type: 'variant_seen', variant: first });
    expect(JSON.parse(storage.getItem(EVENTS_KEY) ?? '[]')).toHaveLength(1);
  });

  it('does not overwrite an existing variant assignment', () => {
    const storage = window.localStorage;
    storage.setItem('poll.variant', 'b');

    expect(assignVariant(storage)).toBe('b');
    expect(getEvents(storage).filter((e) => e.type === 'variant_seen')).toHaveLength(0);
  });
});

describe('resetPoll', () => {
  it('empties the log and the variant assignment, so the next read starts back at pair 1', () => {
    const storage = window.localStorage;
    const variant = assignVariant(storage);
    for (const pair of PAIRS) castVote(storage, pair, 'left', variant);
    expect(getCurrentPair(getEvents(storage))).toBeNull();

    resetPoll(storage);

    expect(getEvents(storage)).toEqual([]);
    expect(storage.getItem(EVENTS_KEY)).toBeNull();
    expect(getVariant(storage)).toBeNull();
    expect(storage.getItem(VARIANT_KEY)).toBeNull();
    expect(getCurrentPair(getEvents(storage))).toEqual(PAIRS[0]);
  });

  it('leaves a log holding exactly one variant_seen event once a variant is assigned again (ADR 0002)', () => {
    const storage = window.localStorage;
    assignVariant(storage);
    castVote(storage, PAIRS[0], 'left', 'a');

    resetPoll(storage);
    const after = assignVariant(storage);

    const events = getEvents(storage);
    expect(events.filter((event) => event.type === 'variant_seen')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'vote')).toHaveLength(0);
    expect(getVariant(storage)).toBe(after);
  });
});
