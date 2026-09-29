// @vitest-environment node
//
// #273 AC1, the strict-superset proof (contract §14 S1) for #225's suite:
// re-run session-started-internal.migration.test.ts, unmodified, against a
// database that has every earlier migration plus 20261003000000. Its
// `beforeAll` reads the migration files one by one, so the only change is
// that its read of 20261002000000_session_started_and_is_internal.sql
// returns that file followed by the new one. Siblings do the same for the
// other two suites: second-pass-superset-224 (#224's) and
// second-pass-superset-two-city (#81's). Nothing this migration does
// reverses an assertion in any of them, so none is marked `fails`.
import { vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const readFileSync = ((file: unknown, ...rest: unknown[]) => {
    const original = (actual.readFileSync as (...a: unknown[]) => unknown)(file, ...rest);
    if (String(file).endsWith('20261002000000_session_started_and_is_internal.sql')) {
      const added = actual.readFileSync(
        String(file).replace(
          '20261002000000_session_started_and_is_internal.sql',
          '20261003000000_second_pass_readiness.sql',
        ),
        'utf-8',
      );
      return `${String(original)}\n${added}`;
    }
    return original;
  }) as typeof actual.readFileSync;
  return { ...actual, default: { ...actual, readFileSync }, readFileSync };
});

await import('./session-started-internal.migration.test');
