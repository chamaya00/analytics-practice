// Tracker history rows, San Francisco light (#171, docs/design/162-*,
// "Tips"/"History rows") — this build has no PUBLIC_WALLET_ENABLED (no repo
// secret in this environment), so the wallet gate is dark and every tip
// control renders as D1's "absent": the difference this shot can actually
// show is a wallet-paid order with no stored tip (nothing under Tip) next to
// one that already has one (`tipMinor`, shown regardless of the gate — see
// docs/design/162-rating-win-tips-rewards-vip.md, "History rows"). The
// signed-in states (Tip/Sign in to tip/the panel) can't be photographed this
// way at all (#159) — see the DOM tests named in the pull request instead.

/* global window, addEventListener, setTimeout, scrollTo, document -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    {
      orderId: '11111111-1111-4171-8171-111111111171',
      placedAt: new Date().toISOString(),
      etaMinutes: 20,
      deliveryMs: 20 * 60_000,
      items: [
        {
          itemId: 'north-beach-pizzeria-margherita',
          restaurantSlug: 'north-beach-pizzeria',
          restaurantName: 'North Beach Pizzeria',
          name: 'Margherita',
          amountMinor: 1650,
          currency: 'USD',
          quantity: 1,
        },
      ],
      itemCount: 1,
      amountMinor: 1650,
      totalMinor: 2148,
      currency: 'USD',
      driver: { id: 'sf-driver-03', name: 'Marcus J.', rating: 4.8, ratingCount: 987 },
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 1,
      deliveredEventFired: false,
      rating: null,
      driverRating: null,
      ratingPromptedAt: null,
      walletPaid: false,
      thanksVoucherMinor: 0,
      vipCounted: false,
      tipMinor: null,
    },
    {
      orderId: '22222222-2222-4171-8171-222222222171',
      placedAt: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
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
      rating: { stars: 5, tags: ['fast'] },
      driverRating: { stars: 4 },
      ratingPromptedAt: new Date(Date.now() - 25 * 60 * 60_000).toISOString(),
      walletPaid: true,
      thanksVoucherMinor: 0,
      vipCounted: true,
      tipMinor: null,
    },
    {
      orderId: '33333333-3333-4171-8171-333333333171',
      placedAt: new Date(Date.now() - 50 * 60 * 60_000).toISOString(),
      etaMinutes: 25,
      deliveryMs: 6 * 60_000,
      items: [
        {
          itemId: 'mission-taqueria-chips-guac',
          restaurantSlug: 'mission-taqueria',
          restaurantName: 'Mission Taqueria',
          name: 'Chips & guacamole',
          amountMinor: 650,
          currency: 'USD',
          quantity: 1,
        },
      ],
      itemCount: 1,
      amountMinor: 650,
      totalMinor: 1148,
      currency: 'USD',
      driver: { id: 'sf-driver-05', name: 'Priya R.', rating: 4.7, ratingCount: 1502 },
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 1,
      deliveredEventFired: true,
      rating: { stars: 4, tags: ['great_packaging'] },
      driverRating: { stars: 5 },
      ratingPromptedAt: new Date(Date.now() - 49 * 60 * 60_000).toISOString(),
      walletPaid: true,
      thanksVoucherMinor: 0,
      vipCounted: true,
      tipMinor: 200,
    },
  ]),
);

// Scrolls to the bottom so both Past-orders rows land in the 812px viewport
// this is photographed at, rather than being cut off below it.
addEventListener('load', () => setTimeout(() => scrollTo(0, document.body.scrollHeight), 300));
