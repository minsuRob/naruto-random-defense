'use no memo';

import { useFrame } from '@react-three/fiber';

import type { Engine } from '@/game/engine/engine';
import type { SimClock } from '@/game/runtime/clock';
import type { HudSync } from '@/game/runtime/hud-sync';

/**
 * Drives the simulation from the render loop: accumulate the frame delta, run
 * whole sim steps, then publish to the HUD once per frame rather than per tick.
 */
export function SimDriver({
  engine,
  clock,
  hudSync,
}: {
  engine: Engine;
  clock: SimClock;
  hudSync: HudSync;
}) {
  useFrame((_state, delta) => {
    const steps = clock.accumulate(delta);
    if (steps === 0) return;

    for (let i = 0; i < steps; i++) engine.tick();
    hudSync.flush(engine.drainEvents());
  });

  return null;
}
