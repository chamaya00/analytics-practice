// AC3 (#82) / AC4 (#106): every image budget and provenance rule, checked
// against the committed files and the built site directly — not eyeballed.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { restaurantsForCity } from './restaurants';
import { MAX_BYTES as FETCH_MAX_BYTES } from '../../scripts/fetch-photos.mjs';

const ROOT = process.cwd();
const IMAGES_DIR = path.join(ROOT, 'public', 'images');
const CREDITS_FILE = path.join(ROOT, 'docs', 'design', '80-photo-credits.md');
// #82's design budget (40KB) fit a placeholder SVG with room to spare. A
// real downloaded JPEG only has to clear scripts/fetch-photos.mjs's own
// per-file refusal — importing that constant keeps the two from drifting
// apart the way a second hand-typed number would.
const RESTAURANT_THUMBNAIL_MAX_BYTES = FETCH_MAX_BYTES;
const HOME_FEED_FIRST_PAINT_MAX_BYTES = 900 * 1024;

function listImageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listImageFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

describe('committed placeholder images — weight budget (AC3)', () => {
  it('every restaurant hero thumbnail is at most 40KB', () => {
    for (const city of ['sf', 'hcmc'] as const) {
      for (const restaurant of restaurantsForCity(city)) {
        const filePath = path.join(ROOT, 'public', restaurant.heroImage.replace(/^\//, ''));
        const size = statSync(filePath).size;
        expect(size, `${restaurant.heroImage} is ${size} bytes`).toBeLessThanOrEqual(RESTAURANT_THUMBNAIL_MAX_BYTES);
      }
    }
  });

  it("the home feed's first paint (up to six restaurant thumbnails, phone width; the promo banner is text-only, #104 round 1) totals at most 900KB", () => {
    for (const city of ['sf', 'hcmc'] as const) {
      const restaurants = restaurantsForCity(city).slice(0, 6);
      const total = restaurants.reduce(
        (sum, restaurant) => sum + statSync(path.join(ROOT, 'public', restaurant.heroImage.replace(/^\//, ''))).size,
        0,
      );
      expect(total, `${city} first paint totals ${total} bytes`).toBeLessThanOrEqual(HOME_FEED_FIRST_PAINT_MAX_BYTES);
    }
  });
});

describe('photo credits file (AC3, #82; rewritten from the lock file by #106)', () => {
  it('every committed image under public/images has an entry in the credits file', () => {
    const credits = readFileSync(CREDITS_FILE, 'utf-8');
    const files = listImageFiles(IMAGES_DIR);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const relPath = `public/images/${path.relative(IMAGES_DIR, file).split(path.sep).join('/')}`;
      expect(credits, `${relPath} has no credits entry`).toContain(relPath);
    }
  });

  it('names a real photographer and licence for every entry — no placeholder left (#106)', () => {
    const credits = readFileSync(CREDITS_FILE, 'utf-8');
    expect(credits).not.toContain('Placeholder — not yet downloaded');
    expect(credits).not.toContain('.svg');
    const rows = credits.split('\n').filter((line) => /^\|\s*`public\/images\//.test(line));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row, row).toContain('Unsplash License');
    }
  });
});

describe('no image is hotlinked from another host (AC3)', () => {
  it('the built site references no external src/srcset/href/url() for an image', () => {
    const distDir = path.join(ROOT, 'dist');
    const offenders: string[] = [];
    const pattern = /(?:src|srcset|href)="https?:\/\/|url\(\s*['"]?https?:\/\//gi;

    function walk(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(html|css|js)$/.test(entry.name)) {
          const contents = readFileSync(full, 'utf-8');
          if (pattern.test(contents)) offenders.push(full);
        }
      }
    }

    walk(distDir);
    expect(offenders).toEqual([]);
  });
});
