'use no memo';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';

import type { Engine } from '@/game/engine/engine';

/**
 * The pakkun tokens waiting south of the plot, and the ones trotting to an
 * altar. Instanced, because the count changes every round and none of them
 * need to be individually addressable in the scene graph.
 */

const MAX_TOKENS = 64;
const IDLE = new Color('#8fb8e8');
const WALKING = new Color('#f0c674');

export function PakkunTokens({ engine }: { engine: Engine }) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const tokens = engine.state.pakkuns;
    const bob = Math.sin(state.clock.elapsedTime * 4) * 0.03;
    let visible = 0;

    for (const token of tokens) {
      if (visible >= MAX_TOKENS) break;
      dummy.position.set(token.x, 0.22 + (token.target ? bob : 0), token.z);
      dummy.scale.setScalar(0.2);
      dummy.updateMatrix();
      mesh.setMatrixAt(visible, dummy.matrix);
      mesh.setColorAt(visible, token.target ? WALKING : IDLE);
      visible++;
    }

    mesh.count = visible;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_TOKENS]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial roughness={0.7} />
    </instancedMesh>
  );
}
