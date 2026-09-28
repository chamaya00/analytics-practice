// The same SF cart as 107-checkout-sf-seed.js ($21.50, auto-qualifying for
// sf-discount-t1 and sf-delivery-entry), plus a held #166 thanks voucher for
// this city so checkout shows all three lines together — Discount, Thanks
// voucher, and the catalogue vouchers' own free delivery (docs/design/
// 162-checkout-sf-light).

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.cart',
  JSON.stringify([
    {
      itemId: 'north-beach-pizzeria-margherita',
      restaurantSlug: 'north-beach-pizzeria',
      restaurantName: 'North Beach Pizzeria',
      name: 'Margherita',
      amountMinor: 2150,
      currency: 'USD',
      quantity: 1,
    },
  ]),
);
window.localStorage.setItem(
  'parody.thanksVoucher',
  JSON.stringify({
    sf: {
      amountMinor: 300,
      minimumSpendMinor: 1500,
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      sourceOrderId: '11111111-1111-4111-8111-111111111166',
    },
  }),
);
