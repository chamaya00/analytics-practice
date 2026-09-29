import { defineConfig } from 'astro/config';

// Static output, no adapter: this site has no backend (CLAUDE.md, ADR 0001).
// Vercel auto-detects this and deploys it with zero configuration.
//
// `__BUILD_SHA__` is the deploy's commit (#270 §5.3), compiled into the client
// bundle; src/lib/build-stamp.ts lowercases and validates it.
export default defineConfig({
  output: 'static',
  vite: {
    define: {
      __BUILD_SHA__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA ?? null),
    },
  },
});
