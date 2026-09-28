// The LinkedIn preview image that og:image points at (BaseLayout.astro,
// docs/design/235-first-screen-intro.md): it must exist in public/ - or every
// preview shows a broken image - and be 1200x630, LinkedIn's 1.91:1 size.
// Reads the PNG's own IHDR header rather than trusting the file name.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const file = path.join(process.cwd(), 'public/og-image.png');

describe('LinkedIn preview image (#236)', () => {
  it('exists as public/og-image.png', () => {
    expect(existsSync(file)).toBe(true);
  });

  it('is a 1200x630 PNG', () => {
    const bytes = readFileSync(file);
    expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
  });
});
