import type { Camera } from 'three';

import type { CameraRig } from '@/game/camera/camera-rig';
import type { InputController } from '@/game/input/types';

/**
 * Module-level handle to the things the HUD needs to read every frame but must
 * never put in React state: the camera rig, the live three camera and the input
 * controller. The minimap reads these directly in its own rAF loop.
 *
 * Set by GameScreen on mount, cleared on unmount.
 */
interface ViewHandle {
  rig: CameraRig | null;
  camera: Camera | null;
  input: InputController | null;
}

const handle: ViewHandle = { rig: null, camera: null, input: null };

export function setViewHandle(next: Partial<ViewHandle>) {
  Object.assign(handle, next);
}

export function clearViewHandle() {
  handle.rig = null;
  handle.camera = null;
  handle.input = null;
}

export function getViewHandle(): Readonly<ViewHandle> {
  return handle;
}
