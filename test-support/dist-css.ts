import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

/**
 * Every CSS rule the built page at `distPath` actually delivers: its inline
 * `<style>` blocks plus the contents of every stylesheet it links.
 *
 * Build-output tests used to read the inline block alone. That held only
 * while every stylesheet stayed under Astro's `inlineStylesheets: 'auto'`
 * size cut-off (~4kB); the first rule that pushed `global.css` past it moved
 * the whole file into `/_astro/*.css` and took the theme and nav assertions
 * red with it, though the browser still received every rule they were
 * asserting. Where a rule is delivered from is the bundler's decision and
 * not something these tests mean to pin, so they read both.
 */
export function deliveredCss(distPath: string): string {
  const html = readFileSync(path.join(root, distPath), 'utf-8');

  const inline = [...html.matchAll(/<style>(.*?)<\/style>/gs)].map((match) => match[1]);
  const linked = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((match) =>
    readFileSync(path.join(root, 'dist', match[1].replace(/^\//, '')), 'utf-8'),
  );

  if (inline.length === 0 && linked.length === 0) {
    throw new Error(`expected ${distPath} to deliver CSS, inline or linked, and it delivers neither`);
  }

  return [...inline, ...linked].join('\n');
}
