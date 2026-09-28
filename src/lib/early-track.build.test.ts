// #245 AC3: load-time events reach the store in the built site. Page
// scripts (`index.astro`'s) run before `BaseLayout.astro`'s initialiser —
// Astro decides that bundle order — so this runs the real built bundles, in
// the order dist/index.html lists them, against the built page's own body.
//
// happy-dom does not execute `<script type="module" src>` itself, so the test
// imports each listed bundle in document order, which is the order a browser
// runs deferred module scripts in. The driver's playwright-core check on
// #246 is the real-browser proof; this is the one CI keeps running.
//
// Builds into its own throwaway outDir with a fake store URL and key, so it
// neither depends on nor clobbers the shared dist/ (see head-tags.test.ts).
//
// Lives in src/lib, not src/pages: see about-page.test.ts.

import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

const root = process.cwd();
const FAKE_URL = 'https://fake-ref.supabase.co';

function buildWithFakeStore(): string {
  // Inside the project (gitignored) rather than the OS temp dir: Vitest's
  // module runner will not import files from outside the project root.
  const cacheDir = path.join(root, 'node_modules', '.cache');
  mkdirSync(cacheDir, { recursive: true });
  const outDir = mkdtempSync(path.join(cacheDir, 'early-track-'));
  execSync(`npx astro build --outDir ${outDir}`, {
    cwd: root,
    env: { ...process.env, PUBLIC_SUPABASE_URL: FAKE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake' },
    stdio: 'pipe',
  });
  return outDir;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('built / on a returning visit (#245 AC3)', () => {
  const outDir = buildWithFakeStore();
  const html = readFileSync(path.join(outDir, 'index.html'), 'utf-8');
  afterAll(() => rmSync(outDir, { recursive: true, force: true }));

  it('sends session_started, then home_viewed, once the page’s module scripts have run', async () => {
    const scripts = [...html.matchAll(/<script type="module" src="([^"]+)"/g)].map((m) => m[1]);
    // The bug's precondition: the page's own script is listed before the initialiser's.
    expect(scripts.findIndex((src) => src.includes('index.astro'))).toBeLessThan(
      scripts.findIndex((src) => src.includes('BaseLayout.astro')),
    );

    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('parody.city', 'sf');
    vi.stubGlobal('navigator', { webdriver: false, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchImpl);
    document.body.innerHTML = html
      .slice(html.indexOf('<body'), html.lastIndexOf('</body>') + 7)
      .replace(/<script\b[\s\S]*?<\/script>/g, '');

    for (const src of scripts) {
      await import(/* @vite-ignore */ path.join(outDir, src));
    }

    const sent = fetchImpl.mock.calls.map((call) => {
      expect(call[0]).toBe(`${FAKE_URL}/rest/v1/events`);
      return JSON.parse(call[1].body).event_name as string;
    });
    expect(sent).toEqual(['session_started', 'home_viewed']);
  });
});
