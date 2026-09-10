import { CELL_SIZE, PLOT_CELLS, PLOT_HALF } from '@/game/config/map';

/**
 * Placement grid inside a plot. Cells are addressed (cx, cy) with cx east and
 * cy south, both 0..PLOT_CELLS-1. Occupancy is one byte per cell so it can be
 * copied cheaply and inspected in tests.
 */

export interface Cell {
  cx: number;
  cy: number;
}

export const CELL_COUNT = PLOT_CELLS * PLOT_CELLS;

export function createOccupancy(): Uint8Array {
  return new Uint8Array(CELL_COUNT);
}

export function cellIndex(cx: number, cy: number): number {
  return cy * PLOT_CELLS + cx;
}

export function isInsidePlot(cx: number, cy: number): boolean {
  return cx >= 0 && cy >= 0 && cx < PLOT_CELLS && cy < PLOT_CELLS;
}

/** Centre of a cell, in plot-local world units. */
export function cellToLocal(cx: number, cy: number): { x: number; z: number } {
  return {
    x: -PLOT_HALF + (cx + 0.5) * CELL_SIZE,
    z: -PLOT_HALF + (cy + 0.5) * CELL_SIZE,
  };
}

/** Cell containing a plot-local point, or null when outside the plot. */
export function localToCell(x: number, z: number): Cell | null {
  const cx = Math.floor((x + PLOT_HALF) / CELL_SIZE);
  const cy = Math.floor((z + PLOT_HALF) / CELL_SIZE);
  return isInsidePlot(cx, cy) ? { cx, cy } : null;
}

/**
 * The world <-> cell pair.
 *
 * Everything that picks (a raycast onto the ground, a pointer hit) works in
 * world space, while the grid above is plot-local. These two are the only
 * sanctioned bridge; passing a world coordinate straight into `localToCell`
 * silently works for a plot at the origin and silently fails for every other.
 */

/** Cell of the plot at `origin` containing a world point, or null if outside it. */
export function worldToCell(
  origin: { x: number; z: number },
  x: number,
  z: number
): Cell | null {
  return localToCell(x - origin.x, z - origin.z);
}

/** Centre of a cell of the plot at `origin`, in world units. */
export function cellToWorld(
  origin: { x: number; z: number },
  cx: number,
  cy: number
): { x: number; z: number } {
  const local = cellToLocal(cx, cy);
  return { x: local.x + origin.x, z: local.z + origin.z };
}

/**
 * First free cell, filling from the outside in.
 *
 * The lane runs around the plot, so the outer ring is the only place a new unit
 * can reach it — a centre cell is more than an attack range away from the
 * nearest lane point. Players still reposition freely; this just makes the
 * default placement useful.
 */
export function findFreeCell(occupancy: Uint8Array): Cell | null {
  const maxRing = Math.floor((PLOT_CELLS - 1) / 2);
  for (let inset = 0; inset <= maxRing; inset++) {
    const lo = inset;
    const hi = PLOT_CELLS - 1 - inset;
    for (let cy = lo; cy <= hi; cy++) {
      for (let cx = lo; cx <= hi; cx++) {
        // Only this ring's perimeter is new.
        const onRing = cx === lo || cx === hi || cy === lo || cy === hi;
        if (!onRing || !isInsidePlot(cx, cy)) continue;
        if (occupancy[cellIndex(cx, cy)] === 0) return { cx, cy };
      }
    }
  }
  return null;
}
