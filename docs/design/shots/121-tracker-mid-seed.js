// Seeds an order placed 3 minutes ago with an 18-minute estimate and a
// 7-minute delivery time (#121), so /tracker renders mid-countdown — past
// the "Picked up" threshold (2/7 of 7min), short of both "On the way" (4/7)
// and the order's own Delivered time — with a live "15:00 until estimated
// arrival" counting down toward the (later, un-early) estimate.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.order',
  JSON.stringify({
    orderId: '22222222-2222-4222-8222-222222222121',
    placedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    etaMinutes: 18,
    deliveryMs: 7 * 60_000,
    items: [
      {
        itemId: 'mission-taqueria-al-pastor',
        restaurantSlug: 'mission-taqueria',
        restaurantName: 'Mission Taqueria',
        name: 'Al pastor taco',
        amountMinor: 425,
        currency: 'USD',
        quantity: 2,
      },
    ],
    itemCount: 2,
    amountMinor: 850,
    currency: 'USD',
    dropOffPreset: 'home',
    deliveryInstructions: 'hand_to_me',
    utensils: true,
    appliedVoucherIds: [],
    savedAmountMinor: 0,
    viewCount: 0,
    deliveredEventFired: false,
    rating: null,
  }),
);
