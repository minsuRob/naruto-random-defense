import type { AltarKind } from '@/game/config/map';

/**
 * Colours shared by the 3D scene and the minimap.
 *
 * Both draw the same things at wildly different scales, and the only way a
 * player connects a dot on the minimap to a plinth on the map is if they are
 * the same colour. One source, so they cannot drift.
 */

export const ALTAR_COLOR: Record<AltarKind, string> = {
  normal: '#c9d1d9',
  magic: '#4aa3ff',
  gold: '#f0c674',
  wood: '#9fd07a',
};

/** One per island, in plot-id order. Slot 0 is the local player. */
export const SLOT_COLOR = ['#4aa3ff', '#e8862c', '#9fd07a', '#d18ff0'] as const;
