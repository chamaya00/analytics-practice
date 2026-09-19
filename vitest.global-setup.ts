import { execFileSync } from 'node:child_process';

// Build-output tests (nav.test.ts, swipe-card-css.build.test.ts) read
// dist/ rather than rendering components in isolation, so what they assert
// matches what Vercel actually ships (ADR 0001). Vitest runs test files
// concurrently, so each file invoking `npm run build` in its own
// beforeAll races every other one against the same dist/ output and the
// same Vite/Astro cache — an earlier run of this issue hit that directly:
// two concurrent builds crashed astro outright. Building once here, before
// any test file starts, is what makes a second build-output test file safe
// to add later.
export default function setup(): void {
  execFileSync('npm', ['run', 'build'], { cwd: process.cwd(), stdio: 'inherit' });
}
