// Seeds an SF order delivered 30 minutes ago, unrated on both steps, so the
// rating sheet auto-opens on /tracker/ at its driver step (#163,
// docs/design/162-rate-driver-sf-{light,dark}) — decideRatingPrompt
// (tracker-state.ts) opens the most recently delivered qualifying order
// within its 24-hour window, no interaction needed to land on step one.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    {
      orderId: '11111111-1111-4111-8111-111111111163',
      placedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      etaMinutes: 20,
      deliveryMs: 5 * 60_000,
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
      ratingPromptedAt: null,
    },
  ]),
);
