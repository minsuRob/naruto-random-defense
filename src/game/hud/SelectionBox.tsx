import type { InputController } from '@/game/input/types';

/**
 * Native has no drag-box yet (a one-finger drag pans, a tap selects), so this
 * renders nothing. Kept as a platform pair so the tree matches web.
 */
export function SelectionBox(_props: { input: InputController }) {
  return null;
}
