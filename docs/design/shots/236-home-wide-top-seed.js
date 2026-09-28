// Seeds San Francisco as the picked city with a flash draw already dismissed
// (collapsed), so the home feed renders with the .reopen-bar above the tab bar
// - #236 criterion 4's "after a city is picked, flash sheet in its first-visit
// collapsed-bar state". Run by scripts/app-render's third argument.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.sessionStorage.setItem(
  'flashDeal:sf',
  JSON.stringify({
    drawnAt: Date.now(),
    amountMinor: 300,
    restaurants: [
      { slug: 'mission-taqueria', feeMode: 'free' },
      { slug: 'north-beach-pizzeria', feeMode: 'reduced' },
      { slug: 'golden-lotus-dim-sum', feeMode: 'free' },
      { slug: 'bay-grain-bowls', feeMode: 'reduced' },
      { slug: 'mission-taqueria', feeMode: 'reduced' },
    ],
    collapsed: true,
    closedEventFired: true,
  }),
);

// Same state as the seed above, but left at the top of the page so the
// picture shows the header (wordmark, nav and the home intro).
window.addEventListener('load', () => {
  window.setTimeout(() => window.scrollTo(0, 0), 2500);
});
