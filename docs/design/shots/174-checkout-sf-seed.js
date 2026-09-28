// Seeds an SF cart ($21.50, north-beach-pizzeria, matching #107's own
// checkout seed) alongside three already-delivered orders totalling $75 —
// past Platinum's floor — so /checkout renders both perk lines:
// docs/design/162-*, "Checkout: the perks and the voucher as lines".
// sweepVipLedger (checkout-dom.ts's own mount, order-store.ts) folds the
// three orders in when the page loads, the same path a real visit takes.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.cart',
  JSON.stringify([
    {
      itemId: 'north-beach-pizzeria-margherita',
      restaurantSlug: 'north-beach-pizzeria',
      restaurantName: 'North Beach Pizzeria',
      name: 'Margherita',
      amountMinor: 2150,
      currency: 'USD',
      quantity: 1,
    },
  ]),
);
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify(
    ['77777777-7777-4777-8777-777777777001', '77777777-7777-4777-8777-777777777002', '77777777-7777-4777-8777-777777777003'].map(
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
        viewCount: 0,
        deliveredEventFired: true,
        rating: null,
        driverRating: null,
        ratingPromptedAt: null,
        walletPaid: false,
        thanksVoucherMinor: 0,
        vipCounted: false,
      }),
    ),
  ),
);
