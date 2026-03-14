declare module "canvas-confetti" {
  export interface ConfettiOptions {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: {
      x?: number;
      y?: number;
    };
    colors?: string[];
    shapes?: ("square" | "circle")[];
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  // eslint-disable-next-line no-unused-vars
  function confetti(options?: ConfettiOptions): Promise<null>;
  function confetti(
    _options: ConfettiOptions & { particleCount: number }
  ): Promise<null>;

  export default confetti;
}
