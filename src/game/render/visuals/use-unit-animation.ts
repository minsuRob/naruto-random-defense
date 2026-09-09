import { useFrame } from '@react-three/fiber';
import { useState } from 'react';

import type { Engine } from '@/game/engine/engine';
import { unitAnimationFor, type UnitAnimation } from './unit-animation';

/**
 * Which clip a unit should be playing, polled from the engine.
 *
 * Read in the render loop rather than pushed through the store: the answer
 * changes on its own schedule (a walk starts, a target dies) and only a handful
 * of times a second, so setState on change is cheaper than a per-tick publish.
 */
export function useUnitAnimation(engine: Engine, unitId: number): UnitAnimation {
  const [animation, setAnimation] = useState<UnitAnimation>('stand');

  useFrame(() => {
    const next = unitAnimationFor(engine, unitId);
    if (next !== animation) setAnimation(next);
  });

  return animation;
}
