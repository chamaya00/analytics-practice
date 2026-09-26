// #82 review round 1: a raw "&" in mission-taqueria-chips-guac.svg's <text>
// content ("Chips & guacamole") is invalid XML, so the browser renders a
// broken-image icon in place of the dish photo. This walks every committed
// placeholder and parses it well-formed-XML-strict — tag tokens are stripped
// first, then any bare "<", ">" or "&" left in what should be pure text
// content is a parse failure, the same class of error a real XML parser
// raises for an unescaped entity.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const IMAGES_DIR = path.join(ROOT, 'public', 'images');

const TAG_TOKEN = /<\/?[a-zA-Z][\w:-]*(?:\s+[^<>]*?)?\/?>|<\?[^<>]*\?>|<!--[\s\S]*?-->/g;
const ENTITY_REF = /&(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);/g;

/** Returns a description of the first well-formedness problem found, or null if the document parses clean. */
function findXmlProblem(source: string): string | null {
  const withoutTags = source.replace(TAG_TOKEN, '');
  if (withoutTags.includes('<') || withoutTags.includes('>')) {
    return 'unescaped "<" or ">" outside a tag';
  }
  const withoutEntities = withoutTags.replace(ENTITY_REF, '');
  if (withoutEntities.includes('&')) {
    return 'unescaped "&" (not part of a recognised entity reference)';
  }
  return null;
}

function listSvgFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSvgFiles(full));
    } else if (entry.name.endsWith('.svg')) {
      out.push(full);
    }
  }
  return out;
}

describe('committed placeholder SVGs parse as well-formed XML (AC3, #82 review round 1)', () => {
  const files = listSvgFiles(IMAGES_DIR);

  it('finds at least one committed SVG to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [path.relative(ROOT, file), file] as const))('%s has no unescaped &, < or >', (_label, file) => {
    const problem = findXmlProblem(readFileSync(file, 'utf-8'));
    expect(problem, `${file}: ${problem}`).toBeNull();
  });
});
