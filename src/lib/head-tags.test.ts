// #236 AC1-AC3: the LinkedIn preview reads raw HTML with no JavaScript, so
// these assert on the built files themselves (not a happy-dom render of a
// running page). The two env cases run their own `astro build` into a temp
// outDir so they neither depend on nor clobber the shared dist/.
//
// Lives in src/lib, not src/pages: see about-page.test.ts.

import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const HOST = 'example-prod.vercel.app';

function buildTo(env: Record<string, string | undefined>) {
  const outDir = mkdtempSync(path.join(tmpdir(), 'head-tags-'));
  const fullEnv = { ...process.env, ...env };
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete fullEnv[k];
  execSync(`npx astro build --outDir ${outDir}`, { cwd: root, env: fullEnv, stdio: 'pipe' });
  return outDir;
}

function head(html: string) {
  return html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
}

describe('production build with VERCEL_PROJECT_PRODUCTION_URL set', () => {
  const outDir = buildTo({ VERCEL_PROJECT_PRODUCTION_URL: HOST });
  const html = readFileSync(path.join(outDir, 'index.html'), 'utf-8');

  it('AC1: raw index.html carries og tags with absolute urls', () => {
    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain('<meta property="og:description"');
    expect(html).toContain(`<meta property="og:image" content="https://${HOST}/og-image.png"`);
    expect(html).toContain(`<meta property="og:url" content="https://${HOST}/"`);
  });

  it('AC1: raw index.html carries the intro copy without running any script', () => {
    expect(html).toContain('data-testid="home-intro"');
    expect(html).toContain('This is a demo.');
    expect(html).toContain('No payment is taken and no food is sent.');
    expect(html).toMatch(/no food is sent\. <a href="\/about\/"[^>]*>What we log, and why →<\/a>/);
  });
});

describe('build with VERCEL_PROJECT_PRODUCTION_URL unset', () => {
  const outDir = buildTo({ VERCEL_PROJECT_PRODUCTION_URL: undefined });
  const html = readFileSync(path.join(outDir, 'index.html'), 'utf-8');

  it('AC2: succeeds and the head has no literal undefined and no absolute-url tags', () => {
    expect(head(html)).not.toContain('undefined');
    expect(head(html)).not.toContain('og:image');
    expect(head(html)).not.toContain('og:url');
    expect(head(html)).toContain('og:title');
  });
});

describe('every built page', () => {
  const dist = path.join(root, 'dist');
  const pages = (function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (e.name === '_astro' ? [] : walk(path.join(dir, e.name))) : e.name.endsWith('.html') ? [path.join(dir, e.name)] : [],
    );
  })(dist);

  it('AC3: has a favicon link whose file exists, and a consistent title', () => {
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      const h = head(readFileSync(page, 'utf-8'));
      const icon = /<link rel="icon"[^>]*href="([^"]+)"/.exec(h);
      expect(icon, page).not.toBeNull();
      expect(existsSync(path.join(root, 'public', icon![1])), page).toBe(true);
      const title = /<title>([^<]*)<\/title>/.exec(h)![1];
      expect(title, page).toMatch(/^(Dontdropthatpromo|.+ — Dontdropthatpromo)$/);
    }
  });
});
