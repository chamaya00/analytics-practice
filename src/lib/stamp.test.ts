// #206's acceptance criteria: the shared seal function itself — the point
// count and the dashed ring (AC1). The glyph/fill contrast pair is checked by
// contrast.test.ts's existing "--color-bg text on the accent fill" case (AC3),
// since stamp.ts reuses that exact pair rather than a new one.

import { describe, expect, it } from 'vitest';
import { countSealOutlinePoints, stampSealSvg } from './stamp';

describe('stampSealSvg', () => {
  it('draws an outline with exactly 28 points', () => {
    expect(countSealOutlinePoints()).toBe(28);
  });

  it('draws a dashed inner ring', () => {
    const markup = stampSealSvg('check');
    expect(markup).toContain('stroke-dasharray="3 3"');
  });

  it('draws a check glyph for Delivered', () => {
    const markup = stampSealSvg('check');
    expect(markup).toContain('M31 51l12 12 26-27');
  });

  it('draws a star glyph for the win', () => {
    const markup = stampSealSvg('star');
    expect(markup).toContain('M12 3.5 14.4 9.6');
  });

  it('fills the seal with --color-accent-a and the glyph/ring with --color-bg', () => {
    const markup = stampSealSvg('star');
    expect(markup).toContain('fill="var(--color-accent-a)"');
    expect(markup).toContain('fill="var(--color-bg)"');
    expect(markup).toContain('stroke="var(--color-bg)"');
  });
});
