import { beforeEach, describe, expect, it } from 'vitest';
import {
  THANKS_VOUCHER_AMOUNT_MINOR,
  THANKS_VOUCHER_EXPIRY_MS,
  THANKS_VOUCHER_MINIMUM_SPEND_MINOR,
  consumeThanksVoucher,
  formatThanksVoucherExpiry,
  getThanksVoucher,
  thanksVoucherDiscountMinor,
  unlockThanksVoucher,
} from './thanks-voucher';

const NOW = new Date('2026-09-27T12:00:00.000Z').getTime();

beforeEach(() => {
  window.localStorage.clear();
});

describe('thanks-voucher', () => {
  it('unlocking creates a voucher with this city\'s amount, minimum and a 7-day expiry, not topped up', () => {
    const { voucher, toppedUp } = unlockThanksVoucher(window.localStorage, 'hcmc', 'order-1', NOW);
    expect(voucher.amountMinor).toBe(THANKS_VOUCHER_AMOUNT_MINOR.hcmc);
    expect(voucher.minimumSpendMinor).toBe(THANKS_VOUCHER_MINIMUM_SPEND_MINOR.hcmc);
    expect(new Date(voucher.expiresAt).getTime()).toBe(NOW + THANKS_VOUCHER_EXPIRY_MS);
    expect(voucher.sourceOrderId).toBe('order-1');
    expect(toppedUp).toBe(false);
  });

  it('getThanksVoucher reads back what was unlocked, for that city only', () => {
    unlockThanksVoucher(window.localStorage, 'sf', 'order-1', NOW);
    expect(getThanksVoucher(window.localStorage, 'sf', NOW)?.sourceOrderId).toBe('order-1');
    expect(getThanksVoucher(window.localStorage, 'hcmc', NOW)).toBeNull();
  });

  it('holding is at most one per city: unlocking again refreshes the expiry and reports a top-up', () => {
    unlockThanksVoucher(window.localStorage, 'hcmc', 'order-1', NOW);
    const laterNow = NOW + 60_000;
    const { voucher, toppedUp } = unlockThanksVoucher(window.localStorage, 'hcmc', 'order-2', laterNow);
    expect(toppedUp).toBe(true);
    expect(voucher.sourceOrderId).toBe('order-2');
    expect(new Date(voucher.expiresAt).getTime()).toBe(laterNow + THANKS_VOUCHER_EXPIRY_MS);
  });

  it('is not offered once expired: getThanksVoucher returns null past the injected clock\'s 7 days, and removes it', () => {
    unlockThanksVoucher(window.localStorage, 'sf', 'order-1', NOW);
    const pastExpiry = NOW + THANKS_VOUCHER_EXPIRY_MS + 1;
    expect(getThanksVoucher(window.localStorage, 'sf', pastExpiry)).toBeNull();
    expect(getThanksVoucher(window.localStorage, 'sf', pastExpiry)).toBeNull();
  });

  it('an unlock in one city is not offered in the other', () => {
    unlockThanksVoucher(window.localStorage, 'sf', 'order-1', NOW);
    expect(getThanksVoucher(window.localStorage, 'hcmc', NOW)).toBeNull();
  });

  it('applies only once the subtotal is at or above the minimum', () => {
    const { voucher } = unlockThanksVoucher(window.localStorage, 'sf', 'order-1', NOW);
    expect(thanksVoucherDiscountMinor(voucher, THANKS_VOUCHER_MINIMUM_SPEND_MINOR.sf - 1)).toBe(0);
    expect(thanksVoucherDiscountMinor(voucher, THANKS_VOUCHER_MINIMUM_SPEND_MINOR.sf)).toBe(THANKS_VOUCHER_AMOUNT_MINOR.sf);
  });

  it('thanksVoucherDiscountMinor is 0 for no voucher', () => {
    expect(thanksVoucherDiscountMinor(null, 1_000_000)).toBe(0);
  });

  it('consumeThanksVoucher removes only the named city\'s voucher', () => {
    unlockThanksVoucher(window.localStorage, 'sf', 'order-1', NOW);
    unlockThanksVoucher(window.localStorage, 'hcmc', 'order-2', NOW);
    consumeThanksVoucher(window.localStorage, 'sf');
    expect(getThanksVoucher(window.localStorage, 'sf', NOW)).toBeNull();
    expect(getThanksVoucher(window.localStorage, 'hcmc', NOW)?.sourceOrderId).toBe('order-2');
  });

  it('a stored value that cannot be parsed is treated as empty rather than thrown', () => {
    window.localStorage.setItem('parody.thanksVoucher', '{not json');
    expect(() => getThanksVoucher(window.localStorage, 'sf', NOW)).not.toThrow();
    expect(getThanksVoucher(window.localStorage, 'sf', NOW)).toBeNull();
  });

  it('formatThanksVoucherExpiry reads day then abbreviated month', () => {
    expect(formatThanksVoucherExpiry('2026-10-04T12:00:00.000Z')).toBe('4 Oct');
  });
});
