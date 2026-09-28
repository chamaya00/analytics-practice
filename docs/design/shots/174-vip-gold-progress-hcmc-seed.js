// Seeds two delivered HCMC orders — one short of Gold — so /tracker/'s VIP
// card renders state 2, "progress to Gold" (docs/design/162-*, "The VIP
// card"). Run with the dark flag alongside this seed.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify(
    ['22222222-2222-4222-8222-222222222741', '22222222-2222-4222-8222-222222222742'].map((orderId, i) => ({
      orderId,
      placedAt: new Date(Date.now() - 100_000 - i * 1000).toISOString(),
      etaMinutes: 20,
      deliveryMs: 1000,
      items: [
        {
          itemId: 'ben-thanh-banh-mi-op-la',
          restaurantSlug: 'ben-thanh-banh-mi',
          restaurantName: 'Bến Thành Bánh Mì',
          name: 'Bánh mì ốp la',
          amountMinor: 30000,
          currency: 'VND',
          quantity: 1,
        },
      ],
      itemCount: 1,
      amountMinor: 30000,
      totalMinor: 30000,
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
      // Already prompted, so the rating sheet's auto-open rule (#163) never
      // covers the VIP card this seed is for.
      ratingPromptedAt: new Date(Date.now() - 100_000).toISOString(),
      walletPaid: false,
      thanksVoucherMinor: 0,
      vipCounted: false,
    })),
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
