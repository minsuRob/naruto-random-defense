import {
  GAMBLE_COST,
  HIRE_COST,
  MISSION_INTERVAL,
  MISSION_TABLE,
  PAKKUN_GOLD,
  PAKKUN_WOOD_CHANCE,
  SELL_REFUND,
} from '@/game/config/balance';
import { UNITS, type Grade } from '@/game/data/units';
import { cellIndex, cellToLocal, findFreeCell } from './grid';
import type { EngineEvent, GameState, UnitInstance } from './types';

/**
 * Pakkun, wood, gambling, hiring and selling — the original's economy.
 *
 * Pakkun is the per-round currency: seven at the start, two more each round.
 * Wood is the premium one, and it is what the combination recipes cost.
 */

/** Gacha pools, built once from the unit table. */
const POOLS: Record<string, string[]> = {};
for (const grade of ['normal', 'magic', 'rare', 'unique', 'special'] as Grade[]) {
  POOLS[grade] = UNITS.filter((u) => u.grade === grade).map((u) => u.id);
}

export type GachaSource = 'gacha' | 'hire' | 'combine';

/** Place a unit on the owner's plot, or fail when the plot is full. */
export function addUnit(
  state: GameState,
  playerId: number,
  defId: string,
  via: GachaSource,
  emit: (event: EngineEvent) => void,
  atCell?: { cx: number; cy: number }
): UnitInstance | null {
  const plot = state.plots.find((p) => p.owner === playerId);
  if (!plot) return null;

  const cell =
    atCell && plot.occupancy[cellIndex(atCell.cx, atCell.cy)] === 0
      ? atCell
      : findFreeCell(plot.occupancy);
  if (!cell) {
    emit({ e: 'log', text: '자리가 없습니다' });
    return null;
  }

  const local = cellToLocal(cell.cx, cell.cy);
  const unit: UnitInstance = {
    id: state.nextUnitId++,
    defId,
    owner: playerId,
    plot: plot.id,
    cell,
    x: local.x + plot.origin.x,
    z: local.z + plot.origin.z,
    cooldown: 0,
    targetMob: -1,
    buffAtkSpeedPct: 0,
    buffAtkPct: 0,
  };
  plot.occupancy[cellIndex(cell.cx, cell.cy)] = 1;
  state.units.set(unit.id, unit);
  state.rosterVersion++;
  emit({ e: 'unitAdd', unitId: unit.id, defId, via });
  return unit;
}

export function removeUnit(
  state: GameState,
  unitId: number,
  emit: (event: EngineEvent) => void
): boolean {
  const unit = state.units.get(unitId);
  if (!unit) return false;
  const plot = state.plots[unit.plot];
  plot.occupancy[cellIndex(unit.cell.cx, unit.cell.cy)] = 0;
  state.units.delete(unitId);
  state.rosterVersion++;
  emit({ e: 'unitRemove', unitId, defId: unit.defId });
  return true;
}

export function moveUnit(
  state: GameState,
  unitId: number,
  cell: { cx: number; cy: number }
): boolean {
  const unit = state.units.get(unitId);
  if (!unit) return false;
  const plot = state.plots[unit.plot];
  const target = cellIndex(cell.cx, cell.cy);
  if (plot.occupancy[target] === 1) return false;

  plot.occupancy[cellIndex(unit.cell.cx, unit.cell.cy)] = 0;
  plot.occupancy[target] = 1;
  unit.cell = cell;
  const local = cellToLocal(cell.cx, cell.cy);
  unit.x = local.x + plot.origin.x;
  unit.z = local.z + plot.origin.z;
  unit.targetMob = -1;
  state.rosterVersion++;
  return true;
}

function drawFrom(state: GameState, grades: { grade: Grade; weight: number }[]): string | null {
  const available = grades.filter((g) => POOLS[g.grade]?.length);
  if (!available.length) return null;
  const chosen = state.rng.weighted(available, (g) => g.weight);
  const pool = POOLS[chosen.grade];
  return pool[state.rng.int(pool.length)];
}

/** 파쿤을 아래로: 노말 유닛 하나. */
export function pakkunDown(
  state: GameState,
  playerId: number,
  emit: (event: EngineEvent) => void
): boolean {
  const player = state.players[playerId];
  if (!player || player.pakkun < 1) {
    emit({ e: 'log', text: '파쿤이 부족합니다' });
    return false;
  }
  const defId = drawFrom(state, [{ grade: 'normal', weight: 1 }]);
  if (!defId) return false;
  player.pakkun--;
  return addUnit(state, playerId, defId, 'gacha', emit) !== null;
}

