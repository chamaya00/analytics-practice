import { describe, expect, it } from 'vitest';
import { formatReviewCount } from './reviews';
import { ALL_RESTAURANTS } from './restaurants';

describe('formatReviewCount (#130 AC2)', () => {
  it('returns the exact number under 1,000', () => {
    expect(formatReviewCount(999)).toBe('999');
  });

  it('floors to whole thousands with "k+" at 1,000 and above, never rounding up', () => {
    expect(formatReviewCount(1000)).toBe('1k+');
    expect(formatReviewCount(1999)).toBe('1k+');
    expect(formatReviewCount(2000)).toBe('2k+');
  });
});

describe('restaurants.ts reviewCount data (#130 AC1)', () => {
  it('every restaurant has a fixed reviewCount, and none at or above a 4.8 rating is under 200', () => {
    for (const restaurant of ALL_RESTAURANTS) {
      expect(Number.isInteger(restaurant.reviewCount)).toBe(true);
      expect(restaurant.reviewCount).toBeGreaterThan(0);
      if (restaurant.rating >= 4.8) {
        expect(restaurant.reviewCount).toBeGreaterThanOrEqual(200);
      }
    }
  });

  it('counts are varied rather than uniform, with some under 1,000 and most 1,000 or more', () => {
    const counts = ALL_RESTAURANTS.map((restaurant) => restaurant.reviewCount);
    const distinctCounts = new Set(counts);
    expect(distinctCounts.size).toBeGreaterThan(counts.length / 2);

    const under1000 = counts.filter((count) => count < 1000);
    const atOrAbove1000 = counts.filter((count) => count >= 1000);
    expect(under1000.length).toBeGreaterThan(0);
    expect(atOrAbove1000.length).toBeGreaterThan(under1000.length);
  });
});
