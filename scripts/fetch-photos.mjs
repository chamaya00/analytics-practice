// Fetch licence-clean photos from Unsplash into public/images/, on a GitHub
// runner. Run by .github/workflows/photos.yml, never by an agent run.
//
//   node scripts/fetch-photos.mjs
//
// Why a workflow step and not a role: agent runs cannot reach Unsplash, which
// is why #82 shipped "Placeholder" SVGs, and the owner chose not to widen the
// driving session's network either. A plain workflow step on a GitHub-hosted
// runner has ordinary internet access, so this is where the download happens.
// Roles only edit the manifest; the workflow does the fetching.
//
// Input: docs/design/photos.json
//   { "photos": [ { "path": "public/images/restaurants/x.jpg",
//                   "query": "banh mi sandwich",
//                   "width": 640, "height": 480,
//                   "photo": "optional Unsplash photo id to pin" } ] }
//
// Output, per entry whose file is missing or whose pin changed:
//   - the JPEG at `path`, cropped server-side by Unsplash's image CDN to
//     width x height at 2x for phone screens, and refused above MAX_BYTES
//   - a record in docs/design/photos.lock.json: the photo id, photographer,
//     photographer profile and photo page links, and the licence, which is
//     what docs/design/80-photo-credits.md is written from
//
// Only two hosts are ever contacted: unsplash.com (search and photo lookup)
// and images.unsplash.com (the file). The site itself never hotlinks either;
// what ships is the committed file.

/* global process, console, fetch, Buffer, URL -- a Node script; the repo's lint config declares no Node globals. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const MANIFEST = 'docs/design/photos.json';
export const LOCK = 'docs/design/photos.lock.json';
export const MAX_BYTES = 180_000;
const API = 'https://unsplash.com/napi';
const LICENCE = 'Unsplash License (https://unsplash.com/license)';

/** Returns a list of problems with one manifest entry; empty means usable. */
export function validateEntry(entry) {
  const problems = [];
  if (typeof entry?.path !== 'string' || !/^public\/images\/[a-z0-9/_-]+\.jpg$/.test(entry.path)) {
    problems.push(`path must be public/images/<lowercase-kebab>.jpg, got ${JSON.stringify(entry?.path)}`);
  }
  if (typeof entry?.query !== 'string' || entry.query.trim() === '') {
    problems.push('query must be a non-empty string');
  }
  for (const key of ['width', 'height']) {
    const value = entry?.[key];
    if (!Number.isInteger(value) || value < 64 || value > 1600) {
      problems.push(`${key} must be an integer between 64 and 1600`);
    }
  }
  if (entry?.photo !== undefined && (typeof entry.photo !== 'string' || !/^[A-Za-z0-9_-]{6,20}$/.test(entry.photo))) {
    problems.push('photo, when set, must be an Unsplash photo id');
  }
  return problems;
}

/** The CDN URL for one photo, cropped to the slot at 2x density. */
export function downloadUrl(rawUrl, width, height) {
  const url = new URL(rawUrl);
  if (url.hostname !== 'images.unsplash.com') throw new Error(`refusing non-Unsplash image host ${url.hostname}`);
  url.searchParams.set('w', String(width * 2));
  url.searchParams.set('h', String(height * 2));
  url.searchParams.set('fit', 'crop');
  url.searchParams.set('crop', 'entropy');
  url.searchParams.set('fm', 'jpg');
  url.searchParams.set('q', '60');
  return url.toString();
}

/** First search result not already used by another slot, so two cards never share a photo. */
export function pickResult(results, usedIds) {
  return results.find((result) => result?.id && result?.urls?.raw && !usedIds.has(result.id)) ?? null;
}

/** Entries that need fetching: the file is missing, or the lock records a different pin. */
export function entriesToFetch(entries, lock, fileExists) {
  return entries.filter((entry) => {
    const locked = lock[entry.path];
    if (!locked || !fileExists(entry.path)) return true;
    return entry.photo !== undefined && entry.photo !== locked.id;
  });
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

async function resolvePhoto(entry, usedIds) {
  if (entry.photo) return getJson(`${API}/photos/${entry.photo}`);
  const orientation = entry.width >= entry.height * 1.2 ? 'landscape' : 'squarish';
  const search = await getJson(
    `${API}/search/photos?query=${encodeURIComponent(entry.query)}&per_page=20&orientation=${orientation}`,
  );
  const picked = pickResult(search.results ?? [], usedIds);
  if (!picked) throw new Error(`no unused result for "${entry.query}"`);
  return picked;
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const entries = manifest.photos ?? [];
  const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : {};

  const invalid = entries.flatMap((entry, i) => validateEntry(entry).map((p) => `photos[${i}]: ${p}`));
  const paths = entries.map((entry) => entry.path);
  const duplicates = paths.filter((path, i) => paths.indexOf(path) !== i);
  if (duplicates.length) invalid.push(`duplicate paths: ${[...new Set(duplicates)].join(', ')}`);
  if (invalid.length) {
    console.error(`fetch-photos: ${MANIFEST} is invalid:\n  ${invalid.join('\n  ')}`);
    process.exit(1);
  }

  const usedIds = new Set(Object.values(lock).map((record) => record.id));
  const todo = entriesToFetch(entries, lock, existsSync);
  console.log(`fetch-photos: ${todo.length} of ${entries.length} slot(s) to fetch`);

  const failures = [];
  for (const entry of todo) {
    try {
      if (lock[entry.path]) usedIds.delete(lock[entry.path].id);
      const photo = await resolvePhoto(entry, usedIds);
      const response = await fetch(downloadUrl(photo.urls.raw, entry.width, entry.height));
      if (!response.ok) throw new Error(`image download answered ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_BYTES) throw new Error(`${bytes.length} bytes is over the ${MAX_BYTES}-byte budget`);
      mkdirSync(dirname(entry.path), { recursive: true });
      writeFileSync(entry.path, bytes);
      usedIds.add(photo.id);
      lock[entry.path] = {
        id: photo.id,
        query: entry.query,
        photographer: photo.user?.name ?? 'Unknown',
        photographerUrl: photo.user?.links?.html ?? null,
        photoUrl: photo.links?.html ?? `https://unsplash.com/photos/${photo.id}`,
        licence: LICENCE,
        bytes: bytes.length,
      };
      console.log(`  ${entry.path} <- ${photo.id} by ${lock[entry.path].photographer} (${bytes.length} bytes)`);
    } catch (error) {
      failures.push(`${entry.path}: ${error.message}`);
    }
  }

  const sorted = Object.fromEntries(Object.entries(lock).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(LOCK, `${JSON.stringify(sorted, null, 2)}\n`);
  if (failures.length) {
    console.error(`fetch-photos: ${failures.length} slot(s) failed:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
