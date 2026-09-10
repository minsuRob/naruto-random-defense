import { describe, expect, it } from 'vitest';

import { PLOT_CELLS, PLOT_COUNT, PLOT_HALF, plotOrigin } from '@/game/config/map';
import {
  CELL_COUNT,
  cellIndex,
  cellToLocal,
  cellToWorld,
  createOccupancy,
  findFreeCell,
  localToCell,
  worldToCell,
} from './grid';

describe('grid', () => {
  it('maps cells to their centres', () => {
    expect(cellToLocal(0, 0)).toEqual({ x: -PLOT_HALF + 0.5, z: -PLOT_HALF + 0.5 });
    const last = cellToLocal(PLOT_CELLS - 1, PLOT_CELLS - 1);
    expect(last.x).toBeCloseTo(PLOT_HALF - 0.5, 10);
    expect(last.z).toBeCloseTo(PLOT_HALF - 0.5, 10);
  });

  it('round-trips every cell through plot-local space', () => {
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

/**
 * The bridge between world picking and the plot-local grid.
 *
 * Every click in the game goes through this pair. The plot-local round trip
 * above would keep passing even if every one of those clicks landed on the
 * wrong island — only an off-origin plot exposes a missing `- origin`.
 */
describe('world <-> cell', () => {
  it('round-trips every cell of every island', () => {
    for (let plot = 0; plot < PLOT_COUNT; plot++) {
      const origin = plotOrigin(plot);
      for (let cy = 0; cy < PLOT_CELLS; cy++) {
        for (let cx = 0; cx < PLOT_CELLS; cx++) {
          const p = cellToWorld(origin, cx, cy);
          expect(worldToCell(origin, p.x, p.z)).toEqual({ cx, cy });
        }
      }
    }
  });

  it('claims nothing outside its own island', () => {
    const mine = plotOrigin(0);
    // The plaza belongs to no island.
    expect(worldToCell(mine, 0, 0)).toBeNull();
    // Nor does anyone else's ground.
    for (let other = 1; other < PLOT_COUNT; other++) {
      const theirs = plotOrigin(other);
      expect(worldToCell(mine, theirs.x, theirs.z)).toBeNull();
      expect(worldToCell(theirs, mine.x, mine.z)).toBeNull();
    }
  });

  it('is the identity on a plot at the origin', () => {
    // Which is exactly why the old world-as-local calls looked correct.
    const origin = { x: 0, z: 0 };
    expect(cellToWorld(origin, 3, 7)).toEqual(cellToLocal(3, 7));
  });
});
