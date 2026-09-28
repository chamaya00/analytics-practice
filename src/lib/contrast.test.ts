import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

// Palette values from src/styles/global.css and docs/design/
// 181-color-scheme-proposals.md's "#181-green" section 2a, dark column (the
// owner's chosen direction, #194) — asserted here rather than imported so
// this test fails if either file's hex values drift from what it checks.
// The site is always dark (#194): one palette, one suite, not a light/dark
// pair.
const BG = '#0b0f0c';
const SURFACE = '#121712';
const TEXT = '#edf5ee';
const TEXT_MUTED = '#9fb3a2';
const ACCENT_A = '#14b8a6';
const ACCENT_B = '#ffb84d';
const BADGE_INK = '#0b0f0c';
const DANGER = '#ff6b6b';

describe('palette contrast (#194: #181-green, always dark)', () => {
  it('body text clears 4.5:1 against both bg and surface', () => {
    expect(contrastRatio(TEXT, BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(TEXT, SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('muted text clears 4.5:1 against both bg and surface', () => {
    expect(contrastRatio(TEXT_MUTED, BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(TEXT_MUTED, SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('--color-bg text on the accent fill clears 4.5:1 (.place-order and every other accent-a fill in BaseLayout.astro)', () => {
    expect(contrastRatio(BG, ACCENT_A)).toBeGreaterThanOrEqual(4.5);
  });

  it('the accent clears 4.5:1 against both bg and surface, as text (the discount/success line, chip selection)', () => {
    expect(contrastRatio(ACCENT_A, BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ACCENT_A, SURFACE)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('badge fill (--color-accent-b) is never text-on-background (#80 "Contrast", carried forward)', () => {
  it('the badge-ink-on-fill pairing this site actually uses clears 4.5:1', () => {
    expect(contrastRatio(BADGE_INK, ACCENT_B)).toBeGreaterThanOrEqual(4.5);
  });

  it('white text on the fill fails — why dark ink is the rule, not a suggestion', () => {
    expect(contrastRatio('#ffffff', ACCENT_B)).toBeLessThan(4.5);
  });
});

describe('danger fill (--color-danger) carries --color-bg text: the cart’s swipe-revealed "Remove" and the confirm dialog’s "Remove"', () => {
  it('bg-coloured text on the danger fill clears 4.5:1', () => {
    expect(contrastRatio(BG, DANGER)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('flash sheet header and collapsed reopen bar carry --color-bg text on the --color-accent-a fill (#126 AC3)', () => {
  // The header/bar used to use a fixed white, which failed once the accent
  // itself turned light (dark-mode's old lavender, and now this palette's
  // teal) — --color-bg text tracks the fill instead, the same pairing
  // .place-order already uses on this fill, checked here again under the
  // flash sheet's own name so a future token change can't regress it
  // without this failing too.
  it('clears 4.5:1', () => {
    expect(contrastRatio(BG, ACCENT_A)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('flash sheet / reopen bar countdown tile: a fixed dark tile with light digits, independent of theme (#126 AC3)', () => {
  // --color-flash-tile-bg (global.css) is a deliberately fixed value, not a
  // token that varies with the rest of the palette.
  const FLASH_TILE_BG = '#12261a';

  it('white digits clear 4.5:1 against the fixed dark tile fill', () => {
    expect(contrastRatio('#ffffff', FLASH_TILE_BG)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('thanks-voucher ticket: text on tint, the win\'s reward-slot card (#166, docs/design/162-*, "The thanks voucher")', () => {
  // --color-tab-active-bg (global.css) is #181-green's own tint value, so
  // this is the same pair `./scripts/contrast` was run against for the PR,
  // pinned here rather than left to only a rendered shot.
  const TINT = '#1b2a1e';

  it('clears 4.5:1', () => {
    expect(contrastRatio(TEXT, TINT)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('first-order banner ticket: amount ink on the ticket\'s white fill (#184, #194 recolor)', () => {
  // The ticket graphic (BaseLayout.astro's .carousel-slide-panel, home-dom.ts's
  // TICKET_SVG) is a fixed, not-retheming coupon design (same reasoning as
  // --color-flash-tile-bg) — recolored from #80's violet to a teal-register
  // dark ink for #194 so it doesn't read as a leftover violet element
  // against the rest of the now-teal site. Fixed regardless of palette.
  const TICKET_INK = '#0b2e29';
  const TICKET_FILL = '#ffffff';

  it('clears 4.5:1', () => {
    expect(contrastRatio(TICKET_INK, TICKET_FILL)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('first-order banner: white claim text and the light sub-text tint clear 4.5:1 against both fixed gradient stops (#194 recolor)', () => {
  // .carousel-slide-panel's own fixed gradient (BaseLayout.astro) — the
  // worst case is the lighter stop, since the darker one only improves
  // contrast against light text.
  const GRADIENT_LIGHT_STOP = '#0a7a6d';
  const GRADIENT_DARK_STOP = '#0b2e29';
  const CLAIM_TEXT = '#ffffff';
  const SUB_TEXT = '#dff9f4';

  it('the claim text clears 4.5:1 against both stops', () => {
    expect(contrastRatio(CLAIM_TEXT, GRADIENT_LIGHT_STOP)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(CLAIM_TEXT, GRADIENT_DARK_STOP)).toBeGreaterThanOrEqual(4.5);
  });

  it('the sub text clears 4.5:1 against both stops', () => {
    expect(contrastRatio(SUB_TEXT, GRADIENT_LIGHT_STOP)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(SUB_TEXT, GRADIENT_DARK_STOP)).toBeGreaterThanOrEqual(4.5);
  });
});

// Light-mode (#199 option C, "Daylight") palette values from src/styles/
// global.css's `@media (prefers-color-scheme: light)` block and docs/design/
// 199-light-mode-treatments.md's C column — asserted here rather than
// imported so this test fails if either file's hex values drift from what
// it checks. --color-cta/--color-cta-ink keep their dark values in C (the
// spec keeps the CTA teal as a fill), so CTA/CTA_INK below equal ACCENT_A/
// BADGE_INK above by value, not by accident.
const LIGHT_BG = '#f1f4f1';
const LIGHT_SURFACE = '#ffffff';
const LIGHT_TEXT = '#0b0f0c';
const LIGHT_TEXT_MUTED = '#56665b';
const LIGHT_ACCENT_A = '#0f766e';
const LIGHT_TAB_ACTIVE_BG = '#d7ede8';
const LIGHT_DANGER = '#c4213a';
const LIGHT_ACCENT_B_TEXT = '#8a5300';
const LIGHT_INDICATOR = '#7d8c82';
const CTA = '#14b8a6';
const CTA_INK = '#0b0f0c';

describe('light mode contrast (#199 option C, "Daylight")', () => {
  it('text and muted text clear 4.5:1 against both bg and surface', () => {
    expect(contrastRatio(LIGHT_TEXT, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_TEXT, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_TEXT_MUTED, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_TEXT_MUTED, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('the accent clears 4.5:1 against both bg and surface, as text (deep-teal accent text/outlines, the swoosh, the active dot, the focus ring, selected-chip border)', () => {
    expect(contrastRatio(LIGHT_ACCENT_A, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_ACCENT_A, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('--color-bg text on the accent-a fill clears 4.5:1 (.flash-tag, .cart-badge, .reopen-bar, the flash sheet header — kept on accent-a rather than moved to the CTA pair)', () => {
    expect(contrastRatio(LIGHT_BG, LIGHT_ACCENT_A)).toBeGreaterThanOrEqual(4.5);
  });

  it('--color-cta-ink on --color-cta clears 4.5:1 (.place-order and the rest of the CTA-pair consumers)', () => {
    expect(contrastRatio(CTA_INK, CTA)).toBeGreaterThanOrEqual(4.5);
  });

  it('--color-accent-b-text clears 4.5:1 against both bg and surface (.voucher-expiry)', () => {
    expect(contrastRatio(LIGHT_ACCENT_B_TEXT, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_ACCENT_B_TEXT, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('--color-bg text on the danger fill clears 4.5:1 (the cart\'s swipe-revealed "Remove" and the confirm dialog\'s "Remove")', () => {
    expect(contrastRatio(LIGHT_BG, LIGHT_DANGER)).toBeGreaterThanOrEqual(4.5);
  });

  it('text on tab-active-bg clears 4.5:1', () => {
    expect(contrastRatio(LIGHT_TEXT, LIGHT_TAB_ACTIVE_BG)).toBeGreaterThanOrEqual(4.5);
  });

  it('--color-indicator (the inactive carousel dot) clears the 3:1 non-text floor against bg — a dot is a button, not body text', () => {
    expect(contrastRatio(LIGHT_INDICATOR, LIGHT_BG)).toBeGreaterThanOrEqual(3.0);
  });
});

describe('light mode: two pairs the spec keeps below floor, on purpose (#199 option C, "Contrast, computed")', () => {
  it('the CTA edge on the ground is below the 3:1 non-text floor — the Place order button is identified by its label, which is 7.76:1, not by its edge (WCAG 1.4.11 asks 3:1 of the visual information needed to identify a component)', () => {
    expect(contrastRatio(CTA, LIGHT_BG)).toBeLessThan(3.0);
  });

  it('the white card on the ground is well below the 3:1 non-text floor — cards are identified by their photo and text, not their edge, which is why --color-border is kept rather than removed', () => {
    expect(contrastRatio(LIGHT_SURFACE, LIGHT_BG)).toBeLessThan(3.0);
  });
});

describe('VIP level fills: full ink only, never muted text (#174, docs/design/162-*, "Contrast")', () => {
  const GOLD = '#e0b95a';
  const GOLD_INK = '#0b0f0c';
  const PLATINUM = '#c9c9d1';
  const PLATINUM_INK = '#0b0f0c';

  it('gold ink on the gold fill clears 4.5:1 ("Free delivery"/"Gold" pills, the VIP stamp)', () => {
    expect(contrastRatio(GOLD_INK, GOLD)).toBeGreaterThanOrEqual(4.5);
  });

  it('platinum ink on the platinum fill clears 4.5:1 ("Platinum" pill)', () => {
    expect(contrastRatio(PLATINUM_INK, PLATINUM)).toBeGreaterThanOrEqual(4.5);
  });

  it('muted text on the gold fill misses 4.5:1 — why full ink is the rule, not a suggestion', () => {
    expect(contrastRatio(TEXT_MUTED, GOLD)).toBeLessThan(4.5);
  });
});
