/**
 * Platform-neutral input surface consumed by the camera rig and the HUD.
 *
 * Web drives it from DOM keyboard/mouse; native will drive it from
 * react-native-gesture-handler. Nothing above this interface may reference
 * `window`, `document` or a gesture library.
 */

export type Hotkey =
  | 'PAKKUN_DOWN'
  | 'PAKKUN_UP'
  | 'PAKKUN_GOLD'
  | 'PAKKUN_WOOD'
  | 'GAMBLE'
  | 'GAMBLE_1'
  | 'GAMBLE_3'
  | 'GAMBLE_5'
  | 'HIRE_NORMAL'
  | 'HIRE_MAGIC'
  | 'SELL'
  | 'MOVE'
  | 'COMBINE'
  | 'COMBO_BOOK'
  | 'CANCEL'
  | 'CYCLE'
  | 'SELECT_ALL'
  | 'CENTER'
  | 'PAUSE'
  | 'ZOOM_IN'
  | 'ZOOM_OUT';

export interface PointerInput {
  kind: 'down' | 'up' | 'move' | 'click' | 'contextmenu' | 'dblclick';
  /** Viewport-relative CSS pixels. */
  x: number;
  y: number;
  button: number;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
}

export interface BoxSelect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface InputSettings {
  /** Let WASD pan the camera. Off by default: W/S belong to the command card. */
  wasdPan: boolean;
  edgeScroll: boolean;
}

export const DEFAULT_INPUT_SETTINGS: InputSettings = {
  wasdPan: false,
  edgeScroll: true,
};

export interface InputController {
  /** Bind to a host element/view. Returns a detach function. */
  attach(host: unknown): () => void;
  /** Called once per frame before the camera reads the fields below. */
  update(dt: number, viewport: Viewport): void;

  /** Screen-space pan intent for this frame, each axis in [-1, 1]. +y is "north". */
  readonly panAxis: { x: number; y: number };
  /** Pixels dragged since the last call (middle-drag / two-finger). Resets on read. */
  consumeDragPan(): { dx: number; dy: number };
  /** Multiplicative zoom factor since the last call; 1 means no change. */
  consumeZoom(): number;
  /** Requested 90-degree yaw steps since the last call. */
  consumeRotate(): number;

  readonly modifiers: { shift: boolean; ctrl: boolean; alt: boolean };
  readonly boxSelect: BoxSelect | null;

  onHotkey(cb: (key: Hotkey) => void): () => void;
  onPointer(cb: (p: PointerInput) => void): () => void;
  /** Fires once, on release, with the rectangle that was dragged. */
  onBoxSelect(cb: (box: BoxSelect, additive: boolean) => void): () => void;
  /** Digit keys: assign with ctrl, append with shift, otherwise recall. */
  onControlGroup(
    cb: (slot: number, mode: 'assign' | 'recall' | 'append') => void
  ): () => void;

  /** Disabled while a modal owns the keyboard. */
  setEnabled(enabled: boolean): void;
  setSettings(settings: InputSettings): void;
  dispose(): void;
}
