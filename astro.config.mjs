import { defineConfig } from 'astro/config';

// Static output, no adapter: this site has no backend (CLAUDE.md, ADR 0001).
// Vercel auto-detects this and deploys it with zero configuration.
export default defineConfig({
  output: 'static',
});
