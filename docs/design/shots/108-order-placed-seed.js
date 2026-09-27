// Seeds a just-placed order from a single SF restaurant, so /order-placed
// renders its confirmation (105-order-placed.html) instead of redirecting
// to /restaurants/ for having nothing to confirm.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.order',
  JSON.stringify({
    orderId: '11111111-1111-4111-8111-111111111111',
    placedAt: new Date().toISOString(),
    items: [
      {
        itemId: 'mission-taqueria-al-pastor',
        restaurantSlug: 'mission-taqueria',
        restaurantName: 'Mission Taqueria',
        name: 'Al pastor taco',
        amountMinor: 425,
        currency: 'USD',
        quantity: 2,
      },
    ],
    itemCount: 2,
    amountMinor: 850,
    currency: 'USD',
    dropOffPreset: 'home',
    deliveryInstructions: 'hand_to_me',
    utensils: true,
    appliedVoucherIds: [],
    savedAmountMinor: 0,
    viewCount: 0,
    deliveredEventFired: false,
    rating: null,
  }),
);
