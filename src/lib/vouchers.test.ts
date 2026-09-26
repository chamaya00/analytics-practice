// Unit tests for the stacking/tier engine — docs/design/
// 87-promo-offers-and-flash.md's worked examples, transcribed as assertions
// rather than read once and trusted (AC1, AC2, AC3's flash-vs-t2 pick).

import { describe, expect, it } from 'vitest';
import {
  EMPTY_OFFERS_STATE,
  appliedDiscountAmountMinor,
  appliedVoucherIds,
  catalogueForCity,
  cheapestMinimumSpendMinor,
  flashCatalogueEntry,
  formatCountdown,
  manualSelect,
  pickLargest,
  syncOffersState,
  type CatalogueEntry,
} from './vouchers';

describe('cheapestMinimumSpendMinor (AC1 empty state)', () => {
  it('names the delivery-entry minimum in both cities', () => {
    expect(cheapestMinimumSpendMinor('hcmc')).toBe(50000);
    expect(cheapestMinimumSpendMinor('sf')).toBe(1000);
  });
});

describe('syncOffersState — nudge amounts (AC1)', () => {
  it('HCMC ₫250.000: t1/t2/delivery-entry qualify, t3 is greyed with the exact nudge', () => {
    const result = syncOffersState(EMPTY_OFFERS_STATE, catalogueForCity('hcmc'), 250000);
    const t3 = result.discountViews.find((view) => view.entry.id === 'hcmc-discount-t3')!;
    expect(t3.qualifies).toBe(false);
    expect(t3.nudgeAmountMinor).toBe(100000);
  });

  it('SF $21.50: t1/delivery-entry qualify, t2 and t3 are greyed with their own exact nudges', () => {
    const result = syncOffersState(EMPTY_OFFERS_STATE, catalogueForCity('sf'), 2150);
    const t2 = result.discountViews.find((view) => view.entry.id === 'sf-discount-t2')!;
    const t3 = result.discountViews.find((view) => view.entry.id === 'sf-discount-t3')!;
    expect(t2.qualifies).toBe(false);
    expect(t2.nudgeAmountMinor).toBe(1850);
    expect(t3.qualifies).toBe(false);
    expect(t3.nudgeAmountMinor).toBe(3850);
  });
});

describe('syncOffersState — one voucher per stack group, auto-select on unlock (AC1, AC2)', () => {
  it('HCMC ₫250.000: the higher qualifying tier (t2) auto-selects over t1, and the delivery entry auto-applies too', () => {
    const result = syncOffersState(EMPTY_OFFERS_STATE, catalogueForCity('hcmc'), 250000);
    expect(result.state.discountId).toBe('hcmc-discount-t2');
    expect(result.state.deliveryId).toBe('hcmc-delivery-entry');
    expect(appliedVoucherIds(result.state).sort()).toEqual(['hcmc-delivery-entry', 'hcmc-discount-t2'].sort());
  });

  it('checking a second voucher in the same group unchecks the first, and groups never block each other', () => {
    const first = syncOffersState(EMPTY_OFFERS_STATE, catalogueForCity('hcmc'), 250000);
    const manual = manualSelect(first.state, 'hcmc-discount-t1', 'discount');
    expect(manual.discountId).toBe('hcmc-discount-t1');
    expect(manual.deliveryId).toBe('hcmc-delivery-entry'); // untouched — different group
  });

  it('unchecks the currently-applied voucher in a group when it is tapped again', () => {
    const first = syncOffersState(EMPTY_OFFERS_STATE, catalogueForCity('hcmc'), 250000);
    const toggled = manualSelect(first.state, 'hcmc-discount-t2', 'discount');
    expect(toggled.discountId).toBeNull();
  });

  it('refuses to select a voucher that is not currently qualifying', () => {
    const first = syncOffersState(EMPTY_OFFERS_STATE, catalogueForCity('hcmc'), 250000);
    const attempted = manualSelect(first.state, 'hcmc-discount-t3', 'discount');
    expect(attempted.discountId).toBe('hcmc-discount-t2'); // unchanged
  });
});

