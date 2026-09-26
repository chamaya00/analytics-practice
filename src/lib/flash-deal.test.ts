// Unit tests for the flash-deal draw and its session persistence — docs/
// design/87-promo-offers-and-flash.md, "The flash-deal sheet" (AC4). A
// seeded random source stands in for `Math.random` throughout, so a draw is
// asserted against its exact result rather than only "it's in range."

import { beforeEach, describe, expect, it } from 'vitest';
import {
  FLASH_WINDOW_MS,
  drawFlashDeal,
  ensureFlashDraw,
  flashFeeForRestaurant,
  flashSecondsRemaining,
  getFlashDraw,
  isFlashLive,
  setFlashDraw,
} from './flash-deal';

/** Returns 0, then the next value, ... cycling — lets a test predict exactly which array index `pickIndex`/the fee-mode coin flip lands on. */
function seededRandom(sequence: number[]): () => number {
  let i = 0;
  return () => sequence[i++ % sequence.length];
}

describe('drawFlashDeal — range and step (AC4)', () => {
  it('HCMC draws an amount from ₫10.000–₫30.000 in ₫5.000 steps', () => {
    const amounts = new Set<number>();
    for (let step = 0; step < 5; step++) {
      const draw = drawFlashDeal('hcmc', 0, seededRandom([step / 5, 0, 0, 0, 0]));
      amounts.add(draw.amountMinor);
    }
    expect([...amounts].sort((a, b) => a - b)).toEqual([10000, 15000, 20000, 25000, 30000]);
  });

  it('SF draws an amount from $2.00–$6.00 in $1.00 steps', () => {
    const amounts = new Set<number>();
    for (let step = 0; step < 5; step++) {
      const draw = drawFlashDeal('sf', 0, seededRandom([step / 5, 0, 0, 0, 0]));
      amounts.add(draw.amountMinor);
    }
    expect([...amounts].sort((a, b) => a - b)).toEqual([200, 300, 400, 500, 600]);
  });

  it('draws two distinct restaurants from the city catalogue, each with a free-or-reduced fee mode', () => {
    const draw = drawFlashDeal('hcmc', 0, seededRandom([0, 0, 0.9, 0, 0.1]));
    expect(draw.restaurants).toHaveLength(2);
    expect(draw.restaurants[0].slug).not.toBe(draw.restaurants[1].slug);
    expect(['free', 'reduced']).toContain(draw.restaurants[0].feeMode);
    expect(['free', 'reduced']).toContain(draw.restaurants[1].feeMode);
  });

  it('a 15:00 countdown starts at the drawn moment', () => {
    const draw = drawFlashDeal('hcmc', 1_000_000, seededRandom([0]));
    expect(isFlashLive(draw, 1_000_000)).toBe(true);
    expect(flashSecondsRemaining(draw, 1_000_000)).toBe(900);
    expect(flashSecondsRemaining(draw, 1_000_000 + FLASH_WINDOW_MS)).toBe(0);
    expect(isFlashLive(draw, 1_000_000 + FLASH_WINDOW_MS)).toBe(false);
  });
});

describe('session persistence — one draw per city per session (AC4)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('the first home-feed load this session draws and stores; returning does not redraw', () => {
    const first = ensureFlashDraw(window.sessionStorage, 'hcmc', 1000, seededRandom([0.4, 0.1, 0.6]));
    expect(first.isNewDraw).toBe(true);

    const second = ensureFlashDraw(window.sessionStorage, 'hcmc', 5000, seededRandom([0.9, 0.9, 0.9]));
    expect(second.isNewDraw).toBe(false);
    expect(second.draw).toEqual(first.draw); // the stored draw, not a new one at the later timestamp
  });

  it('the first visit to the other city this session makes its own independent draw', () => {
    ensureFlashDraw(window.sessionStorage, 'hcmc', 1000, seededRandom([0.4, 0.1, 0.6]));
    const sf = ensureFlashDraw(window.sessionStorage, 'sf', 1000, seededRandom([0.9, 0.9, 0.9]));
    expect(sf.isNewDraw).toBe(true);
    expect(getFlashDraw(window.sessionStorage, 'sf')).toEqual(sf.draw);
    expect(getFlashDraw(window.sessionStorage, 'hcmc')).not.toEqual(sf.draw);
  });

  it('a stored draw that cannot be parsed is replaced by a fresh draw, and nothing throws', () => {
    window.sessionStorage.setItem('flashDeal:hcmc', '{not json');
    let result;
    expect(() => (result = ensureFlashDraw(window.sessionStorage, 'hcmc', 1000, seededRandom([0.2])))).not.toThrow();
    expect(result!.isNewDraw).toBe(true);
    expect(getFlashDraw(window.sessionStorage, 'hcmc')).toEqual(result!.draw); // the replacement draw is now stored

    window.sessionStorage.setItem('flashDeal:hcmc', JSON.stringify({ drawnAt: 1, amountMinor: 'not-a-number' }));
    expect(() => getFlashDraw(window.sessionStorage, 'hcmc')).not.toThrow();
    expect(getFlashDraw(window.sessionStorage, 'hcmc')).toBeNull();
  });

  it('a new session (no stored key) draws again', () => {
    setFlashDraw(window.sessionStorage, 'hcmc', {
      drawnAt: 0,
      amountMinor: 10000,
      restaurants: [
        { slug: 'a', feeMode: 'free' },
        { slug: 'b', feeMode: 'reduced' },
      ],
    });
    window.sessionStorage.clear(); // simulates a fresh session/tab: no cooldown to check against
    const result = ensureFlashDraw(window.sessionStorage, 'hcmc', 1000, seededRandom([0.2]));
    expect(result.isNewDraw).toBe(true);
  });
});

describe('flashFeeForRestaurant — the effective delivery fee ordering (AC4)', () => {
  const draw = {
    drawnAt: 0,
    amountMinor: 15000,
    restaurants: [
      { slug: 'free-one', feeMode: 'free' as const },
      { slug: 'reduced-one', feeMode: 'reduced' as const },
    ],
  };

  it('a free-mode restaurant waives its fee outright while the window is live', () => {
    expect(flashFeeForRestaurant(draw, 'hcmc', 'free-one', 15000, 0)).toBe(0);
  });

  it('a reduced-mode restaurant gets a flat ₫10.000/$2.00 reduction off its own normal fee', () => {
    expect(flashFeeForRestaurant(draw, 'hcmc', 'reduced-one', 15000, 0)).toBe(5000);
    expect(flashFeeForRestaurant(draw, 'sf', 'reduced-one', 299, 0)).toBe(99);
  });

  it('returns null once the window has ended, or for a restaurant not in the draw', () => {
    expect(flashFeeForRestaurant(draw, 'hcmc', 'free-one', 15000, FLASH_WINDOW_MS)).toBeNull();
    expect(flashFeeForRestaurant(draw, 'hcmc', 'someone-else', 15000, 0)).toBeNull();
  });
});
