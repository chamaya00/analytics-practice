// @vitest-environment node
//
// #224 AC1: the strict-superset proof. Rather than copy
// two-city-event-contract.migration.test.ts's fixtures (which would drift),
// this file re-runs that whole file, unmodified, against a database that has
// the new migration applied on top of #85's. The only change is that its read
// of 20260926000000_two_city_event_contract.sql returns that file followed by
// 20261001000000_analytics_readiness_event_contract.sql, so every `beforeAll`
// there builds main's migrations plus the new file. Each accepting fixture in
// it must therefore still be stored; its refusing cases (retired names, old
// parody shapes, bounds) must still hold too.
import { vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const readFileSync = ((file: unknown, ...rest: unknown[]) => {
    const original = (actual.readFileSync as (...a: unknown[]) => unknown)(file, ...rest);
    if (String(file).endsWith('20260926000000_two_city_event_contract.sql')) {
      const added = actual.readFileSync(
        String(file).replace(
          '20260926000000_two_city_event_contract.sql',
          '20261001000000_analytics_readiness_event_contract.sql',
        ),
        'utf-8',
      );
      return `${String(original)}\n${added}`;
    }
    return original;
  }) as typeof actual.readFileSync;
  return { ...actual, default: { ...actual, readFileSync }, readFileSync };
});

await import('./two-city-event-contract.migration.test');
