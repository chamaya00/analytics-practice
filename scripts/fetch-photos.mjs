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
// Only two hosts are ever contacted: api.unsplash.com (search, photo lookup
// and the download ping Unsplash's API terms require) and images.unsplash.com
// (the file). The site itself never hotlinks either; what ships is the
// committed file.
//
// It needs UNSPLASH_ACCESS_KEY, an Unsplash developer app's access key, held
// as a repository secret. The keyless unsplash.com/napi endpoint this first
// used answers 401 to GitHub's runners (#106's first run). A new app is in
// "demo" mode, capped at 50 requests an hour, so a large manifest lands over
// several runs: the script stops cleanly when the hour's budget is spent,
// commits what it got, and the next run picks up only the missing slots.

/* global process, console, fetch, Buffer, URL -- a Node script; the repo's lint config declares no Node globals. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const MANIFEST = 'docs/design/photos.json';
export const LOCK = 'docs/design/photos.lock.json';
export const MAX_BYTES = 180_000;
const API = 'https://api.unsplash.com';
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

/**
 * Entries that need fetching: the file is missing, the lock records a
 * different pin, or - for an unpinned slot - the manifest's query changed.
 * Editing a query is how a role swaps a photo that came back wrong for its
 * slot without knowing an Unsplash id.
 */
export function entriesToFetch(entries, lock, fileExists) {
  return entries.filter((entry) => {
    const locked = lock[entry.path];
    if (!locked || !fileExists(entry.path)) return true;
    if (entry.photo !== undefined) return entry.photo !== locked.id;
    return locked.query !== undefined && locked.query !== entry.query;
  });
}

/**
 * The searches to try for one slot, most specific first: the query with the
 * slot's orientation, then without it, then with its last word dropped. A
 * narrow phrase ("com tam restaurant vietnam") can find nothing in one
 * orientation and plenty without it. Three at most - each costs a request.
 */
export function searchAttempts(query, orientation) {
  const words = query.trim().split(/\s+/);
  const attempts = [
    { query: words.join(' '), orientation },
    { query: words.join(' '), orientation: null },
  ];
  if (words.length > 2) attempts.push({ query: words.slice(0, -1).join(' '), orientation: null });
  return attempts;
}

/** Thrown when the hour's request budget is spent, so the run stops rather than failing every slot left. */
export class RateLimited extends Error {}

/** True when a response's rate-limit header says no requests are left this hour. */
export function budgetSpent(headers) {
  const remaining = headers.get('x-ratelimit-remaining');
  return remaining !== null && Number(remaining) <= 0;
}

let accessKey = '';

async function getJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'Accept-Version': 'v1', Authorization: `Client-ID ${accessKey}` },
  });
  if (response.status === 403 && budgetSpent(response.headers)) throw new RateLimited('hourly request budget spent');
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  const body = await response.json();
  return { body, spent: budgetSpent(response.headers) };
}

async function resolvePhoto(entry, usedIds) {
  if (entry.photo) return getJson(`${API}/photos/${entry.photo}`);
  const orientation = entry.width >= entry.height * 1.2 ? 'landscape' : 'squarish';
  const tried = [];
  for (const attempt of searchAttempts(entry.query, orientation)) {
    const filter = attempt.orientation ? `&orientation=${attempt.orientation}` : '';
    const { body, spent } = await getJson(
      `${API}/search/photos?query=${encodeURIComponent(attempt.query)}&per_page=20${filter}`,
    );
    const picked = pickResult(body.results ?? [], usedIds);
    if (picked) return { body: picked, spent };
    if (spent) throw new RateLimited('hourly request budget spent');
    tried.push(`"${attempt.query}"${attempt.orientation ? ` (${attempt.orientation})` : ''}: ${body.total ?? 0} results`);
  }
  throw new Error(`no unused result - ${tried.join('; ')}`);
}

/** Unsplash's API terms ask for a ping to the photo's download_location on every download. */
async function pingDownload(photo) {
  const location = photo.links?.download_location;
  if (!location || new URL(location).hostname !== 'api.unsplash.com') return false;
  const { spent } = await getJson(location);
  return spent;
}

async function main() {
  accessKey = process.env.UNSPLASH_ACCESS_KEY ?? '';
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
  if (todo.length && !accessKey) {
    console.error('fetch-photos: UNSPLASH_ACCESS_KEY is not set - add it as a repository secret (see the header of this file).');
    process.exit(1);
  }

  const failures = [];
  let deferred = 0;
  for (const [i, entry] of todo.entries()) {
    let fetched = false;
    try {
      // A missing file may come back as the same photo; a swap (the query or
      // pin changed while the file is still here) must not.
      if (lock[entry.path] && !existsSync(entry.path)) usedIds.delete(lock[entry.path].id);
      const { body: photo, spent: searchSpent } = await resolvePhoto(entry, usedIds);
      const response = await fetch(downloadUrl(photo.urls.raw, entry.width, entry.height));
      if (!response.ok) throw new Error(`image download answered ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_BYTES) throw new Error(`${bytes.length} bytes is over the ${MAX_BYTES}-byte budget`);
      mkdirSync(dirname(entry.path), { recursive: true });
      writeFileSync(entry.path, bytes);
      usedIds.add(photo.id);
      fetched = true;
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
      const pingSpent = await pingDownload(photo).catch((error) => {
        if (error instanceof RateLimited) return true;
        console.warn(`  (download ping for ${photo.id} failed: ${error.message})`);
        return false;
      });
      if (searchSpent || pingSpent) throw new RateLimited('hourly request budget spent');
    } catch (error) {
      if (error instanceof RateLimited) {
        deferred = todo.length - i - (fetched ? 1 : 0);
        console.warn(`fetch-photos: ${error.message}; ${deferred} slot(s) left for the next run.`);
        break;
      }
      failures.push(`${entry.path}: ${error.message}`);
    }
  }

  const sorted = Object.fromEntries(Object.entries(lock).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(LOCK, `${JSON.stringify(sorted, null, 2)}\n`);
  if (failures.length) {
    console.error(`fetch-photos: ${failures.length} slot(s) failed:\n  ${failures.join('\n  ')}`);
  }
  if (deferred) {
    console.error(`fetch-photos: ${deferred} slot(s) not fetched yet - re-run this job after the hour resets.`);
  }
  if (failures.length || deferred) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
