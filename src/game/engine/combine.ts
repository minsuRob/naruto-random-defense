import { RECIPE_BY_ID, type Recipe } from '@/game/data/recipes';
import { addUnit, removeUnit } from './economy';
import type { EngineEvent, GameState } from './types';

/**
 * Unit combination.
 *
 * A recipe consumes whole units and some wood and produces one better unit.
 * Selected units are consumed first, so combining from the combo book never
 * eats a copy the player was deliberately holding elsewhere.
 */

export interface Availability {
  ok: boolean;
  woodOk: boolean;
  missing: { unitId: string; need: number; have: number }[];
}

export function countsFor(state: GameState, playerId: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const unit of state.units.values()) {
    if (unit.owner !== playerId) continue;
    counts[unit.defId] = (counts[unit.defId] ?? 0) + 1;
  }
  return counts;
}

export function availability(
  recipe: Recipe,
  counts: Record<string, number>,
  wood: number
): Availability {
  const missing: Availability['missing'] = [];
  for (const material of recipe.materials) {
    const have = counts[material.unitId] ?? 0;
    if (have < material.count) {
      missing.push({ unitId: material.unitId, need: material.count, have });
    }
  }
  const woodOk = wood >= recipe.wood;
  return { ok: missing.length === 0 && woodOk, woodOk, missing };
}

/** Every recipe the player could complete right now. */
export function findSatisfiable(
  recipes: Recipe[],
  counts: Record<string, number>,
  wood: number
): Recipe[] {
  return recipes.filter((r) => availability(r, counts, wood).ok);
}

export function applyCombine(
  state: GameState,
  playerId: number,
  recipeId: string,
  emit: (event: EngineEvent) => void,
  preferIds?: number[]
): boolean {
  const recipe = RECIPE_BY_ID.get(recipeId);
  if (!recipe) return false;

  const player = state.players[playerId];
  if (!player) return false;

  const counts = countsFor(state, playerId);
  const check = availability(recipe, counts, player.wood);
  if (!check.ok) {
    emit({
      e: 'log',
      text: check.woodOk ? '조합 재료가 부족합니다' : `목재 ${recipe.wood}개가 필요합니다`,
    });
    return false;
  }

  // Pick the actual unit instances to consume: selected ones first.
  const preferred = new Set(preferIds ?? []);
  const consumed: number[] = [];
  let placementCell: { cx: number; cy: number } | undefined;

  for (const material of recipe.materials) {
    const owned = [...state.units.values()].filter(
      (u) => u.owner === playerId && u.defId === material.unitId && !consumed.includes(u.id)
    );
    owned.sort((a, b) => Number(preferred.has(b.id)) - Number(preferred.has(a.id)));
    for (let i = 0; i < material.count; i++) {
      const unit = owned[i];
      if (!unit) return false;
      if (!placementCell) placementCell = unit.cell;
      consumed.push(unit.id);
    }
  }

  for (const unitId of consumed) removeUnit(state, unitId, emit);
  player.wood -= recipe.wood;

  const created = addUnit(state, playerId, recipe.resultId, 'combine', emit, placementCell);
  if (created) emit({ e: 'log', text: `${recipe.resultNameKo} 조합 성공` });
  return created !== null;
}
