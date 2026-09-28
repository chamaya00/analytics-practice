// HCMC counterpart of 166-win-sf-seed.js — stubs reduced motion and drives
// both steps to completion, landing on the win screen's still alternative
// with #166's thanks-voucher ticket unlocked (docs/design/162-win-hcmc-
// dark, the ticket). Run with app-render's dark flag.

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

window.localStorage.setItem('parody.city', 'hcmc');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    {
      orderId: '22222222-2222-4222-8222-222222222166',
      placedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      etaMinutes: 20,
      deliveryMs: 5 * 60_000,
      items: [
        {
          itemId: 'ben-thanh-banh-mi-thit-nuong',
          restaurantSlug: 'ben-thanh-banh-mi',
          restaurantName: 'Bến Thành Bánh Mì',
          name: 'Bánh mì thịt nướng',
          amountMinor: 35000,
          currency: 'VND',
          quantity: 2,
        },
      ],
      itemCount: 2,
      amountMinor: 70000,
      totalMinor: 82000,
      currency: 'VND',
      driver: { id: 'hcmc-driver-01', name: 'Minh T.', rating: 4.9, ratingCount: 3312 },
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
  pollClick('[data-testid="rating-sheet-driver-next"]', function () {
    pollClick('[data-testid="rating-sheet-restaurant-star-5"]', function () {
      pollClick('[data-testid="rating-sheet-restaurant-submit"]');
    });
  });
});
