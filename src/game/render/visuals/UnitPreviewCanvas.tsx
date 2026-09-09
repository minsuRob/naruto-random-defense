'use no memo';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';

import { UnitVisual } from './UnitVisual';

/**
 * A small second canvas for the combo book's result preview.
 *
 * Deliberately its own <Canvas> rather than drei's <View>: View tracks a DOM
 * element with getBoundingClientRect, which does not exist on native. This
 * mounts only while the book is open.
 */
export function UnitPreviewCanvas({ unitId, grade }: { unitId: string; grade: string }) {
  return (
    <Canvas camera={{ fov: 35, position: [0, 1.5, 3.4] }} dpr={[1, 2]}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} />
      <directionalLight position={[-3, 2, -3]} intensity={0.5} />
      <Turntable>
        <group position={[0, -0.75, 0]}>
          <UnitVisual unitId={unitId} grade={grade} scale={1.1} />
        </group>
      </Turntable>
    </Canvas>
  );
}

function Turntable({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame((_state, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.6;
  });
  return <group ref={ref}>{children}</group>;
}
