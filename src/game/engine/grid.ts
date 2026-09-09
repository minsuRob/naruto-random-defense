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
 * First free cell, searched in rings outward from the plot centre so new units
 * cluster where they can actually reach the lane. Returns null when full.
 */
export function findFreeCell(occupancy: Uint8Array): Cell | null {
  const mid = Math.floor(PLOT_CELLS / 2);
  for (let ring = 0; ring <= PLOT_CELLS; ring++) {
    for (let cy = mid - ring; cy <= mid + ring; cy++) {
      for (let cx = mid - ring; cx <= mid + ring; cx++) {
        // Only the perimeter of this ring is new.
        const onRing = Math.abs(cx - mid) === ring || Math.abs(cy - mid) === ring;
        if (!onRing || !isInsidePlot(cx, cy)) continue;
        if (occupancy[cellIndex(cx, cy)] === 0) return { cx, cy };
      }
    }
  }
  return null;
}
