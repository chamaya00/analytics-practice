import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREDITS, MANIFEST, parseCreditsRows, SLOT_SIZE } from './generate-photo-manifest.mjs';
import { validateEntry } from './fetch-photos.mjs';

describe('generate-photo-manifest', () => {
  it('parses one entry per placeholder row, with the .svg swapped for .jpg', () => {
    const rows = parseCreditsRows(readFileSync(CREDITS, 'utf8'));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.path).toMatch(/^public\/images\/[a-z0-9/_-]+\.jpg$/);
      expect(row.query.trim()).not.toBe('');
    }
  });

  it('sizes every slot from the component that actually renders it, never invents a fourth size', () => {
    const rows = parseCreditsRows(readFileSync(CREDITS, 'utf8'));
    for (const row of rows) {
      const known = Object.values(SLOT_SIZE).some((size) => size.width === row.width && size.height === row.height);
      expect(known, `${row.path} has an unrecognised size ${row.width}x${row.height}`).toBe(true);
    }
  });

  it('the committed manifest is what the generator produces right now, and every entry validates', () => {
    const committed = JSON.parse(readFileSync(MANIFEST, 'utf8')).photos;
    const generated = parseCreditsRows(readFileSync(CREDITS, 'utf8'));
    expect(committed).toEqual(generated);

    const paths = committed.map((entry: { path: string }) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const entry of committed) {
      expect(validateEntry(entry), `${entry.path}: ${validateEntry(entry).join(', ')}`).toEqual([]);
    }
  });
});
