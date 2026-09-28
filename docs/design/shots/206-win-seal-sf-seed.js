// Same pattern as 169-win-nudge-sf-seed.js: stubs prefers-reduced-motion (so
// the win screen settles on its still frame, no in-flight confetti particles
// to race the shutter) and drives both rating steps to completion with
// pollClick, landing on the win screen to compare #206's shared rubber-stamp
// seal (104px, docs/design/162-*) against 162-win-still-sf-light.

/* global window, document, setInterval, clearInterval -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.matchMedia = function (query) {
  return {
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addListener: function () {},
    removeListener: function () {},
    addEventListener: function () {},
    removeEventListener: function () {},
    dispatchEvent: function () {
      return false;
    },
    onchange: null,
  };
};

window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    {
      orderId: '33333333-3333-4333-8333-333333333206',
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
      walletPaid: false,
      thanksVoucherMinor: 0,
      vipCounted: false,
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
  pollClick('[data-testid="rating-sheet-driver-next"]', function () {
    pollClick('[data-testid="rating-sheet-restaurant-star-5"]', function () {
      pollClick('[data-testid="rating-sheet-restaurant-submit"]');
    });
  });
});
