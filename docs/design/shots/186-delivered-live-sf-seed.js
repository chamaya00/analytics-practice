// Seeds an SF order still active when the page loads (deliveryMs is
// comfortably longer than any real page-load latency before tracker-dom.ts's
// own script actually runs), so it lands live on one of the page's first few
// 1s render ticks — #189's "as it lands while watched" (docs/design/162-*,
// "Delivered") — leaving most of this script's 3s settle window for the
// press (360ms) and ring (500ms) to finish and rest before the shutter.
// Already prompted (as 169-delivered-later-sf-seed.js's own order is) so the
// rating sheet's own 1.4s auto-open never rises and covers the card
// mid-settle.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    {
      orderId: '11111111-1111-4111-8111-111111111186',
      placedAt: new Date(Date.now()).toISOString(),
      etaMinutes: 20,
      deliveryMs: 1500,
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
      deliveredEventFired: false,
      rating: null,
      driverRating: null,
      ratingPromptedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      walletPaid: false,
      thanksVoucherMinor: 0,
      vipCounted: false,
    },
  ]),
);
