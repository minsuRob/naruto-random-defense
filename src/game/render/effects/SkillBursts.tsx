'use no memo';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';

import { MANA_SKILL } from '@/game/config/balance';
import type { ManaSkill } from '@/game/engine/types';
import { onSkillCast } from '@/game/runtime/effect-bus';

/**
 * Expanding rings where a mana skill went off.
 *
 * Skills fire in the simulation, which the renderer never reads directly, so
 * they arrive over the effect bus — the same events the log is built from.
 */

const MAX_BURSTS = 24;
const LIFETIME = 0.45;

const COLOR: Record<ManaSkill, Color> = {
  nova: new Color('#ff8a3b'),
  execute: new Color('#ff3b6b'),
  bigHit: new Color('#ffe27a'),
};

const RADIUS: Record<ManaSkill, number> = {
  nova: MANA_SKILL.novaRadius,
  execute: 0.9,
  bigHit: 1.2,
};

interface Burst {
  x: number;
  z: number;
  radius: number;
  color: Color;
  remaining: number;
}

export function SkillBursts() {
  const meshRef = useRef<InstancedMesh>(null);
  const bursts = useRef<Burst[]>([]);
  const dummy = useMemo(() => new Object3D(), []);

  useEffect(
    () =>
      onSkillCast((event) => {
        if (bursts.current.length >= MAX_BURSTS) bursts.current.shift();
        bursts.current.push({
          x: event.x,
          z: event.z,
          radius: RADIUS[event.skill],
          color: COLOR[event.skill],
          remaining: LIFETIME,
        });
      }),
    []
  );

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    let visible = 0;
    for (const burst of bursts.current) {
      burst.remaining -= delta;
      if (burst.remaining <= 0) continue;

      const t = 1 - burst.remaining / LIFETIME;
      dummy.position.set(burst.x, 0.12, burst.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(burst.radius * (0.3 + 0.7 * t));
      dummy.updateMatrix();
      mesh.setMatrixAt(visible, dummy.matrix);
      mesh.setColorAt(visible, burst.color);
      visible++;
    }
    bursts.current = bursts.current.filter((b) => b.remaining > 0);

    mesh.count = visible;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_BURSTS]} frustumCulled={false}>
      <ringGeometry args={[0.75, 1, 28]} />
      <meshBasicMaterial transparent opacity={0.55} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}
