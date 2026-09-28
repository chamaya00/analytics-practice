// Seeds three delivered SF orders, spend well under Platinum's $60 floor, so
// /tracker/'s VIP card renders state 3, "Gold" (docs/design/162-*, "The VIP
// card"): the gold stamp, "Gold" with the "Free delivery" pill, and the
// spend bar toward Platinum.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify(
    ['33333333-3333-4333-8333-333333333001', '33333333-3333-4333-8333-333333333002', '33333333-3333-4333-8333-333333333003'].map(
      (orderId, i) => ({
        orderId,
        placedAt: new Date(Date.now() - 100_000 - i * 1000).toISOString(),
        etaMinutes: 20,
        deliveryMs: 1000,
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
        amountMinor: 1000,
        totalMinor: 1000,
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
        // Already prompted, so the rating sheet's auto-open rule (#163) never
        // covers the VIP card this seed is for.
        ratingPromptedAt: new Date(Date.now() - 100_000).toISOString(),
        walletPaid: false,
        thanksVoucherMinor: 0,
        vipCounted: false,
      }),
    ),
  ),
);

// Scrolls the VIP card into view once the page has rendered it — see
// 174-vip-gold-progress-sf-seed.js for why.
window.addEventListener('load', () => {
  const poll = window.setInterval(() => {
    const card = document.querySelector('[data-testid="vip-card"]');
    if (card) {
      card.scrollIntoView({ block: 'start' });
      window.clearInterval(poll);
    }
  }, 50);
});
