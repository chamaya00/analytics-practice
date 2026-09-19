// Pure drag-gesture resolver for the swipe-poll card. Decides whether a
// drag's horizontal displacement and velocity cross the vote-commit
// thresholds, and which direction it commits to. No DOM APIs, no
// PointerEvent — see docs/design and poll-dom.ts for the wiring that will
// consume this.

import type { Direction } from './poll';

export interface DragGestureInput {
  /** Signed horizontal displacement in px. Positive is right, negative is left. */
  horizontalDistance: number;
  /** Signed vertical displacement in px, used only to reject mostly-vertical drags. */
  verticalDistance: number;
  /** Signed horizontal velocity in px/ms. Takes precedence over `elapsedMs` when given. */
  velocity?: number;
  /** Elapsed time in ms, used to derive velocity from `horizontalDistance` when `velocity` is omitted. */
  elapsedMs?: number;
}

export const DISTANCE_THRESHOLD_PX = 80;
export const VELOCITY_THRESHOLD_PX_PER_MS = 0.5;

/** A drag whose vertical displacement exceeds its horizontal by more than this ratio is treated as vertical, not a swipe. */
export const MAX_VERTICAL_TO_HORIZONTAL_RATIO = 1;

function directionOf(signed: number): Direction {
  return signed > 0 ? 'right' : 'left';
}

function resolveVelocity(input: DragGestureInput): number {
  if (input.velocity !== undefined) return input.velocity;
  if (input.elapsedMs) return input.horizontalDistance / input.elapsedMs;
  return 0;
}

/**
 * Resolves a drag to the direction it commits a vote to, or `null` if it
 * crosses neither the distance nor the velocity threshold, or if it is
 * mostly vertical.
 */
export function resolveDragDirection(input: DragGestureInput): Direction | null {
  const horizontalMagnitude = Math.abs(input.horizontalDistance);
  const verticalMagnitude = Math.abs(input.verticalDistance);

  if (verticalMagnitude > horizontalMagnitude * MAX_VERTICAL_TO_HORIZONTAL_RATIO) {
    return null;
  }

  if (horizontalMagnitude >= DISTANCE_THRESHOLD_PX) {
    return directionOf(input.horizontalDistance);
  }

  const velocity = resolveVelocity(input);
  if (Math.abs(velocity) >= VELOCITY_THRESHOLD_PX_PER_MS) {
    return directionOf(velocity);
  }

  return null;
}
