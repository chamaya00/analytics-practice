import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

// Reads the output of `astro build`, the same command Vercel runs for this
// static site (ADR 0001) — so this test proves the nav ships in what a
// visitor actually gets, not just in an isolated component render. The
// build itself runs once for the whole test run in vitest.global-setup.ts,
// not here — see that file for why.
const root = process.cwd();

function readHtml(distPath: string) {
  return readFileSync(path.join(root, distPath), 'utf-8');
}

// #46's spec keeps `Header.astro` as one component that reshapes at 480px:
// `.site-nav` is the unchanged desktop/tablet nav, `.tab-bar` is the new
// phone-width bottom bar. Both exist in every build; CSS toggles which one
// is visible at a given width (see the phone-width describe block below).
function readNav(distPath: string, selector: string) {
  const window = new Window();
  window.document.write(readHtml(distPath));
  return window.document.querySelector(selector);
}

describe('shared header/nav (AC2, AC5)', () => {
  it('the swipe-poll page links to /results/', () => {
    const nav = readNav('dist/index.html', 'nav.site-nav');
    expect(nav).not.toBeNull();
    const link = nav?.querySelector('a[href="/results/"]');
    expect(link?.textContent).toContain('Results');
  });

  it('the results page links to /', () => {
    const nav = readNav('dist/results/index.html', 'nav.site-nav');
    expect(nav).not.toBeNull();
    const link = nav?.querySelector('a[href="/"]');
    expect(link?.textContent).toContain('Swipe poll');
  });
});

describe('viewport meta covers the display, not just its safe rectangle (AC3)', () => {
  it('the viewport meta content includes viewport-fit=cover on both pages', () => {
    for (const distPath of ['dist/index.html', 'dist/results/index.html']) {
      const window = new Window();
      window.document.write(readHtml(distPath));
      const meta = window.document.querySelector('meta[name="viewport"]');
      expect(meta?.getAttribute('content')).toContain('viewport-fit=cover');
    }
  });
});

describe('bottom tab bar at phone width (AC1)', () => {
  it('the tab bar carries the same two destinations as the desktop nav, each a 44px-minimum, evenly split tap target', () => {
    const tabBar = readNav('dist/index.html', 'nav.tab-bar');
    expect(tabBar).not.toBeNull();
    expect(tabBar?.querySelector('a[href="/results/"]')?.textContent).toContain('Results');
    const css = readHtml('dist/index.html');
    expect(css).toMatch(/\.tab-bar\[data-astro-cid-[\w-]+\]\s*a\[data-astro-cid-[\w-]+\]\{[^}]*min-height:44px[^}]*flex:1/);
  });

  it('the current tab is distinguished by a filled pill, not the underline the desktop nav uses for the same state', () => {
    const tabBar = readNav('dist/index.html', 'nav.tab-bar');
    const current = tabBar?.querySelector('a.current');
    expect(current?.getAttribute('aria-current')).toBe('page');
    expect(current?.querySelector('span.pill')).not.toBeNull();

    // The desktop nav's current-page treatment (underline) must not be the
    // tab bar's only cue — the pill above is required in addition to it.
    const css = readHtml('dist/index.html');
    const tabBarCurrentRule = css.match(/\.tab-bar\[data-astro-cid-[\w-]+\]\s*a\[data-astro-cid-[\w-]+\]\.current\{[^}]*\}/);
    expect(tabBarCurrentRule?.[0]).not.toMatch(/text-decoration:\s*underline/);
  });
});

describe('desktop keeps the unchanged header shape, not the tab bar (AC2)', () => {
  it('the tab bar is display:none outside the phone-width media query, and display:flex inside it', () => {
    const css = readHtml('dist/index.html');
    // Base rule (no media wrapper): hidden by default, i.e. on desktop/tablet.
    expect(css).toMatch(/\.tab-bar\[data-astro-cid-[\w-]+\]\{display:none\}/);
    // Inside the 480px breakpoint the bar becomes visible.
    expect(css).toMatch(/@media \([^)]*480px\)[\s\S]*?\.tab-bar\[data-astro-cid-[\w-]+\]\{[^}]*display:flex/);
  });

  it('the desktop nav keeps its underline current-page treatment, unmoved by this change', () => {
    const css = readHtml('dist/index.html');
    expect(css).toMatch(
      /\.site-nav\[data-astro-cid-[\w-]+\]\s*a\[data-astro-cid-[\w-]+\]\.current\{[^}]*text-decoration:underline/,
    );
  });

  // A human confirms which media query actually wins visually — nothing in
  // this suite can assert that. See docs/design/48-nav-safe-area-wide.png
  // and docs/design/48-nav-safe-area-narrow.png, rendered from this same
  // build with scripts/design-render.
});

describe('safe-area insets pad for hardware, not just the viewport rectangle (AC4)', () => {
  it('the header pads for the top inset (notch) and the tab bar pads for the bottom inset (home indicator)', () => {
    const css = readHtml('dist/index.html');
    expect(css).toMatch(/\.site-header\[data-astro-cid-[\w-]+\]\{[^}]*env\(safe-area-inset-top\)/);
    expect(css).toMatch(/\.tab-bar\[data-astro-cid-[\w-]+\]\{[^}]*env\(safe-area-inset-bottom\)/);
  });

  it('the header and tab bar also pad left/right for a notch or rounded corner in landscape', () => {
    const css = readHtml('dist/index.html');
    expect(css).toMatch(/\.site-header\[data-astro-cid-[\w-]+\]\{[^}]*env\(safe-area-inset-left\)/);
    expect(css).toMatch(/\.tab-bar\[data-astro-cid-[\w-]+\]\{[^}]*env\(safe-area-inset-right\)/);
  });
});
