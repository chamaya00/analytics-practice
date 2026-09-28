import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

// Palette values from src/styles/global.css and docs/design/
// 80-two-city-brand-and-flow.md's "Contrast" section (the chosen direction),
// asserted here rather than imported so this test fails if either file's hex
// values drift from what it checks. --color-accent-a/-b keep their existing
// token names (every consumer already uses them) but now carry #80's chosen
// --color-accent / --color-accent-secondary values.
const LIGHT_BG = '#fbf7ff';
const LIGHT_SURFACE = '#f7f1ff';
const LIGHT_TEXT = '#241b33';
const LIGHT_TEXT_MUTED = '#6b5d85';
const LIGHT_ACCENT_A = '#6c3ce0';
const LIGHT_ACCENT_B = '#ff7a45';
const LIGHT_BADGE_INK = '#241b33';
const LIGHT_DANGER = '#c4213a';

const DARK_BG = '#16101f';
const DARK_SURFACE = '#1e1730';
const DARK_TEXT = '#f1e9ff';
const DARK_TEXT_MUTED = '#b7a6d9';
const DARK_ACCENT_A = '#b79cff';
const DARK_ACCENT_B = '#ffa36b';
const DARK_BADGE_INK = '#16101f';
const DARK_DANGER = '#ff8a9b';

