import { describe, expect, it } from 'vitest';
import { rewriteCredits, rewriteRow } from './rewrite-photo-credits.mjs';

const RECORD = {
  id: 'abc123',
  query: 'san francisco street golden gate',
  photographer: 'Jane Doe',
  photographerUrl: 'https://unsplash.com/@janedoe',
  photoUrl: 'https://unsplash.com/photos/abc123',
  licence: 'Unsplash License (https://unsplash.com/license)',
  bytes: 42_000,
};

describe('rewriteRow', () => {
  it('leaves a non-table line untouched', () => {
    expect(rewriteRow('# Photo credits', {})).toBe('# Photo credits');
  });

  it('leaves a row untouched when the lock has no entry for it', () => {
    const row = '| `public/images/cities/sf.svg` | "san francisco street golden gate" | Placeholder — not yet downloaded |';
    expect(rewriteRow(row, {})).toBe(row);
  });

  it('swaps .svg for .jpg and the status cell for the lock record, for a 3-column row', () => {
    const row = '| `public/images/cities/sf.svg` | "san francisco street golden gate" | Placeholder — not yet downloaded |';
    const rewritten = rewriteRow(row, { 'public/images/cities/sf.jpg': RECORD });
    expect(rewritten).toContain('`public/images/cities/sf.jpg`');
    expect(rewritten).not.toContain('.svg');
    expect(rewritten).not.toContain('Placeholder');
    expect(rewritten).toContain('Jane Doe');
    expect(rewritten).toContain('Unsplash License');
    expect(rewritten).toContain('"san francisco street golden gate"');
  });

  it('keeps the cuisine column untouched on a 4-column restaurant hero row', () => {
    const row =
      '| `public/images/restaurants/mission-taqueria-hero.svg` | SF, tacos | "modern taqueria interior" | Placeholder — not yet downloaded |';
    const rewritten = rewriteRow(row, { 'public/images/restaurants/mission-taqueria-hero.jpg': RECORD });
    expect(rewritten).toContain('| SF, tacos |');
    expect(rewritten).toContain('`public/images/restaurants/mission-taqueria-hero.jpg`');
    expect(rewritten).toContain('Jane Doe');
  });
});

describe('rewriteCredits', () => {
  it('only rewrites the rows the lock file covers, leaving the rest as placeholders', () => {
    const markdown = [
      '| `public/images/cities/sf.svg` | "a" | Placeholder — not yet downloaded |',
      '| `public/images/cities/hcmc.svg` | "b" | Placeholder — not yet downloaded |',
    ].join('\n');
    const result = rewriteCredits(markdown, { 'public/images/cities/sf.jpg': RECORD });
    const lines = result.split('\n');
    expect(lines[0]).toContain('.jpg');
    expect(lines[1]).toContain('.svg');
    expect(lines[1]).toContain('Placeholder');
  });
});
