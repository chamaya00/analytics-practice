/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
window.localStorage.setItem(
  'parody.order',
  JSON.stringify({
    orderId: 'render-order-1',
    placedAt: new Date().toISOString(),
    etaMinutes: 18,
    deliveryMs: 9 * 60_000,
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
    deliveryInstructions: 'leave_at_door',
    utensils: true,
    appliedVoucherIds: [],
    savedAmountMinor: 0,
    viewCount: 0,
    deliveredEventFired: false,
    rating: null,
  }),
);
