// Seeds San Francisco and advances the carousel to the first-order slide
// (dot index 3, #184's reordering) before the shutter — the render proof for
// #185's ticket/gradient banner, which no DOM/unit test can see laid out.

/* global window, document -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
// An already-expired flash draw so the home feed renders without the flash
// sheet covering the carousel (matches 130-home-sf-seed.js's own pattern).
window.sessionStorage.setItem(
  'flashDeal:sf',
  JSON.stringify({
    drawnAt: Date.now() - 20 * 60 * 1000,
    amountMinor: 300,
    restaurants: [
      { slug: 'mission-taqueria', feeMode: 'free' },
      { slug: 'north-beach-pizzeria', feeMode: 'reduced' },
      { slug: 'golden-lotus-dim-sum', feeMode: 'free' },
      { slug: 'bay-grain-bowls', feeMode: 'reduced' },
      { slug: 'dogpatch-burger-works', feeMode: 'free' },
    ],
  }),
);

// Poll-and-click, same pattern as 174-vip-gold-progress-hcmc-seed.js — the
// carousel's dots don't exist until the client script has run.
window.addEventListener('load', () => {
  const poll = window.setInterval(() => {
    const dot = document.querySelector('[data-testid="carousel-dot-3"]');
    if (dot) {
      dot.click();
      window.clearInterval(poll);
    }
  }, 50);
});
