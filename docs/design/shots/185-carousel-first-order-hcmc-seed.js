// Seeds Ho Chi Minh City and advances the carousel to the first-order slide
// (dot index 3, #184's reordering) before the shutter — the render proof for
// #185's ticket/gradient banner, which no DOM/unit test can see laid out.
// Run twice (light and dark) via ./scripts/app-render's fourth argument —
// this file doesn't need its own light/dark variants.

/* global window, document -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
// An already-expired flash draw so the home feed renders without the flash
// sheet covering the carousel (matches 130-home-sf-seed.js's own pattern).
window.sessionStorage.setItem(
  'flashDeal:hcmc',
  JSON.stringify({
    drawnAt: Date.now() - 20 * 60 * 1000,
    amountMinor: 10000,
    restaurants: [
      { slug: 'ben-thanh-banh-mi', feeMode: 'free' },
      { slug: 'saigon-pho-quan', feeMode: 'reduced' },
      { slug: 'com-tam-quan-nha', feeMode: 'free' },
      { slug: 'bun-cha-co-ba', feeMode: 'reduced' },
      { slug: 'hu-tieu-nam-vang-hoa-phat', feeMode: 'free' },
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
