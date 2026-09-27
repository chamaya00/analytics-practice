import { describe, expect, it } from 'vitest';
import { DRIVERS_BY_CITY, pickDriver } from './drivers';
import { CITIES } from './money';

describe('driver pool (#144 AC4)', () => {
  it('each city has 25 drivers with distinct ids', () => {
    for (const city of CITIES) {
      const pool = DRIVERS_BY_CITY[city];
      expect(pool).toHaveLength(25);
      expect(new Set(pool.map((driver) => driver.id)).size).toBe(25);
    }
  });

  it('every driver has a first-name-plus-last-initial name, a rating and a rating count', () => {
    for (const city of CITIES) {
      for (const driver of DRIVERS_BY_CITY[city]) {
        expect(driver.name).toMatch(/^\S+ \S\.$/);
        expect(driver.rating).toBeGreaterThan(0);
        expect(driver.ratingCount).toBeGreaterThan(0);
      }
    }
  });

  it('the HCMC pool uses Vietnamese names', () => {
    const names = DRIVERS_BY_CITY.hcmc.map((driver) => driver.name);
    expect(names).toContain('Minh T.');
    expect(names.some((name) => /[ăâđêôơư]/i.test(name))).toBe(true);
  });

  it('pickDriver is deterministic for a fixed random source, and picks the exact index that source lands on', () => {
    const pool = DRIVERS_BY_CITY.sf;
    expect(pickDriver('sf', () => 0)).toEqual(pool[0]);
    expect(pickDriver('sf', () => 0.999999)).toEqual(pool[pool.length - 1]);
    expect(pickDriver('sf', () => 0.5)).toEqual(pickDriver('sf', () => 0.5));
  });
});
