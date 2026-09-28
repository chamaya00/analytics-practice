// AC3 (#82) / AC4 (#106): every image budget and provenance rule, checked
// against the committed files and the built site directly — not eyeballed.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { restaurantsForCity } from './restaurants';
import { CITIES } from './money';
import { MAX_BYTES as FETCH_MAX_BYTES } from '../../scripts/fetch-photos.mjs';
import { DRIVERS_BY_CITY } from './drivers';

const ROOT = process.cwd();
const IMAGES_DIR = path.join(ROOT, 'public', 'images');
const CREDITS_FILE = path.join(ROOT, 'docs', 'design', '80-photo-credits.md');
// #148, docs/decisions/0010-driver-avatars.md: the 50 vendored driver
// avatars, measured once against the DiceBear option set drivers.ts and
// generate-driver-avatars.mjs actually produce (the largest observed,
// hcmc-driver-12's long-hair-plus-beard combination, is ~14.2KB; the 50
// together total ~258KB) — both caps leave headroom rather than sitting
// exactly on the observed numbers.
const AVATARS_DIR = path.join(ROOT, 'public', 'avatars', 'drivers');
const AVATAR_PER_FILE_MAX_BYTES = 16 * 1024;
const AVATAR_TOTAL_MAX_BYTES = 300 * 1024;
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
  it('every restaurant hero thumbnail is at most 180KB (fetch-photos.mjs MAX_BYTES)', () => {
    for (const city of CITIES) {
      for (const restaurant of restaurantsForCity(city)) {
        const filePath = path.join(ROOT, 'public', restaurant.heroImage.replace(/^\//, ''));
        const size = statSync(filePath).size;
        expect(size, `${restaurant.heroImage} is ${size} bytes`).toBeLessThanOrEqual(RESTAURANT_THUMBNAIL_MAX_BYTES);
      }
    }
  });

  // #137's own "Image budget" section left this slice size to the engineer:
  // the carousel's on-load slide is now `ad1` (#184 reorders the first-order
  // slide to index 3), a real restaurant photo — but that restaurant is
  // already `restaurantsForCity(city)[0]` in both cities (`mission-taqueria`
  // is SF_RESTAURANTS' own first entry, `ben-thanh-banh-mi` is HCMC_RESTAURANTS'
  // own first entry, and those are exactly CAROUSEL_RESTAURANT_SLIDES' `ad1`
  // for each city), so it's already inside this slice's existing four-image
  // sum rather than a fifth image to add. If a future catalogue reorder ever
  // puts a different restaurant at `restaurantsForCity(city)[0]` than the one
  // `CAROUSEL_RESTAURANT_SLIDES` names as `ad1`, that restaurant's `heroImage`
  // would need to be added to this sum explicitly, since it would no longer be
  // absorbed by the tile grid's own first two rows.
  //
  // The rest of this slice's own reasoning is unchanged: the "Near you" grid
  // is 2 columns, and at 375px main's own padding is var(--space-lg) (20px)
  // each side with the header/search/carousel/chips/heading above the grid
  // running to roughly 480-500px, leaving under half of the 812px viewport
  // ./scripts/app-render photographs (its own NARROW_SIZE) for tiles — enough
  // for the grid's first row (2 tiles) in full and a second row's photos to at
  // least partly enter the viewport, so this slice counts 4 (two rows of two)
  // rather than the old single-column six, erring toward the stricter (more
  // images counted) side of that estimate.
  it("the home feed's first paint (up to 4 restaurant thumbnails: the 2-column tile grid's first two rows, phone width; the carousel's on-load slide is now the first ad restaurant, already inside this slice) totals at most 900KB", () => {
    for (const city of CITIES) {
      const restaurants = restaurantsForCity(city).slice(0, 4);
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

describe('driver avatars — weight budget (#148 AC4)', () => {
  it('every driver id in drivers.ts has its own committed avatar file, and only those 50', () => {
    // LA reuses SF's pool (docs/design/229-la-catalogue.md), so an id can appear under two cities.
    const expectedIds = [...new Set(Object.values(DRIVERS_BY_CITY)
      .flat()
      .map((driver) => driver.id))]
      .sort();
    const actualIds = readdirSync(AVATARS_DIR)
      .map((name) => name.replace(/\.svg$/, ''))
      .sort();
    expect(actualIds).toEqual(expectedIds);
  });

  it('every avatar is at most the per-file cap, and all 50 together are at most the total cap', () => {
    const files = readdirSync(AVATARS_DIR).map((name) => path.join(AVATARS_DIR, name));
    let total = 0;
    for (const file of files) {
      const size = statSync(file).size;
      total += size;
      expect(size, `${path.basename(file)} is ${size} bytes`).toBeLessThanOrEqual(AVATAR_PER_FILE_MAX_BYTES);
    }
    expect(total, `all avatars total ${total} bytes`).toBeLessThanOrEqual(AVATAR_TOTAL_MAX_BYTES);
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
          // A plain <a href> is navigation, not an image load (the About page
          // links to the builder's LinkedIn, #236).
          const contents = readFileSync(full, 'utf-8').replace(/<a\s[^>]*>/gi, '');
          if (pattern.test(contents)) offenders.push(full);
        }
      }
    }

    walk(distDir);
    expect(offenders).toEqual([]);
  });
});
