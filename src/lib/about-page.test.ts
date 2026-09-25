// AC5: the disclosure text docs/measurement/66-parody-event-contract.md §8
// drafted appears at /about, built at the location #65's flow spec fixes.
// Reads the built output the same way nav.test.ts does, so this proves what
// a visitor actually gets, not an isolated component render.
//
// Lives in src/lib, not src/pages: any file under src/pages is a route to
// Astro's file-based router, and a .test.ts there breaks the build trying
// to render it as one.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readAbout() {
  const window = new Window();
  window.document.write(readFileSync(path.join(root, 'dist/about/index.html'), 'utf-8'));
  return window.document;
}

describe('"What we log, and why" disclosure at /about (AC5)', () => {
  it('names the random per-browser ID, what it is not, and its purpose', () => {
    const text = readAbout().body.textContent ?? '';
    expect(text).toContain('A random ID for this browser');
    expect(text).toContain("It isn't your name, email, or anything that identifies you");
  });

  it('names every screen visited, including repeat tracker views', () => {
    const text = readAbout().body.textContent ?? '';
    expect(text).toContain('Which screens you visit and when');
    expect(text).toContain(
      "landing, restaurants, a restaurant's menu, your cart, checkout, and the tracker",
    );
  });

  it('names the checkout choices logged, using the handling-instructions label and the promo code (contract §8, amended)', () => {
    const text = readAbout().body.textContent ?? '';
    expect(text).toContain('The choices you make at checkout');
    expect(text).toContain('your joke drop-off spot');
    expect(text).toContain('your handling instructions (mostly about the promo)');
    expect(text).toContain('whether you want utensils');
    expect(text).toContain('your tip percentage');
    expect(text).toContain('the promo code you pick');
    expect(text).not.toContain('ghost rider');
  });

  it('states no card, email, phone, or address field exists to log', () => {
    const text = readAbout().body.textContent ?? '';
    expect(text).toContain(
      'There is no name, address, phone number, email, or payment field anywhere in this app for us to log',
    );
  });

  it('states what is not logged', () => {
    const text = readAbout().body.textContent ?? '';
    expect(text).toContain('anything that identifies you as a real person');
    expect(text).toContain('No account, no card, no email, no address, no cross-site tracking cookie');
  });

  it('discloses the IP-hash rate limit, its one-hour retention, and that it never joins the events table', () => {
    const text = readAbout().body.textContent ?? '';
    expect(text).toContain('scrambled (one-way hashed) version of your IP address');
    expect(text).toContain('up to one hour');
    expect(text).toContain("it isn't stored in the same place as the events above and can't be joined back to them");
  });
});
