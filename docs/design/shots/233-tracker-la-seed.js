// Seeds one live LA order (placed 13 minutes ago, twenty minutes out) so
// /tracker/ renders it picked up, with the car, and a driver from LA's pool
// (docs/design/229-la-catalogue.md: LA reuses SF's) - #233 criterion 3.
// Already prompted, so the rating sheet never rises over it.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'la');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    {
      orderId: '23323323-3233-4233-8233-233233233001',
      placedAt: new Date(Date.now() - 13 * 60_000).toISOString(),
      etaMinutes: 20,
      deliveryMs: 20 * 60_000,
      items: [
        {
          itemId: 'boyle-heights-taco-window-birria-tacos',
          restaurantSlug: 'boyle-heights-taco-window',
          restaurantName: 'Boyle Heights Taco Window',
          name: 'Birria tacos',
          amountMinor: 1395,
          currency: 'USD',
          quantity: 1,
        },
      ],
      itemCount: 1,
      amountMinor: 1395,
      totalMinor: 1594,
      currency: 'USD',
      driver: { id: 'sf-driver-03', name: 'Maria G.', rating: 4.8, ratingCount: 1590 },
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 1,
      deliveredEventFired: false,
      rating: null,
      driverRating: null,
      ratingPromptedAt: new Date(Date.now() - 60_000).toISOString(),
      walletPaid: false,
      thanksVoucherMinor: 0,
      vipCounted: false,
    },
  ]),
);
