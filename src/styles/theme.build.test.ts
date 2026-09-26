import { describe, expect, it } from 'vitest';
import { deliveredCss } from '../../test-support/dist-css';

// Reads the output of `astro build`, the same command Vercel runs for this
// static site (ADR 0001), so these assertions prove what a visitor's
// browser actually receives. The build itself runs once for the whole
// test run in vitest.global-setup.ts, not here - see that file for why.
const css = deliveredCss('dist/index.html');

describe('dark theme palette (#82 review round 1: #80\'s chosen violet direction)', () => {
  it('a prefers-color-scheme: dark block re-declares #80\'s dark hex values, including the tab-active-bg and badge-ink tokens the spec leaves to the engineer', () => {
    const start = css.indexOf('@media (prefers-color-scheme:dark)');
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('}}', start) + 2);
    expect(block).toContain('--color-bg:#16101f');
    expect(block).toContain('--color-surface:#1e1730');
    expect(block).toContain('--color-text:#f1e9ff');
    expect(block).toContain('--color-text-muted:#b7a6d9');
    expect(block).toContain('--color-border:#3a2e52');
    expect(block).toContain('--color-tab-active-bg:#2e2444');
    expect(block).toContain('--color-badge-ink:#16101f');
  });

  it('both accents resolve to #80\'s chosen-direction dark values', () => {
    const start = css.indexOf('@media (prefers-color-scheme:dark)');
    const block = css.slice(start, css.indexOf('}}', start) + 2);
    expect(block).toContain('--color-accent-a:#b79cff');
    expect(block).toContain('--color-accent-b:#ffa36b');
  });
});

describe('touch feedback: tap-highlight and pressed state (AC2)', () => {
  const cases: Array<[string, RegExp]> = [
    ['the primary CTA (place-order)', /\.place-order\{[^}]*\}/],
    ['a tab bar link', /\.tab-bar\[data-astro-cid-[\w-]+\]\s*a\[data-astro-cid-[\w-]+\]\{[^}]*\}/],
    ['a restaurant card link', /\.restaurant-card\{[^}]*\}/],
    ['the start-over button', /\.reset-button\{[^}]*\}/],
  ];

  it.each(cases)('%s suppresses the default tap-highlight', (_label, pattern) => {
    const rule = css.match(pattern)?.[0] ?? '';
    expect(rule).toContain('-webkit-tap-highlight-color:transparent');
  });

  it('the primary CTA (place-order) defines a visible :active pressed rule', () => {
    expect(css).toMatch(/\.place-order:active\{[^}]*transform:[^}]*\}/);
  });

  it('a tab bar link defines a visible :active pressed rule', () => {
    expect(css).toMatch(/\.tab-bar\[data-astro-cid-[\w-]+\]\s*a\[data-astro-cid-[\w-]+\]:active\{[^}]*transform:[^}]*\}/);
  });

  it('a restaurant card link defines a visible :active pressed rule', () => {
    expect(css).toMatch(/\.restaurant-card:active\{[^}]*transform:[^}]*\}/);
  });

  it('the start-over button clears the 44px touch floor and defines a visible :active pressed rule', () => {
    expect(css).toMatch(/\.reset-button\{[^}]*min-height:44px[^}]*\}/);
    expect(css).toMatch(/\.reset-button:active\{[^}]*transform:[^}]*\}/);
  });
});

describe('touch feedback: no text selection on press-and-hold (AC3)', () => {
  const cases: Array<[string, RegExp]> = [
    ['the primary CTA (place-order)', /\.place-order\{[^}]*\}/],
    ['a tab bar link', /\.tab-bar\[data-astro-cid-[\w-]+\]\s*a\[data-astro-cid-[\w-]+\]\{[^}]*\}/],
    ['a restaurant card link', /\.restaurant-card\{[^}]*\}/],
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

describe('cart badge never renders at zero (driver review, #67)', () => {
  it('a hidden cart badge is display:none, not an empty flex dot', () => {
    const rules = css.match(/\.cart-badge(?:\[[^\]]*\])*\{[^}]*\}/g) ?? [];
    const hiddenRule = rules.find((rule) => rule.includes('[hidden]') && rule.includes('display:none'));
    expect(hiddenRule, `expected a .cart-badge[hidden] rule with display:none among: ${rules.join(' / ')}`).toBeTruthy();
  });
});

describe('landing hero wordmark fits at 375px (driver review, #67)', () => {
  it('h1 allows the run-together wordmark to break rather than overflow the viewport', () => {
    const rule = css.match(/h1\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('overflow-wrap:anywhere');
  });
});

describe('home feed promo banner fits at 375px (#82 review round 2, item 1)', () => {
  // A row layout with the banner image's fixed 343px intrinsic width had no
  // room left for the heading once the surrounding padding/border were
  // subtracted at a 375px viewport — the image spilled past the box and the
  // heading rendered beside it, off-screen, widening the whole page
  // (measured scrollWidth 453 on 938d004). This fails against that commit
  // and passes once the banner stacks and the image scales to its box.
  it('the banner stacks the image above the heading rather than placing them side by side', () => {
    const rule = css.match(/\.promo-banner\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('flex-direction:column');
  });

  it("the banner image scales to the box's own width instead of its 343px intrinsic size", () => {
    const rule = css.match(/\.promo-banner img\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('width:100%');
    expect(rule).not.toMatch(/(?<!max-)width:343px/);
  });
});

describe('cart/checkout breakdown, chip groups and CTA fit at 375px (#94 review round 1, item 4)', () => {
  // main's own padding (var(--space-lg) = 20px each side) leaves a 335px
  // content column at a 375px viewport, so any of these three rules could
  // overflow the page if it declared a fixed pixel width instead of sizing
  // to that column.
  it('the primary CTA (place-order, shared with "Go to checkout") fills its container rather than a fixed pixel width', () => {
    const rule = css.match(/\.place-order\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('width:100%');
    expect(rule).not.toMatch(/width:\d+px/);
  });

  it('a chip group (drop-off, delivery instructions) wraps its chips instead of forcing them onto one line', () => {
    const rule = css.match(/\.chip-group\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('flex-wrap:wrap');
  });

  it('the checkout breakdown does not set a fixed pixel width wider than the 335px content column', () => {
    const rule = css.match(/\.checkout-breakdown\{[^}]*\}/)?.[0] ?? '';
    expect(rule).not.toMatch(/width:\d+px/);
  });

  it('the demo disclosure does not set a fixed pixel width wider than the 335px content column', () => {
    const rule = css.match(/\.demo-disclosure\{[^}]*\}/)?.[0] ?? '';
    expect(rule).not.toMatch(/width:\d+px/);
  });
});
