'use no memo';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { PerspectiveCamera } from 'three';

import type { InputController } from '@/game/input/types';
import { setViewHandle } from '@/game/runtime/view-handle';
import { stepCameraFromInput, type CameraRig as Rig } from './camera-rig';

/**
 * Drives the pure rig from the input controller and copies the pose onto the
 * three camera. All mutation happens inside useFrame — hence 'use no memo',
 * since the React Compiler cannot reason about this.
 *
 * The per-frame logic lives in stepCameraFromInput so it stays unit-testable.
 */
export function CameraRig({ rig, input }: { rig: Rig; input: InputController }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const poseRef = useRef(rig.getPose());

  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    if (perspective.isPerspectiveCamera && perspective.fov !== rig.config.fov) {
      perspective.fov = rig.config.fov;
      perspective.updateProjectionMatrix();
    }
    setViewHandle({ camera, rig });
  }, [camera, rig]);

  useFrame((_state, delta) => {
    stepCameraFromInput(rig, input, Math.min(delta, 0.1), {
      width: size.width,
      height: size.height,
    });

    const pose = rig.getPose(poseRef.current);
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
  });

  return null;
}
