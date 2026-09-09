import { describe, expect, it } from 'vitest';

import { TICK_RATE } from '@/game/config/balance';
import { DIFFICULTIES, type DifficultyId } from '@/game/config/difficulty';
import { RECIPES } from '@/game/data/recipes';
import { availability, countsFor } from './combine';
import { completeDraft, createEngine, type Engine } from './engine';

/**
 * Balance smoke test: play the game the way a person would and see how far it
 * goes.
 *
 * Not a unit test of any one rule — it is the check that the pieces add up to a
 * game. A run that dies on round 3 or one that never dies both mean the numbers
 * are wrong, and neither shows up in the rule-level tests.
 *
 * Measured across six seeds: 이지 47-57, 하드 41-53, 헬 35-41.
 */

/** Spend everything available each round, and combine whatever is completable. */
function playRound(engine: Engine) {
  const player = engine.state.players[0];

  // Pakkun: keep a couple back for wood, spend the rest on units. Commands are
  // applied at the top of the next tick, so the counter cannot be read back in
  // this loop — the number to enqueue has to be decided up front.
  const pakkun = player.pakkun;
  const forUnits = Math.max(0, pakkun - 2);
  for (let i = 0; i < forUnits; i++) engine.enqueue({ t: 'PAKKUN_UP', player: 0 });
  for (let i = 0; i < pakkun - forUnits; i++) engine.enqueue({ t: 'PAKKUN_WOOD', player: 0 });

  // Wood: take the best gamble affordable.
  if (player.wood >= 5) engine.enqueue({ t: 'GAMBLE', player: 0, tier: 5 });
  else if (player.wood >= 3) engine.enqueue({ t: 'GAMBLE', player: 0, tier: 3 });

  const counts = countsFor(engine.state, 0);
  for (const recipe of RECIPES) {
    if (availability(recipe, counts, player.wood).ok) {
      engine.enqueue({ t: 'COMBINE', player: 0, recipeId: recipe.id });
      break;
    }
  }
}

function playUntilOver(difficultyId: DifficultyId, seed: number, maxRounds = 40) {
  const engine = createEngine({ difficulty: DIFFICULTIES[difficultyId], seed });
  completeDraft(engine);
  let lastRound = 0;
  const maxTicks = TICK_RATE * 60 * 60; // an hour of game time is plenty

  for (let tick = 0; tick < maxTicks && !engine.state.over; tick++) {
    if (engine.state.round.number !== lastRound) {
      lastRound = engine.state.round.number;
      playRound(engine);
      if (lastRound > maxRounds) break;
    }
    engine.tick();
    engine.drainEvents();
  }
  return engine;
}

describe('playthrough', () => {
  it('a player who spends every round gets past the early rounds on easy', () => {
    const engine = playUntilOver('easy', 1);
    expect(engine.state.round.number).toBeGreaterThan(5);
    expect(engine.state.units.size).toBeGreaterThan(0);
  });

  it('doing nothing loses, and playing well survives longer', () => {
    const idle = createEngine({ difficulty: DIFFICULTIES.easy, seed: 5 });
    completeDraft(idle);
    // Sell the draft picks: this is the do-nothing baseline.
    idle.state.units.clear();
    idle.state.plots[0].occupancy.fill(0);
    for (let i = 0; i < TICK_RATE * 60 * 30 && !idle.state.over; i++) idle.tick();
    expect(idle.state.over).toBe(true);

    const played = playUntilOver('easy', 5);
    expect(played.state.round.number).toBeGreaterThan(idle.state.round.number);
  });

  it('hell is harder than easy for the same player and seed', () => {
    const easy = playUntilOver('easy', 9);
    const hell = playUntilOver('hell', 9);
    expect(hell.state.round.number).toBeLessThanOrEqual(easy.state.round.number);
  });

  it('keeps the alive counter in step with the pool across a long run', () => {
    const engine = playUntilOver('easy', 3, 20);
    const mobs = engine.state.mobs;
    let counted = 0;
    for (let i = 0; i < mobs.count; i++) if (mobs.active[i]) counted++;
    expect(mobs.alive).toBe(counted);
    expect(engine.state.aliveOnLane[0]).toBe(counted);
  });

  it('never leaks pool slots', () => {
    const engine = playUntilOver('easy', 4, 20);
    const mobs = engine.state.mobs;
    // Every slot is either live or on the free list — nothing is stranded.
    expect(mobs.freeList.length + mobs.alive).toBe(mobs.count);
    expect(new Set(mobs.freeList).size).toBe(mobs.freeList.length);
  });
});
