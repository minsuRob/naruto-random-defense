import {
  BOSS_BOUNTY_GOLD,
  BOSS_BOUNTY_WOOD,
  TICK_DT,
  killBounty,
} from '@/game/config/balance';
import { updateAuras, updateCombat, updateTargeting } from './combat';
import {
  addUnit,
  dispatchPakkun,
  gamble,
  hire,
  moveUnit,
  resolveAltar,
  rollMission,
  sell,
  updateUnitWalks,
} from './economy';
import { grantPakkun, updatePakkuns } from './pakkun';
import { applyCombine } from './combine';
import { despawnMob, spawnMob } from './mobs';
import { isFinalRound, roundTimeUp, startRound } from './rounds';
import { createInitialState, deathCountFor, type GameConfig, type GameTables } from './state';
import type { Command, EngineEvent, GameState } from './types';

/**
 * The simulation.
 *
 * Fixed 20 Hz step, every random draw through state.rng, so a run replays
 * exactly from its seed. Nothing here imports React, three or react-native.
 */

export interface Engine {
  readonly state: GameState;
  readonly tables: GameTables;
  enqueue(command: Command): void;
  /** Advance one fixed step. */
  tick(): void;
  /** Take the events produced since the last drain. */
  drainEvents(): EngineEvent[];
}

/**
 * End the setup window immediately, for callers that only care about the
 * defense. Used by the tests and the balance harness; a real run spends the
 * window sending pakkun to the altars.
 *
 * Deliberately stops before round 1 begins: it starts on the caller's next
 * tick, so nothing has spawned yet and the board can still be set up.
 */
export function skipPrep(engine: Engine): void {
  engine.state.round.prepLeft = 0;
}

