import {
  MOB_CAPACITY,
  MOB_HP_SCALE,
  MOB_SPEED,
  BOSS_SPEED,
  START_PAKKUN,
} from '@/game/config/balance';
import type { DifficultyDef } from '@/game/config/difficulty';
import { ALTARS, plotOrigin } from '@/game/config/map';
import { BOSSES, WAVES, waveFor } from '@/game/data/waves';
import { createDraft } from './draft';
import { cellIndex, createOccupancy } from './grid';
import { createLane } from './lane';
import { createMobPool } from './mobs';
import { grantPakkun } from './pakkun';
import { createRng } from './rng';
import type { GameState, MobDef, Plot } from './types';

export interface GameConfig {
  difficulty: DifficultyDef;
  seed: number;
  /** v1 renders one plot; the engine is written for several. */
  plotCount?: number;
}

/**
 * Build the mob definition table once per run, with difficulty scaling folded
 * in. Wave `n` lives at index `n - 1`; bosses follow at BOSS_OFFSET.
 */
function buildMobDefs(difficulty: DifficultyDef): { defs: MobDef[]; bossOffset: number } {
  const defs: MobDef[] = [];
  const maxRound = WAVES.reduce((max, w) => Math.max(max, w.round), 0);

  for (let round = 1; round <= maxRound; round++) {
    const wave = waveFor(round);
    defs.push({
      id: `wave_${round}`,
      nameKo: wave.nameKo,
      hp: wave.hp * MOB_HP_SCALE * difficulty.hpMult,
      armor: wave.armor,
      damageType: 'phys',
      speed: MOB_SPEED,
      scale: wave.scale,
      isBoss: false,
      bounty: 0,
    });
  }

  const bossOffset = defs.length;
  for (const boss of BOSSES) {
    defs.push({
      id: `boss_${boss.slot}_${boss.w3uId}`,
      nameKo: boss.nameKo,
      hp: boss.hp * MOB_HP_SCALE * difficulty.hpMult,
      armor: boss.armor,
      damageType: 'phys',
      speed: BOSS_SPEED,
      scale: boss.scale,
      isBoss: true,
      bounty: 0,
    });
  }

  return { defs, bossOffset };
}

export interface GameTables {
  mobDefs: MobDef[];
  bossOffset: number;
}

export function createInitialState(config: GameConfig): { state: GameState; tables: GameTables } {
  const plotCount = config.plotCount ?? 1;
  const { defs, bossOffset } = buildMobDefs(config.difficulty);

  const plots: Plot[] = [];
  for (let i = 0; i < plotCount; i++) {
    const occupancy = createOccupancy();
    // The altars stand on the centre cells, so nothing can be built there.
    for (const altar of ALTARS) occupancy[cellIndex(altar.cell.cx, altar.cell.cy)] = 1;
    plots.push({
      id: i,
      owner: i,
      origin: plotOrigin(i),
      lane: createLane(),
      occupancy,
    });
  }

  const rng = createRng(config.seed);
  const state: GameState = {
    tick: 0,
    time: 0,
    seed: config.seed,
    rng,
    difficulty: config.difficulty,
    over: false,
    outcome: null,
    players: plots.map((p) => ({
      id: p.owner,
      gold: 0,
      wood: 0,
      pakkun: START_PAKKUN,
      sMissionUsed: false,
      alive: true,
    })),
    plots,
    mobs: createMobPool(MOB_CAPACITY),
    mobDefs: defs,
    units: new Map(),
    nextUnitId: 1,
    rosterVersion: 0,
    // The opening draft runs before any wave; rounds only start once it is done.
    draft: createDraft(rng),
    round: {
      number: 0,
      phase: 'draft',
      elapsed: 0,
      duration: 0,
      hardLimit: null,
      spawnQueue: [],
      spawned: 0,
      bossAlive: false,
    },
    aliveOnLane: new Uint16Array(plotCount),
    pakkuns: [],
    nextPakkunId: 1,
  };

  for (const player of state.players) grantPakkun(state, player.id, START_PAKKUN);

  return { state, tables: { mobDefs: defs, bossOffset } };
}

/** Death count for a round: the original tightens it for the final stretch. */
export function deathCountFor(state: GameState, round: number): number {
  return round >= 80 ? state.difficulty.finalDeathCount : state.difficulty.deathCount;
}