describe('syncOffersState — an applied voucher dropping below its minimum (AC1)', () => {
  it('HCMC: removing a ₫60.000 item drops the subtotal to ₫190.000 — t2 unchecks and nothing replaces it, matching the doc’s worked error scenario', () => {
    const opened = syncOffersState(EMPTY_OFFERS_STATE, catalogueForCity('hcmc'), 250000);
    expect(opened.state.discountId).toBe('hcmc-discount-t2');

    const afterRemoval = syncOffersState(opened.state, catalogueForCity('hcmc'), 190000);
    expect(afterRemoval.discountDropped).toBe(true);
    expect(afterRemoval.state.discountId).toBeNull(); // not re-applied to t1, even though t1 still qualifies at ₫190.000
    expect(afterRemoval.state.deliveryId).toBe('hcmc-delivery-entry'); // independent partner, still comfortably met
    expect(afterRemoval.deliveryDropped).toBe(false);

    const t1 = afterRemoval.discountViews.find((view) => view.entry.id === 'hcmc-discount-t1')!;
    expect(t1.qualifies).toBe(true); // qualifying-but-unchecked
  });

  it('SF: dropping below the sole applied tier’s own minimum removes it with nothing to replace it', () => {
    const opened = syncOffersState(EMPTY_OFFERS_STATE, catalogueForCity('sf'), 2150); // sf-discount-t1 applied
    expect(opened.state.discountId).toBe('sf-discount-t1');

    const afterRemoval = syncOffersState(opened.state, catalogueForCity('sf'), 1500); // below t1's $20.00 minimum
    expect(afterRemoval.state.discountId).toBeNull();
    expect(afterRemoval.discountDropped).toBe(true);
  });
});

describe('pickLargest — tie-break by soonest expiry (AC2)', () => {
  it('two vouchers tied on amount: the one with the sooner expiry wins', () => {
    const soon: CatalogueEntry = {
      id: 'hcmc-discount-t1',
      city: 'hcmc',
      stackGroup: 'discount',
      tier: 1,
      label: 'tied, sooner',
      minimumSpendMinor: 0,
      amountMinor: 20000,
      expiryMinutes: 60,
      expiryLabel: '1 hour',
    };
    const later: CatalogueEntry = {
      ...soon,
      id: 'hcmc-discount-t2',
      label: 'tied, later',
      expiryMinutes: 4320,
      expiryLabel: '3 days',
    };
    expect(pickLargest([later, soon])).toBe('hcmc-discount-t1');
    expect(pickLargest([soon, later])).toBe('hcmc-discount-t1');
  });
});

describe('flash-vs-tier amount comparison (AC2, AC3 — the doc’s flash-live worked example)', () => {
  it('a ₫30.000 flash draw beats hcmc-discount-t2’s fixed ₫25.000 at the same ₫250.000 basket', () => {
    const flash = flashCatalogueEntry('hcmc', 30000, 500);
    const entries = [...catalogueForCity('hcmc'), flash];
    const result = syncOffersState(EMPTY_OFFERS_STATE, entries, 250000);
    expect(result.state.discountId).toBe('hcmc-flash');
    expect(appliedDiscountAmountMinor(result.state, entries)).toBe(30000);
  });

  it('a ₫15.000 flash draw still loses to t2’s ₫25.000 at the same basket', () => {
    const flash = flashCatalogueEntry('hcmc', 15000, 500);
    const entries = [...catalogueForCity('hcmc'), flash];
    const result = syncOffersState(EMPTY_OFFERS_STATE, entries, 250000);
    expect(result.state.discountId).toBe('hcmc-discount-t2');
  });

  it('a ₫15.000 flash draw beats t1’s ₫10.000 at a ₫120.000 basket where t2 does not yet qualify', () => {
    const flash = flashCatalogueEntry('hcmc', 15000, 500);
    const entries = [...catalogueForCity('hcmc'), flash];
    const result = syncOffersState(EMPTY_OFFERS_STATE, entries, 120000);
    expect(result.state.discountId).toBe('hcmc-flash');
  });

  it('the flash voucher is removed outright (not greyed) once its window ends, even if it was applied', () => {
    const flash = flashCatalogueEntry('hcmc', 30000, 500);
    const withFlash = syncOffersState(EMPTY_OFFERS_STATE, [...catalogueForCity('hcmc'), flash], 250000);
    expect(withFlash.state.discountId).toBe('hcmc-flash');

    // The window has ended: the caller stops including the flash entry at all.
    const afterExpiry = syncOffersState(withFlash.state, catalogueForCity('hcmc'), 250000);
    expect(afterExpiry.state.discountId).toBe(null);
    expect(afterExpiry.discountViews.some((view) => view.entry.id === 'hcmc-flash')).toBe(false);
  });
});

describe('formatCountdown', () => {
  it('renders mm:ss, zero-padded', () => {
    expect(formatCountdown(900)).toBe('15:00');
    expect(formatCountdown(512)).toBe('08:32');
    expect(formatCountdown(5)).toBe('00:05');
    expect(formatCountdown(0)).toBe('00:00');
  });
});
