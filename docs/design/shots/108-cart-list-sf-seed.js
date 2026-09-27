// Seeds carts from two SF restaurants, so /cart renders the "Your carts"
// list (105-cart-list-sf.html) rather than a single restaurant's cart.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.cart',
  JSON.stringify([
    {
      itemId: 'mission-taqueria-al-pastor',
      restaurantSlug: 'mission-taqueria',
      restaurantName: 'Mission Taqueria',
      name: 'Al pastor taco',
      amountMinor: 425,
      currency: 'USD',
      quantity: 2,
    },
    {
      itemId: 'mission-taqueria-chips-guac',
      restaurantSlug: 'mission-taqueria',
      restaurantName: 'Mission Taqueria',
      name: 'Chips & guacamole',
      amountMinor: 650,
      currency: 'USD',
      quantity: 1,
    },
    {
      itemId: 'north-beach-pizzeria-margherita',
      restaurantSlug: 'north-beach-pizzeria',
      restaurantName: 'North Beach Pizzeria',
      name: 'Margherita',
      amountMinor: 1650,
      currency: 'USD',
      quantity: 1,
    },
  ]),
);
