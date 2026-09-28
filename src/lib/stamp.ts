// #162's shared rubber-stamp seal (docs/design/162-rating-win-tips-rewards-vip.md,
// "The deliberate oddity: the stamp") — the one mark for Delivered (a check) and
// the rating win (a star): a 28-point serrated edge, a dashed inner ring, and a
// white glyph. Built once here so tracker-dom.ts's Delivered hero and
// rating-sheet-dom.ts's win draw the identical SVG rather than two hand-drawn
// copies that drift apart. The VIP badge shares the same motif in the spec but
// is out of scope for #206 (`.vip-stamp` stays the plain filled circle it is
// today) and does not use this module.

export type StampGlyph = 'check' | 'star';

export const STAMP_SEAL_POINT_COUNT = 28;

// Traced from the mocks' own stamp (docs/design/162-delivered-live-sf-light.html,
// docs/design/162-win-sf-light.html — both draw this exact path): 56 vertices
// around a 100x100 viewBox, alternating outer/inner radius, tracing 28 points.
const SEAL_OUTLINE_PATH =
  'M50.00 1.00 L54.98 5.78 L60.90 2.23 L64.70 8.00 L71.26 5.85 L73.68 12.32 L80.55 11.69 L81.47 18.53 L88.31 19.45 L87.68 26.32 L94.15 28.74 L92.00 35.30 L97.77 39.10 L94.22 45.02 L99.00 50.00 L94.22 54.98 L97.77 60.90 L92.00 64.70 L94.15 71.26 L87.68 73.68 L88.31 80.55 L81.47 81.47 L80.55 88.31 L73.68 87.68 L71.26 94.15 L64.70 92.00 L60.90 97.77 L54.98 94.22 L50.00 99.00 L45.02 94.22 L39.10 97.77 L35.30 92.00 L28.74 94.15 L26.32 87.68 L19.45 88.31 L18.53 81.47 L11.69 80.55 L12.32 73.68 L5.85 71.26 L8.00 64.70 L2.23 60.90 L5.78 54.98 L1.00 50.00 L5.78 45.02 L2.23 39.10 L8.00 35.30 L5.85 28.74 L12.32 26.32 L11.69 19.45 L18.53 18.53 L19.45 11.69 L26.32 12.32 L28.74 5.85 L35.30 8.00 L39.10 2.23 L45.02 5.78Z';

// The pair used here (--color-bg on --color-accent-a) is already the one
// contrast.test.ts checks ("--color-bg text on the accent fill clears 4.5:1"),
// so the seal's glyph and dashed ring need no new contrast test of their own.
const CHECK_GLYPH =
  '<path d="M31 51l12 12 26-27" fill="none" stroke="var(--color-bg)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>';

const STAR_GLYPH =
  '<g transform="translate(26 25) scale(2)" fill="var(--color-bg)"><path d="M12 3.5 14.4 9.6 21 10.2 16 14.4 17.6 21 12 17.3 6.4 21 8 14.4 3 10.2 9.6 9.6Z"/></g>';

/** The seal's own SVG markup, ready for `el.innerHTML =`. The caller sizes and
 * rotates it via CSS on its own wrapper element — this draws only the fixed
 * 100x100 mark (the filled seal, the dashed inner ring, and the glyph). The
 * wrapper's own `svg { width: 100%; height: 100% }` rule is load-bearing
 * (docs/memory/engineer.md's #169 lesson): this SVG carries no width/height
 * attribute of its own, so without that rule it renders at an intrinsic size
 * regardless of the wrapper's box. */
export function stampSealSvg(glyph: StampGlyph): string {
  const glyphMarkup = glyph === 'check' ? CHECK_GLYPH : STAR_GLYPH;
  return (
    '<svg class="stamp-seal" viewBox="0 0 100 100" aria-hidden="true">' +
    `<path d="${SEAL_OUTLINE_PATH}" fill="var(--color-accent-a)"/>` +
    '<circle cx="50" cy="50" r="36" fill="none" stroke="var(--color-bg)" stroke-width="1.6" stroke-dasharray="3 3" opacity="0.7"/>' +
    glyphMarkup +
    '</svg>'
  );
}

/** Test-only: the outline's own vertex count, halved. A vertex alternates
 * between the outer and the inner radius, so every two vertices trace one
 * visible point around the serrated edge. */
export function countSealOutlinePoints(): number {
  const vertices = SEAL_OUTLINE_PATH.match(/\d+\.\d+ \d+\.\d+/g) ?? [];
  return vertices.length / 2;
}
