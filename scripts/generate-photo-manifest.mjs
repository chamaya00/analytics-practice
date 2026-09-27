// Generates docs/design/photos.json mechanically from the placeholder rows
// in docs/design/80-photo-credits.md, so a 155-slot manifest is never
// hand-typed (#106). Run after the credits table changes:
//
//   node scripts/generate-photo-manifest.mjs
//
// Each credits row already names the file and the intended Unsplash search;
// this only swaps the placeholder's `.svg` for the real download's `.jpg`
// and attaches the slot's rendered width/height so scripts/fetch-photos.mjs
// (never edited here — house rules) can crop the right size.

/* global process, console -- a Node script; the repo's lint config declares no Node globals. */

import { readFileSync, writeFileSync } from 'node:fs';

export const CREDITS = 'docs/design/80-photo-credits.md';
export const MANIFEST = 'docs/design/photos.json';

// One size per slot kind, matching the only place each image renders:
// city card — src/lib/home-dom.ts's `location-card` <img>; restaurant hero —
// both src/lib/home-dom.ts's 72x72 `restaurant-card-photo` and the detail
// page's 343x180 `restaurant-hero` (src/pages/restaurants/[slug]/index.astro)
// share one file, so the larger of the two is what gets fetched; dish photo —
// src/lib/menu-dom.ts's 64x64 `menu-item-photo`.
export const SLOT_SIZE = {
  cities: { width: 96, height: 64 },
  restaurants: { width: 343, height: 180 },
  dishes: { width: 64, height: 64 },
};

const ROW = /\|\s*`(public\/images\/([a-z0-9-]+)\/[a-z0-9-]+\.svg)`\s*\|(?:[^|]*\|)*?\s*"([^"]+)"\s*\|/;

/** Parses every placeholder-image row out of the credits markdown, in file order. */
export function parseCreditsRows(markdown) {
  const photos = [];
  for (const line of markdown.split('\n')) {
    const match = ROW.exec(line);
    if (!match) continue;
    const [, svgPath, slot, query] = match;
    const size = SLOT_SIZE[slot];
    if (!size) throw new Error(`${CREDITS}: unrecognised slot "${slot}" in row: ${line}`);
    photos.push({ path: svgPath.replace(/\.svg$/, '.jpg'), query, width: size.width, height: size.height });
  }
  return photos;
}

function main() {
  const markdown = readFileSync(CREDITS, 'utf8');
  const photos = parseCreditsRows(markdown);
  if (photos.length === 0) throw new Error(`${CREDITS}: found no placeholder rows to generate a manifest from`);
  writeFileSync(MANIFEST, `${JSON.stringify({ photos }, null, 2)}\n`);
  console.log(`generate-photo-manifest: wrote ${photos.length} slot(s) to ${MANIFEST}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
