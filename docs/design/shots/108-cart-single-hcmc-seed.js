// Seeds a single HCMC restaurant's cart with two lines, so /cart renders
// straight onto that restaurant's own cart (105-cart-single-hcmc.html) —
// the photo tile, name/stepper/price per line, and the breakdown preview.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
window.localStorage.setItem(
  'parody.cart',
  JSON.stringify([
    {
      itemId: 'ben-thanh-banh-mi-thit-nuong',
      restaurantSlug: 'ben-thanh-banh-mi',
      restaurantName: 'Bến Thành Bánh Mì',
      name: 'Bánh mì thịt nướng',
      amountMinor: 35000,
      currency: 'VND',
      quantity: 1,
    },
    {
      itemId: 'ben-thanh-banh-mi-op-la',
      restaurantSlug: 'ben-thanh-banh-mi',
      restaurantName: 'Bến Thành Bánh Mì',
      name: 'Bánh mì ốp la',
      amountMinor: 30000,
      currency: 'VND',
      quantity: 1,
    },
  ]),
);
