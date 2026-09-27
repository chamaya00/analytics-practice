// A pre-collapsed draw so the page loads straight into the reopen bar
// rather than the open sheet — home-dom.ts only shows the bar when the
// stored draw already exists (not a fresh session) and is collapsed. Used
// for #126's dark-mode contrast renders of the collapsed bar.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
window.sessionStorage.setItem(
  'flashDeal:hcmc',
  JSON.stringify({
    drawnAt: Date.now(),
    amountMinor: 25000,
    restaurants: [
      { slug: 'ben-thanh-banh-mi', feeMode: 'free' },
      { slug: 'saigon-pho-quan', feeMode: 'reduced' },
      { slug: 'com-tam-quan-nha', feeMode: 'free' },
      { slug: 'bun-cha-co-ba', feeMode: 'reduced' },
      { slug: 'hu-tieu-nam-vang-hoa-phat', feeMode: 'free' },
    ],
    collapsed: true,
    closedEventFired: true,
  }),
);
