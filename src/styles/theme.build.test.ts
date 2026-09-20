import { describe, expect, it } from 'vitest';
import { deliveredCss } from '../../test-support/dist-css';

// Reads the output of `astro build`, the same command Vercel runs for this
// static site (ADR 0001), so these assertions prove what a visitor's
// browser actually receives. The build itself runs once for the whole
// test run in vitest.global-setup.ts, not here - see that file for why.
const css = deliveredCss('dist/index.html');

describe('dark theme palette (AC1)', () => {
  it('a prefers-color-scheme: dark block re-declares the design spec\'s dark hex values, including the tab-active-bg token the spec\'s table omits', () => {
    const start = css.indexOf('@media (prefers-color-scheme:dark)');
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('}}', start) + 2);
    expect(block).toContain('--color-bg:#1c1712');
    expect(block).toContain('--color-surface:#241e17');
    expect(block).toContain('--color-text:#f0e6d2');
    expect(block).toContain('--color-text-muted:#b3a58c');
    expect(block).toContain('--color-border:#45392c');
    expect(block).toContain('--color-tab-active-bg:#382d20');
  });

  it('both accents resolve to the values the spec named as cool/warm', () => {
    const start = css.indexOf('@media (prefers-color-scheme:dark)');
    const block = css.slice(start, css.indexOf('}}', start) + 2);
    expect(block).toContain('--color-accent-a:#7fb2e8');
    expect(block).toContain('--color-accent-b:#e8935a');
  });
});

describe('touch feedback: tap-highlight and pressed state (AC2)', () => {
  const cases: Array<[string, RegExp]> = [
    ['the card', /\.swipe-card\{[^}]*\}/],
    ['a tab bar link', /\.tab-bar\[data-astro-cid-[\w-]+\]\s*a\[data-astro-cid-[\w-]+\]\{[^}]*\}/],
    ['the end-state link', /\[data-testid=swipe-card-end\] a\{[^}]*\}/],
    ['the start-over button', /\.reset-button\{[^}]*\}/],
  ];

  it.each(cases)('%s suppresses the default tap-highlight', (_label, pattern) => {
    const rule = css.match(pattern)?.[0] ?? '';
    expect(rule).toContain('-webkit-tap-highlight-color:transparent');
  });

  it('the card defines a visible :active pressed rule', () => {
    expect(css).toMatch(/\.swipe-card:active\{[^}]*transform:[^}]*\}/);
  });

  it('a tab bar link defines a visible :active pressed rule', () => {
    expect(css).toMatch(/\.tab-bar\[data-astro-cid-[\w-]+\]\s*a\[data-astro-cid-[\w-]+\]:active\{[^}]*transform:[^}]*\}/);
  });

  it('the end-state link defines a visible :active pressed rule', () => {
    expect(css).toMatch(/\[data-testid=swipe-card-end\] a:active\{[^}]*transform:[^}]*\}/);
  });

  it('the start-over button clears the 44px touch floor and defines a visible :active pressed rule', () => {
    expect(css).toMatch(/\.reset-button\{[^}]*min-height:44px[^}]*\}/);
    expect(css).toMatch(/\.reset-button:active\{[^}]*transform:[^}]*\}/);
  });
});

describe('touch feedback: no text selection on press-and-hold (AC3)', () => {
  const cases: Array<[string, RegExp]> = [
    ['the card', /\.swipe-card\{[^}]*\}/],
    ['a tab bar link', /\.tab-bar\[data-astro-cid-[\w-]+\]\s*a\[data-astro-cid-[\w-]+\]\{[^}]*\}/],
    ['the end-state link', /\[data-testid=swipe-card-end\] a\{[^}]*\}/],
    ['the start-over button', /\.reset-button\{[^}]*\}/],
  ];

  it.each(cases)('%s sets user-select: none (with vendor prefixes)', (_label, pattern) => {
    const rule = css.match(pattern)?.[0] ?? '';
    expect(rule).toContain('-webkit-user-select:none');
    expect(rule).toContain('user-select:none');
  });
});

describe('no page rubber-band during a card drag (AC4)', () => {
  it('the scroll container (body) sets overscroll-behavior to contain', () => {
    const rule = css.match(/body\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('overscroll-behavior:contain');
  });
});
