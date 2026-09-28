// @vitest-environment node
//
// #225 AC1, second half of the strict-superset proof: every fixture #224's
// tests accept is still stored. The same technique as
// analytics-readiness-superset.migration.test.ts: re-run
// analytics-readiness-event-contract.migration.test.ts, unmodified, against
// a database that has main's migrations plus the new one. The only change
// is that its read of 20261001000000_analytics_readiness_event_contract.sql
// returns that file followed by
// 20261002000000_session_started_and_is_internal.sql.
//
// One test in that file cannot keep passing, by design: it asserts that
// `session_started` is refused because it was "not yet in the store", and
// storing it is what this issue is for. That one test, matched by its exact
// title, is run with Vitest's own `fails` flag, so it must now fail - if
// `session_started` were still refused it would pass and turn this file red.
// Its other assertion (`home_viewed` with `city: 'nyc'` is refused) is
// proved again, on its own, in session-started-internal.migration.test.ts.
// Every other test in the file, accepting and refusing, runs as written.
import { afterAll, beforeEach, expect, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const readFileSync = ((file: unknown, ...rest: unknown[]) => {
    const original = (actual.readFileSync as (...a: unknown[]) => unknown)(file, ...rest);
    if (String(file).endsWith('20261001000000_analytics_readiness_event_contract.sql')) {
      const added = actual.readFileSync(
        String(file).replace(
          '20261001000000_analytics_readiness_event_contract.sql',
          '20261002000000_session_started_and_is_internal.sql',
        ),
        'utf-8',
      );
      return `${String(original)}\n${added}`;
    }
    return original;
  }) as typeof actual.readFileSync;
  return { ...actual, default: { ...actual, readFileSync }, readFileSync };
});

const REVERSED_BY_THIS_ISSUE = 'a city outside sf/hcmc/la, and session_started (not yet in the store)';
let reversedSeen = 0;

beforeEach((context) => {
  if (context.task.name === REVERSED_BY_THIS_ISSUE) {
    reversedSeen += 1;
    // Typed read-only, but the runner reads `fails` only after the test body
    // has run, so setting it here is what `it.fails` itself sets.
    (context.task as { fails?: boolean }).fails = true;
  }
});

afterAll(() => {
  // A renamed or deleted test would otherwise leave this wrapper silently
  // inverting nothing.
  expect(reversedSeen).toBe(1);
});

await import('./analytics-readiness-event-contract.migration.test');
