// A chosen city with sessionStorage otherwise untouched — the "fresh
// session" #107's AC4 asks for, so home-dom.ts's isNewDraw is true and the
// flash sheet opens on load rather than needing a prior visit.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'hcmc');
