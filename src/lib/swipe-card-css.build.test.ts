import { describe, expect, it } from 'vitest';
import { deliveredCss } from '../../test-support/dist-css';

// Reads the output of `astro build`, the same command Vercel runs for this
// static site (ADR 0001) - so these assertions prove what a visitor's
// browser actually receives, not just what the source stylesheet says.
// happy-dom does no layout, so a real vertical scroll or a real absence of
// motion can't be exercised here (see the pull request for the by-hand
// checks that cover the rest of AC3/AC4); these tests are the checkable
// half - the emitted CSS values a build-output assertion can prove false.
// The build itself runs once for the whole test run in
// vitest.global-setup.ts, not here - see that file for why.
const css = deliveredCss('dist/index.html');

describe('swipe-card emitted CSS (AC3, AC4)', () => {
  it('sets touch-action to pan-y on the card, never a blanket none (AC3)', () => {
    const rule = css.match(/\.swipe-card\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('touch-action:pan-y');
    expect(rule).not.toContain('touch-action:none');
  });

  it('never sets touch-action: none anywhere in the swipe-card stylesheet (AC3)', () => {
    expect(css).not.toContain('touch-action:none');
  });

  it('a prefers-reduced-motion block overrides the card transition and swipe-out transform/opacity (AC4)', () => {
    const start = css.indexOf('prefers-reduced-motion:reduce');
    expect(start).toBeGreaterThan(-1);
    const reducedBlock = css.slice(start);
    expect(reducedBlock).toContain('.swipe-card{transition:none}');
    expect(reducedBlock).toMatch(/\.swipe-out-left,\.swipe-out-right\{[^}]*transform:none[^}]*\}/);
  });

  it('the swipe-card transition outside reduced motion still animates transform (sanity check for the override above)', () => {
    const rule = css.match(/\.swipe-card\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('transition:transform');
  });
});
