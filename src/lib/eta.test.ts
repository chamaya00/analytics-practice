import { describe, expect, it } from 'vitest';
import { estimateEtaMinutes, ETA_MAX_MINUTES, ETA_MIN_MINUTES, etaLabel } from './eta';

describe('estimateEtaMinutes (AC1)', () => {
  it('is deterministic — the same visitor and slug repeated gives the same number', () => {
    const first = estimateEtaMinutes('visitor-1', 'mission-taqueria');
    const second = estimateEtaMinutes('visitor-1', 'mission-taqueria');
    expect(second).toBe(first);
  });

  it('stays within 10–25 minutes across many different visitors and slugs', () => {
    for (let i = 0; i < 200; i++) {
      const minutes = estimateEtaMinutes(`visitor-${i}`, `restaurant-${i}`);
      expect(Number.isInteger(minutes)).toBe(true);
      expect(minutes).toBeGreaterThanOrEqual(ETA_MIN_MINUTES);
      expect(minutes).toBeLessThanOrEqual(ETA_MAX_MINUTES);
    }
  });

  it('a different slug for the same visitor can give a different estimate', () => {
    const estimates = new Set<number>();
    for (let i = 0; i < 30; i++) {
      estimates.add(estimateEtaMinutes('visitor-1', `restaurant-${i}`));
    }
    expect(estimates.size).toBeGreaterThan(1);
  });

  it('a different visitor for the same slug can give a different estimate', () => {
    const estimates = new Set<number>();
    for (let i = 0; i < 30; i++) {
      estimates.add(estimateEtaMinutes(`visitor-${i}`, 'mission-taqueria'));
    }
    expect(estimates.size).toBeGreaterThan(1);
  });
});

describe('etaLabel', () => {
  it('renders "N min"', () => {
    expect(etaLabel(18)).toBe('18 min');
  });
});
