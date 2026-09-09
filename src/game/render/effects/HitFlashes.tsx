'use no memo';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, LineSegments } from 'three';

import type { Engine } from '@/game/engine/engine';

/**
 * Hitscan tracers.
 *
 * Attacks resolve instantly in the simulation, so the visual is a short line
 * from the shooter to the target that fades over a few frames. One pooled
 * LineSegments keeps it to a single draw call.
 */

const MAX_TRACERS = 128;
const TRACER_SECONDS = 0.12;

interface Tracer {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  until: number;
}

export function HitFlashes({ engine }: { engine: Engine }) {
  const linesRef = useRef<LineSegments>(null);
  const tracers = useRef<Tracer[]>([]);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(MAX_TRACERS * 6), 3));
    return g;
  }, []);

  useFrame((_state, delta) => {
    const now = performance.now() / 1000;

    // The engine's events are drained by SimDriver, so read hits off the state
    // instead: a unit that just fired has a full cooldown and a live target.
    for (const unit of engine.state.units.values()) {
      const target = unit.targetMob;
      if (target < 0 || !engine.state.mobs.active[target]) continue;
      if (unit.cooldown > delta * 2) continue; // only just fired
      if (tracers.current.length >= MAX_TRACERS) break;
      tracers.current.push({
        x0: unit.x,
        z0: unit.z,
        x1: engine.state.mobs.x[target],
        z1: engine.state.mobs.z[target],
        until: now + TRACER_SECONDS,
      });
    }

    tracers.current = tracers.current.filter((t) => t.until > now);

    const positions = geometry.getAttribute('position') as BufferAttribute;
    const array = positions.array as Float32Array;
    for (let i = 0; i < tracers.current.length; i++) {
      const t = tracers.current[i];
      const o = i * 6;
      array[o] = t.x0;
      array[o + 1] = 0.55;
      array[o + 2] = t.z0;
      array[o + 3] = t.x1;
      array[o + 4] = 0.35;
      array[o + 5] = t.z1;
    }
    positions.needsUpdate = true;
    geometry.setDrawRange(0, tracers.current.length * 2);
  });

  return (
    <lineSegments ref={linesRef} geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial color="#ffe9a8" transparent opacity={0.5} />
    </lineSegments>
  );
}
