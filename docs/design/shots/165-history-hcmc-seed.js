// Tracker history rows, Ho Chi Minh City dark (#165, docs/design/162-*,
// "History"/"Order again") — same shape as 165-history-sf-seed.js: one
// still-active order (the open card), one delivered and unrated (Rate +
// Order again) and one delivered and fully rated (the rated summary +
// Order again). Run with app-render's dark flag for the dark render.

/* global window, addEventListener, setTimeout, scrollTo, document -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    {
      orderId: '11111111-1111-4111-8111-111111111265',
      placedAt: new Date().toISOString(),
      etaMinutes: 20,
      deliveryMs: 20 * 60_000,
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
      totalMinor: 57000,
      currency: 'VND',
      driver: { id: 'hcmc-driver-09', name: 'Long D.', rating: 4.9, ratingCount: 2214 },
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 1,
      deliveredEventFired: false,
      rating: null,
      driverRating: null,
      ratingPromptedAt: null,
      walletPaid: false,
    },
    {
      orderId: '22222222-2222-4222-8222-222222222265',
      placedAt: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
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
      ratingPromptedAt: new Date(Date.now() - 25 * 60 * 60_000).toISOString(),
      walletPaid: true,
    },
    {
      orderId: '33333333-3333-4333-8333-333333333265',
      placedAt: new Date(Date.now() - 50 * 60 * 60_000).toISOString(),
      etaMinutes: 25,
      deliveryMs: 6 * 60_000,
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
      totalMinor: 70000,
      currency: 'VND',
      driver: { id: 'hcmc-driver-11', name: 'Khánh N.', rating: 4.8, ratingCount: 1655 },
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 1,
      deliveredEventFired: true,
      rating: { stars: 5, tags: [] },
      driverRating: { stars: 5 },
      ratingPromptedAt: new Date(Date.now() - 49 * 60 * 60_000).toISOString(),
      walletPaid: false,
    },
  ]),
);

// Scrolls to the bottom so both Past-orders rows — Rate + Order again on the
// unrated one, the rated summary + Order again on the other — land in the
// 812px viewport this is photographed at, rather than being cut off below it.
addEventListener('load', () => setTimeout(() => scrollTo(0, document.body.scrollHeight), 300));
