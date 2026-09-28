// Generates one illustrated headshot per driver in drivers.ts, at build time,
// into public/avatars/drivers/ — #148, design doc
// docs/design/147-tracker-multi-order-driver-history.md, "Avatar style".
//
// Run after drivers.ts changes:
//
//   npm run generate-driver-avatars
//
// DiceBear (@dicebear/core, @dicebear/avataaars — MIT code; the Avataaars
// artwork is Pablo Stanley's "free for personal and commercial use", see
// docs/decisions/0010-driver-avatars.md) draws each driver's SVG from their
// own stable `id` as the seed, so the same driver always gets the same face
// and nothing is generated in the browser. The option set below is the
// design doc's own — a constrained pool per city so an HCMC driver never
// draws blonde or pink hair, and excluding the defaults' crying/vomiting/
// heart-eyes expressions and yellow/orange skin.

/* global process, console -- a Node script; the repo's lint config declares no Node globals. */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createAvatar } from '@dicebear/core';
import * as avataaars from '@dicebear/avataaars';
import { DRIVERS_BY_CITY } from '../src/lib/drivers.ts';

export const OUTPUT_DIR = 'public/avatars/drivers';

const SHARED_OPTIONS = {
  style: ['circle'],
  backgroundColor: ['d9c8ff'],
  eyes: ['default', 'happy', 'wink', 'squint'],
  eyebrows: ['default', 'defaultNatural', 'raisedExcited', 'raisedExcitedNatural', 'flatNatural'],
  mouth: ['smile', 'default', 'twinkle'],
  accessoriesProbability: 15,
  accessories: ['prescription01', 'prescription02', 'round', 'wayfarers'],
  facialHairProbability: 15,
  facialHair: ['beardLight', 'beardMedium', 'moustacheFancy'],
  clothing: ['collarAndSweater', 'hoodie', 'shirtCrewNeck', 'shirtScoopNeck', 'shirtVNeck', 'overall'],
  clothesColor: ['262e33', '5199e4', '25557c', '929598', '3c4f5c', 'ff5c5c', 'a7ffc4', 'ffffb1'],
  topProbability: 100,
  top: [
    'bigHair',
    'bob',
    'bun',
    'curly',
    'curvy',
    'dreads01',
    'frizzle',
    'fro',
    'froAndBand',
    'hijab',
    'longButNotTooLong',
    'shavedSides',
    'shortCurly',
    'shortFlat',
    'shortRound',
    'shortWaved',
    'sides',
    'straight01',
    'straight02',
    'straightAndStrand',
    'theCaesar',
    'theCaesarAndSidePart',
  ],
};

// Per-city ranges (design doc): the SF pool uses the full natural range, the
// HCMC pool a narrower one so a Vietnamese name never lands on blonde or pink
// hair.
const CITY_OPTIONS = {
  sf: {
    skinColor: ['614335', 'ae5d29', 'd08b5b', 'edb98a', 'ffdbb4'],
    hairColor: ['2c1b18', '4a312c', '724133', 'a55728', 'b58143', 'd6b370', 'e8e1e1'],
  },
  hcmc: {
    skinColor: ['d08b5b', 'edb98a', 'ffdbb4'],
    hairColor: ['2c1b18', '4a312c', '724133'],
  },
};

/** One driver's SVG markup, deterministic for their stable id (the seed). */
export function renderDriverAvatar(driverId, city) {
  const avatar = createAvatar(avataaars, {
    seed: driverId,
    ...SHARED_OPTIONS,
    ...CITY_OPTIONS[city],
  });
  return avatar.toString();
}

function main() {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  let count = 0;
  const written = new Set();
  for (const [city, drivers] of Object.entries(DRIVERS_BY_CITY)) {
    for (const driver of drivers) {
      // LA reuses SF's pool (docs/design/229-la-catalogue.md): an avatar is
      // drawn once, under the city whose pool it came from, never redrawn
      // with another city's options.
      if (written.has(driver.id)) continue;
      written.add(driver.id);
      const svg = renderDriverAvatar(driver.id, city);
      writeFileSync(`${OUTPUT_DIR}/${driver.id}.svg`, svg);
      count += 1;
    }
  }
  console.log(`generate-driver-avatars: wrote ${count} avatar(s) to ${OUTPUT_DIR}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
