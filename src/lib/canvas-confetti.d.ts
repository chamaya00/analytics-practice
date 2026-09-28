// canvas-confetti ships no types of its own (ADR 0011) — this declares only
// the surface rating-sheet-dom.ts actually calls: the default export's
// `create(canvas, options)`, which returns a burst function scoped to that
// canvas (docs/design/162-rating-win-tips-rewards-vip.md, "The animation").
declare module 'canvas-confetti' {
  export interface ConfettiOptions {
    particleCount?: number;
    spread?: number;
    startVelocity?: number;
    ticks?: number;
    gravity?: number;
    colors?: string[];
    disableForReducedMotion?: boolean;
    /** Fractions of the viewport (0–1 on each axis), not pixels — the
     * Delivered landing burst (#189) computes this from the stamp's own
     * `getBoundingClientRect()` rather than leaving it at the library's
     * `{ x: 0.5, y: 0.5 }` default. */
    origin?: { x: number; y: number };
  }

  export type ConfettiFn = (options?: ConfettiOptions) => void;

  export interface ConfettiCannon extends ConfettiFn {
    create(canvas: HTMLCanvasElement, options?: { resize?: boolean; useWorker?: boolean }): ConfettiFn;
    reset(): void;
  }

  const confetti: ConfettiCannon;
  export default confetti;
}
