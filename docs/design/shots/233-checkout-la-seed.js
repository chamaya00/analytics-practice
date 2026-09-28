// Seeds an LA cart (Koreatown Charcoal House's galbi plate, $26.95) so
// /checkout/ renders an LA order in dollars with LA's vouchers - #233
// criterion 3's checkout render.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'la');
window.localStorage.setItem(
  'parody.cart',
  JSON.stringify([
    {
      itemId: 'koreatown-charcoal-house-galbi-plate',
      restaurantSlug: 'koreatown-charcoal-house',
      restaurantName: 'Koreatown Charcoal House',
      name: 'Galbi plate',
      amountMinor: 2695,
      currency: 'USD',
      quantity: 1,
    },
  ]),
);
