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
 * M1 ships the shape only: the camera and HUD already talk to this interface, so
 * wiring react-native-gesture-handler (two-finger pan, pinch, tap) in M5 is a
 * change confined to this file. Gestures run on the UI thread and will push
 * small deltas in via the setters below.
 */
export function createInputController(): InputController {
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
      // Native pans come from gestures, not held keys, so panAxis stays zero.
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
    setEnabled(v) {
      enabled = v;
      void enabled;
    },
    setSettings(next) {
      settings = next;
      void settings;
    },
    dispose() {
      hotkeyHandlers.clear();
      pointerHandlers.clear();
    },
  };
}
