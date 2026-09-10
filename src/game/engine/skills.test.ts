import { describe, expect, it } from 'vitest';

import { MANA_SKILL } from '@/game/config/balance';
import { DIFFICULTIES } from '@/game/config/difficulty';
import { resolveHit } from './combat';
import { createEngine } from './engine';
import { spawnMob } from './mobs';
import type { Ability, EngineEvent, GameState, MobDef, UnitDef, UnitInstance } from './types';

/**
 * The skill kinds, each exercised on its own.
 *
 * These build the unit and the mobs by hand rather than drafting a real roster:
 * the point is what one ability does to a known board, and a hand-made board is
 * the only way to say "that mob was hit by the splash, not by the shot".
 */

function bench() {
  const engine = createEngine({ difficulty: DIFFICULTIES.easy, seed: 1 });
  const state = engine.state;
  const events: EngineEvent[] = [];
  const emit = (event: EngineEvent) => events.push(event);
  return { state, events, emit };
}

const MOB: MobDef = {
  id: 'dummy',
  nameKo: '표적',
  hp: 1000,
  armor: 0,
  damageType: 'phys',
  speed: 0,
  scale: 1,
  isBoss: false,
  bounty: 0,
};

/**
 * Put a mob on the lane at a given arc length and sync its world position.
 *
 * The lane is plot-local, so the island's origin has to be added — the same
 * composition the engine does. Getting this wrong would make the whole bench
 * self-consistently wrong.
 */
function placeMob(state: GameState, s: number, overrides: Partial<MobDef> = {}): number {
  const def = { ...MOB, ...overrides };
  const index = state.mobDefs.push(def) - 1;
  const slot = spawnMob(state.mobs, index, def, 0, s);
  const plot = state.plots[0];
  const p = plot.lane.positionAt(s);
  state.mobs.x[slot] = p.x + plot.origin.x;
  state.mobs.z[slot] = p.z + plot.origin.z;
  return slot;
}

function attacker(state: GameState, abilities: Ability[], damage = 100): {
  unit: UnitInstance;
  def: UnitDef;
} {
  const origin = state.plots[0].origin;
  const unit: UnitInstance = {
    id: 1,
    defId: 'bench',
    owner: 0,
    plot: 0,
    cell: { cx: 0, cy: 0 },
    x: origin.x,
    z: origin.z,
    cooldown: 0,
    targetMob: -1,
    mana: 0,
    buffAtkSpeedPct: 0,
    buffAtkPct: 0,
    walk: null,
  };
  state.units.set(unit.id, unit);
  const def: UnitDef = {
    id: 'bench',
    nameKo: '표준',
    grade: 'normal',
    damage,
    cooldown: 1,
    range: 20,
    damageType: 'phys',
    abilities,
  };
  return { unit, def };
}

describe('splash', () => {
  it('hits neighbours of the target for a share of the damage', () => {
    const { state, emit } = bench();
    const lane = state.plots[0].lane;
    const target = placeMob(state, 0);
    const near = placeMob(state, 1); // one unit along the lane
    const far = placeMob(state, lane.length / 2); // opposite side

    const { unit, def } = attacker(state, [{ kind: 'splash', radius: 2, pct: 0.5 }]);
    resolveHit(state, unit, def, target, emit);

    expect(state.mobs.hp[target]).toBeLessThan(MOB.hp);
    expect(state.mobs.hp[near]).toBeCloseTo(MOB.hp - 50, 5);
    expect(state.mobs.hp[far]).toBe(MOB.hp);
  });
});

describe('multishot', () => {
  it('strikes extra targets, capped at the stated count', () => {
    const { state, emit } = bench();
    const target = placeMob(state, 0);
    const others = [placeMob(state, 1), placeMob(state, 2), placeMob(state, 3)];

    const { unit, def } = attacker(state, [
      { kind: 'multishot', extraTargets: 2, pct: 0.5 },
    ]);
    resolveHit(state, unit, def, target, emit);

    const hurt = others.filter((i) => state.mobs.hp[i] < MOB.hp);
    expect(hurt).toHaveLength(2);
    expect(state.mobs.hp[hurt[0]]).toBeCloseTo(MOB.hp - 50, 5);
  });
});

describe('critical', () => {
  it('multiplies the hit when it lands', () => {
    const { state, emit } = bench();
    const target = placeMob(state, 0);
    const { unit, def } = attacker(state, [
      { kind: 'critical', chance: 1, multiplier: 3 },
    ]);
    resolveHit(state, unit, def, target, emit);
    expect(MOB.hp - state.mobs.hp[target]).toBeCloseTo(300, 5);
  });

  it('leaves the hit alone when it does not', () => {
    const { state, emit } = bench();
    const target = placeMob(state, 0);
    const { unit, def } = attacker(state, [
      { kind: 'critical', chance: 0, multiplier: 3 },
    ]);
    resolveHit(state, unit, def, target, emit);
    expect(MOB.hp - state.mobs.hp[target]).toBeCloseTo(100, 5);
  });
});

