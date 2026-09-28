// Same order as 186-delivered-live-sf-seed.js, still active when the page
// loads (deliveryMs is comfortably longer than any real page-load latency
// before tracker-dom.ts's own script actually runs) so it lands live on one
// of its first few 1s render ticks — #189's "as it lands while watched".
// Already prompted, as that file's own order is, so the rating sheet's 1.4s
// auto-open never rises and covers the card before the shutter.
//
// The press and the ring are pinned to 150ms into their own animation by a
// stylesheet rule in place *before* tracker-dom.ts ever creates them, rather
// than a pause applied just after — pausing an already-running animation a
// tick late freezes wherever it happened to be, not a chosen offset. A
// negative animation-delay jumps an animation straight to that local time,
// and animation-play-state: paused holds it there for however long the
// element then exists, so this stylesheet rule is what actually determines
// the frame, not when in the settle window the shutter happens to fire.
//
// #189 plays the landing animation on exactly one render tick and is static
// on every tick after (AC2) — tracker-dom.ts's own 1s interval would
// otherwise rebuild the hero back to static well before app-render's fixed
// 3s settle wait takes the shutter. A MutationObserver reacts to the landing
// itself (rather than a guessed delay) to stop that interval the moment the
// paused elements appear, so nothing ever re-renders them away.

/* global window, document, MutationObserver -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'sf');
window.localStorage.setItem(
  'parody.orders',
  JSON.stringify([
    {
      orderId: '11111111-1111-4111-8111-111111111187',
      placedAt: new Date(Date.now()).toISOString(),
      etaMinutes: 20,
      deliveryMs: 1500,
      items: [
        {
          itemId: 'mission-taqueria-al-pastor',
          restaurantSlug: 'mission-taqueria',
          restaurantName: 'Mission Taqueria',
          name: 'Al pastor taco',
          amountMinor: 425,
          currency: 'USD',
          quantity: 3,
        },
      ],
      itemCount: 3,
      amountMinor: 1275,
      totalMinor: 1724,
      currency: 'USD',
      driver: { id: 'sf-driver-01', name: 'Sarah K.', rating: 4.9, ratingCount: 2143 },
      dropOffPreset: 'home',
      deliveryInstructions: 'hand_to_me',
      utensils: true,
      appliedVoucherIds: [],
      savedAmountMinor: 0,
      viewCount: 1,
      deliveredEventFired: false,
      rating: null,
      driverRating: null,
      ratingPromptedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      walletPaid: false,
      thanksVoucherMinor: 0,
      vipCounted: false,
    },
  ]),
);

// Neither document.head nor document.documentElement exists yet at the point
// this runs (confirmed empirically: appending to either here threw, which —
// this being one synchronous script — silently aborted everything after it,
// including the seeding above, on an earlier version of this file with the
// seeding placed after). document itself does, so a MutationObserver on it
// is what waits for a head to append the style rule into, however soon or
// late the parser actually creates one.
let styleInjected = false;
function injectPausedFrameStyle() {
  if (styleInjected) return true;
  const target = document.head || document.documentElement;
  if (!target) return false;
  const style = document.createElement('style');
  style.textContent = `
    .tracker-delivered-stamp--landing,
    .tracker-delivered-ring {
      animation-delay: -150ms !important;
      animation-play-state: paused !important;
    }
  `;
  target.appendChild(style);
  styleInjected = true;
  return true;
}

let trackerIntervalId = null;
const realSetInterval = window.setInterval.bind(window);
window.setInterval = function capturingSetInterval(fn, delay, ...args) {
  trackerIntervalId = realSetInterval(fn, delay, ...args);
  return trackerIntervalId;
};

injectPausedFrameStyle();

// One observer, two jobs: keep retrying the style injection until it lands
// (a no-op once `styleInjected`), and stop the tracker's interval the
// moment the landing elements it targets actually appear.
new MutationObserver(() => {
  injectPausedFrameStyle();
  if (trackerIntervalId !== null && document.querySelector('.tracker-delivered-stamp--landing, .tracker-delivered-ring')) {
    window.clearInterval(trackerIntervalId);
    trackerIntervalId = null;
  }
}).observe(document, { childList: true, subtree: true });
