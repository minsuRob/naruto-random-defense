import type { Camera } from 'three';

import type { CameraRig } from '@/game/camera/camera-rig';
import type { Engine } from '@/game/engine/engine';
import type { InputController } from '@/game/input/types';

/**
 * Module-level handle to the things the HUD reads every frame but must never
 * put in React state: the camera rig, the live three camera, the input
 * controller and the engine itself (the minimap draws mob dots straight from
 * its typed arrays in its own rAF loop).
 *
 * Set by GameScreen on mount, cleared on unmount.
 */
interface ViewHandle {
  rig: CameraRig | null;
  camera: Camera | null;
  input: InputController | null;
  engine: Engine | null;
}

const handle: ViewHandle = { rig: null, camera: null, input: null, engine: null };

export function setViewHandle(next: Partial<ViewHandle>) {
  Object.assign(handle, next);
}

export function clearViewHandle() {
  handle.rig = null;
  handle.camera = null;
  handle.input = null;
  handle.engine = null;
}

export function getViewHandle(): Readonly<ViewHandle> {
  return handle;
}
