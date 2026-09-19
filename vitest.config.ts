import { defineConfig } from 'vitest/config';

// happy-dom gives component tests a document/window to render into and
// dispatch events against — see docs/decisions/0003-happy-dom-for-component-tests.md.
export default defineConfig({
  test: {
    environment: 'happy-dom',
    // Builds dist/ once for every build-output test file to read, rather
    // than each one rebuilding concurrently — see vitest.global-setup.ts.
    globalSetup: ['./vitest.global-setup.ts'],
  },
});
