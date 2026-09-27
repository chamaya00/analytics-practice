// Seeds two stored orders directly under the new `parody.orders` key (#144)
// — an older SF order placed first, then an HCMC order placed after it — so
// /order-placed/ can be photographed showing the order just placed (the
// HCMC one: its restaurant, its item count, its amount, its own motorbike
// icon), not the older SF order still sitting underneath it (AC1).

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    {
      orderId: '11111111-1111-4111-8111-111111111144',
      placedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      etaMinutes: 18,
      deliveryMs: 5 * 60_000,
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
      totalMinor: 1199,
      currency: 'USD',
      driver: { id: 'sf-driver-01', name: 'Sarah K.', rating: 4.9, ratingCount: 2143 },
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 0,
      deliveredEventFired: false,
      rating: null,
    },
    {
      orderId: '22222222-2222-4222-8222-222222222144',
      placedAt: new Date().toISOString(),
      etaMinutes: 22,
      deliveryMs: 6 * 60_000,
      items: [
        {
          itemId: 'ben-thanh-banh-mi-thit-nuong',
          restaurantSlug: 'ben-thanh-banh-mi',
          restaurantName: 'Bến Thành Bánh Mì',
          name: 'Bánh mì thịt nướng',
          amountMinor: 35000,
          currency: 'VND',
          quantity: 1,
        },
      ],
      itemCount: 1,
      amountMinor: 35000,
      totalMinor: 65000,
      currency: 'VND',
      driver: { id: 'hcmc-driver-01', name: 'Minh T.', rating: 4.9, ratingCount: 3312 },
      dropOffPreset: 'office',
      deliveryInstructions: 'leave_at_door',
      utensils: false,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 0,
      deliveredEventFired: false,
      rating: null,
    },
  ]),
);
