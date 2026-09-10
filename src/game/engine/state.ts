import {
  MOB_CAPACITY,
  MOB_HP_SCALE,
  MOB_SPEED,
  BOSS_SPEED,
  PREP_SECONDS,
} from '@/game/config/balance';
import type { DifficultyDef } from '@/game/config/difficulty';
import { PLOT_COUNT, plotOrigin } from '@/game/config/map';
import { BOSSES, WAVES, waveFor } from '@/game/data/waves';
import { createOccupancy } from './grid';
import { createLane } from './lane';
import { createMobPool } from './mobs';
import { grantPakkun } from './pakkun';
import { createRng } from './rng';
import type { GameState, MobDef, Plot } from './types';

export interface GameConfig {
  difficulty: DifficultyDef;
  seed: number;
  /**
   * How many of the four islands have a player. v1 is 1; the other three are
   * drawn but stay empty, and co-op only has to raise this.
   */
  playerCount?: number;
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
  const playerCount = config.playerCount ?? 1;
  const { defs, bossOffset } = buildMobDefs(config.difficulty);

  // Every island exists; only the first `playerCount` of them have an owner.
  // An unowned plot has owner -1, which the engine already reads as "skip".
  const plots: Plot[] = [];
  for (let i = 0; i < PLOT_COUNT; i++) {
    plots.push({
      id: i,
      owner: i < playerCount ? i : -1,
      origin: plotOrigin(i),
      lane: createLane(),
      occupancy: createOccupancy(),
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
    players: Array.from({ length: playerCount }, (_, id) => ({
      id,
      gold: 0,
      wood: config.difficulty.startWood,
      pakkun: config.difficulty.startPakkun,
      sMissionUsed: false,
      alive: true,
    })),
    plots,
    mobs: createMobPool(MOB_CAPACITY),
    mobDefs: defs,
    units: new Map(),
    nextUnitId: 1,
    rosterVersion: 0,
    round: {
      number: 0,
      // The run opens holding pakkun and no defense; the setup window is the
      // chance to spend them before anything walks the lane.
      phase: 'prep',
      prepLeft: PREP_SECONDS,
      elapsed: 0,
      duration: 0,
      hardLimit: null,
      spawnQueue: [],
      spawned: 0,
      bossAlive: false,
    },
    aliveOnLane: new Uint16Array(PLOT_COUNT),
    pakkuns: [],
    nextPakkunId: 1,
  };

  for (const player of state.players) grantPakkun(state, player.id, player.pakkun);

  return { state, tables: { mobDefs: defs, bossOffset } };
}

/** Death count for a round: the original tightens it for the final stretch. */
export function deathCountFor(state: GameState, round: number): number {
  return round >= 80 ? state.difficulty.finalDeathCount : state.difficulty.deathCount;
}
