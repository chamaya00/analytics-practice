// Seeds two delivered SF orders — one short of Gold — so /tracker/'s VIP
// card renders state 2, "progress to Gold" (docs/design/162-*, "The VIP
// card"): the empty dashed stamp, "Not VIP yet", the three-segment meter at
// 2, and "1 order to Gold". Neither order is vipCounted yet, so the
// tracker's own sweepVipLedger (order-store.ts) folds them in on mount —
// the same path a real visit takes, not a hand-built ledger.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify(
    ['11111111-1111-4111-8111-111111111741', '11111111-1111-4111-8111-111111111742'].map((orderId, i) => ({
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
      amountMinor: 850,
      totalMinor: 850,
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
    })),
  ),
);

// Scrolls the VIP card into view once the page has rendered it — the card
// sits below the open Delivered card, past the fold at a phone width, and
// this script runs before the page's own code so there is nothing to
// scroll to until tracker-dom.ts has mounted.
window.addEventListener('load', () => {
  const poll = window.setInterval(() => {
    const card = document.querySelector('[data-testid="vip-card"]');
    if (card) {
      card.scrollIntoView({ block: 'start' });
      window.clearInterval(poll);
    }
  }, 50);
});
