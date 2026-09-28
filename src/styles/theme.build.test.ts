import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { deliveredCss } from '../../test-support/dist-css';

// Reads the output of `astro build`, the same command Vercel runs for this
// static site (ADR 0001), so these assertions prove what a visitor's
// browser actually receives. The build itself runs once for the whole
// test run in vitest.global-setup.ts, not here - see that file for why.
const css = deliveredCss('dist/index.html');

describe('the site is always dark: one palette, no OS-follows toggle (#194: #181-green, section 2a)', () => {
  it(':root declares #181-green\'s dark values directly, including the tab-active-bg and badge-ink tokens the spec leaves to the engineer', () => {
    const rootBlock = css.match(/:root\{[^}]*\}/)?.[0] ?? '';
    expect(rootBlock).toContain('color-scheme:dark');
    expect(rootBlock).toContain('--color-bg:#0b0f0c');
    expect(rootBlock).toContain('--color-surface:#121712');
    expect(rootBlock).toContain('--color-text:#edf5ee');
    expect(rootBlock).toContain('--color-text-muted:#9fb3a2');
    expect(rootBlock).toContain('--color-border:#243328');
    expect(rootBlock).toContain('--color-tab-active-bg:#1b2a1e');
    expect(rootBlock).toContain('--color-badge-ink:#0b0f0c');
  });

  it('both accents resolve to #181-green\'s dark values', () => {
    const rootBlock = css.match(/:root\{[^}]*\}/)?.[0] ?? '';
    expect(rootBlock).toContain('--color-accent-a:#14b8a6');
    expect(rootBlock).toContain('--color-accent-b:#ffb84d');
  });

  it('no prefers-color-scheme block redeclares a palette token — there is only one theme', () => {
    expect(css).not.toContain('prefers-color-scheme');
  });
});

