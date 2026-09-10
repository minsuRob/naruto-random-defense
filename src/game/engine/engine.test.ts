import { describe, expect, it } from 'vitest';

import {
  MOBS_PER_WAVE,
  PREP_SECONDS,
  SPAWN_INTERVAL,
  TICK_RATE,
  armorMultiplier,
  roundDuration,
} from '@/game/config/balance';
import { DIFFICULTIES } from '@/game/config/difficulty';
import { createEngine, skipPrep } from './engine';
import { countAlive } from './mobs';
import type { EngineEvent } from './types';

/** Past the setup window, which these tests are not about. */
function newEngine(difficultyId: 'easy' | 'hard' | 'hell' = 'easy', seed = 1) {
  const engine = createEngine({ difficulty: DIFFICULTIES[difficultyId], seed });
  skipPrep(engine);
  engine.drainEvents();
  return engine;
}

/**
 * A run opens with no units at all, so this is the same engine — named for the
 * cases that depend on nobody shooting back.
 */
const emptyEngine = newEngine;

/** Run for `seconds`, collecting everything the engine emitted. */
function run(engine: ReturnType<typeof createEngine>, seconds: number) {
  const events: EngineEvent[] = [];
  const ticks = Math.round(seconds * TICK_RATE);
  for (let i = 0; i < ticks; i++) {
    engine.tick();
    events.push(...engine.drainEvents());
  }
  return events;
}

describe('rounds', () => {
  it('holds the first wave until the setup window runs out', () => {
    const engine = createEngine({ difficulty: DIFFICULTIES.easy, seed: 1 });
    expect(engine.state.round.phase).toBe('prep');
    expect(engine.state.round.number).toBe(0);
    expect(engine.state.units.size).toBe(0);

    // Most of the window passes with nothing on the lane.
    const quiet = run(engine, PREP_SECONDS - 1);
    expect(quiet.some((e) => e.e === 'roundStart')).toBe(false);
    expect(engine.state.round.number).toBe(0);
    expect(engine.state.mobs.alive).toBe(0);

    const events = run(engine, 1.5);
    expect(events).toContainEqual({ e: 'roundStart', round: 1 });
    expect(engine.state.round.number).toBe(1);
  });

  it('leaves enough of the window to turn the opening pakkun into a defense', () => {
    // The whole point of the setup window: every token you are handed can reach
    // an altar and come back as a unit before the first mob walks the lane.
    const engine = createEngine({ difficulty: DIFFICULTIES.easy, seed: 3 });
    const opening = engine.state.players[0].pakkun;
    for (let i = 0; i < opening; i++) {
      engine.enqueue({ t: 'PAKKUN_DOWN', player: 0 });
    }

    run(engine, PREP_SECONDS - 1);
    expect(engine.state.round.number).toBe(0);
    expect(engine.state.pakkuns).toHaveLength(0);
    expect(engine.state.units.size).toBe(opening);
  });

  it('opens with the difficulty grant, in tokens as well as the counter', () => {
    for (const id of ['easy', 'hard', 'hell'] as const) {
      const difficulty = DIFFICULTIES[id];
      const engine = createEngine({ difficulty, seed: 1 });
      const player = engine.state.players[0];
      expect(player.pakkun).toBe(difficulty.startPakkun);
      expect(player.wood).toBe(difficulty.startWood);
      expect(engine.state.pakkuns).toHaveLength(difficulty.startPakkun);
    }
    // Harder tiers are handed more, as the original announces.
    expect(DIFFICULTIES.hell.startPakkun).toBeGreaterThan(DIFFICULTIES.easy.startPakkun);
  });

  it('runs rounds 1-9 for 30s and later rounds for 42s', () => {
    expect(roundDuration(1)).toBe(30);
    expect(roundDuration(9)).toBe(30);
    expect(roundDuration(10)).toBe(42);

    const engine = newEngine();
    run(engine, 29);
    expect(engine.state.round.number).toBe(1);
    run(engine, 2);
    expect(engine.state.round.number).toBe(2);
  });

  it('hands out pakkun at the end of each round', () => {
    const { startPakkun, pakkunPerRound } = DIFFICULTIES.easy;
    const engine = newEngine();
    run(engine, 0.05);
    expect(engine.state.players[0].pakkun).toBe(startPakkun);
    run(engine, 31);
    expect(engine.state.players[0].pakkun).toBe(startPakkun + pakkunPerRound);
    // The counter and the tokens on the map never drift apart.
    expect(engine.state.pakkuns).toHaveLength(startPakkun + pakkunPerRound);
  });

  it('spawns the whole wave on the spawn interval', () => {
    // No units, so nothing thins the wave out before it is counted.
    const engine = emptyEngine();
    run(engine, MOBS_PER_WAVE * SPAWN_INTERVAL + 0.5);
    expect(engine.state.mobs.alive).toBe(MOBS_PER_WAVE);
    expect(countAlive(engine.state.mobs)).toBe(MOBS_PER_WAVE);
  });

  it('adds a boss on rounds ending in 3 and 0', () => {
    const engine = newEngine();
    // Round 3 is the first boss round.
    run(engine, 30 * 2 + 3);
    expect(engine.state.round.number).toBe(3);
    expect(engine.state.round.bossAlive).toBe(true);
    const bosses = [...Array(engine.state.mobs.count).keys()].filter(
      (i) => engine.state.mobs.active[i] && engine.state.mobs.isBoss[i]
    );
    expect(bosses.length).toBe(1);
  });
});

