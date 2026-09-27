// Seeds one item added to Mission Taqueria's own cart, so the menu page
// renders a quantity stepper (not just an Add button) and the fixed
// cart-summary bar above the tab bar — the filled state 105-menu-sf.html
// depicts. Run by scripts/app-render's third argument before the page's
// own scripts.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.cart',
  JSON.stringify([
    {
      itemId: 'mission-taqueria-chips-guac',
      restaurantSlug: 'mission-taqueria',
      restaurantName: 'Mission Taqueria',
      name: 'Chips & guacamole',
      amountMinor: 650,
      currency: 'USD',
      quantity: 2,
    },
  ]),
);
