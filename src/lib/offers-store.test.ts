import { beforeEach, describe, expect, it } from 'vitest';
import { clearOffersState, getOffersState, setOffersState } from './offers-store';
import { EMPTY_OFFERS_STATE } from './vouchers';

beforeEach(() => {
  window.localStorage.clear();
});

describe('offers-store', () => {
  it('returns the empty state when nothing is stored', () => {
    expect(getOffersState(window.localStorage)).toEqual(EMPTY_OFFERS_STATE);
  });

  it('round-trips a state written and read back', () => {
    const state = {
      discountId: 'hcmc-discount-t2' as const,
      deliveryId: 'hcmc-delivery-entry' as const,
      qualifyingDiscountIds: ['hcmc-discount-t1', 'hcmc-discount-t2'] as const,
      qualifyingDeliveryIds: ['hcmc-delivery-entry'] as const,
    };
    setOffersState(window.localStorage, state as never);
    expect(getOffersState(window.localStorage)).toEqual(state);
  });

  it('a stored value that cannot be parsed is treated as empty rather than thrown', () => {
    window.localStorage.setItem('parody.offersState', '{not json');
    expect(() => getOffersState(window.localStorage)).not.toThrow();
    expect(getOffersState(window.localStorage)).toEqual(EMPTY_OFFERS_STATE);
  });

  it('clearOffersState removes the stored state', () => {
    setOffersState(window.localStorage, {
      discountId: null,
      deliveryId: 'sf-delivery-entry',
      qualifyingDiscountIds: [],
      qualifyingDeliveryIds: ['sf-delivery-entry'],
    });
    clearOffersState(window.localStorage);
    expect(getOffersState(window.localStorage)).toEqual(EMPTY_OFFERS_STATE);
  });
});
