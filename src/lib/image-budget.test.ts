// AC3: every image budget and provenance rule, checked against the
// committed files and the built site directly — not eyeballed.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { restaurantsForCity } from './restaurants';

const ROOT = process.cwd();
const IMAGES_DIR = path.join(ROOT, 'public', 'images');
const CREDITS_FILE = path.join(ROOT, 'docs', 'design', '80-photo-credits.md');
const RESTAURANT_THUMBNAIL_MAX_BYTES = 40 * 1024;
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

  it("the home feed's first paint (one promo banner plus up to six restaurant thumbnails, phone width) totals at most 900KB", () => {
    const bannerSize = statSync(path.join(ROOT, 'public', 'images', 'promo-banner.svg')).size;
    for (const city of ['sf', 'hcmc'] as const) {
      const restaurants = restaurantsForCity(city).slice(0, 6);
      const total =
        bannerSize +
        restaurants.reduce(
          (sum, restaurant) => sum + statSync(path.join(ROOT, 'public', restaurant.heroImage.replace(/^\//, ''))).size,
          0,
        );
      expect(total, `${city} first paint totals ${total} bytes`).toBeLessThanOrEqual(HOME_FEED_FIRST_PAINT_MAX_BYTES);
    }
  });
});

describe('photo credits file (AC3)', () => {
  it('every committed image under public/images has an entry in the credits file', () => {
    const credits = readFileSync(CREDITS_FILE, 'utf-8');
    const files = listImageFiles(IMAGES_DIR);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const relPath = `public/images/${path.relative(IMAGES_DIR, file).split(path.sep).join('/')}`;
      expect(credits, `${relPath} has no credits entry`).toContain(relPath);
    }
  });

  it('marks every entry as a not-yet-downloaded placeholder (network was refused this run)', () => {
    const credits = readFileSync(CREDITS_FILE, 'utf-8');
    expect(credits).toContain('Placeholder');
    expect(credits).not.toMatch(/\| Downloaded \|/);
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
