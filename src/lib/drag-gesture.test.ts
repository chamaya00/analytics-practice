import { describe, expect, it } from 'vitest';
import {
  DISTANCE_THRESHOLD_PX,
  VELOCITY_THRESHOLD_PX_PER_MS,
  resolveDragDirection,
} from './drag-gesture';

describe('resolveDragDirection', () => {
  it('commits right when horizontal distance is beyond the distance threshold (AC1)', () => {
    const direction = resolveDragDirection({
      horizontalDistance: DISTANCE_THRESHOLD_PX + 1,
      verticalDistance: 0,
    });
    expect(direction).toBe('right');
  });

  it('commits left when horizontal distance is beyond the distance threshold in the other direction (AC1)', () => {
    const direction = resolveDragDirection({
      horizontalDistance: -(DISTANCE_THRESHOLD_PX + 1),
      verticalDistance: 0,
    });
    expect(direction).toBe('left');
  });

  it('commits in the drag direction when distance is below threshold but velocity is beyond the velocity threshold (AC2)', () => {
    const direction = resolveDragDirection({
      horizontalDistance: DISTANCE_THRESHOLD_PX - 10,
      verticalDistance: 0,
      velocity: VELOCITY_THRESHOLD_PX_PER_MS + 0.1,
    });
    expect(direction).toBe('right');
  });

  it('derives velocity from elapsed time when velocity is not given directly (AC2)', () => {
    const horizontalDistance = -(DISTANCE_THRESHOLD_PX - 10);
    const elapsedMs = Math.abs(horizontalDistance) / (VELOCITY_THRESHOLD_PX_PER_MS + 0.1);
    const direction = resolveDragDirection({
      horizontalDistance,
      verticalDistance: 0,
      elapsedMs,
    });
    expect(direction).toBe('left');
  });

  it('returns null when both distance and velocity are below their thresholds (AC3)', () => {
    const direction = resolveDragDirection({
      horizontalDistance: DISTANCE_THRESHOLD_PX - 10,
      verticalDistance: 0,
      velocity: VELOCITY_THRESHOLD_PX_PER_MS - 0.1,
    });
    expect(direction).toBeNull();
  });

  it('returns null for a mostly-vertical drag regardless of vertical distance (AC4)', () => {
    const direction = resolveDragDirection({
      horizontalDistance: 10,
      verticalDistance: 500,
      velocity: VELOCITY_THRESHOLD_PX_PER_MS + 1,
    });
    expect(direction).toBeNull();
  });

  it('returns null for a mostly-vertical drag even when horizontal distance alone would cross the distance threshold', () => {
    const direction = resolveDragDirection({
      horizontalDistance: DISTANCE_THRESHOLD_PX + 5,
      verticalDistance: DISTANCE_THRESHOLD_PX + 200,
    });
    expect(direction).toBeNull();
  });
});
