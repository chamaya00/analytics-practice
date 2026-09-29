// @vitest-environment node
//
// #273 AC1, first of three strict-superset proofs (contract §14 S1): every
// fixture #81 accepted is still stored. Re-runs
// two-city-event-contract.migration.test.ts, unmodified, against a database
// with every migration through 20261003000000. See
// second-pass-superset.migration.test.ts for the technique.
import { vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const readFileSync = ((file: unknown, ...rest: unknown[]) => {
    const original = (actual.readFileSync as (...a: unknown[]) => unknown)(file, ...rest);
    if (String(file).endsWith('20260926000000_two_city_event_contract.sql')) {
      const later = [
        '20261001000000_analytics_readiness_event_contract.sql',
        '20261002000000_session_started_and_is_internal.sql',
        '20261003000000_second_pass_readiness.sql',
      ].map((name) =>
        actual.readFileSync(String(file).replace('20260926000000_two_city_event_contract.sql', name), 'utf-8'),
      );
      return [String(original), ...later].join('\n');
    }
    return original;
  }) as typeof actual.readFileSync;
  return { ...actual, default: { ...actual, readFileSync }, readFileSync };
});

await import('./two-city-event-contract.migration.test');
