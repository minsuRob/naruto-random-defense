import { describe, expect, it } from 'vitest';

import { TICK_RATE } from '@/game/config/balance';
import { DIFFICULTIES } from '@/game/config/difficulty';
import { PLOT_COUNT } from '@/game/config/map';
import { createEngine, skipPrep } from './engine';
import { buildSpawnQueue } from './rounds';

/**
 * Four islands, one player.
 *
 * The three empty islands exist so the map reads like the original's and so
 * co-op is a data change rather than a rewrite. Everything here guards the
 * price of that: they must stay completely inert. A mob on an unowned island
 * would have no owner to charge, no death count to trip, and no way to die.
 */

function newEngine(playerCount?: number) {
  return createEngine({ difficulty: DIFFICULTIES.easy, seed: 1, playerCount });
}

describe('plots and players', () => {
  it('builds every island but seats only the players there are', () => {
    const engine = newEngine();
    expect(engine.state.plots).toHaveLength(PLOT_COUNT);
    expect(engine.state.players).toHaveLength(1);

    expect(engine.state.plots[0].owner).toBe(0);
    for (const plot of engine.state.plots.slice(1)) {
      expect(plot.owner).toBe(-1);
    }
  });

  it('seats more players when asked, which is all co-op needs', () => {
    const engine = newEngine(4);
    expect(engine.state.players).toHaveLength(4);
    expect(engine.state.plots.map((p) => p.owner)).toEqual([0, 1, 2, 3]);
  });

  it('keeps plot ids dense and matching their array position', () => {
    // mobs.plot is a Uint8Array indexed straight into state.plots.
    const engine = newEngine();
    engine.state.plots.forEach((plot, i) => expect(plot.id).toBe(i));
  });

  it('starts every island fully buildable', () => {
    const engine = newEngine();
    for (const plot of engine.state.plots) {
      expect(plot.occupancy.every((v) => v === 0)).toBe(true);
    }
  });
});

describe('unowned islands', () => {
  it('never queues a spawn for one', () => {
    const engine = newEngine();
    const queue = buildSpawnQueue(engine.state, engine.tables, 3); // a boss round
    expect(queue.length).toBeGreaterThan(0);
    expect(new Set(queue.map((e) => e.plot))).toEqual(new Set([0]));
  });

  it('leaves them empty across a long run', () => {
    const engine = newEngine();
    skipPrep(engine);
    for (let i = 0; i < TICK_RATE * 60 * 4 && !engine.state.over; i++) {
      engine.tick();
      engine.drainEvents();
    }
    expect(engine.state.round.number).toBeGreaterThan(3);

    for (let plot = 1; plot < PLOT_COUNT; plot++) {
      expect(engine.state.aliveOnLane[plot]).toBe(0);
    }
    const mobs = engine.state.mobs;
    for (let i = 0; i < mobs.count; i++) {
      if (mobs.active[i]) expect(mobs.plot[i]).toBe(0);
    }
  });

  it('does not stop the run from ending normally', () => {
    // state.players[-1] is read in two hot paths; this proves the guards hold.
    const engine = newEngine();
    skipPrep(engine);
    for (let i = 0; i < TICK_RATE * 60 * 20 && !engine.state.over; i++) {
      engine.tick();
      engine.drainEvents();
    }
    expect(engine.state.over).toBe(true);
    expect(engine.state.outcome).toBe('lose');
  });
});
