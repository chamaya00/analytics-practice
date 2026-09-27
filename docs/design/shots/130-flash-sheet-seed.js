// A chosen city with sessionStorage otherwise untouched — a fresh session,
// so home-dom.ts's isNewDraw is true and the flash sheet opens on load
// rather than needing a prior visit. Used for #130 round 1's flash-sheet-row
// render (review item 4).

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
