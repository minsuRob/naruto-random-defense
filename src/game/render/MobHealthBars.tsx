'use no memo';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';

import { MOB_CAPACITY } from '@/game/config/balance';
import type { Engine } from '@/game/engine/engine';
import { lerpWrapped } from '@/game/engine/lane';
import type { SimClock } from '@/game/runtime/clock';

/**
 * Health bars over damaged mobs, as two instanced quads (track and fill) that
 * billboard toward the camera.
 *
 * Only mobs that have taken damage get one, so a fresh wave costs nothing —
 * this is the first thing to switch off if mobile frame times get tight.
 */

const GREEN = new Color('#5fd08a');
const RED = new Color('#e8623c');
const BAR_WIDTH = 0.62;
const BAR_HEIGHT = 0.09;

export function MobHealthBars({ engine, clock }: { engine: Engine; clock: SimClock }) {
  const trackRef = useRef<InstancedMesh>(null);
  const fillRef = useRef<InstancedMesh>(null);
  const camera = useThree((s) => s.camera);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);

  useFrame(() => {
    const track = trackRef.current;
    const fill = fillRef.current;
    if (!track || !fill) return;

    const { state } = engine;
    const mobs = state.mobs;
    let visible = 0;

    for (let i = 0; i < mobs.count; i++) {
      if (!mobs.active[i]) continue;
      const health = mobs.maxHp[i] > 0 ? mobs.hp[i] / mobs.maxHp[i] : 1;
      if (health >= 0.999) continue;

      const plot = state.plots[mobs.plot[i]];
      const lane = plot.lane;
      const s = lerpWrapped(mobs.sPrev[i], mobs.s[i], clock.alpha, lane.length);
      const p = lane.positionAt(s);
      const boss = mobs.isBoss[i] === 1;
      const y = (boss ? 1.5 : 0.75) + BAR_HEIGHT;

      dummy.position.set(p.x + plot.origin.x, y, p.z + plot.origin.z);
      dummy.quaternion.copy(camera.quaternion);
      dummy.scale.set(boss ? BAR_WIDTH * 2 : BAR_WIDTH, BAR_HEIGHT, 1);
      dummy.updateMatrix();
      track.setMatrixAt(visible, dummy.matrix);

      // The fill shrinks from the left, so shift it by the missing half.
      const width = (boss ? BAR_WIDTH * 2 : BAR_WIDTH) * health;
      dummy.scale.set(width, BAR_HEIGHT * 0.72, 1);
      dummy.translateX(-((boss ? BAR_WIDTH * 2 : BAR_WIDTH) - width) / 2 / Math.max(width, 1e-6));
      dummy.updateMatrix();
      fill.setMatrixAt(visible, dummy.matrix);
      fill.setColorAt(visible, color.copy(RED).lerp(GREEN, health));

      visible++;
      if (visible >= MOB_CAPACITY) break;
    }

    track.count = visible;
    fill.count = visible;
    track.instanceMatrix.needsUpdate = true;
    fill.instanceMatrix.needsUpdate = true;
    if (fill.instanceColor) fill.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh
        ref={trackRef}
        args={[undefined, undefined, MOB_CAPACITY]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#10131a" transparent opacity={0.75} depthWrite={false} />
      </instancedMesh>
      <instancedMesh
        ref={fillRef}
        args={[undefined, undefined, MOB_CAPACITY]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial toneMapped={false} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
