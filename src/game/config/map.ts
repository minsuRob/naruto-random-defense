/**
 * World layout constants.
 *
 * One world unit = one placement cell. Everything is expressed in plot-local
 * coordinates; world position = local + plot.origin, so adding co-op plots later
 * is a matter of creating more origins.
 *
 * Axes: +x right, +z toward the viewer ("south"), -z away ("north").
 */

/** Placement plot is PLOT_CELLS x PLOT_CELLS cells, centred on the plot origin. */
export const PLOT_CELLS = 10;
export const CELL_SIZE = 1;
/** Half-extent of the plot in world units: cells span [-PLOT_HALF, +PLOT_HALF]. */
export const PLOT_HALF = (PLOT_CELLS * CELL_SIZE) / 2;

/** Lane centreline: rounded rectangle with this half-extent and corner radius. */
export const LANE_HALF = 7;
export const LANE_CORNER_RADIUS = 2.5;
/** Visual width of the lane ribbon (mobs walk down the middle). */
export const LANE_WIDTH = 1.2;

/** Padding between the outer lane edge and the camera bounds. */
export const MAP_MARGIN = 7;

/** Grid of plot origins for co-op (max 8). v1 only instantiates index 0. */
export const PLOT_PITCH = 32;
export const MAX_PLOTS = 8;

export function plotOrigin(index: number): { x: number; z: number } {
  if (index === 0) return { x: 0, z: 0 };
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: col * PLOT_PITCH - 48, z: row * PLOT_PITCH - 16 };
}

/** Axis-aligned world bounds covering `plotCount` plots plus margin. */
export function mapBounds(plotCount: number) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < plotCount; i++) {
    const o = plotOrigin(i);
    minX = Math.min(minX, o.x - LANE_HALF - MAP_MARGIN);
    maxX = Math.max(maxX, o.x + LANE_HALF + MAP_MARGIN);
    minZ = Math.min(minZ, o.z - LANE_HALF - MAP_MARGIN);
    maxZ = Math.max(maxZ, o.z + LANE_HALF + MAP_MARGIN);
  }
  return { minX, maxX, minZ, maxZ };
}

/**
 * The four altars in the middle of the plot.
 *
 * This is where a pakkun token has to be walked to, as in the original: the
 * token is the widget you are handed, and what you get depends on which altar
 * you send it to. The centre cells are the natural home for them — they are
 * more than an attack range away from the lane, so they were the least useful
 * squares to build on anyway.
 */
export type AltarKind = 'normal' | 'magic' | 'gold' | 'wood';

export interface AltarDef {
  kind: AltarKind;
  nameKo: string;
  hint: string;
  /** Cell the altar occupies; it is permanently blocked for placement. */
  cell: { cx: number; cy: number };
}

const MID = PLOT_CELLS / 2;

export const ALTARS: AltarDef[] = [
  { kind: 'magic', nameKo: '위쪽 제단', hint: '노말 + 매직', cell: { cx: MID - 1, cy: MID - 1 } },
  { kind: 'gold', nameKo: '금고', hint: '골드 100', cell: { cx: MID, cy: MID - 1 } },
  { kind: 'normal', nameKo: '아래쪽 제단', hint: '노말', cell: { cx: MID - 1, cy: MID } },
  { kind: 'wood', nameKo: '목재소', hint: '목재 60%', cell: { cx: MID, cy: MID } },
];

export const ALTAR_BY_KIND: Record<AltarKind, AltarDef> = Object.fromEntries(
  ALTARS.map((a) => [a.kind, a])
) as Record<AltarKind, AltarDef>;

/** Where fresh pakkun tokens wait: a strip just south of the plot. */
export const PAKKUN_HOLDING_Z = PLOT_HALF + 1.3;
export const PAKKUN_HOLDING_SPACING = 0.7;
