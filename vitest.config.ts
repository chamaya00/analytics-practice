import { defineConfig } from 'vitest/config';

// happy-dom gives component tests a document/window to render into and
// dispatch events against — see docs/decisions/0003-happy-dom-for-component-tests.md.
export default defineConfig({
  test: {
    environment: 'happy-dom',
  },
});
