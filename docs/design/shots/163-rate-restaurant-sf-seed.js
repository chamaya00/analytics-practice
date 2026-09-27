// Same order as 163-rate-driver-sf-seed.js, but drives the sheet one step
// further before the screenshot: rates the driver five stars and advances,
// landing on the restaurant step ("2 of 2 · Restaurant", #163, docs/design/
// 162-rate-restaurant-sf-{light,dark}) — the label stays "2 of 2" rather than
// "1 of 1" because the sheet opened on the driver step this same session
// (rating-sheet-dom.ts's `startedAtRestaurant` is fixed at open time).
// Polls rather than a fixed delay so this isn't racing tracker-dom.ts's own
// mount time.

/* global window, document, setInterval, clearInterval -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
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

function pollClick(selector, then) {
  var tries = 150;
  var timer = setInterval(function () {
    var el = document.querySelector(selector);
    if (el) {
      clearInterval(timer);
      el.click();
      if (then) then();
    } else if (--tries <= 0) {
      clearInterval(timer);
    }
  }, 20);
}

pollClick('[data-testid="rating-sheet-driver-star-5"]', function () {
  pollClick('[data-testid="rating-sheet-driver-next"]');
});
