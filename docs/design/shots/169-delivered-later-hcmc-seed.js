// HCMC counterpart of 169-delivered-later-sf-seed.js — an order delivered 8
// minutes ago, unrated but already prompted, for #169's celebratory
// Delivered hero and done rail (docs/design/162-*, "Delivered"). Run with
// app-render's dark flag for the dark render.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    {
      orderId: '22222222-2222-4222-8222-222222222169',
      placedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
      etaMinutes: 20,
      deliveryMs: 12 * 60_000,
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
      totalMinor: 82000,
      currency: 'VND',
      driver: { id: 'hcmc-driver-01', name: 'Minh T.', rating: 4.9, ratingCount: 3312 },
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 1,
      deliveredEventFired: true,
      rating: null,
      driverRating: null,
      ratingPromptedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      walletPaid: false,
      thanksVoucherMinor: 0,
      vipCounted: false,
    },
  ]),
);
