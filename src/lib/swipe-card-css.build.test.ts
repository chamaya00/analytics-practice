import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// Reads the output of `astro build`, the same command Vercel runs for this
// static site (ADR 0001) - so these assertions prove what a visitor's
// browser actually receives, not just what the source stylesheet says.
// happy-dom does no layout, so a real vertical-scroll or a real absence of
// motion can't be exercised here (see the pull request for the by-hand
// checks that cover the rest of AC3/AC4); these tests are the checkable
// half - the emitted CSS values a build-output assertion can prove false.
const root = process.cwd();

let css: string;

beforeAll(() => {
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  const html = readFileSync(path.join(root, 'dist/index.html'), 'utf-8');
  const match = html.match(/<style>(.*?)<\/style>/s);
  if (!match) throw new Error('expected an inline <style> block in dist/index.html');
  css = match[1];
}, 30_000);

describe('swipe-card emitted CSS (AC3, AC4)', () => {
  it('sets touch-action to pan-y on the card, never a blanket none (AC3)', () => {
    const match = css.match(/\.swipe-card\{[^}]*\}/);
    expect(match).not.toBeNull();
    const rule = match?.[0] ?? '';
    expect(rule).toContain('touch-action:pan-y');
    expect(rule).not.toContain('touch-action:none');
  });

  it('never sets touch-action: none anywhere in the swipe-card stylesheet (AC3)', () => {
    expect(css).not.toContain('touch-action:none');
  });

  it('a prefers-reduced-motion block overrides the card transition and swipe-out transform/opacity (AC4)', () => {
    const start = css.indexOf('prefers-reduced-motion:reduce');
    expect(start).toBeGreaterThan(-1);
    const reducedBlock = css.slice(start);
    expect(reducedBlock).toContain('.swipe-card{transition:none}');
    expect(reducedBlock).toMatch(/\.swipe-out-left,\.swipe-out-right\{[^}]*transform:none[^}]*\}/);
  });

  it('the swipe-card transition outside reduced motion still animates transform (sanity check for the override above)', () => {
    const match = css.match(/\.swipe-card\{[^}]*\}/);
    const rule = match?.[0] ?? '';
    expect(rule).toContain('transition:transform');
  });
});
