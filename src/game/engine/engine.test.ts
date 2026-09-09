import { describe, expect, it } from 'vitest';

import {
  MOBS_PER_WAVE,
  PAKKUN_PER_ROUND,
  SPAWN_INTERVAL,
  START_PAKKUN,
  TICK_RATE,
  armorMultiplier,
  roundDuration,
} from '@/game/config/balance';
import { DIFFICULTIES } from '@/game/config/difficulty';
import { completeDraft, createEngine } from './engine';
import { countAlive } from './mobs';
import type { EngineEvent } from './types';

/** Past the opening draft, which these tests are not about. */
function newEngine(difficultyId: 'easy' | 'hard' | 'hell' = 'easy', seed = 1) {
  const engine = createEngine({ difficulty: DIFFICULTIES[difficultyId], seed });
  completeDraft(engine);
  engine.drainEvents();
  return engine;
}

/** The draft hands out four units; clear them for the "nobody shoots" cases. */
function emptyEngine(difficultyId: 'easy' | 'hard' | 'hell' = 'easy', seed = 1) {
  const engine = newEngine(difficultyId, seed);
  engine.state.units.clear();
  engine.state.plots[0].occupancy.fill(0);
  return engine;
}

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
  it('starts at round 1 once the draft is done', () => {
    const engine = createEngine({ difficulty: DIFFICULTIES.easy, seed: 1 });
    expect(engine.state.round.phase).toBe('draft');
    expect(engine.state.round.number).toBe(0);

    completeDraft(engine);
    const draftEvents = engine.drainEvents();

    expect(engine.state.draft.chosen).toHaveLength(4);
    expect(engine.state.units.size).toBe(4);
    expect(draftEvents.filter((e) => e.e === 'draftPick')).toHaveLength(4);
    expect(draftEvents).toContainEqual({ e: 'draftDone' });

    // Round 1 begins on the next tick, not during the draft.
    expect(engine.state.round.number).toBe(0);
    const events = run(engine, 0.05);
    expect(events).toContainEqual({ e: 'roundStart', round: 1 });
    expect(engine.state.round.number).toBe(1);
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
    const engine = newEngine();
    run(engine, 0.05);
    expect(engine.state.players[0].pakkun).toBe(START_PAKKUN);
    run(engine, 31);
    expect(engine.state.players[0].pakkun).toBe(START_PAKKUN + PAKKUN_PER_ROUND);
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

  it('keeps world coordinates on the lane', () => {
    const engine = newEngine();
    run(engine, 3);
    const mobs = engine.state.mobs;
    const lane = engine.state.plots[0].lane;
    for (let i = 0; i < mobs.count; i++) {
      if (!mobs.active[i]) continue;
      const expected = lane.positionAt(mobs.s[i]);
      expect(mobs.x[i]).toBeCloseTo(expected.x, 5);
      expect(mobs.z[i]).toBeCloseTo(expected.z, 5);
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
    expect(a.state.draft.chosen).toEqual(b.state.draft.chosen);
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
