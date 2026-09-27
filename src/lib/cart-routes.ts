// The `?restaurant=<slug>` links between the three screens that work on one
// restaurant's cart — cart, checkout and Offers. Every restaurant is its own
// cart (order-store.ts's `selectRestaurantCart`), so every link between those
// screens carries which one; a screen opened without it falls back to the
// rules `selectRestaurantCart` documents rather than guessing.

export const RESTAURANT_PARAM = 'restaurant';

/** The requested restaurant slug from a `location.search` string, or `null` when absent or blank. */
export function restaurantSlugFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get(RESTAURANT_PARAM);
  return value && value.trim() !== '' ? value : null;
}

function withRestaurant(path: string, restaurantSlug: string): string {
  return `${path}?${RESTAURANT_PARAM}=${encodeURIComponent(restaurantSlug)}`;
}

export function cartPath(restaurantSlug: string): string {
  return withRestaurant('/cart/', restaurantSlug);
}

export function checkoutPath(restaurantSlug: string): string {
  return withRestaurant('/checkout/', restaurantSlug);
}

export function offersPath(restaurantSlug: string): string {
  return withRestaurant('/offers/', restaurantSlug);
}

/** The "Your carts" list, where a visitor with several carts picks one. */
export const ALL_CARTS_PATH = '/cart/';
