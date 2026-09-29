// @vitest-environment node
//
// #273 AC1, second of three strict-superset proofs (contract §14 S1): every
// fixture #224's tests accept is still stored. Re-runs
// analytics-readiness-event-contract.migration.test.ts, unmodified, against
// a database with every migration through 20261003000000. See
// second-pass-superset.migration.test.ts for the technique.
//
// The one test #225 already reversed (session_started "not yet in the
// store") is run with Vitest's `fails` flag, exactly as
// session-started-superset-224.migration.test.ts does. This migration
// reverses nothing further.
import { afterAll, beforeEach, expect, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const readFileSync = ((file: unknown, ...rest: unknown[]) => {
    const original = (actual.readFileSync as (...a: unknown[]) => unknown)(file, ...rest);
    if (String(file).endsWith('20261001000000_analytics_readiness_event_contract.sql')) {
      const later = [
        '20261002000000_session_started_and_is_internal.sql',
        '20261003000000_second_pass_readiness.sql',
      ].map((name) =>
        actual.readFileSync(
          String(file).replace('20261001000000_analytics_readiness_event_contract.sql', name),
          'utf-8',
        ),
      );
      return [String(original), ...later].join('\n');
    }
    return original;
  }) as typeof actual.readFileSync;
  return { ...actual, default: { ...actual, readFileSync }, readFileSync };
});

const REVERSED_BY_225 = 'a city outside sf/hcmc/la, and session_started (not yet in the store)';
let reversedSeen = 0;

beforeEach((context) => {
  if (context.task.name === REVERSED_BY_225) {
    reversedSeen += 1;
    (context.task as { fails?: boolean }).fails = true;
  }
});

afterAll(() => {
  expect(reversedSeen).toBe(1);
});

await import('./analytics-readiness-event-contract.migration.test');
