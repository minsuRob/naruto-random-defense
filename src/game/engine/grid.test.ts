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

  it('fills outward from the centre', () => {
    const occ = createOccupancy();
    const mid = Math.floor(PLOT_CELLS / 2);
    const first = findFreeCell(occ);
    expect(first).toEqual({ cx: mid, cy: mid });

    // Claiming the centre pushes the next pick onto the surrounding ring.
    occ[cellIndex(mid, mid)] = 1;
    const second = findFreeCell(occ)!;
    expect(Math.max(Math.abs(second.cx - mid), Math.abs(second.cy - mid))).toBe(1);
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
