import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

// Reads the output of `astro build`, the same command Vercel runs for this
// static site (ADR 0001) — so this test proves the nav ships in what a
// visitor actually gets, not just in an isolated component render. The
// build itself runs once for the whole test run in vitest.global-setup.ts,
// not here — see that file for why.
const root = process.cwd();

function readNav(distPath: string) {
  const html = readFileSync(path.join(root, distPath), 'utf-8');
  const window = new Window();
  window.document.write(html);
  return window.document.querySelector('nav');
}

describe('shared header/nav (AC2)', () => {
  it('the swipe-poll page links to /results/', () => {
    const nav = readNav('dist/index.html');
    expect(nav).not.toBeNull();
    const link = nav?.querySelector('a[href="/results/"]');
    expect(link?.textContent).toContain('Results');
  });

  it('the results page links to /', () => {
    const nav = readNav('dist/results/index.html');
    expect(nav).not.toBeNull();
    const link = nav?.querySelector('a[href="/"]');
    expect(link?.textContent).toContain('Swipe poll');
  });
});
