// Seeds an order placed 30 minutes ago — well past DELIVERED_MS (7min) in
// tracker-state.ts — so /tracker renders Delivered with the interactive
// rating prompt (105-tracker.html).

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
window.localStorage.setItem(
  'parody.order',
  JSON.stringify({
    orderId: '33333333-3333-4333-8333-333333333333',
    placedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    items: [
      {
        itemId: 'ben-thanh-banh-mi-thit-nuong',
        restaurantSlug: 'ben-thanh-banh-mi',
        restaurantName: 'Bến Thành Bánh Mì',
        name: 'Bánh mì thịt nướng',
        amountMinor: 35000,
        currency: 'VND',
        quantity: 2,
      },
    ],
    itemCount: 2,
    amountMinor: 70000,
    currency: 'VND',
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
