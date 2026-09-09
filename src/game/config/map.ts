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
