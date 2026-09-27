import { describe, expect, it } from 'vitest';
import { formatHistoryDate } from './history-date';

const NOW = Date.parse('2026-09-27T20:00:00.000Z'); // 2026-09-27 in both UTC-based test locales

describe('formatHistoryDate (#147, "History row")', () => {
  it('reads "Today, <time>" for a date placed earlier the same day', () => {
    const placedAt = new Date(NOW - 60 * 60_000).toISOString();
    expect(formatHistoryDate(placedAt, 'sf', NOW)).toMatch(/^Today, /);
  });

  it('reads "Yesterday" for a date placed the previous calendar day', () => {
    const placedAt = new Date(NOW - 25 * 60 * 60_000).toISOString();
    expect(formatHistoryDate(placedAt, 'sf', NOW)).toBe('Yesterday');
  });

  it('reads a short weekday/month/day for anything older, in SF vs HCMC word order', () => {
    const placedAt = new Date(NOW - 5 * 24 * 60 * 60_000).toISOString();
    const sf = formatHistoryDate(placedAt, 'sf', NOW);
    const hcmc = formatHistoryDate(placedAt, 'hcmc', NOW);
    expect(sf).not.toBe('Yesterday');
    expect(sf).not.toMatch(/^Today/);
    expect(sf).not.toBe(hcmc);
  });

  it('uses 24-hour time for HCMC and 12-hour (AM/PM) for SF', () => {
    const placedAt = new Date(NOW - 60 * 60_000).toISOString();
    const sf = formatHistoryDate(placedAt, 'sf', NOW);
    const hcmc = formatHistoryDate(placedAt, 'hcmc', NOW);
    expect(sf).toMatch(/[AP]M/i);
    expect(hcmc).not.toMatch(/[AP]M/i);
  });
});
