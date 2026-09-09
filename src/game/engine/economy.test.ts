import { describe, expect, it } from 'vitest';

import { GAMBLE_COST, HIRE_COST, PAKKUN_WOOD_CHANCE, START_PAKKUN } from '@/game/config/balance';
import { DIFFICULTIES } from '@/game/config/difficulty';
import { PLOT_CELLS } from '@/game/config/map';
import { UNIT_BY_ID } from '@/game/data/units';
import { RECIPES, RECIPE_BY_ID } from '@/game/data/recipes';
import { availability, countsFor, findSatisfiable } from './combine';
import { addUnit, gamble, hire, pakkunDown, pakkunUp, pakkunWood, sell } from './economy';
import { completeDraft, createEngine } from './engine';
import type { EngineEvent } from './types';

/** Past the opening draft, and with its picks cleared off the plot. */
function newEngine(seed = 1) {
  const engine = createEngine({ difficulty: DIFFICULTIES.easy, seed });
  completeDraft(engine);
  engine.drainEvents();
  engine.state.units.clear();
  engine.state.plots[0].occupancy.fill(0);
  return engine;
}

/** Collect events without touching the engine's own queue. */
function collector() {
  const events: EngineEvent[] = [];
  return { events, emit: (e: EngineEvent) => events.push(e) };
}

describe('pakkun', () => {
  it('spends one pakkun and places a normal unit', () => {
    const engine = newEngine();
    const { emit } = collector();
    expect(pakkunDown(engine.state, 0, emit)).toBe(true);
    expect(engine.state.players[0].pakkun).toBe(START_PAKKUN - 1);
    expect(engine.state.units.size).toBe(1);

    const unit = [...engine.state.units.values()][0];
    expect(UNIT_BY_ID.get(unit.defId)?.grade).toBe('normal');
  });

  it('refuses to draw without pakkun', () => {
    const engine = newEngine();
    engine.state.players[0].pakkun = 0;
    const { events, emit } = collector();
    expect(pakkunDown(engine.state, 0, emit)).toBe(false);
    expect(events).toContainEqual({ e: 'log', text: '파쿤이 부족합니다' });
  });

  it('draws normal and magic on the upward pull', () => {
    const engine = newEngine(99);
    const { emit } = collector();
    engine.state.players[0].pakkun = 400;
    const grades = new Set<string>();
    for (let i = 0; i < 200; i++) {
      pakkunUp(engine.state, 0, emit);
      const units = [...engine.state.units.values()];
      const last = units[units.length - 1];
      if (last) grades.add(UNIT_BY_ID.get(last.defId)!.grade);
      // Keep the plot from filling up.
      for (const u of units) engine.state.units.delete(u.id);
      engine.state.plots[0].occupancy.fill(0);
    }
    expect(grades).toEqual(new Set(['normal', 'magic']));
  });

  it('turns pakkun into wood at roughly the stated rate', () => {
    const engine = newEngine(4242);
    const { emit } = collector();
    const trials = 4000;
    engine.state.players[0].pakkun = trials;
    let successes = 0;
    for (let i = 0; i < trials; i++) if (pakkunWood(engine.state, 0, emit)) successes++;
    expect(successes / trials).toBeCloseTo(PAKKUN_WOOD_CHANCE, 1);
  });
});

describe('gambling and hiring', () => {
  it('charges the wood tier and draws from its pool', () => {
    const engine = newEngine();
    const { emit } = collector();
    engine.state.players[0].wood = 10;

    expect(gamble(engine.state, 0, 3, emit)).toBe(true);
    expect(engine.state.players[0].wood).toBe(10 - GAMBLE_COST[3]);
    const unit = [...engine.state.units.values()][0];
    expect(UNIT_BY_ID.get(unit.defId)?.grade).toBe('rare');
  });

  it('refuses a tier the player cannot afford', () => {
    const engine = newEngine();
    const { events, emit } = collector();
    engine.state.players[0].wood = 2;
    expect(gamble(engine.state, 0, 5, emit)).toBe(false);
    expect(engine.state.units.size).toBe(0);
    expect(events.some((e) => e.e === 'log')).toBe(true);
  });

  it('charges gold and wood for a mercenary', () => {
    const engine = newEngine();
    const { emit } = collector();
    engine.state.players[0].gold = 500;
    engine.state.players[0].wood = 3;
    expect(hire(engine.state, 0, 'magic', emit)).toBe(true);
    expect(engine.state.players[0].gold).toBe(500 - HIRE_COST.magic.gold);
    expect(engine.state.players[0].wood).toBe(3 - HIRE_COST.magic.wood);
  });
});

