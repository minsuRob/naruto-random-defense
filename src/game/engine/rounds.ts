import {
  HARD_LIMIT_ROUNDS,
  HARD_LIMIT_SECONDS,
  MOBS_PER_WAVE,
  SPAWN_INTERVAL,
  roundDuration,
} from '@/game/config/balance';
import { FINAL_ROUND, bossFor } from '@/game/data/waves';
import type { GameState, SpawnEntry } from './types';
import type { GameTables } from './state';

/**
 * Round scheduler.
 *
 * Line rounds run on a timer; the boss rounds (endings 0 and 3) add a boss at
 * the west or east gate on top of the line, and rounds 80 and 85 replace the
 * timer with a hard limit that must be cleared by killing the boss.
 */

export function buildSpawnQueue(state: GameState, tables: GameTables, round: number): SpawnEntry[] {
  const queue: SpawnEntry[] = [];
  const waveDefIndex = Math.min(round, tables.bossOffset) - 1;

  for (const plot of state.plots) {
    for (let i = 0; i < MOBS_PER_WAVE; i++) {
      queue.push({
        at: i * SPAWN_INTERVAL,
        defIndex: waveDefIndex,
        plot: plot.id,
        s: plot.lane.spawnS,
      });
    }

    const boss = bossFor(round);
    if (boss) {
      const bossIndex = tables.mobDefs.findIndex(
        (d, i) => i >= tables.bossOffset && d.nameKo === boss.boss.nameKo
      );
      queue.push({
        at: 2,
        defIndex: bossIndex >= 0 ? bossIndex : tables.bossOffset,
        plot: plot.id,
        s: boss.gate === 'west' ? plot.lane.leftBossS : plot.lane.rightBossS,
      });
    }
  }

  queue.sort((a, b) => a.at - b.at);
  return queue;
}

export function startRound(state: GameState, tables: GameTables, round: number): void {
  state.round = {
    number: round,
    phase: 'wave',
    elapsed: 0,
    duration: roundDuration(round),
    hardLimit: HARD_LIMIT_ROUNDS.has(round) ? HARD_LIMIT_SECONDS : null,
    spawnQueue: buildSpawnQueue(state, tables, round),
    spawned: 0,
    bossAlive: bossFor(round) !== null,
  };
}

/** True when the round's clock has run out. */
export function roundTimeUp(state: GameState): boolean {
  const { round } = state;
  const limit = round.hardLimit ?? round.duration;
  return round.elapsed >= limit;
}

export function isFinalRound(round: number): boolean {
  return round >= FINAL_ROUND;
}
