// #77 AC1: the hero wordmark (src/pages/index.astro) is one run-together word
// on purpose (docs/design/72-dontdropthatpromo-identity.md), but overflow-wrap:
// anywhere on h1 (added in #75 to stop the page scrolling sideways) let it wrap
// inside a word at 375px. Reads the built output the same way nav.test.ts does,
// so this proves what a visitor's browser actually receives.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readHero() {
  const window = new Window();
  window.document.write(readFileSync(path.join(root, 'dist/index.html'), 'utf-8'));
  return window.document.querySelector('h1');
}

describe('landing hero wordmark breaks only between its words, never inside one (#77 AC1)', () => {
  it('the text content is still exactly the run-together wordmark, with no spaces', () => {
    expect(readHero()?.textContent).toBe('Dontdropthatpromo');
  });

  it('the markup carries a break opportunity at each of the three word boundaries and nowhere else', () => {
    expect(readHero()?.innerHTML.trim()).toBe('Dont<wbr>drop<wbr>that<wbr>promo');
  });
});
