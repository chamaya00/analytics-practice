// Seeds a single SF restaurant's cart with two lines, so /cart renders
// straight onto that restaurant's own cart (105-cart-single-sf.html) — the
// photo tile, name/stepper/price per line, and the breakdown preview.

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
  ]),
);
