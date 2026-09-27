import { beforeEach, describe, expect, it } from 'vitest';
import { clearOffersState, getOffersState, offersStateKey, setOffersState } from './offers-store';
import { EMPTY_OFFERS_STATE } from './vouchers';

const SLUG = 'ben-thanh-banh-mi';
const OTHER_SLUG = 'saigon-pho-quan';

beforeEach(() => {
  window.localStorage.clear();
});

describe('offers-store', () => {
  it('returns the empty state when nothing is stored', () => {
    expect(getOffersState(window.localStorage, SLUG)).toEqual(EMPTY_OFFERS_STATE);
  });

  it('round-trips a state written and read back', () => {
    const state = {
      discountId: 'hcmc-discount-t2' as const,
      deliveryId: 'hcmc-delivery-entry' as const,
      qualifyingDiscountIds: ['hcmc-discount-t1', 'hcmc-discount-t2'] as const,
      qualifyingDeliveryIds: ['hcmc-delivery-entry'] as const,
    };
    setOffersState(window.localStorage, SLUG, state as never);
    expect(getOffersState(window.localStorage, SLUG)).toEqual(state);
  });

  it('a stored value that cannot be parsed is treated as empty rather than thrown', () => {
    window.localStorage.setItem(offersStateKey(SLUG), '{not json');
    expect(() => getOffersState(window.localStorage, SLUG)).not.toThrow();
    expect(getOffersState(window.localStorage, SLUG)).toEqual(EMPTY_OFFERS_STATE);
  });

  it('clearOffersState removes the stored state', () => {
    setOffersState(window.localStorage, SLUG, {
      discountId: null,
      deliveryId: 'sf-delivery-entry',
      qualifyingDiscountIds: [],
      qualifyingDeliveryIds: ['sf-delivery-entry'],
    });
    clearOffersState(window.localStorage, SLUG);
    expect(getOffersState(window.localStorage, SLUG)).toEqual(EMPTY_OFFERS_STATE);
  });
});

describe('offers-store is kept per restaurant (one cart per restaurant)', () => {
  const applied = {
    discountId: 'hcmc-discount-t2' as const,
    deliveryId: 'hcmc-delivery-entry' as const,
    qualifyingDiscountIds: ['hcmc-discount-t1', 'hcmc-discount-t2'] as const,
    qualifyingDeliveryIds: ['hcmc-delivery-entry'] as const,
  };

  it('a selection stored for one restaurant is not read back for another', () => {
    setOffersState(window.localStorage, SLUG, applied as never);
    expect(getOffersState(window.localStorage, OTHER_SLUG)).toEqual(EMPTY_OFFERS_STATE);
  });

  it('clearing one restaurant’s selection leaves another restaurant’s intact', () => {
    setOffersState(window.localStorage, SLUG, applied as never);
    setOffersState(window.localStorage, OTHER_SLUG, applied as never);
    clearOffersState(window.localStorage, SLUG);
    expect(getOffersState(window.localStorage, SLUG)).toEqual(EMPTY_OFFERS_STATE);
    expect(getOffersState(window.localStorage, OTHER_SLUG)).toEqual(applied);
  });

  it('the pre-split single-cart key is never read as any restaurant’s selection', () => {
    window.localStorage.setItem('parody.offersState', JSON.stringify(applied));
    expect(getOffersState(window.localStorage, SLUG)).toEqual(EMPTY_OFFERS_STATE);
  });
});
