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
      quantity: 2,
    },
  ]),
);
