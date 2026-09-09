import { Vector3, type Camera } from 'three';

import { PLOT_CELLS } from '@/game/config/map';
import { cellIndex, isInsidePlot } from '@/game/engine/grid';
import type { Engine } from '@/game/engine/engine';
import type { BoxSelect } from '@/game/input/types';
import { useGameStore } from './game-store';

/**
 * Selection operations.
 *
 * Kept out of the components because they need the live camera to project units
 * to screen space, and because the rules (additive, cycle, select-all) are the
 * same on every platform.
 */

const projected = new Vector3();

/** Units whose screen position falls inside the dragged rectangle. */
export function unitsInBox(
  engine: Engine,
  camera: Camera,
  box: BoxSelect,
  viewport: { width: number; height: number }
): number[] {
  const x0 = Math.min(box.x0, box.x1);
  const x1 = Math.max(box.x0, box.x1);
  const y0 = Math.min(box.y0, box.y1);
  const y1 = Math.max(box.y0, box.y1);

  const hits: number[] = [];
  for (const unit of engine.state.units.values()) {
    // Aim at the unit's middle rather than its feet, matching what you clicked.
    projected.set(unit.x, 0.5, unit.z).project(camera);
    if (projected.z > 1) continue; // behind the camera

    const sx = ((projected.x + 1) / 2) * viewport.width;
    const sy = ((1 - projected.y) / 2) * viewport.height;
    if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) hits.push(unit.id);
  }
  return hits;
}

export function applySelection(ids: number[], additive: boolean): void {
  const store = useGameStore.getState();
  if (!additive) {
    store.setSelection(ids);
    return;
  }
  const merged = new Set(store.selection);
  for (const id of ids) merged.add(id);
  store.setSelection([...merged]);
}

/**
 * Ctrl-click / double-click in Warcraft grabs every unit of the same type.
 * Here that means every unit sharing the clicked unit's definition.
 */
export function selectSameType(engine: Engine, unitId: number, additive: boolean): void {
  const clicked = engine.state.units.get(unitId);
  if (!clicked) return;
  const ids = [...engine.state.units.values()]
    .filter((u) => u.owner === clicked.owner && u.defId === clicked.defId)
    .map((u) => u.id);
  applySelection(ids, additive);
}

/** Ctrl+1..9 assigns, 1..9 recalls, Shift+1..9 appends. */
export function assignControlGroup(slot: number): void {
  const store = useGameStore.getState();
  const groups = store.controlGroups.map((g, i) => (i === slot ? [...store.selection] : g));
  useGameStore.setState({ controlGroups: groups });
}

export function recallControlGroup(engine: Engine, slot: number, additive: boolean): void {
  const store = useGameStore.getState();
  // Units die and get combined away, so a group can hold stale ids.
  const ids = (store.controlGroups[slot] ?? []).filter((id) => engine.state.units.has(id));
  if (!ids.length) return;
  applySelection(ids, additive);
}

export function toggleSelection(unitId: number, additive: boolean): void {
  const store = useGameStore.getState();
  if (!additive) {
    store.setSelection([unitId]);
    return;
  }
  const current = store.selection;
  store.setSelection(
    current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId]
  );
}

export function selectAll(engine: Engine, playerId: number): void {
  const ids = [...engine.state.units.values()]
    .filter((u) => u.owner === playerId)
    .map((u) => u.id);
  useGameStore.getState().setSelection(ids);
}

/** Tab: step through the roster, wrapping. */
export function cycleSelection(engine: Engine, playerId: number): void {
  const store = useGameStore.getState();
  const ids = [...engine.state.units.values()]
    .filter((u) => u.owner === playerId)
    .map((u) => u.id)
    .sort((a, b) => a - b);
  if (!ids.length) return;

  const current = store.selection[store.selection.length - 1];
  const index = ids.indexOf(current);
  store.setSelection([ids[(index + 1) % ids.length]]);
}

/**
 * Move every selected unit toward a target cell.
 *
 * The first unit takes the cell that was clicked; the rest fan out into the
 * nearest free cells, so ordering a group somewhere does something sensible
 * instead of silently moving one of them.
 */
export function moveSelection(
  engine: Engine,
  playerId: number,
  target: { cx: number; cy: number }
): void {
  const store = useGameStore.getState();
  const selected = store.selection
    .map((id) => engine.state.units.get(id))
    .filter((u): u is NonNullable<typeof u> => !!u && u.owner === playerId);
  if (!selected.length) return;

  const plot = engine.state.plots.find((p) => p.owner === playerId);
  if (!plot) return;

  // Claim cells greedily around the target, ignoring cells the movers vacate.
  const taken = new Set<number>();
  for (let i = 0; i < plot.occupancy.length; i++) {
    if (plot.occupancy[i] === 1) taken.add(i);
  }
  for (const unit of selected) taken.delete(cellIndex(unit.cell.cx, unit.cell.cy));

  const ordered = [...selected].sort(
    (a, b) => distanceTo(a, target) - distanceTo(b, target)
  );

  for (const unit of ordered) {
    const cell = nearestFreeCell(target, taken);
    if (!cell) break;
    taken.add(cellIndex(cell.cx, cell.cy));
    engine.enqueue({ t: 'MOVE', player: playerId, unitId: unit.id, cell });
  }
  store.setUiMode('idle');
}

function distanceTo(
  unit: { cell: { cx: number; cy: number } },
  target: { cx: number; cy: number }
): number {
  return Math.hypot(unit.cell.cx - target.cx, unit.cell.cy - target.cy);
}

/** Spiral outward from the target until a cell nobody has claimed turns up. */
function nearestFreeCell(
  target: { cx: number; cy: number },
  taken: Set<number>
): { cx: number; cy: number } | null {
  for (let ring = 0; ring < PLOT_CELLS; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const cx = target.cx + dx;
        const cy = target.cy + dy;
        if (!isInsidePlot(cx, cy)) continue;
        if (!taken.has(cellIndex(cx, cy))) return { cx, cy };
      }
    }
  }
  return null;
}
