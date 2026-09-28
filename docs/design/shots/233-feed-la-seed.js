// Seeds Los Angeles as the picked city with a flash draw already dismissed
// (collapsed), so the home feed renders LA's carousel, chips and tiles rather
// than the flash sheet over them - #233 criterion 3, "the feed shows LA
// restaurants". Run by scripts/app-render's third argument.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'la');
window.sessionStorage.setItem(
  'flashDeal:la',
  JSON.stringify({
    drawnAt: Date.now(),
    amountMinor: 300,
    restaurants: [
      { slug: 'boyle-heights-taco-window', feeMode: 'free' },
      { slug: 'koreatown-charcoal-house', feeMode: 'reduced' },
      { slug: 'thai-town-boat-noodle-house', feeMode: 'free' },
      { slug: 'sawtelle-tonkotsu-bar', feeMode: 'reduced' },
      { slug: 'fairfax-pastrami-deli', feeMode: 'free' },
    ],
    collapsed: true,
    closedEventFired: true,
  }),
);
