'use no memo';

import { useGLTF } from '@react-three/drei';
import { Asset } from 'expo-asset';
import { Suspense, useMemo } from 'react';

import { getVisual } from './registry';

/**
 * Draws one unit: its converted model when the asset pipeline has produced one,
 * a graded primitive otherwise. Swapping in better art never touches callers.
 */
export function UnitVisual({
  unitId,
  grade,
  scale = 1,
}: {
  unitId: string;
  grade: string;
  scale?: number;
}) {
  const visual = getVisual(unitId, grade);

  if (visual.kind === 'placeholder') {
    return <Placeholder shape={visual.shape} color={visual.color} scale={scale} />;
  }
  return (
    <Suspense fallback={<Placeholder shape="capsule" color="#3d444d" scale={scale} />}>
      <GltfModel module={visual.module} scale={scale} />
    </Suspense>
  );
}

function GltfModel({ module, scale }: { module: number; scale: number }) {
  // Metro hands back an asset module id; expo-asset turns it into a URL both
  // the DOM loader and expo-gl can fetch.
  const uri = useMemo(() => Asset.fromModule(module).uri, [module]);
  const gltf = useGLTF(uri);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);
  return <primitive object={scene} scale={scale} />;
}

function Placeholder({
  shape,
  color,
  scale,
}: {
  shape: 'capsule' | 'box' | 'cone';
  color: string;
  scale: number;
}) {
  return (
    <mesh position={[0, 0.45 * scale, 0]} scale={scale} castShadow>
      {shape === 'capsule' ? (
        <capsuleGeometry args={[0.22, 0.42, 4, 8]} />
      ) : shape === 'box' ? (
        <boxGeometry args={[0.44, 0.9, 0.44]} />
      ) : (
        <coneGeometry args={[0.28, 0.9, 6]} />
      )}
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}
