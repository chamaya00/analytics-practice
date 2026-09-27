// Seeds a single-restaurant HCMC cart whose subtotal (250.000 ₫) auto-
// qualifies for hcmc-discount-t2 (25.000 ₫ off) and hcmc-delivery-entry
// (free delivery on saigon-pho-quan's own 15.000 ₫ fee) — the same "2
// applied · You saved 40.000 ₫" figures docs/design/80-checkout-hcmc.html
// depicts. Run by scripts/app-render's third argument before the page's own
// scripts, so checkout and offers render already filled rather than empty.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
window.localStorage.setItem(
  'parody.cart',
  JSON.stringify([
    {
      itemId: 'saigon-pho-quan-bo',
      restaurantSlug: 'saigon-pho-quan',
      restaurantName: 'Sài Gòn Phở Quán',
      name: 'Phở bò',
      amountMinor: 250000,
      currency: 'VND',
      quantity: 1,
    },
  ]),
);
