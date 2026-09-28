// Seeds three delivered SF orders totalling $75 — past Platinum's $60
// floor — so /tracker/'s VIP card renders state 5, "Platinum" — docs/design/
// 162-*, "The VIP card": the platinum stamp, "Platinum", and no spend bar.

/* global window, document -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify(
    ['55555555-5555-4555-8555-555555555001', '55555555-5555-4555-8555-555555555002', '55555555-5555-4555-8555-555555555003'].map(
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
            quantity: 6,
          },
        ],
        itemCount: 6,
        amountMinor: 2500,
        totalMinor: 2500,
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
