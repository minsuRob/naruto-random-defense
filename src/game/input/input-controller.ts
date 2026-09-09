import {
  DEFAULT_INPUT_SETTINGS,
  type BoxSelect,
  type Hotkey,
  type InputController,
  type InputSettings,
  type PointerInput,
  type Viewport,
} from './types';

/**
 * Native input controller.
 *
 * Gestures are captured on the UI thread by the GestureHost component in
 * ./GestureHost.tsx and pushed in here as small deltas; the camera reads them
 * in useFrame exactly as it does on web. Everything above the InputController
 * interface is identical across platforms.
 */

export interface NativeInputController extends InputController {
  /** Two-finger drag, in screen pixels since the last frame. */
  pushDragPan(dx: number, dy: number): void;
  /** Pinch scale delta; > 1 zooms out. */
  pushZoom(factor: number): void;
  pushPointer(event: PointerInput): void;
  emitHotkey(key: Hotkey): void;
}

export function createInputController(): NativeInputController {
  let enabled = true;
  let settings: InputSettings = { ...DEFAULT_INPUT_SETTINGS };

  const panAxis = { x: 0, y: 0 };
  const modifiers = { shift: false, ctrl: false, alt: false };
  let dragPanX = 0;
  let dragPanY = 0;
  let zoomFactor = 1;

  const hotkeyHandlers = new Set<(k: Hotkey) => void>();
  const pointerHandlers = new Set<(p: PointerInput) => void>();

  return {
    attach() {
      return () => {};
    },
    update(_dt: number, _viewport: Viewport) {
      // Native panning comes from gestures, not held keys, so panAxis stays 0.
    },
    panAxis,
    consumeDragPan() {
      const out = { dx: dragPanX, dy: dragPanY };
      dragPanX = 0;
      dragPanY = 0;
      return out;
    },
    consumeZoom() {
      const out = zoomFactor;
      zoomFactor = 1;
      return out;
    },
    consumeRotate() {
      return 0;
    },
    modifiers,
    get boxSelect(): BoxSelect | null {
      return null;
    },
    onHotkey(cb) {
      hotkeyHandlers.add(cb);
      return () => hotkeyHandlers.delete(cb);
    },
    onPointer(cb) {
      pointerHandlers.add(cb);
      return () => pointerHandlers.delete(cb);
    },
    setEnabled(value) {
      enabled = value;
    },
    setSettings(next) {
      settings = next;
      void settings;
    },
    dispose() {
      hotkeyHandlers.clear();
      pointerHandlers.clear();
    },

    pushDragPan(dx, dy) {
      if (!enabled) return;
      dragPanX += dx;
      dragPanY += dy;
    },
    pushZoom(factor) {
      if (!enabled) return;
      zoomFactor *= factor;
    },
    pushPointer(event) {
      if (!enabled) return;
      pointerHandlers.forEach((cb) => cb(event));
    },
    emitHotkey(key) {
      hotkeyHandlers.forEach((cb) => cb(key));
    },
  };
}