describe('shared design system: pill/rounded corners replace the parody-era square ones, no letter-spacing on button text (#104)', () => {
  it('the compact-choice chip (drop-off, delivery instructions, rating tags) is a rounded pill, not a square', () => {
    const rule = css.match(/\.chip\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('border-radius:999px');
    expect(rule).not.toContain('letter-spacing');
  });

  it('the menu add button is rounded, not square (the cart\'s standalone Remove button is gone - swipe-to-reveal and the confirm dialog replace it)', () => {
    const rules = css.match(/\.add-button\{[^}]*\}/g) ?? [];
    expect(rules.length, `expected an .add-button rule among: ${rules.join(' / ')}`).toBeGreaterThan(0);
    expect(rules[0]).toContain('border-radius:10px');
    expect(rules[0]).not.toContain('letter-spacing');
    expect(css).not.toContain('.remove-button');
  });

  it('the primary CTA (place-order) is rounded and carries no letter-spacing on its label', () => {
    const rule = css.match(/\.place-order\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('border-radius:12px');
    expect(rule).not.toContain('letter-spacing');
  });

  it('the start-over button is rounded and carries no letter-spacing on its label', () => {
    const rule = css.match(/\.reset-button\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('border-radius:10px');
    expect(rule).not.toContain('letter-spacing');
  });
});

describe('compact page-title scale replaces the oversized parody-era h1 (#104)', () => {
  it('--font-size-h1 matches the mock\'s compact page-title scale (docs/design/80-checkout-sf.html\'s h1 uses --font-size-h2, 1rem) instead of the old 1.875rem', () => {
    const rootBlock = css.match(/:root\{[^}]*\}/)?.[0] ?? '';
    expect(rootBlock).toContain('--font-size-h1:1rem');
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

describe('promo carousel fits at 375px (#137)', () => {
  // Replaces the old single .promo-banner slot — docs/design/
  // 137-carousel-header-tiles.md's own arithmetic: 200px of photo plus a
  // caption strip, 256px total (excluding the dot row).
  it('the slide media is sized as a hero image, not a slightly-tall list row', () => {
    const rule = css.match(/\.carousel-slide-media\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('height:200px');
  });

  it('the pause control clears the 44px touch-target floor in both dimensions (docs/design/46-phone-native.md); each dot clears it in height, narrower in width by the driver\'s own round-1 review (PR #150) compacting the row', () => {
    const pauseRule = css.match(/\.carousel-pause\{[^}]*\}/)?.[0] ?? '';
    expect(pauseRule).toContain('min-width:44px');
    expect(pauseRule).toContain('min-height:44px');

    const dotRule = css.match(/\.carousel-dot\{[^}]*\}/)?.[0] ?? '';
    expect(dotRule).toContain('width:24px');
    expect(dotRule).toContain('min-height:44px');
  });

  it('the slide link and the pause control suppress the default tap-highlight', () => {
    const linkRule = css.match(/\.carousel-slide-link\{[^}]*\}/)?.[0] ?? '';
    expect(linkRule).toContain('-webkit-tap-highlight-color:transparent');
    const pauseRule = css.match(/\.carousel-pause\{[^}]*\}/)?.[0] ?? '';
    expect(pauseRule).toContain('-webkit-tap-highlight-color:transparent');
  });

  // #151: the first-order slide (home-dom.ts) has no caption text, so it
  // hides .carousel-caption instead of leaving it empty, and grows its
  // media box by that strip's own 56px so the total slide height (media
  // plus caption) still matches every other slide's 256px.
  it('the first-order slide grows its media box by exactly the caption strip\'s own height, so its total height matches every other slide', () => {
    const rule = css.match(/\.carousel-slide-media--first-order\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('height:256px');
  });

  it('the caption strip is actually hidden, not just emptied — [hidden] overrides the strip\'s own flex display rule', () => {
    const rules = css.match(/\.carousel-caption(?:\[[^\]]*\])*\{[^}]*\}/g) ?? [];
    const hiddenRule = rules.find((rule) => rule.includes('[hidden]') && rule.includes('display:none'));
    expect(hiddenRule, `expected a .carousel-caption[hidden] rule with display:none among: ${rules.join(' / ')}`).toBeTruthy();
  });
});

describe('"Near you" 2-column tile grid fits at 375px (#137)', () => {
  it('the grid lays out exactly two columns, not the old vertical single-column list', () => {
    const rule = css.match(/\.tile-grid\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('grid-template-columns:repeat(2,1fr)');
  });

  it('a tile card suppresses the default tap-highlight and defines a visible :active pressed rule, same touch feedback as .restaurant-card', () => {
    const rule = css.match(/\.tile-card\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('-webkit-tap-highlight-color:transparent');
    expect(rule).toContain('-webkit-user-select:none');
    expect(css).toMatch(/\.tile-card:active\{[^}]*transform:[^}]*\}/);
  });

  it('the tile name has no line-clamp or truncation, so a long name wraps instead of clipping (AC5)', () => {
    const rule = css.match(/\.tile-card-name\{[^}]*\}/)?.[0] ?? '';
    expect(rule).not.toContain('-webkit-line-clamp');
    expect(rule).not.toContain('text-overflow');
    expect(rule).not.toContain('white-space:nowrap');
  });

  // #151: the tile grid's columns are narrower than the full-width rows
  // #130 fixed this wrap on, so the fee amount and the word "delivery" are
  // their own non-wrapping unit (home-dom.ts's .tile-card-fee span) rather
  // than relying on room elsewhere in the line.
  it('the fee label is a single non-wrapping unit, so "delivery" never wraps onto its own line', () => {
    const rule = css.match(/\.tile-card-fee\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('white-space:nowrap');
  });
});

describe('header city pill and wallet-balance placeholder, home route only (#137)', () => {
  it('the home page reserves a three-column brand row for the wordmark, the pill, and the balance placeholder', () => {
    const homeCss = deliveredCss('dist/index.html');
    const rule = homeCss.match(/\.brand-group--home\[data-astro-cid-[\w-]+\]\{[^}]*grid-template-columns:1fr auto 1fr[^}]*\}/);
    expect(rule).not.toBeNull();
  });

  it('the pill and balance slots do not exist in the header markup on another route', () => {
    const cartHtml = readFileSync(path.join(process.cwd(), 'dist/cart/index.html'), 'utf-8');
    expect(cartHtml).not.toContain('city-pill-slot');
    expect(cartHtml).not.toContain('balance-slot');
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

describe('tracker stepper and rating prompt fit at 375px (#83)', () => {
  it('the stepper does not set a fixed pixel width wider than the 335px content column', () => {
    const rules = css.match(/\.stepper\{[^}]*\}/g) ?? [];
    expect(rules.length, `expected a .stepper rule among: ${rules.join(' / ')}`).toBeGreaterThan(0);
    expect(rules[0]).not.toMatch(/width:\d+px/);
  });

  it('the star picker wraps rather than forcing five 44px touch targets onto one fixed-width row', () => {
    const rules = css.match(/\.star-picker\{[^}]*\}/g) ?? [];
    expect(rules.length, `expected a .star-picker rule among: ${rules.join(' / ')}`).toBeGreaterThan(0);
    expect(rules[0]).toContain('flex-wrap:wrap');
  });

  it('the rating tag chips wrap rather than forcing three chips onto one line (shared .chip-group rule)', () => {
    const rules = css.match(/\.chip-group\{[^}]*\}/g) ?? [];
    expect(rules.length, `expected a .chip-group rule among: ${rules.join(' / ')}`).toBeGreaterThan(0);
    expect(rules[0]).toContain('flex-wrap:wrap');
  });
});

