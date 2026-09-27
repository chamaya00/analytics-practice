// Rewrites docs/design/80-photo-credits.md's per-row Status cell from
// docs/design/photos.lock.json once the `photos` workflow has fetched real
// files (#106, AC3). Mechanical: swaps each row's `.svg` path for the
// fetched `.jpg` and its "Placeholder — not yet downloaded" status for the
// photographer, photo link and licence the lock file recorded. A row with
// no lock entry yet (a slot that hasn't been fetched, or failed) is left
// untouched, so a partial fetch is safe to run this against.
//
//   node scripts/rewrite-photo-credits.mjs

/* global process, console -- a Node script; the repo's lint config declares no Node globals. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const CREDITS = 'docs/design/80-photo-credits.md';
export const LOCK = 'docs/design/photos.lock.json';

const ROW = /^\|\s*`(public\/images\/[a-z0-9/_-]+)\.svg`\s*\|(.*)\|\s*$/;

/** Rewrites one credits-table line if it names a slot the lock file has fetched; otherwise returns it unchanged. */
export function rewriteRow(line, lock) {
  const match = ROW.exec(line);
  if (!match) return line;
  const [, base, middleAndStatus] = match;
  const jpgPath = `${base}.jpg`;
  const record = lock[jpgPath];
  if (!record) return line;

  const cells = middleAndStatus.split('|');
  cells[cells.length - 1] = ` [${record.photographer}](${record.photographerUrl}) — [photo ${record.id}](${record.photoUrl}) — ${record.licence} `;
  return `| \`${jpgPath}\` |${cells.join('|')}|`;
}

/** Rewrites every row of the credits markdown the lock file has an entry for. */
export function rewriteCredits(markdown, lock) {
  return markdown
    .split('\n')
    .map((line) => rewriteRow(line, lock))
    .join('\n');
}

function main() {
  if (!existsSync(LOCK)) {
    console.error(`rewrite-photo-credits: ${LOCK} does not exist yet — nothing fetched to rewrite from`);
    process.exit(1);
  }
  const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
  const before = readFileSync(CREDITS, 'utf8');
  const after = rewriteCredits(before, lock);
  writeFileSync(CREDITS, after);
  const changed = before.split('\n').filter((line, i) => line !== after.split('\n')[i]).length;
  console.log(`rewrite-photo-credits: rewrote ${changed} row(s) from ${Object.keys(lock).length} lock entries`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
