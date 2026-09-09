'use no memo';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';

import { MOB_CAPACITY } from '@/game/config/balance';
import type { Engine } from '@/game/engine/engine';
import { lerpWrapped } from '@/game/engine/lane';
import type { SimClock } from '@/game/runtime/clock';

/**
 * Every mob in one draw call.
 *
 * Positions come straight off the engine's typed arrays and are interpolated
 * between sim ticks, so the 20 Hz simulation reads as smooth motion. Nothing
 * here goes through React state.
 */

const MOB_COLOR = new Color('#d94b3c');
const BOSS_COLOR = new Color('#ffb020');
const STUNNED_COLOR = new Color('#7fb4ff');
const HURT_COLOR = new Color('#8c2f27');

export function MobInstances({ engine, clock }: { engine: Engine; clock: SimClock }) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { state } = engine;
    const mobs = state.mobs;
    const alpha = clock.alpha;
    let visible = 0;

    for (let i = 0; i < mobs.count; i++) {
      if (!mobs.active[i]) continue;

      const plot = state.plots[mobs.plot[i]];
      const lane = plot.lane;
      const s = lerpWrapped(mobs.sPrev[i], mobs.s[i], alpha, lane.length);
      const p = lane.positionAt(s);

      const boss = mobs.isBoss[i] === 1;
      const scale = boss ? 0.62 : 0.3;
      dummy.position.set(p.x + plot.origin.x, scale, p.z + plot.origin.z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(visible, dummy.matrix);

      const stunned = mobs.stunUntil[i] > state.time;
      const health = mobs.maxHp[i] > 0 ? mobs.hp[i] / mobs.maxHp[i] : 1;
      if (stunned) color.copy(STUNNED_COLOR);
      else if (boss) color.copy(BOSS_COLOR);
      else color.copy(HURT_COLOR).lerp(MOB_COLOR, health);
      mesh.setColorAt(visible, color);

      visible++;
    }

    mesh.count = visible;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MOB_CAPACITY]}
      frustumCulled={false}
      castShadow
    >
      <sphereGeometry args={[1, 10, 8]} />
      <meshStandardMaterial roughness={0.55} />
    </instancedMesh>
  );
}