describe('lane movement', () => {
  it('walks mobs around the loop and wraps them', () => {
    const engine = emptyEngine();
    run(engine, 1);
    const mobs = engine.state.mobs;
    const first = 0;
    expect(mobs.active[first]).toBe(1);
    const startS = mobs.s[first];
    run(engine, 2);
    expect(mobs.s[first]).toBeGreaterThan(startS);

    // A full lap is about 21s at the default speed.
    run(engine, 22);
    expect(mobs.lap[first]).toBeGreaterThanOrEqual(1);
  });

  it('keeps world coordinates on the lane, offset by the island origin', () => {
    const engine = newEngine();
    run(engine, 3);
    const mobs = engine.state.mobs;
    for (let i = 0; i < mobs.count; i++) {
      if (!mobs.active[i]) continue;
      // The lane is plot-local; the world position is that plus the origin.
      const plot = engine.state.plots[mobs.plot[i]];
      const expected = plot.lane.positionAt(mobs.s[i]);
      expect(mobs.x[i]).toBeCloseTo(expected.x + plot.origin.x, 5);
      expect(mobs.z[i]).toBeCloseTo(expected.z + plot.origin.z, 5);
    }
  });
});

describe('death count', () => {
  it('ends the run once the lane holds more than the limit', () => {
    const engine = emptyEngine('easy');
    const limit = DIFFICULTIES.easy.deathCount;

    // Nothing kills mobs yet, so the lane fills at one wave per round.
    const events = run(engine, 60 * 12);
    expect(engine.state.over).toBe(true);
    expect(engine.state.outcome).toBe('lose');
    expect(events).toContainEqual({ e: 'gameOver', outcome: 'lose' });
    expect(engine.state.aliveOnLane[0]).toBeGreaterThan(limit);
  });

  it('trips at exactly limit + 1', () => {
    const engine = emptyEngine('easy');
    const limit = DIFFICULTIES.easy.deathCount;
    for (let i = 0; i < 60 * 12 * 20 && !engine.state.over; i++) {
      const before = engine.state.aliveOnLane[0];
      engine.tick();
      engine.drainEvents();
      if (engine.state.over) {
        expect(engine.state.aliveOnLane[0]).toBe(limit + 1);
        expect(before).toBe(limit);
        return;
      }
    }
    throw new Error('expected the run to end');
  });

  it('is tighter on hell than on easy', () => {
    expect(DIFFICULTIES.hell.deathCount).toBeLessThan(DIFFICULTIES.easy.deathCount);
  });

  it('stops ticking once the run is over', () => {
    const engine = emptyEngine();
    run(engine, 60 * 12);
    expect(engine.state.over).toBe(true);
    const tick = engine.state.tick;
    run(engine, 5);
    expect(engine.state.tick).toBe(tick);
  });
});

describe('determinism', () => {
  it('two engines with the same seed stay identical', () => {
    const a = newEngine('hard', 12345);
    const b = newEngine('hard', 12345);
    for (let i = 0; i < 3000; i++) {
      a.tick();
      b.tick();
    }
    expect(a.state.tick).toBe(b.state.tick);
    expect(a.state.round.number).toBe(b.state.round.number);
    expect(a.state.mobs.alive).toBe(b.state.mobs.alive);
    expect([...a.state.mobs.s]).toEqual([...b.state.mobs.s]);
    expect(a.state.players[0].gold).toBe(b.state.players[0].gold);
  });
});

describe('armour curve', () => {
  it('reduces damage for positive armour and amplifies it for negative', () => {
    expect(armorMultiplier(0)).toBeCloseTo(1, 10);
    expect(armorMultiplier(10)).toBeLessThan(1);
    expect(armorMultiplier(10)).toBeGreaterThan(0);
    // The source map's round-1 mobs sit at -47 armour, which nearly doubles hits.
    expect(armorMultiplier(-47)).toBeGreaterThan(1.9);
    expect(armorMultiplier(-47)).toBeLessThan(2);
  });

  it('never inverts the sign of the damage', () => {
    for (let armor = -100; armor <= 300; armor += 7) {
      expect(armorMultiplier(armor)).toBeGreaterThan(0);
    }
  });
});
