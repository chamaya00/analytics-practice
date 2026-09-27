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
  }

  export type ConfettiFn = (options?: ConfettiOptions) => void;

  export interface ConfettiCannon extends ConfettiFn {
    create(canvas: HTMLCanvasElement, options?: { resize?: boolean; useWorker?: boolean }): ConfettiFn;
    reset(): void;
  }

  const confetti: ConfettiCannon;
  export default confetti;
}
