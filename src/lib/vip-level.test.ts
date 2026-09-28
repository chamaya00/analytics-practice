import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_VIP_LEDGER,
  applyDeliveredOrderToLedger,
  computeVipLevel,
  higherVipLevel,
  platinumDiscountMinor,
  platinumSpendRemainingMinor,
  readVipLedger,
  writeVipLedger,
  type VipLedger,
} from './vip-level';

describe('computeVipLevel (AC1: exact thresholds, per currency)', () => {
  it('is none below 3 delivered orders, and none has no currency to check', () => {
    expect(computeVipLevel(2, { USD: 0, VND: 0 })).toBe('none');
  });

  it('is gold at exactly 3 delivered orders with no qualifying spend', () => {
    expect(computeVipLevel(3, { USD: 0, VND: 0 })).toBe('gold');
  });

  it('$59.99 of spend is not Platinum, and $60.00 is', () => {
    expect(computeVipLevel(3, { USD: 5999, VND: 0 })).toBe('gold');
    expect(computeVipLevel(3, { USD: 6000, VND: 0 })).toBe('platinum');
  });

  it('1.499.999 ₫ is not Platinum, and 1.500.000 ₫ is', () => {
    expect(computeVipLevel(3, { USD: 0, VND: 1499999 })).toBe('gold');
    expect(computeVipLevel(3, { USD: 0, VND: 1500000 })).toBe('platinum');
  });

  it('$59.00 plus 1.499.000 ₫ is not Platinum — currencies are never added or converted', () => {
    expect(computeVipLevel(3, { USD: 5900, VND: 1499000 })).toBe('gold');
  });

  it('Platinum requires Gold: spend alone, below 3 delivered orders, is still none', () => {
    expect(computeVipLevel(2, { USD: 6000, VND: 1500000 })).toBe('none');
  });
});

describe('higherVipLevel (Refinement 2: a level, once reached, is kept)', () => {
  it('never returns a lower level than either input', () => {
    expect(higherVipLevel('platinum', 'none')).toBe('platinum');
    expect(higherVipLevel('gold', 'platinum')).toBe('platinum');
    expect(higherVipLevel('gold', 'none')).toBe('gold');
    expect(higherVipLevel('none', 'none')).toBe('none');
  });
});

describe('applyDeliveredOrderToLedger (AC1: progress, and the high-water rule)', () => {
  it('2 delivered orders means no level and progress 2/3, and the 3rd means Gold', () => {
    let ledger: VipLedger = EMPTY_VIP_LEDGER;
    ledger = applyDeliveredOrderToLedger(ledger, { currency: 'USD', totalMinor: 1000, amountMinor: 1000 });
    ledger = applyDeliveredOrderToLedger(ledger, { currency: 'USD', totalMinor: 1000, amountMinor: 1000 });
    expect(ledger.deliveredCount).toBe(2);
    expect(ledger.level).toBe('none');

    ledger = applyDeliveredOrderToLedger(ledger, { currency: 'USD', totalMinor: 1000, amountMinor: 1000 });
    expect(ledger.deliveredCount).toBe(3);
    expect(ledger.level).toBe('gold');
  });

  it('sums spend into the order’s own currency only, never converting or adding across them', () => {
    let ledger: VipLedger = EMPTY_VIP_LEDGER;
    ledger = applyDeliveredOrderToLedger(ledger, { currency: 'USD', totalMinor: 5900, amountMinor: 5900 });
    ledger = applyDeliveredOrderToLedger(ledger, { currency: 'VND', totalMinor: 1499000, amountMinor: 1499000 });
    ledger = applyDeliveredOrderToLedger(ledger, { currency: 'USD', totalMinor: 100, amountMinor: 100 });
    expect(ledger.spendMinor).toEqual({ USD: 6000, VND: 1499000 });
    expect(ledger.deliveredCount).toBe(3);
    expect(ledger.level).toBe('platinum');
  });

  it('a legacy order with totalMinor null contributes its amountMinor instead', () => {
    let ledger: VipLedger = EMPTY_VIP_LEDGER;
    ledger = applyDeliveredOrderToLedger(ledger, { currency: 'USD', totalMinor: null, amountMinor: 1400 });
    expect(ledger.spendMinor.USD).toBe(1400);
  });

  it('never drops the level even if a later fold would compute a lower one on its own', () => {
    const platinumLedger: VipLedger = { v: 1, deliveredCount: 3, spendMinor: { USD: 6000, VND: 0 }, level: 'platinum' };
    // A single additional delivered order, spend 0 — computeVipLevel alone would still say platinum here
    // since deliveredCount/spend never decrease, but the high-water rule is what protects a ledger a
    // caller edited or partially replayed from ever reading back lower than it already was.
    const next = applyDeliveredOrderToLedger(platinumLedger, { currency: 'VND', totalMinor: 0, amountMinor: 0 });
    expect(next.level).toBe('platinum');
  });
});

describe('platinumDiscountMinor (AC2: rounding per currency, docs/design/162-*\'s worked examples)', () => {
  it('USD floors to the whole cent: $23.75 gives 237.5¢, so $2.37', () => {
    expect(platinumDiscountMinor(2375, 'USD')).toBe(237);
  });

  it('VND floors to the whole 1.000 ₫: 180.000 ₫ gives 18.000 ₫ exactly', () => {
    expect(platinumDiscountMinor(180000, 'VND')).toBe(18000);
  });

  it('VND floors down within the 1.000 band: 95.000 ₫ gives 9.500 → 9.000 ₫', () => {
    expect(platinumDiscountMinor(95000, 'VND')).toBe(9000);
  });

  it('never gives more than 10% (flooring only ever rounds down)', () => {
    expect(platinumDiscountMinor(2375, 'USD')).toBeLessThanOrEqual(237.5);
    expect(platinumDiscountMinor(95000, 'VND')).toBeLessThanOrEqual(9500);
  });
});

describe('platinumSpendRemainingMinor', () => {
  it('is the gap to the floor in that currency alone', () => {
    const ledger: VipLedger = { v: 1, deliveredCount: 3, spendMinor: { USD: 5230, VND: 420000 }, level: 'gold' };
    expect(platinumSpendRemainingMinor(ledger, 'USD')).toBe(770);
    expect(platinumSpendRemainingMinor(ledger, 'VND')).toBe(1080000);
  });
});

describe('readVipLedger/writeVipLedger', () => {
  beforeEach(() => window.localStorage.clear());

  it('reads EMPTY_VIP_LEDGER when nothing is stored', () => {
    expect(readVipLedger(window.localStorage)).toEqual(EMPTY_VIP_LEDGER);
  });

  it('round-trips a written ledger', () => {
    const ledger: VipLedger = { v: 1, deliveredCount: 5, spendMinor: { USD: 1200, VND: 0 }, level: 'gold' };
    writeVipLedger(window.localStorage, ledger);
    expect(readVipLedger(window.localStorage)).toEqual(ledger);
  });

  it('reads EMPTY_VIP_LEDGER for a corrupt value rather than throwing', () => {
    window.localStorage.setItem('parody.vip', '{not json');
    expect(readVipLedger(window.localStorage)).toEqual(EMPTY_VIP_LEDGER);
  });
});
