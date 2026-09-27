// HCMC counterpart of 163-rate-driver-sf-seed.js — an order delivered 30
// minutes ago, unrated on both steps, so the rating sheet auto-opens on
// /tracker/ at its driver step (#163, docs/design/162-rate-driver-hcmc-dark).
// Run with app-render's dark flag for the dark render.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    {
      orderId: '22222222-2222-4222-8222-222222222163',
      placedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      etaMinutes: 20,
      deliveryMs: 5 * 60_000,
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
      ratingPromptedAt: null,
    },
  ]),
);