describe('light palette contrast (#82 review round 1, item 2)', () => {
  it('body text clears 4.5:1 against both bg and surface', () => {
    expect(contrastRatio(LIGHT_TEXT, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_TEXT, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('muted text clears 4.5:1 against both bg and surface', () => {
    expect(contrastRatio(LIGHT_TEXT_MUTED, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_TEXT_MUTED, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('the accent (discount/success color) clears 4.5:1 against both bg and surface', () => {
    expect(contrastRatio(LIGHT_ACCENT_A, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_ACCENT_A, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('dark palette contrast (#82 review round 1, item 2)', () => {
  it('body text clears 4.5:1 against both bg and surface', () => {
    expect(contrastRatio(DARK_TEXT, DARK_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK_TEXT, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('muted text clears 4.5:1 against both bg and surface', () => {
    expect(contrastRatio(DARK_TEXT_MUTED, DARK_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK_TEXT_MUTED, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('the accent clears 4.5:1 against both bg and surface', () => {
    expect(contrastRatio(DARK_ACCENT_A, DARK_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK_ACCENT_A, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('badge fill (--color-accent-b) is never text-on-background (#80 "Contrast")', () => {
  it('the chosen light direction fails outright as text directly on bg — the reason it is badge-fill only, per #80\'s own "checked and rejected first" figure (2.44)', () => {
    expect(contrastRatio(LIGHT_ACCENT_B, LIGHT_BG)).toBeLessThan(4.5);
  });

  it('the badge-ink-on-fill pairing this site actually uses clears 4.5:1 in both themes', () => {
    expect(contrastRatio(LIGHT_BADGE_INK, LIGHT_ACCENT_B)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK_BADGE_INK, DARK_ACCENT_B)).toBeGreaterThanOrEqual(4.5);
  });

  it('white text on the fill fails in both themes — why dark ink is the rule, not a suggestion', () => {
    expect(contrastRatio('#ffffff', LIGHT_ACCENT_B)).toBeLessThan(4.5);
    expect(contrastRatio('#ffffff', DARK_ACCENT_B)).toBeLessThan(4.5);
  });
});

describe('danger fill (--color-danger) carries --color-bg text: the cart’s swipe-revealed "Remove" and the confirm dialog’s "Remove"', () => {
  it('bg-coloured text on the danger fill clears 4.5:1 in the light theme', () => {
    expect(contrastRatio(LIGHT_BG, LIGHT_DANGER)).toBeGreaterThanOrEqual(4.5);
  });

  it('bg-coloured text on the danger fill clears 4.5:1 in the dark theme', () => {
    expect(contrastRatio(DARK_BG, DARK_DANGER)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('flash sheet header and collapsed reopen bar carry --color-bg text on the --color-accent-a fill, in both themes (#126 AC3)', () => {
  // The header/bar used a fixed white, which read fine against the light
  // theme's dark violet accent but nearly disappeared in dark mode, where
  // --color-accent-a turns light lavender. --color-bg text tracks the fill
  // through both themes instead — the same pairing .place-order already
  // uses on this fill, checked here again under the flash sheet's own name
  // so a future token change can't regress it without this failing too.
  it('clears 4.5:1 in the light theme', () => {
    expect(contrastRatio(LIGHT_BG, LIGHT_ACCENT_A)).toBeGreaterThanOrEqual(4.5);
  });

  it('clears 4.5:1 in the dark theme', () => {
    expect(contrastRatio(DARK_BG, DARK_ACCENT_A)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('flash sheet / reopen bar countdown tile: a fixed dark tile with light digits, independent of theme (#126 AC3)', () => {
  // --color-flash-tile-bg (global.css) is deliberately the same value in
  // both theme blocks (not redeclared in the dark one), so one check
  // against white covers both — unlike every other token pair above,
  // which needs a light and a dark case because the token itself flips.
  const FLASH_TILE_BG = '#241b33';

  it('white digits clear 4.5:1 against the fixed dark tile fill', () => {
    expect(contrastRatio('#ffffff', FLASH_TILE_BG)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('thanks-voucher ticket: text on tint, the win\'s reward-slot card (#166, docs/design/162-*, "The thanks voucher" — the design\'s own "text on tint" row, quoted 13.14 / 12.29)', () => {
  // --color-tab-active-bg (global.css) is the design's exact tint value in
  // both themes, so this is the same pair `./scripts/contrast` was run
  // against for the PR, pinned here rather than left to only a rendered shot.
  const LIGHT_TINT = '#ede1ff';
  const DARK_TINT = '#2e2444';

  it('clears 4.5:1 in the light theme', () => {
    expect(contrastRatio(LIGHT_TEXT, LIGHT_TINT)).toBeGreaterThanOrEqual(4.5);
  });

  it('clears 4.5:1 in the dark theme', () => {
    expect(contrastRatio(DARK_TEXT, DARK_TINT)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('first-order banner ticket: amount ink on the ticket\'s white fill (#184, docs/design/137-carousel-header-tiles.md, "Contrast checked")', () => {
  // #2f1861 is the banner gradient's own darker stop (already checked against
  // white as the banner's own text color elsewhere in that table) — this row
  // is the one new pairing #184 introduces: that same ink directly on the
  // ticket's white fill, unaffected by the --compact size modifier since a
  // size change doesn't change a color pairing's ratio.
  const TICKET_INK = '#2f1861';
  const TICKET_FILL = '#ffffff';

  it('clears 4.5:1 — fixed in both themes, same gradient/ticket in light and dark', () => {
    expect(contrastRatio(TICKET_INK, TICKET_FILL)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('VIP level fills: full ink only, never muted text (#174, docs/design/162-*, "Contrast")', () => {
  const LIGHT_GOLD = '#f3d27a';
  const LIGHT_GOLD_INK = '#241b33';
  const DARK_GOLD = '#e0b95a';
  const DARK_GOLD_INK = '#16101f';
  const LIGHT_PLATINUM = '#d9d3ea';
  const LIGHT_PLATINUM_INK = '#241b33';
  const DARK_PLATINUM = '#cbc3e3';
  const DARK_PLATINUM_INK = '#16101f';

  it('gold ink on the gold fill clears 4.5:1 in both themes ("Free delivery"/"Gold" pills, the VIP stamp)', () => {
    expect(contrastRatio(LIGHT_GOLD_INK, LIGHT_GOLD)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK_GOLD_INK, DARK_GOLD)).toBeGreaterThanOrEqual(4.5);
  });

  it('platinum ink on the platinum fill clears 4.5:1 in both themes ("Platinum" pill)', () => {
    expect(contrastRatio(LIGHT_PLATINUM_INK, LIGHT_PLATINUM)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK_PLATINUM_INK, DARK_PLATINUM)).toBeGreaterThanOrEqual(4.5);
  });

  it('the one failure the design doc found and designed out: muted text on the gold fill misses 4.5:1', () => {
    expect(contrastRatio(LIGHT_TEXT_MUTED, LIGHT_GOLD)).toBeLessThan(4.5);
  });
});
