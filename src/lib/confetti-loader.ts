// The single dynamic import() of canvas-confetti (ADR 0011) — shared by
// rating-sheet-dom.ts's win burst and tracker-dom.ts's Delivered landing
// burst (#189), so the module is fetched at most once per page load however
// many bursts actually play, and both draw from the one loaded cannon.
import type { ConfettiCannon } from 'canvas-confetti';

let cannonPromise: Promise<ConfettiCannon> | null = null;

export function loadConfettiCannon(): Promise<ConfettiCannon> {
  if (!cannonPromise) {
    cannonPromise = import('canvas-confetti').then((mod) => mod.default);
  }
  return cannonPromise;
}

/** Test-only, the same shape as tracking.ts's `resetTrack` — clears the
 * cached promise so a test can assert "imported exactly once" from a known
 * starting state rather than whatever an earlier test in the same file left
 * behind. */
export function resetConfettiCannon(): void {
  cannonPromise = null;
}
