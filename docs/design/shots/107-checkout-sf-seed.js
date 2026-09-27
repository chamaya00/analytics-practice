// Seeds a single-restaurant SF cart whose subtotal ($21.50) auto-qualifies
// for sf-discount-t1 ($2.00 off) and sf-delivery-entry (free delivery on
// north-beach-pizzeria's own $2.99 fee) — the same "2 applied · You saved
// $4.99" figures docs/design/80-checkout-sf.html depicts. Run by
// scripts/app-render's third argument before the page's own scripts, so
// checkout renders already filled rather than empty.

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
