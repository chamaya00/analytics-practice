// Seeds San Francisco as the picked city with a flash draw already dismissed
// (collapsed), so the home feed renders with the .reopen-bar above the tab bar
// - #236 criterion 4's "after a city is picked, flash sheet in its first-visit
// collapsed-bar state". Run by scripts/app-render's third argument.

/* global window, document -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
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

// The footer link sits below the fold on the feed; scroll to the bottom once
// the feed has rendered so the picture shows it against the reopen bar.
window.addEventListener('load', () => {
  window.setTimeout(() => window.scrollTo(0, document.documentElement.scrollHeight), 2500);
});
