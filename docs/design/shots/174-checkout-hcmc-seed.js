// Seeds an HCMC cart (180.000 ₫, ben-thanh-banh-mi, matching #166's own
// worked "Gold" checkout example) alongside three already-delivered orders
// totalling 300.000 ₫ — Gold, short of Platinum's 1.500.000 ₫ floor — so
// /checkout renders the Gold free-delivery line without a Platinum row:
// docs/design/162-*, "Checkout: the perks and the voucher as lines". Run
// with the dark flag alongside this seed.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
window.localStorage.setItem(
  'parody.cart',
  JSON.stringify([
    {
      itemId: 'ben-thanh-banh-mi-op-la',
      restaurantSlug: 'ben-thanh-banh-mi',
      restaurantName: 'Bến Thành Bánh Mì',
      name: 'Bánh mì ốp la',
      amountMinor: 30000,
      currency: 'VND',
      quantity: 6,
    },
  ]),
);
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify(
    ['88888888-8888-4888-8888-888888888001', '88888888-8888-4888-8888-888888888002', '88888888-8888-4888-8888-888888888003'].map(
      (orderId, i) => ({
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
            quantity: 3,
          },
        ],
        itemCount: 3,
        amountMinor: 100000,
        totalMinor: 100000,
        currency: 'VND',
        driver: { id: 'hcmc-driver-01', name: 'Minh T.', rating: 4.9, ratingCount: 3312 },
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
