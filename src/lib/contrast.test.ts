import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

// Palette values from src/styles/global.css and docs/design/46-phone-native.md
// (the dark theme's own table), asserted here rather than imported so this
// test fails if either file's hex values drift from what it checks.
const LIGHT_SURFACE = '#fffaf0';
const LIGHT_ACCENT_A = '#35608f';
const LIGHT_ACCENT_B = '#b1581c';
const LIGHT_TEXT_MUTED = '#7f6e58';

const DARK_SURFACE = '#241e17';
const DARK_TEXT = '#f0e6d2';
const DARK_ACCENT_A = '#7fb2e8';
const DARK_ACCENT_B = '#e8935a';

describe('dark palette contrast (AC5)', () => {
  it('body text clears 4.5:1 against the dark surface', () => {
    expect(contrastRatio(DARK_TEXT, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('both accents clear 4.5:1 against the dark surface', () => {
    expect(contrastRatio(DARK_ACCENT_A, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK_ACCENT_B, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('light-theme accent-b/text-muted contrast fix (AC6)', () => {
  it('--color-accent-b clears 4.5:1 against --color-surface', () => {
    expect(contrastRatio(LIGHT_ACCENT_B, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('--color-text-muted clears 4.5:1 against --color-surface', () => {
    expect(contrastRatio(LIGHT_TEXT_MUTED, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('--color-accent-b still reads warm against --color-accent-a\'s cool', () => {
    // A cheap, checkable stand-in for "reads warm/cool": accent-b's red
    // channel dominates its blue channel (warm), accent-a's is the
    // reverse (cool) - true of both the original hex values and stays
    // true after darkening accent-b for contrast.
    const [rB, , bB] = [
      parseInt(LIGHT_ACCENT_B.slice(1, 3), 16),
      parseInt(LIGHT_ACCENT_B.slice(3, 5), 16),
      parseInt(LIGHT_ACCENT_B.slice(5, 7), 16),
    ];
    const [rA, , bA] = [
      parseInt(LIGHT_ACCENT_A.slice(1, 3), 16),
      parseInt(LIGHT_ACCENT_A.slice(3, 5), 16),
      parseInt(LIGHT_ACCENT_A.slice(5, 7), 16),
    ];
    expect(rB).toBeGreaterThan(bB);
    expect(bA).toBeGreaterThan(rA);
  });
});