describe('Offers screen voucher icons stay explicitly sized at 375px (driver review, #89 revision round 1)', () => {
  // Before this round's styling fix, .badge and .voucher-expiry rendered
  // their SVGs at intrinsic size with no width/height rule at all, so each
  // voucher row measured roughly 330px wide on its own (driver review on
  // PR #97). These assert the sizing rule exists at all - not `?? ''`,
  // which would let a renamed or dropped selector pass silently - before
  // checking what it constrains the icon to.
  it('.badge svg is explicitly sized rather than left at its intrinsic width', () => {
    const rules = css.match(/\.badge svg\{[^}]*\}/g) ?? [];
    expect(rules.length, `expected a .badge svg rule among: ${rules.join(' / ')}`).toBeGreaterThan(0);
    expect(rules[0]).toContain('width:18px');
    expect(rules[0]).toContain('height:18px');
  });

  it('.voucher-expiry svg is explicitly sized rather than left at its intrinsic width', () => {
    const rules = css.match(/\.voucher-expiry svg\{[^}]*\}/g) ?? [];
    expect(rules.length, `expected a .voucher-expiry svg rule among: ${rules.join(' / ')}`).toBeGreaterThan(0);
    expect(rules[0]).toContain('width:13px');
    expect(rules[0]).toContain('height:13px');
  });

  it('.voucher-main clears its flex min-width floor so its text truncates instead of forcing the row wider', () => {
    const rules = css.match(/\.voucher-main\{[^}]*\}/g) ?? [];
    expect(rules.length, `expected a .voucher-main rule among: ${rules.join(' / ')}`).toBeGreaterThan(0);
    expect(rules[0]).toContain('min-width:0');
  });
});

describe('flash-deal sheet renders as a fixed overlay above the feed, not page content (driver review, #89 revision round 1)', () => {
  // Before this round's styling fix, .flash-sheet-overlay had no position
  // rule at all, so the scrim and sheet sat in normal page flow under the
  // last restaurant card instead of covering the viewport as a modal
  // (driver review on PR #97).
  it('.flash-sheet-overlay covers the full viewport rather than sitting in page flow', () => {
    const rules = css.match(/\.flash-sheet-overlay\{[^}]*\}/g) ?? [];
    expect(rules.length, `expected a .flash-sheet-overlay rule among: ${rules.join(' / ')}`).toBeGreaterThan(0);
    expect(rules[0]).toContain('position:fixed');
    expect(rules[0]).toContain('inset:0');
  });

  it('.flash-sheet-overlay .sheet is pinned to the viewport edges rather than a fixed pixel width that could overflow at 375px', () => {
    const rules = css.match(/\.flash-sheet-overlay \.sheet\{[^}]*\}/g) ?? [];
    expect(rules.length, `expected a .flash-sheet-overlay .sheet rule among: ${rules.join(' / ')}`).toBeGreaterThan(0);
    const rule = rules[0];
    expect(rule).toContain('position:fixed');
    expect(rule).toContain('left:0');
    expect(rule).toContain('right:0');
    expect(rule).not.toMatch(/(?<!max-)width:\d+px/);
  });
});

