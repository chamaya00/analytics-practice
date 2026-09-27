// Seeds three SF orders directly under `parody.orders` (#144's key) so
// /tracker/ renders #147's "Two live orders" state (147-tracker-live-sf-
// {light,dark}): the soonest-arriving live order open past Picked up (its
// stored driver card showing), a second live order still Preparing as the
// switcher row below it, and a delivered order in Past orders — #148 AC1
// and AC6's render criterion.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    {
      // Delivered two days ago — Past orders.
      orderId: '11111111-1111-4111-8111-111111111147',
      placedAt: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString(),
      etaMinutes: 15,
      deliveryMs: 5 * 60_000,
      items: [
        {
          itemId: 'golden-lotus-dim-sum-har-gow',
          restaurantSlug: 'golden-lotus-dim-sum',
          restaurantName: 'Golden Lotus Dim Sum',
          name: 'Har gow',
          amountMinor: 895,
          currency: 'USD',
          quantity: 2,
        },
      ],
      itemCount: 2,
      amountMinor: 1790,
      totalMinor: 2189,
      currency: 'USD',
      driver: { id: 'sf-driver-05', name: 'Emily R.', rating: 4.9, ratingCount: 3021 },
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 2,
      deliveredEventFired: true,
      rating: { stars: 5, tags: ['fast'] },
    },
    {
      // Placed just now, still Preparing — the switcher row.
      orderId: '22222222-2222-4222-8222-222222222147',
      placedAt: new Date().toISOString(),
      etaMinutes: 22,
      deliveryMs: 7 * 60_000,
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
      totalMinor: 2078,
      currency: 'USD',
      driver: { id: 'sf-driver-12', name: 'Matthew H.', rating: 4.7, ratingCount: 782 },
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: false,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 0,
      deliveredEventFired: false,
      rating: null,
    },
    {
      // Placed 3 minutes ago, past its own Picked-up threshold (2/7 of a
      // 6-minute deliveryMs is 1m43s) but short of its 6-minute deliveryMs —
      // the soonest-arriving live order, so it opens by default with its
      // driver card showing.
      orderId: '33333333-3333-4333-8333-333333333147',
      placedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
      etaMinutes: 20,
      deliveryMs: 6 * 60_000,
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
      viewCount: 0,
      deliveredEventFired: false,
      rating: null,
    },
  ]),
);