/** 파쿤을 위로: 노말 70% / 매직 30%. */
export function pakkunUp(
  state: GameState,
  playerId: number,
  emit: (event: EngineEvent) => void
): boolean {
  const player = state.players[playerId];
  if (!player || player.pakkun < 1) {
    emit({ e: 'log', text: '파쿤이 부족합니다' });
    return false;
  }
  const defId = drawFrom(state, [
    { grade: 'normal', weight: 0.7 },
    { grade: 'magic', weight: 0.3 },
  ]);
  if (!defId) return false;
  player.pakkun--;
  return addUnit(state, playerId, defId, 'gacha', emit) !== null;
}

export function pakkunGold(
  state: GameState,
  playerId: number,
  emit: (event: EngineEvent) => void
): boolean {
  const player = state.players[playerId];
  if (!player || player.pakkun < 1) {
    emit({ e: 'log', text: '파쿤이 부족합니다' });
    return false;
  }
  player.pakkun--;
  player.gold += PAKKUN_GOLD;
  return true;
}

/** 파쿤을 나무로: 60% 확률로 1개. */
export function pakkunWood(
  state: GameState,
  playerId: number,
  emit: (event: EngineEvent) => void
): boolean {
  const player = state.players[playerId];
  if (!player || player.pakkun < 1) {
    emit({ e: 'log', text: '파쿤이 부족합니다' });
    return false;
  }
  player.pakkun--;
  if (state.rng.chance(PAKKUN_WOOD_CHANCE)) {
    player.wood++;
    return true;
  }
  emit({ e: 'log', text: '목재 획득 실패' });
  return false;
}

/** 목재 도박: 1개는 노말·매직, 3개는 레어, 5개는 유니크·스페셜. */
export function gamble(
  state: GameState,
  playerId: number,
  tier: 1 | 3 | 5,
  emit: (event: EngineEvent) => void
): boolean {
  const player = state.players[playerId];
  const cost = GAMBLE_COST[tier];
  if (!player || player.wood < cost) {
    emit({ e: 'log', text: `목재가 부족합니다 (${cost} 필요)` });
    return false;
  }

  const table: Record<1 | 3 | 5, { grade: Grade; weight: number }[]> = {
    1: [
      { grade: 'normal', weight: 0.6 },
      { grade: 'magic', weight: 0.4 },
    ],
    3: [{ grade: 'rare', weight: 1 }],
    5: [
      { grade: 'unique', weight: 0.7 },
      { grade: 'special', weight: 0.3 },
    ],
  };
  const defId = drawFrom(state, table[tier]);
  if (!defId) return false;

  player.wood -= cost;
  return addUnit(state, playerId, defId, 'gacha', emit) !== null;
}

/** 용병 고용: 노말 200골드 + 목재 1, 매직 250골드 + 목재 1. */
export function hire(
  state: GameState,
  playerId: number,
  grade: 'normal' | 'magic',
  emit: (event: EngineEvent) => void
): boolean {
  const player = state.players[playerId];
  const cost = HIRE_COST[grade];
  if (!player || player.gold < cost.gold || player.wood < cost.wood) {
    emit({ e: 'log', text: `골드 ${cost.gold} · 목재 ${cost.wood} 필요` });
    return false;
  }
  const defId = drawFrom(state, [{ grade, weight: 1 }]);
  if (!defId) return false;

  player.gold -= cost.gold;
  player.wood -= cost.wood;
  return addUnit(state, playerId, defId, 'hire', emit) !== null;
}

export function sell(
  state: GameState,
  playerId: number,
  unitIds: number[],
  emit: (event: EngineEvent) => void
): number {
  const player = state.players[playerId];
  if (!player) return 0;

  let sold = 0;
  for (const unitId of unitIds) {
    const unit = state.units.get(unitId);
    if (!unit || unit.owner !== playerId) continue;
    const grade = UNITS.find((u) => u.id === unit.defId)?.grade;
    const refund = grade ? SELL_REFUND[grade] : undefined;
    if (refund?.gold) player.gold += refund.gold;
    if (refund?.wood) player.wood += refund.wood;
    if (removeUnit(state, unitId, emit)) sold++;
  }
  return sold;
}

/** 5라운드마다 랭크 임무. S는 게임당 한 번만 나온다. */
export function rollMission(
  state: GameState,
  round: number,
  emit: (event: EngineEvent) => void
): void {
  if (round % MISSION_INTERVAL !== 0) return;

  for (const player of state.players) {
    if (!player.alive) continue;
    const roll = state.rng.next();
    let cumulative = 0;
    for (const entry of MISSION_TABLE) {
      // The S slot folds into A once it has been used this game.
      const usable = !entry.oncePerGame || !player.sMissionUsed;
      cumulative += entry.chance;
      if (roll < cumulative) {
        const granted = usable ? entry : MISSION_TABLE[1];
        if (granted.oncePerGame) player.sMissionUsed = true;
        player.wood += granted.wood;
        emit({ e: 'mission', rank: granted.rank, wood: granted.wood });
        break;
      }
    }
  }
}
