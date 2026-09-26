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

const DARK_BG = '#16101f';
const DARK_SURFACE = '#1e1730';
const DARK_TEXT = '#f1e9ff';
const DARK_TEXT_MUTED = '#b7a6d9';
const DARK_ACCENT_A = '#b79cff';
const DARK_ACCENT_B = '#ffa36b';
const DARK_BADGE_INK = '#16101f';

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
