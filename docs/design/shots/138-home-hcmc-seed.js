/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
// An already-expired flash draw so the home feed renders without the flash
// sheet covering it (matches #130's own seed pattern for the same reason).
window.sessionStorage.setItem(
  'flashDeal:hcmc',
  JSON.stringify({
    drawnAt: Date.now() - 20 * 60 * 1000,
    amountMinor: 15000,
    restaurants: [
      { slug: 'ben-thanh-banh-mi', feeMode: 'free' },
      { slug: 'saigon-pho-quan', feeMode: 'reduced' },
      { slug: 'com-tam-quan-nha', feeMode: 'free' },
      { slug: 'bun-cha-co-ba', feeMode: 'reduced' },
      { slug: 'hu-tieu-nam-vang-hoa-phat', feeMode: 'free' },
    ],
  }),
);
