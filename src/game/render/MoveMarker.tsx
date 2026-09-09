'use no memo';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh, MeshBasicMaterial } from 'three';

/**
 * Warcraft's green move-order marker: a ring that flashes at the destination
 * and fades out. Purely feedback — it tells you the click registered.
 */

const LIFETIME = 0.55;

export interface MoveMarkerHandle {
  show(x: number, z: number): void;
}

export function MoveMarker({ handleRef }: { handleRef: { current: MoveMarkerHandle | null } }) {
  const groupRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const remaining = useRef(0);

  handleRef.current = {
    show(x, z) {
      const group = groupRef.current;
      if (!group) return;
      group.position.set(x, 0.08, z);
      group.visible = true;
      remaining.current = LIFETIME;
    },
  };

  useFrame((_state, delta) => {
    const group = groupRef.current;
    if (!group?.visible) return;

    remaining.current -= delta;
    if (remaining.current <= 0) {
      group.visible = false;
      return;
    }

    const t = remaining.current / LIFETIME;
    const scale = 1.5 - 0.7 * t; // expands as it fades
    group.scale.setScalar(scale);
    const material = ringRef.current?.material as MeshBasicMaterial | undefined;
    if (material) material.opacity = t;
  });

  return (
    <group ref={groupRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.3, 0.42, 24]} />
        <meshBasicMaterial color="#5fd08a" transparent opacity={1} depthWrite={false} />
      </mesh>
    </group>
  );
}
