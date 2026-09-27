import { describe, expect, it } from 'vitest';
import { cartPath, checkoutPath, offersPath, restaurantSlugFromSearch } from './cart-routes';

describe('cart-routes', () => {
  it('reads ?restaurant= from a search string', () => {
    expect(restaurantSlugFromSearch('?restaurant=north-beach-pizzeria')).toBe('north-beach-pizzeria');
    expect(restaurantSlugFromSearch('?utm=x&restaurant=saigon-pho-quan')).toBe('saigon-pho-quan');
  });

  it('is null when the param is absent or blank', () => {
    expect(restaurantSlugFromSearch('')).toBeNull();
    expect(restaurantSlugFromSearch('?restaurant=')).toBeNull();
    expect(restaurantSlugFromSearch('?restaurant=%20')).toBeNull();
  });

  it('builds cart, checkout and offers links that carry the restaurant', () => {
    expect(cartPath('north-beach-pizzeria')).toBe('/cart/?restaurant=north-beach-pizzeria');
    expect(checkoutPath('north-beach-pizzeria')).toBe('/checkout/?restaurant=north-beach-pizzeria');
    expect(offersPath('north-beach-pizzeria')).toBe('/offers/?restaurant=north-beach-pizzeria');
  });

  it('a built link round-trips through restaurantSlugFromSearch', () => {
    const path = checkoutPath('saigon-pho-quan');
    expect(restaurantSlugFromSearch(path.slice(path.indexOf('?')))).toBe('saigon-pho-quan');
  });
});
