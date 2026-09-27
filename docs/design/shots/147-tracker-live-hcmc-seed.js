// Same shape as 147-tracker-live-sf-seed.js, for HCMC — #148 AC1/AC6.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    {
      // Delivered two days ago — Past orders.
      orderId: '11111111-1111-4111-8111-111111111247',
      placedAt: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString(),
      etaMinutes: 15,
      deliveryMs: 5 * 60_000,
      items: [
        {
          itemId: 'com-tam-quan-nha-suon-nuong',
          restaurantSlug: 'com-tam-quan-nha',
          restaurantName: 'Cơm Tấm Quán Nhà',
          name: 'Cơm tấm sườn nướng',
          amountMinor: 45000,
          currency: 'VND',
          quantity: 1,
        },
      ],
      itemCount: 1,
      amountMinor: 45000,
      totalMinor: 77000,
      currency: 'VND',
      driver: { id: 'hcmc-driver-09', name: 'Long D.', rating: 4.9, ratingCount: 2214 },
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 2,
      deliveredEventFired: true,
      rating: { stars: 5, tags: ['order_was_correct'] },
    },
    {
      // Placed just now, still Preparing — the switcher row.
      orderId: '22222222-2222-4222-8222-222222222247',
      placedAt: new Date().toISOString(),
      etaMinutes: 22,
      deliveryMs: 7 * 60_000,
      items: [
        {
          itemId: 'saigon-pho-quan-bo',
          restaurantSlug: 'saigon-pho-quan',
          restaurantName: 'Sài Gòn Phở Quán',
          name: 'Phở bò',
          amountMinor: 55000,
          currency: 'VND',
          quantity: 1,
        },
      ],
      itemCount: 1,
      amountMinor: 55000,
      totalMinor: 90000,
      currency: 'VND',
      driver: { id: 'hcmc-driver-11', name: 'Khánh N.', rating: 4.8, ratingCount: 1655 },
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: false,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 0,
      deliveredEventFired: false,
      rating: null,
    },
    {
      // Placed 3 minutes ago, past its own Picked-up threshold but short of
      // its 6-minute deliveryMs — the soonest-arriving live order, so it
      // opens by default with its driver card showing.
      orderId: '33333333-3333-4333-8333-333333333247',
      placedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
      etaMinutes: 20,
      deliveryMs: 6 * 60_000,
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
      totalMinor: 105000,
      currency: 'VND',
      driver: { id: 'hcmc-driver-01', name: 'Minh T.', rating: 4.9, ratingCount: 3312 },
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 0,
      deliveredEventFired: false,
      rating: null,
    },
  ]),
);