describe('cart swipe-to-remove row and remove-confirm dialog fit at 375px (polish-cart)', () => {
  // Every assertion first proves its rule exists at all, so a renamed or
  // dropped selector fails here rather than passing on an empty string.
  function rule(pattern: RegExp, label: string): string {
    const rules = css.match(pattern) ?? [];
    expect(rules.length, `expected a ${label} rule`).toBeGreaterThan(0);
    return rules[0] ?? '';
  }

  it('the cart row clips its sliding content, and sets no fixed pixel width', () => {
    const cartRow = rule(/\.cart-row\{[^}]*\}/g, '.cart-row');
    expect(cartRow).toContain('overflow:hidden');
    expect(cartRow).toContain('position:relative');
    expect(cartRow).not.toMatch(/(?<!max-|min-)width:\d+px/);
  });

  it('the cart row bleeds only as far as main\'s own side padding (var(--space-lg)), never past the viewport', () => {
    const cartRow = rule(/\.cart-row\{[^}]*\}/g, '.cart-row');
    expect(cartRow).toContain('margin:0 calc(-1 * var(--space-lg))');
    expect(cartRow).toContain('padding:0 var(--space-lg)');
    // main's own base rule (global.css), not the phone-width padding-bottom override.
    const mainRules = css.match(/(?:^|\})main\{[^}]*\}/g) ?? [];
    const main = mainRules.find((candidate) => candidate.includes('max-width:40rem'));
    expect(main, `expected main's base rule among: ${mainRules.join(' / ')}`).toBeTruthy();
    expect(main).toContain('padding:var(--space-xl) var(--space-lg)');
  });

  it('the row content leaves vertical drags to the page scroll and sits opaque above the action', () => {
    const content = rule(/\.cart-row>\.cart-line\{[^}]*\}/g, '.cart-row > .cart-line');
    expect(content).toContain('touch-action:pan-y');
    expect(content).toContain('background:var(--color-bg)');
    expect(content).toContain('z-index:1');
    expect(content).not.toMatch(/(?<!max-|min-)width:\d+px/);
  });

  it('an open row slides its content 88px left', () => {
    const open = rule(/\.cart-row\.is-open>\.cart-line\{[^}]*\}/g, '.cart-row.is-open > .cart-line');
    expect(open).toContain('transform:translate(-88px)');
  });

  it('the swipe action is a danger-coloured, rounded button pinned inside the row, narrower than the slide', () => {
    const action = rule(/\.swipe-action\{[^}]*\}/g, '.swipe-action');
    expect(action).toContain('position:absolute');
    expect(action).toContain('right:var(--space-lg)');
    expect(action).toContain('width:80px');
    expect(action).toContain('background:var(--color-danger)');
    expect(action).toContain('color:var(--color-bg)');
    expect(action).toContain('border-radius:12px');
    expect(action).not.toContain('letter-spacing');
    expect(action).not.toContain('text-transform');
  });

  it('the confirm overlay covers the viewport as a fixed layer', () => {
    const overlay = rule(/\.confirm-overlay\{[^}]*\}/g, '.confirm-overlay');
    expect(overlay).toContain('position:fixed');
    expect(overlay).toContain('inset:0');
  });

  it('the confirm dialog fills its padded column up to a max width rather than a fixed pixel width', () => {
    const dialog = rule(/\.confirm-dialog\{[^}]*\}/g, '.confirm-dialog');
    expect(dialog).toContain('width:100%');
    expect(dialog).toContain('max-width:22rem');
    expect(dialog).not.toMatch(/(?<!max-|min-)width:\d+px/);
  });

  it('the confirm buttons are pills that share the row and may shrink, with no letter-spacing', () => {
    const button = rule(/\.confirm-button\{[^}]*\}/g, '.confirm-button');
    expect(button).toContain('border-radius:999px');
    expect(button).toContain('flex:1');
    expect(button).toContain('min-width:0');
    expect(button).toContain('min-height:44px');
    expect(button).not.toContain('letter-spacing');
    const danger = rule(/\.confirm-danger\{[^}]*\}/g, '.confirm-danger');
    expect(danger).toContain('background:var(--color-danger)');
  });

  it('prefers-reduced-motion removes the row slide and the dialog entrance', () => {
    const blocks = css.match(/@media \(prefers-reduced-motion:reduce\)\{[^@]*?\}\}/g) ?? [];
    const block = blocks.find((candidate) => candidate.includes('.cart-row>.cart-line'));
    expect(block, `expected a reduced-motion block covering the cart row among: ${blocks.join(' / ')}`).toBeTruthy();
    expect(block).toContain('.confirm-dialog');
    expect(block).toContain('transition:none');
    expect(block).toContain('animation:none');
  });

  it('--color-danger is defined', () => {
    const rootBlock = css.match(/:root\{[^}]*\}/)?.[0] ?? '';
    expect(rootBlock).toContain('--color-danger:#ff6b6b');
  });
});

describe('menu\'s "View cart" bar sits above the tab bar, not flush on top of it (#118)', () => {
  it('the cart summary bar is offset from the viewport bottom by the tab bar\'s own height, the same 56px offset .footer-bar (Offers) uses', () => {
    const rules = css.match(/\.cart-summary-bar\{[^}]*\}/g) ?? [];
    expect(rules.length, `expected a .cart-summary-bar rule among: ${rules.join(' / ')}`).toBeGreaterThan(0);
    const rule = rules.find((candidate) => candidate.includes('position:fixed'));
    expect(rule, `expected a fixed .cart-summary-bar rule among: ${rules.join(' / ')}`).toBeTruthy();
    expect(rule).toContain('bottom:calc(56px + env(safe-area-inset-bottom))');

    const footerRules = css.match(/\.footer-bar\{[^}]*\}/g) ?? [];
    const footerRule = footerRules.find((candidate) => candidate.includes('bottom:calc'));
    expect(footerRule, `expected a .footer-bar rule with a calc() offset among: ${footerRules.join(' / ')}`).toBeTruthy();
    expect(footerRule).toContain('bottom:calc(56px + env(safe-area-inset-bottom))');
  });
});