export function createEngine(config: GameConfig): Engine {
  const { state, tables } = createInitialState(config);
  const commands: Command[] = [];
  let events: EngineEvent[] = [];

  const emit = (event: EngineEvent) => events.push(event);

  // The original opens by announcing what the chosen difficulty handed you.
  // Queued here so the first HUD flush carries it into the log.
  emit({
    e: 'log',
    text:
      `${config.difficulty.nameKo} 초기 지급 — 파쿤 ${config.difficulty.startPakkun}개, ` +
      `목재 ${config.difficulty.startWood}개`,
  });

  /**
   * All queued commands apply at the top of a tick, in the order they arrived,
   * so the simulation stays deterministic no matter when the UI enqueued them.
   */
  function applyCommands() {
    for (const command of commands) {
      switch (command.t) {
        case 'PAKKUN_DOWN':
          dispatchPakkun(state, command.player, 'normal', emit);
          break;
        case 'PAKKUN_UP':
          dispatchPakkun(state, command.player, 'magic', emit);
          break;
        case 'PAKKUN_GOLD':
          dispatchPakkun(state, command.player, 'gold', emit);
          break;
        case 'PAKKUN_WOOD':
          dispatchPakkun(state, command.player, 'wood', emit);
          break;
        case 'PAKKUN_SEND':
          dispatchPakkun(state, command.player, command.altar, emit, command.tokenId);
          break;
        case 'GAMBLE':
          gamble(state, command.player, command.tier, emit);
          break;
        case 'HIRE':
          hire(state, command.player, command.grade, emit);
          break;
        case 'SELL':
          sell(state, command.player, command.unitIds, emit);
          break;
        case 'MOVE':
          moveUnit(state, command.unitId, command.cell);
          break;
        case 'COMBINE':
          applyCombine(state, command.player, command.recipeId, emit, command.preferIds);
          break;
      }
    }
    commands.length = 0;
  }

  function advanceRound(dt: number) {
    const round = state.round;
    if (round.phase === 'prep') {
      // The setup window runs down before anything spawns, so the opening
      // pakkun can actually be walked to an altar and turned into a defense.
      round.prepLeft -= dt;
      if (round.prepLeft > 0) return;
      startRound(state, tables, 1);
      emit({ e: 'roundStart', round: 1 });
      return;
    }
    if (round.phase !== 'wave') return;
    round.elapsed += dt;
  }

  function flushSpawns() {
    const round = state.round;
    while (
      round.spawned < round.spawnQueue.length &&
      round.spawnQueue[round.spawned].at <= round.elapsed
    ) {
      const entry = round.spawnQueue[round.spawned++];
      const def = tables.mobDefs[entry.defIndex];
      if (!def) continue;
      const index = spawnMob(state.mobs, entry.defIndex, def, entry.plot, entry.s);
      if (index >= 0) state.aliveOnLane[entry.plot]++;
    }
  }

  function updateStatus() {
    const mobs = state.mobs;
    for (let i = 0; i < mobs.count; i++) {
      if (!mobs.active[i]) continue;
      if (mobs.slowUntil[i] && mobs.slowUntil[i] <= state.time) {
        mobs.slowUntil[i] = 0;
        mobs.slowMul[i] = 1;
      }
      if (mobs.armorReduceUntil[i] && mobs.armorReduceUntil[i] <= state.time) {
        mobs.armorReduceUntil[i] = 0;
        mobs.armorReduce[i] = 0;
        mobs.armorReduceStacks[i] = 0;
      }
    }
  }

  function updateMovement(dt: number) {
    const mobs = state.mobs;
    for (let i = 0; i < mobs.count; i++) {
      if (!mobs.active[i]) continue;
      const plot = state.plots[mobs.plot[i]];
      const lane = plot.lane;

      mobs.sPrev[i] = mobs.s[i];
      if (mobs.stunUntil[i] > state.time) {
        // Stunned mobs hold position; still refresh world coords for renderers.
        const p = lane.positionAt(mobs.s[i]);
        mobs.x[i] = p.x + plot.origin.x;
        mobs.z[i] = p.z + plot.origin.z;
        continue;
      }

      let s = mobs.s[i] + mobs.speed[i] * mobs.slowMul[i] * dt;
      if (s >= lane.length) {
        s -= lane.length;
        mobs.lap[i]++;
      }
      mobs.s[i] = s;

      const p = lane.positionAt(s);
      mobs.x[i] = p.x + plot.origin.x;
      mobs.z[i] = p.z + plot.origin.z;
    }
  }

  function updateDeaths() {
    const mobs = state.mobs;
    for (let i = 0; i < mobs.count; i++) {
      if (!mobs.active[i] || mobs.hp[i] > 0) continue;

      const boss = mobs.isBoss[i] === 1;
      const owner = state.players[state.plots[mobs.plot[i]].owner];
      if (owner) {
        if (boss) {
          owner.gold += BOSS_BOUNTY_GOLD;
          owner.wood += BOSS_BOUNTY_WOOD;
        } else {
          owner.gold += Math.round(
            killBounty(state.round.number) * state.difficulty.goldMult
          );
        }
      }
      if (boss) state.round.bossAlive = false;

      emit({ e: 'mobDie', index: i, x: mobs.x[i], z: mobs.z[i], boss });
      state.aliveOnLane[mobs.plot[i]]--;
      despawnMob(mobs, i);
    }
  }

  function checkDeathCount() {
    const limit = deathCountFor(state, state.round.number);
    for (const plot of state.plots) {
      const player = state.players[plot.owner];
      if (!player?.alive) continue;
      if (state.aliveOnLane[plot.id] > limit) {
        player.alive = false;
        emit({
          e: 'log',
          text: `라인에 몹이 ${state.aliveOnLane[plot.id]}마리 — 데스카운트 ${limit} 초과`,
        });
      }
    }
    if (state.players.every((p) => !p.alive)) endGame('lose');
  }

  function endGame(outcome: 'win' | 'lose') {
    if (state.over) return;
    state.over = true;
    state.outcome = outcome;
    state.round.phase = 'ended';
    emit({ e: 'gameOver', outcome });
  }

  function checkRoundEnd() {
    const round = state.round;
    if (round.phase !== 'wave') return;

    if (round.hardLimit !== null) {
      // Timed boss round: clear it by killing the boss, lose when time runs out.
      if (!round.bossAlive && round.spawned >= round.spawnQueue.length) {
        finishRound();
      } else if (roundTimeUp(state)) {
        emit({ e: 'log', text: `${round.number}라운드 제한시간 초과` });
        endGame('lose');
      }
      return;
    }

    if (roundTimeUp(state)) finishRound();
  }

  function finishRound() {
    const finished = state.round.number;
    emit({ e: 'roundEnd', round: finished });

    for (const player of state.players) {
      if (!player.alive) continue;
      const granted = state.difficulty.pakkunPerRound;
      grantPakkun(state, player.id, granted);
      player.pakkun += granted;
    }

    rollMission(state, finished, emit);

    if (isFinalRound(finished)) {
      endGame('win');
      return;
    }
    startRound(state, tables, finished + 1);
    emit({ e: 'roundStart', round: finished + 1 });
  }

  function tick() {
    if (state.over) return;
    const dt = TICK_DT;

    applyCommands();
    advanceRound(dt);
    flushSpawns();
    updateStatus();
    updateMovement(dt);
    updateUnitWalks(state, dt);
    updatePakkuns(state, dt, resolveAltar.bind(null, state), emit);
    updateAuras(state);
    updateTargeting(state);
    updateCombat(state, dt, emit);
    updateDeaths();
    checkDeathCount();
    checkRoundEnd();

    state.tick++;
    state.time += dt;
  }

  return {
    state,
    tables,
    enqueue(command) {
      commands.push(command);
    },
    tick,
    drainEvents() {
      const out = events;
      events = [];
      return out;
    },
  };
}