describe('placement', () => {
  it('fills the plot and then refuses', () => {
    const engine = newEngine();
    const { events, emit } = collector();
    const capacity = PLOT_CELLS * PLOT_CELLS;
    const defId = UNIT_BY_ID.keys().next().value!;

    for (let i = 0; i < capacity; i++) {
      expect(addUnit(engine.state, 0, defId, 'gacha', emit)).not.toBeNull();
    }
    expect(engine.state.units.size).toBe(capacity);
    expect(addUnit(engine.state, 0, defId, 'gacha', emit)).toBeNull();
    expect(events).toContainEqual({ e: 'log', text: '자리가 없습니다' });
  });

  it('frees the cell when a unit is sold', () => {
    const engine = newEngine();
    const { emit } = collector();
    const unit = addUnit(engine.state, 0, UNIT_BY_ID.keys().next().value!, 'gacha', emit)!;
    expect(sell(engine.state, 0, [unit.id], emit)).toBe(1);
    expect(engine.state.units.size).toBe(0);
    expect(engine.state.plots[0].occupancy.some((v) => v === 1)).toBe(false);
  });
});

describe('combination', () => {
  it('recovered recipes from the source map', () => {
    expect(RECIPES.length).toBeGreaterThan(100);
    for (const recipe of RECIPES) {
      expect(UNIT_BY_ID.has(recipe.resultId)).toBe(true);
      expect(recipe.materials.length).toBeGreaterThan(0);
      expect(recipe.wood).toBeGreaterThan(0);
    }
  });

  it('reports exactly what is missing', () => {
    const recipe = RECIPES[0];
    const first = recipe.materials[0];
    const partial = { [first.unitId]: first.count - 1 };
    const result = availability(recipe, partial, 0);

    expect(result.ok).toBe(false);
    expect(result.woodOk).toBe(false);
    expect(result.missing.some((m) => m.unitId === first.unitId)).toBe(true);
  });

  it('consumes the materials and the wood, and places the result', () => {
    const engine = newEngine();
    const { emit } = collector();
    // Pick a recipe whose materials all fit on one plot.
    const recipe = RECIPES.find(
      (r) => r.materials.reduce((n, m) => n + m.count, 0) <= 4
    )!;

    for (const material of recipe.materials) {
      for (let i = 0; i < material.count; i++) {
        addUnit(engine.state, 0, material.unitId, 'gacha', emit);
      }
    }
    engine.state.players[0].wood = recipe.wood;

    const counts = countsFor(engine.state, 0);
    expect(availability(recipe, counts, engine.state.players[0].wood).ok).toBe(true);

    engine.enqueue({ t: 'COMBINE', player: 0, recipeId: recipe.id });
    engine.tick();

    const defIds = [...engine.state.units.values()].map((u) => u.defId);
    expect(defIds).toContain(recipe.resultId);
    expect(engine.state.players[0].wood).toBe(0);
    for (const material of recipe.materials) {
      expect(defIds.filter((d) => d === material.unitId).length).toBe(0);
    }
  });

  it('finds only the recipes the roster can complete', () => {
    const recipe = RECIPES[0];
    const counts: Record<string, number> = {};
    for (const material of recipe.materials) counts[material.unitId] = material.count;

    const satisfiable = findSatisfiable(RECIPES, counts, recipe.wood);
    expect(satisfiable).toContain(RECIPE_BY_ID.get(recipe.id));
    expect(findSatisfiable(RECIPES, counts, recipe.wood - 1)).not.toContain(
      RECIPE_BY_ID.get(recipe.id)
    );
  });
});

describe('combat', () => {
  it('kills mobs and pays a bounty once units are on the plot', () => {
    const engine = newEngine();
    const { emit } = collector();
    // A full board of the strongest thing we can place cheaply.
    const strong = [...UNIT_BY_ID.values()]
      .filter((u) => u.grade === 'epic')
      .slice(0, 1)[0];
    for (let i = 0; i < 20; i++) addUnit(engine.state, 0, strong.id, 'gacha', emit);
    engine.drainEvents();

    for (let i = 0; i < 20 * 30; i++) engine.tick();
    const events = engine.drainEvents();

    expect(events.some((e) => e.e === 'hit')).toBe(true);
    expect(events.some((e) => e.e === 'mobDie')).toBe(true);
    expect(engine.state.players[0].gold).toBeGreaterThan(0);
  });

  it('survives far longer with units than without', () => {
    const bare = newEngine(7);
    for (let i = 0; i < 20 * 60 * 12 && !bare.state.over; i++) bare.tick();
    const bareRound = bare.state.round.number;

    const armed = newEngine(7);
    const { emit } = collector();
    const strong = [...UNIT_BY_ID.values()].filter((u) => u.grade === 'epic')[0];
    for (let i = 0; i < 40; i++) addUnit(armed.state, 0, strong.id, 'gacha', emit);
    for (let i = 0; i < 20 * 60 * 12 && !armed.state.over; i++) armed.tick();

    expect(armed.state.round.number).toBeGreaterThan(bareRound);
  });
});
