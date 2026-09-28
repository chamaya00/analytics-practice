// Reads the built dist/404.html - the file Vercel serves for any path this
// static site has no page for - so this proves what a visitor who follows a
// bad link actually gets. Lives in src/lib for the same reason
// about-page.test.ts does: a .test.ts under src/pages is a route to Astro.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

const file = path.join(process.cwd(), 'dist/404.html');

describe('custom 404 page (soft-launch readiness QA)', () => {
  it('is built as dist/404.html', () => {
    expect(existsSync(file)).toBe(true);
  });

  it('says the page was not found and links back home, inside the site header', () => {
    const window = new Window();
    window.document.write(readFileSync(file, 'utf-8'));
    const doc = window.document;
    expect(doc.querySelector('h1')?.textContent).toBe('Page not found');
    expect(doc.querySelector('[data-testid="not-found-home"]')?.getAttribute('href')).toBe('/');
    expect(doc.querySelector('nav.site-nav')).not.toBeNull();
  });
});
