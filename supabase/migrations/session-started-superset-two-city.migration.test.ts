// @vitest-environment node
//
// #225 AC1, first half of the strict-superset proof: every fixture #81
// accepted is still stored. The same technique as
// analytics-readiness-superset.migration.test.ts: re-run
// two-city-event-contract.migration.test.ts, unmodified, against a database
// that has main's migrations plus the new one. The only change is that its
// read of 20260926000000_two_city_event_contract.sql returns that file
// followed by #224's 20261001000000_analytics_readiness_event_contract.sql
// and this issue's 20261002000000_session_started_and_is_internal.sql.
import { vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const readFileSync = ((file: unknown, ...rest: unknown[]) => {
    const original = (actual.readFileSync as (...a: unknown[]) => unknown)(file, ...rest);
    if (String(file).endsWith('20260926000000_two_city_event_contract.sql')) {
      const later = [
        '20261001000000_analytics_readiness_event_contract.sql',
        '20261002000000_session_started_and_is_internal.sql',
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
