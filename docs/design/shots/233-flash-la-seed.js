// Los Angeles picked with sessionStorage otherwise untouched - a fresh
// session, so home-dom.ts draws a new LA flash deal and the flash sheet opens
// on load (#233 criterion 3's flash-deal render). Same shape as
// 126-flash-sheet-seed.js.

/* global window -- run in a browser page's own context, not Node; the repo's lint config declares no browser globals. */
window.localStorage.setItem('parody.city', 'la');
