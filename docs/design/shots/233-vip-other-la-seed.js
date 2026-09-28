// From Los Angeles: three delivered LA orders (Gold) plus one delivered HCMC
// order, so /tracker/'s VIP card shows the "other city" line with three
// cities - docs/design/229-la-catalogue.md, "The 'other city' line": from LA
// it names HCMC. Deferred from #230 to #233 (D15 on #221). Every order is
// already prompted, so the rating sheet never covers the card.

/* global window, document -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
function deliveredOrder(n, slug, name, itemId, itemName, amountMinor, currency, driver) {
  return {
    orderId: `23323323-3233-4233-8233-23323323310${n}`,
    placedAt: new Date(Date.now() - 3_600_000 - n * 60_000).toISOString(),
    etaMinutes: 20,
    deliveryMs: 1000,
    items: [{ itemId, restaurantSlug: slug, restaurantName: name, name: itemName, amountMinor, currency, quantity: 1 }],
    itemCount: 1,
    amountMinor,
    totalMinor: amountMinor,
    currency,
    driver,
    dropOffPreset: 'home',
    deliveryInstructions: 'hand_to_me',
    utensils: true,
    appliedVoucherIds: [],
    savedAmountMinor: 0,
    viewCount: 1,
    deliveredEventFired: true,
    rating: null,
    driverRating: null,
    ratingPromptedAt: new Date(Date.now() - 3_000_000).toISOString(),
    walletPaid: false,
    thanksVoucherMinor: 0,
    vipCounted: false,
  };
}

const LA_DRIVER = { id: 'sf-driver-03', name: 'Maria G.', rating: 4.8, ratingCount: 1590 };
const HCMC_DRIVER = { id: 'hcmc-driver-01', name: 'Minh T.', rating: 4.9, ratingCount: 3312 };

window.localStorage.setItem('parody.city', 'la');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    deliveredOrder(1, 'koreatown-charcoal-house', 'Koreatown Charcoal House', 'koreatown-charcoal-house-kimchi-fried-rice', 'Kimchi fried rice', 1595, 'USD', LA_DRIVER),
    deliveredOrder(2, 'sawtelle-tonkotsu-bar', 'Sawtelle Tonkotsu Bar', 'sawtelle-tonkotsu-bar-tonkotsu-ramen', 'Tonkotsu ramen', 1795, 'USD', LA_DRIVER),
    deliveredOrder(3, 'fairfax-pastrami-deli', 'Fairfax Pastrami Deli', 'fairfax-pastrami-deli-reuben', 'Reuben', 1795, 'USD', LA_DRIVER),
    deliveredOrder(4, 'ben-thanh-banh-mi', 'Bến Thành Bánh Mì', 'ben-thanh-banh-mi-op-la', 'Bánh mì ốp la', 420000, 'VND', HCMC_DRIVER),
  ]),
);

// The VIP card sits below the fold at phone width; scroll it into view once
// tracker-dom.ts has mounted it.
window.addEventListener('load', () => {
  const poll = window.setInterval(() => {
    const card = document.querySelector('[data-testid="vip-card"]');
    if (card) {
      card.scrollIntoView({ block: 'start' });
      window.clearInterval(poll);
    }
  }, 50);
});
