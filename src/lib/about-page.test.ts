// AC5: /about states in plain language, with no parody copy, what the site
// logs (naming every event family docs/measurement/81-two-city-event-
// contract.md §7 defines, including the flash sheet's per-session random
// draw) and what it does not log. Reads the built output the same way
// nav.test.ts does, so this proves what a visitor actually gets, not an
// isolated component render.
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

const CONTRACT_EVENT_FAMILIES = [
  'location_selected',
  'home_viewed',
  'restaurant_opened',
  'cart_viewed',
  'checkout_viewed',
  'flash_sheet_shown',
  'flash_sheet_closed',
  'order_placed',
  'tracker_viewed',
  'order_delivered',
  'rating_submitted',
];

const RETIRED_PARODY_STRINGS = [
  'This site is a parody, but the analytics are real',
  'ghost rider',
  'joke drop-off spot',
  'handling instructions (mostly about the promo)',
  'your tip percentage',
  'the promo code you pick',
];

describe('"What we log, and why" disclosure at /about (AC5)', () => {
  it('names the random per-browser ID, what it is not, and its purpose', () => {
    const text = readAbout().body.textContent ?? '';
    expect(text).toContain('A random ID for this browser');
    expect(text).toContain("It isn't your name, email, or anything that identifies you");
  });

  it('names every event family docs/measurement/81-two-city-event-contract.md §7 defines', () => {
    const text = readAbout().body.textContent ?? '';
    for (const eventName of CONTRACT_EVENT_FAMILIES) {
      expect(text, `expected /about to name ${eventName}`).toContain(eventName);
    }
  });

  it("names the flash-deal sheet's per-session random draw (#87, AC5)", () => {
    const text = readAbout().body.textContent ?? '';
    expect(text).toContain('flash-deal sheet');
    expect(text).toContain('randomly drawn for you this browsing session');
  });

  it('names the real checkout choices logged — drop-off preset, delivery instructions, utensils, vouchers', () => {
    const text = readAbout().body.textContent ?? '';
    expect(text).toContain('The choices you make at checkout');
    expect(text).toContain('your drop-off preset (Home, Office, or Front desk)');
    expect(text).toContain('your delivery instructions');
    expect(text).toContain('whether you want utensils');
    expect(text).toContain('which real voucher or vouchers, if any, you applied');
  });

  it('names the delivery and rating events', () => {
    const text = readAbout().body.textContent ?? '';
    expect(text).toContain('Whether your order actually arrives, and how you rated it');
    expect(text).toContain('the star count and any preset tags (never free text)');
  });

  it('states no card, email, phone, or address field exists to log, and no free-text field, ever', () => {
    const text = readAbout().body.textContent ?? '';
    expect(text).toContain(
      'There is no name, address, phone number, email, or payment field anywhere in this app for us to log',
    );
    expect(text).toContain('no free-text field anywhere in this app, ever');
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

  it('contains none of the retired parody strings', () => {
    const text = readAbout().body.textContent ?? '';
    for (const parodyString of RETIRED_PARODY_STRINGS) {
      expect(text, `expected /about not to contain retired parody string "${parodyString}"`).not.toContain(
        parodyString,
      );
    }
  });
});
