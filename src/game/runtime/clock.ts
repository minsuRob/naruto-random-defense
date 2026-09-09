import { TICK_DT } from '@/game/config/balance';

/**
 * Fixed-timestep accumulator.
 *
 * Rendering runs at the display's rate, the simulation at 20 Hz. `alpha` is how
 * far we are between the last two sim ticks, so mobs can be drawn smoothly.
 */
export interface SimClock {
  /** Feed a frame delta; returns how many sim steps to run now. */
  accumulate(delta: number): number;
  readonly alpha: number;
  readonly paused: boolean;
  setPaused(paused: boolean): void;
  reset(): void;
}

/** Never simulate more than this per frame; a stalled tab must not spiral. */
const MAX_STEPS_PER_FRAME = 5;

export function createSimClock(): SimClock {
  let accumulator = 0;
  let alpha = 0;
  let paused = false;

  return {
    accumulate(delta) {
      if (paused) return 0;
      accumulator += Math.min(delta, 0.25);
      let steps = 0;
      while (accumulator >= TICK_DT && steps < MAX_STEPS_PER_FRAME) {
        accumulator -= TICK_DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;
      alpha = accumulator / TICK_DT;
      return steps;
    },
    get alpha() {
      return alpha;
    },
    get paused() {
      return paused;
    },
    setPaused(value) {
      paused = value;
    },
    reset() {
      accumulator = 0;
      alpha = 0;
    },
  };
}