describe('knockback', () => {
  it('shoves the mob backwards along the lane', () => {
    const { state, emit } = bench();
    const target = placeMob(state, 10);
    const { unit, def } = attacker(state, [
      { kind: 'knockback', chance: 1, distance: 3 },
    ]);
    resolveHit(state, unit, def, target, emit);
    expect(state.mobs.s[target]).toBeCloseTo(7, 5);
    // The world position follows, so the renderer does not jump a frame later.
    const plot = state.plots[0];
    const p = plot.lane.positionAt(7);
    expect(state.mobs.x[target]).toBeCloseTo(p.x + plot.origin.x, 5);
  });

  it('does not move a boss', () => {
    const { state, emit } = bench();
    const boss = placeMob(state, 10, { isBoss: true });
    const { unit, def } = attacker(state, [
      { kind: 'knockback', chance: 1, distance: 3 },
    ]);
    resolveHit(state, unit, def, boss, emit);
    expect(state.mobs.s[boss]).toBeCloseTo(10, 5);
  });
});

describe('mana skills', () => {
  it('fills on hits and fires when the bar tops out', () => {
    const { state, events, emit } = bench();
    const target = placeMob(state, 0);
    const { unit, def } = attacker(state, [
      { kind: 'manaSkill', max: 30, perHit: 10, skill: 'bigHit' },
    ]);

    resolveHit(state, unit, def, target, emit);
    expect(unit.mana).toBe(10);
    resolveHit(state, unit, def, target, emit);
    expect(unit.mana).toBe(20);
    expect(events.filter((e) => e.e === 'skill')).toHaveLength(0);

    resolveHit(state, unit, def, target, emit);
    expect(unit.mana).toBe(0);
    expect(events.filter((e) => e.e === 'skill')).toHaveLength(1);
  });

  it('bigHit lands a multiplied blow on the target', () => {
    const { state, emit } = bench();
    const target = placeMob(state, 0, { hp: 100000 });
    const { unit, def } = attacker(state, [
      { kind: 'manaSkill', max: 10, perHit: 10, skill: 'bigHit' },
    ]);
    resolveHit(state, unit, def, target, emit);
    // The normal hit plus the skill's multiple of it.
    expect(100000 - state.mobs.hp[target]).toBeCloseTo(100 + 100 * MANA_SKILL.bigHitPct, 5);
  });

  it('nova hits everything around the caster', () => {
    const { state, emit } = bench();
    const target = placeMob(state, 0);
    // Sit the caster next to a cluster and put the mobs on top of it.
    const { unit, def } = attacker(state, [
      { kind: 'manaSkill', max: 10, perHit: 10, skill: 'nova' },
    ]);
    const neighbour = placeMob(state, 5);
    state.mobs.x[neighbour] = unit.x + 1;
    state.mobs.z[neighbour] = unit.z + 1;

    resolveHit(state, unit, def, target, emit);
    expect(state.mobs.hp[neighbour]).toBeLessThan(MOB.hp);
  });

  it('execute finishes a target that is already nearly dead', () => {
    const { state, emit } = bench();
    const target = placeMob(state, 0);
    state.mobs.hp[target] = MOB.hp * (MANA_SKILL.executeThreshold / 2);

    const { unit, def } = attacker(state, [
      { kind: 'manaSkill', max: 10, perHit: 10, skill: 'execute' },
    ], 1);
    resolveHit(state, unit, def, target, emit);
    expect(state.mobs.hp[target]).toBe(0);
  });

  it('execute leaves a healthy target alone', () => {
    const { state, emit } = bench();
    const target = placeMob(state, 0);
    const { unit, def } = attacker(state, [
      { kind: 'manaSkill', max: 10, perHit: 10, skill: 'execute' },
    ], 1);
    resolveHit(state, unit, def, target, emit);
    expect(state.mobs.hp[target]).toBeGreaterThan(0);
  });

  it('execute does not work on a boss', () => {
    const { state, emit } = bench();
    const boss = placeMob(state, 0, { isBoss: true });
    state.mobs.hp[boss] = MOB.hp * 0.01;

    const { unit, def } = attacker(state, [
      { kind: 'manaSkill', max: 10, perHit: 10, skill: 'execute' },
    ], 1);
    resolveHit(state, unit, def, boss, emit);
    expect(state.mobs.hp[boss]).toBeGreaterThan(0);
  });
});
