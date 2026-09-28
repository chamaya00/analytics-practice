// The same HCMC cart as 107-checkout-hcmc-seed.js (250.000 ₫, auto-
// qualifying for hcmc-discount-t2 and hcmc-delivery-entry), plus a held
// #166 thanks voucher for this city so checkout shows all three lines
// together (docs/design/162-checkout-hcmc-dark). Run with app-render's dark
// flag.

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
window.localStorage.setItem(
  'parody.thanksVoucher',
  JSON.stringify({
    hcmc: {
      amountMinor: 30000,
      minimumSpendMinor: 150000,
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      sourceOrderId: '22222222-2222-4222-8222-222222222166',
    },
  }),
);
