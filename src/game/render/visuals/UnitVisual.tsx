'use no memo';

import { useAnimations, useGLTF } from '@react-three/drei';
import { Asset } from 'expo-asset';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

import { getVisual } from './registry';
import type { UnitAnimation } from './unit-animation';

/**
 * Draws one unit: its converted model when the asset pipeline has produced one,
 * a graded primitive otherwise. Swapping in better art never touches callers.
 */

export function UnitVisual({
  unitId,
  grade,
  scale = 1,
  animation = 'stand',
}: {
  unitId: string;
  grade: string;
  scale?: number;
  animation?: UnitAnimation;
}) {
  const visual = getVisual(unitId, grade);

  if (visual.kind === 'placeholder') {
    return <Placeholder shape={visual.shape} color={visual.color} scale={scale} />;
  }
  return (
    <Suspense fallback={<Placeholder shape="capsule" color="#3d444d" scale={scale} />}>
      <GltfModel module={visual.module} scale={scale} animation={animation} />
    </Suspense>
  );
}

function GltfModel({
  module,
  scale,
  animation,
}: {
  module: number;
  scale: number;
  animation: UnitAnimation;
}) {
  // Metro hands back an asset module id; expo-asset turns it into a URL both
  // the DOM loader and expo-gl can fetch.
  const uri = useMemo(() => Asset.fromModule(module).uri, [module]);
  const gltf = useGLTF(uri);

  // Every unit needs its own skeleton — a plain clone shares bones, so all
  // copies of a model would animate in lockstep.
  const scene = useMemo(() => cloneSkinned(gltf.scene) as Group, [gltf]);
  const group = useRef<Group>(null);
  const { actions } = useAnimations(gltf.animations, scene);

  useEffect(() => {
    const clip = actions[animation] ?? actions.stand;
    if (!clip) return;
    clip.reset().fadeIn(0.15).play();
    return () => {
      clip.fadeOut(0.15);
    };
  }, [actions, animation]);

  return (
    <group ref={group} scale={scale}>
      <primitive object={scene} />
    </group>
  );
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
