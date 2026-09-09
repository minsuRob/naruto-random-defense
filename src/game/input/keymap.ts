import type { Hotkey, InputSettings } from './types';

/**
 * Command-card hotkeys follow the Warcraft 3 grid convention (QWER / ZXCV rows
 * are commands, never camera movement). The camera pans with the arrow keys,
 * edge scroll, middle-drag and the minimap — WASD is an opt-in setting, and
 * turning it on moves the two colliding commands onto Shift.
 */

export const BASE_KEYMAP: Record<string, Hotkey> = {
  KeyQ: 'PAKKUN_DOWN',
  KeyW: 'PAKKUN_UP',
  KeyE: 'PAKKUN_GOLD',
  KeyR: 'PAKKUN_WOOD',
  KeyT: 'GAMBLE',
  KeyZ: 'HIRE_NORMAL',
  KeyX: 'HIRE_MAGIC',
  KeyB: 'COMBO_BOOK',
  KeyS: 'SELL',
  KeyM: 'MOVE',
  KeyC: 'COMBINE',
  Escape: 'CANCEL',
  Tab: 'CYCLE',
  F1: 'SELECT_ALL',
  Space: 'CENTER',
  KeyH: 'CENTER',
  KeyP: 'PAUSE',
  Equal: 'ZOOM_IN',
  Minus: 'ZOOM_OUT',
};

/** Keys the camera reads directly (held state), never dispatched as hotkeys. */
export const PAN_KEYS = {
  north: ['ArrowUp'],
  south: ['ArrowDown'],
  west: ['ArrowLeft'],
  east: ['ArrowRight'],
} as const;

export const WASD_PAN_KEYS = {
  north: ['KeyW'],
  south: ['KeyS'],
  west: ['KeyA'],
  east: ['KeyD'],
} as const;

/**
 * Resolve a physical key to a hotkey for the current settings.
 * With `wasdPan` on, W and S pan instead, and their commands need Shift.
 */
export function resolveHotkey(
  code: string,
  shift: boolean,
  settings: InputSettings
): Hotkey | null {
  if (settings.wasdPan) {
    if (code === 'KeyW' || code === 'KeyS' || code === 'KeyA' || code === 'KeyD') {
      if (!shift) return null;
      if (code === 'KeyW') return 'PAKKUN_UP';
      if (code === 'KeyS') return 'SELL';
      return null;
    }
  }
  return BASE_KEYMAP[code] ?? null;
}

/** Gamble submenu remaps Q/W/E to the three wood tiers. */
export const GAMBLE_SUBMENU: Record<string, Hotkey> = {
  KeyQ: 'GAMBLE_1',
  KeyW: 'GAMBLE_3',
  KeyE: 'GAMBLE_5',
};

/** Keys we swallow so the browser doesn't scroll / move focus mid-game. */
export const PREVENT_DEFAULT_CODES = new Set([
  'Space',
  'Tab',
  'F1',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);
