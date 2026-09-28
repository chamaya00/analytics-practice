// Tracker history rows, San Francisco light (#165, docs/design/162-*,
// "History"/"Order again") — one still-active order (the open card, so both
// others land in Past orders), one delivered and unrated (Rate + Order
// again) and one delivered and fully rated (the rated summary + Order
// again). Run without app-render's dark flag for the light render.

/* global window, addEventListener, setTimeout, scrollTo, document -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    {
      orderId: '11111111-1111-4111-8111-111111111165',
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
    },
    {
      orderId: '22222222-2222-4222-8222-222222222165',
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
      rating: null,
      driverRating: null,
      ratingPromptedAt: new Date(Date.now() - 25 * 60 * 60_000).toISOString(),
      walletPaid: true,
    },
    {
      orderId: '33333333-3333-4333-8333-333333333165',
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
      rating: { stars: 5, tags: ['fast'] },
      driverRating: { stars: 4 },
      ratingPromptedAt: new Date(Date.now() - 49 * 60 * 60_000).toISOString(),
      walletPaid: false,
    },
  ]),
);

// Scrolls to the bottom so both Past-orders rows — Rate + Order again on the
// unrated one, the rated summary + Order again on the other — land in the
// 812px viewport this is photographed at, rather than being cut off below it.
addEventListener('load', () => setTimeout(() => scrollTo(0, document.body.scrollHeight), 300));
