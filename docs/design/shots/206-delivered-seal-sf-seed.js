// Seeds an SF order delivered 8 minutes ago, unrated but already prompted (so
// the rating sheet does not auto-open and cover the card), for #206's shared
// rubber-stamp seal (docs/design/162-*, "The deliberate oddity: the stamp") —
// opened afterward, the same static layout 169-delivered-later-sf-seed.js
// used before this issue replaced the bare CHECK_ICON with the seal.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    {
      orderId: '11111111-1111-4111-8111-111111111206',
      placedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
      etaMinutes: 20,
      deliveryMs: 12 * 60_000,
      items: [
        {
          itemId: 'mission-taqueria-al-pastor',
          restaurantSlug: 'mission-taqueria',
          restaurantName: 'Mission Taqueria',
          name: 'Al pastor taco',
          amountMinor: 425,
          currency: 'USD',
          quantity: 3,
        },
      ],
      itemCount: 3,
      amountMinor: 1275,
      totalMinor: 1724,
      currency: 'USD',
      driver: { id: 'sf-driver-01', name: 'Sarah K.', rating: 4.9, ratingCount: 2143 },
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
