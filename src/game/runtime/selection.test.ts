import { beforeEach, describe, expect, it } from 'vitest';

import { DIFFICULTIES } from '@/game/config/difficulty';
import { PLOT_CELLS } from '@/game/config/map';
import { UNIT_BY_ID } from '@/game/data/units';
import { addUnit } from '@/game/engine/economy';
import { createEngine, type Engine } from '@/game/engine/engine';
import { cellIndex } from '@/game/engine/grid';
import { useGameStore } from './game-store';
import {
  applySelection,
  cycleSelection,
  moveSelection,
  selectAll,
  toggleSelection,
} from './selection';

/**
 * Selection and group movement.
 *
 * The box-select projection needs a live camera and is checked in the browser;
 * everything below is the platform-neutral half, which is where the rules that
 * can quietly go wrong live.
 */

const PLAYER = 0;

function seed(engine: Engine, count: number) {
  const defId = [...UNIT_BY_ID.keys()][0];
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const unit = addUnit(engine.state, PLAYER, defId, 'gacha', () => {});
    if (unit) ids.push(unit.id);
  }
  return ids;
}

function newEngine() {
  return createEngine({ difficulty: DIFFICULTIES.easy, seed: 1 });
}

beforeEach(() => {
  useGameStore.getState().reset();
});

describe('selecting', () => {
  it('replaces the selection on a plain click and toggles with shift', () => {
    toggleSelection(1, false);
    expect(useGameStore.getState().selection).toEqual([1]);

    toggleSelection(2, false);
    expect(useGameStore.getState().selection).toEqual([2]);

    toggleSelection(3, true);
    expect(useGameStore.getState().selection).toEqual([2, 3]);

    // Shift-clicking something already selected removes it, as in Warcraft.
    toggleSelection(2, true);
    expect(useGameStore.getState().selection).toEqual([3]);
  });

  it('merges a box selection when additive, replaces it otherwise', () => {
    applySelection([1, 2], false);
    applySelection([2, 3], true);
    expect(useGameStore.getState().selection.sort()).toEqual([1, 2, 3]);

    applySelection([9], false);
    expect(useGameStore.getState().selection).toEqual([9]);
  });

  it('selects the whole roster', () => {
    const engine = newEngine();
    const ids = seed(engine, 5);
    selectAll(engine, PLAYER);
    expect(useGameStore.getState().selection.sort((a, b) => a - b)).toEqual(ids);
  });

  it('cycles through the roster and wraps', () => {
    const engine = newEngine();
    const ids = seed(engine, 3);

    cycleSelection(engine, PLAYER);
    expect(useGameStore.getState().selection).toEqual([ids[0]]);
    cycleSelection(engine, PLAYER);
    expect(useGameStore.getState().selection).toEqual([ids[1]]);
    cycleSelection(engine, PLAYER);
    expect(useGameStore.getState().selection).toEqual([ids[2]]);
    cycleSelection(engine, PLAYER);
    expect(useGameStore.getState().selection).toEqual([ids[0]]);
  });

  it('does nothing when there is no roster to cycle', () => {
    const engine = newEngine();
    cycleSelection(engine, PLAYER);
    expect(useGameStore.getState().selection).toEqual([]);
  });
});

describe('group movement', () => {
  it('puts the first unit on the clicked cell and fans the rest out', () => {
    const engine = newEngine();
    const ids = seed(engine, 4);
    applySelection(ids, false);

    const target = { cx: 5, cy: 5 };
    moveSelection(engine, PLAYER, target);
    engine.tick();

    const cells = ids.map((id) => engine.state.units.get(id)!.cell);
    expect(cells).toContainEqual(target);

    // Everyone landed somewhere distinct and close to the target.
    const keys = new Set(cells.map((c) => cellIndex(c.cx, c.cy)));
    expect(keys.size).toBe(ids.length);
    for (const cell of cells) {
      expect(Math.max(Math.abs(cell.cx - target.cx), Math.abs(cell.cy - target.cy))).toBeLessThan(3);
    }
  });

  it('leaves the plot occupancy consistent with where units actually are', () => {
    const engine = newEngine();
    const ids = seed(engine, 6);
    applySelection(ids, false);
    moveSelection(engine, PLAYER, { cx: 2, cy: 7 });
    engine.tick();

    const occupancy = engine.state.plots[0].occupancy;
    let occupied = 0;
    for (let i = 0; i < occupancy.length; i++) if (occupancy[i] === 1) occupied++;
    expect(occupied).toBe(ids.length);

    for (const id of ids) {
      const unit = engine.state.units.get(id)!;
      expect(occupancy[cellIndex(unit.cell.cx, unit.cell.cy)]).toBe(1);
    }
  });

  it('clears move mode once the order is issued', () => {
    const engine = newEngine();
    const ids = seed(engine, 1);
    applySelection(ids, false);
    useGameStore.getState().setUiMode('move');

    moveSelection(engine, PLAYER, { cx: 4, cy: 4 });
    expect(useGameStore.getState().uiMode).toBe('idle');
  });

  it('does nothing without a selection', () => {
    const engine = newEngine();
    seed(engine, 2);
    moveSelection(engine, PLAYER, { cx: 4, cy: 4 });
    engine.tick();

    for (const unit of engine.state.units.values()) {
      expect(unit.cell.cx === 4 && unit.cell.cy === 4).toBe(false);
    }
  });

  it('handles a full plot without losing anyone', () => {
    const engine = newEngine();
    const ids = seed(engine, PLOT_CELLS * PLOT_CELLS);
    applySelection(ids, false);
    moveSelection(engine, PLAYER, { cx: 0, cy: 0 });
    engine.tick();

    expect(engine.state.units.size).toBe(ids.length);
  });
});
