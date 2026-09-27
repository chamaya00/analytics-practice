// Seeds an order placed 5 minutes ago — past ON_THE_WAY_MS (4min), short of
// DELIVERED_MS (7min) in tracker-state.ts — so /tracker renders mid-delivery
// ("On the way" current) rather than the empty or Delivered state.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.order',
  JSON.stringify({
    orderId: '22222222-2222-4222-8222-222222222222',
    placedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
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
