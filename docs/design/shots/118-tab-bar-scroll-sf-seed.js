// Seeds an SF city pick, then scrolls the loaded home feed down 420px so a
// restaurant card (BaseLayout.astro's .restaurant-card) crosses the fixed
// tab bar in the screenshot — proving the bar paints on top rather than
// underneath scrolled content. A render taken at the top of the page never
// shows this, since nothing has scrolled under the bar yet. Run by
// scripts/app-render's third argument before the page's own scripts.

/* global window, addEventListener, setTimeout, scrollTo -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
// A pre-existing flashDeal draw stops the home feed from auto-opening the
// flash sheet on load (home-dom.ts's isNewDraw check, flash-deal.ts) — this
// screenshot is about the tab bar's stacking order under scrolled page
// content, not the flash sheet's own overlay (#118's criterion 3 leaves
// that overlay untouched).
window.sessionStorage.setItem(
  'flashDeal:sf',
  JSON.stringify({
    drawnAt: Date.now(),
    amountMinor: 300,
    restaurants: [
      { slug: 'mission-taqueria', feeMode: 'reduced' },
      { slug: 'north-beach-pizzeria', feeMode: 'reduced' },
    ],
  }),
);
addEventListener('load', () => setTimeout(() => scrollTo(0, 420), 300));
