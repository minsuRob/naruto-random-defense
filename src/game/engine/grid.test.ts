import { describe, expect, it } from 'vitest';

import { PLOT_CELLS, PLOT_HALF } from '@/game/config/map';
import {
  CELL_COUNT,
  cellIndex,
  cellToLocal,
  createOccupancy,
  findFreeCell,
  localToCell,
} from './grid';

describe('grid', () => {
  it('maps cells to their centres', () => {
    expect(cellToLocal(0, 0)).toEqual({ x: -PLOT_HALF + 0.5, z: -PLOT_HALF + 0.5 });
    const last = cellToLocal(PLOT_CELLS - 1, PLOT_CELLS - 1);
    expect(last.x).toBeCloseTo(PLOT_HALF - 0.5, 10);
    expect(last.z).toBeCloseTo(PLOT_HALF - 0.5, 10);
  });

  it('round-trips every cell through world space', () => {
    for (let cy = 0; cy < PLOT_CELLS; cy++) {
      for (let cx = 0; cx < PLOT_CELLS; cx++) {
        const p = cellToLocal(cx, cy);
        expect(localToCell(p.x, p.z)).toEqual({ cx, cy });
      }
    }
  });

  it('rejects points outside the plot', () => {
    expect(localToCell(PLOT_HALF + 0.1, 0)).toBeNull();
    expect(localToCell(0, -PLOT_HALF - 0.1)).toBeNull();
  });

  it('fills from the outside in, where the lane is reachable', () => {
    const occ = createOccupancy();
    expect(findFreeCell(occ)).toEqual({ cx: 0, cy: 0 });

    // The whole outer ring is used before anything steps inward.
    const outerRing = PLOT_CELLS * 4 - 4;
    for (let i = 0; i < outerRing; i++) {
      const cell = findFreeCell(occ)!;
      const onEdge =
        cell.cx === 0 || cell.cy === 0 || cell.cx === PLOT_CELLS - 1 || cell.cy === PLOT_CELLS - 1;
      expect(onEdge).toBe(true);
      occ[cellIndex(cell.cx, cell.cy)] = 1;
    }
    const next = findFreeCell(occ)!;
    expect(next.cx).toBe(1);
    expect(next.cy).toBe(1);
  });

  it('returns null when the plot is full', () => {
    const occ = createOccupancy();
    occ.fill(1);
    expect(findFreeCell(occ)).toBeNull();
  });

  it('hands out every cell exactly once', () => {
    const occ = createOccupancy();
    const seen = new Set<number>();
    for (let i = 0; i < CELL_COUNT; i++) {
      const cell = findFreeCell(occ)!;
      const idx = cellIndex(cell.cx, cell.cy);
      expect(seen.has(idx)).toBe(false);
      seen.add(idx);
      occ[idx] = 1;
    }
    expect(seen.size).toBe(CELL_COUNT);
  });
});
