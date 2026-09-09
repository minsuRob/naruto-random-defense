import {
  AURA_RADIUS,
  MANA_SKILL,
  STUN_BOSS_FACTOR,
  armorMultiplier,
} from '@/game/config/balance';
import { UNIT_DEF_BY_ID } from '@/game/data/abilities';
import { wrapS } from './lane';
import type { EngineEvent, GameState, UnitDef, UnitInstance } from './types';

/**
 * Targeting, auras and hit resolution.
 *
 * Attacks are hitscan: there is no projectile to miss or chase, so a hit is
 * decided entirely by the tick it lands on. That keeps the simulation
 * deterministic and keeps the per-tick cost proportional to the unit count.
 */

/** Keep the current target until it is this much past the unit's range. */
const STICKY_RANGE_FACTOR = 1.1;

export function defOf(unit: UnitInstance): UnitDef | undefined {
  return UNIT_DEF_BY_ID.get(unit.defId);
}

export function updateAuras(state: GameState): void {
  const units = [...state.units.values()];
  for (const unit of units) {
    unit.buffAtkSpeedPct = 0;
    unit.buffAtkPct = 0;
  }

  for (const source of units) {
    const def = defOf(source);
    if (!def) continue;
    for (const ability of def.abilities) {
      if (ability.kind !== 'auraAtkSpeed' && ability.kind !== 'auraAtk') continue;
      const radiusSq = (ability.radius || AURA_RADIUS) ** 2;
      for (const target of units) {
        if (target.plot !== source.plot) continue;
        const dx = target.x - source.x;
        const dz = target.z - source.z;
        if (dx * dx + dz * dz > radiusSq) continue;
        if (ability.kind === 'auraAtkSpeed') target.buffAtkSpeedPct += ability.pct;
        else target.buffAtkPct += ability.pct;
      }
    }
  }
}

export function updateTargeting(state: GameState): void {
  const mobs = state.mobs;

  for (const unit of state.units.values()) {
    const def = defOf(unit);
    if (!def) continue;
    // A unit walking to a new position holds fire until it gets there.
    if (unit.walk) {
      unit.targetMob = -1;
      continue;
    }
    const rangeSq = def.range * def.range;

    // Hold the current target while it is still roughly in range; this stops
    // units flip-flopping between two mobs on the boundary.
    const current = unit.targetMob;
    if (current >= 0 && mobs.active[current]) {
      const dx = mobs.x[current] - unit.x;
      const dz = mobs.z[current] - unit.z;
      if (dx * dx + dz * dz <= rangeSq * STICKY_RANGE_FACTOR * STICKY_RANGE_FACTOR) continue;
    }

    let best = -1;
    let bestDistSq = rangeSq;
    for (let i = 0; i < mobs.count; i++) {
      if (!mobs.active[i] || mobs.plot[i] !== unit.plot) continue;
      const dx = mobs.x[i] - unit.x;
      const dz = mobs.z[i] - unit.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= bestDistSq) {
        bestDistSq = distSq;
        best = i;
      }
    }
    unit.targetMob = best;
  }
}

/** Effective armour after any stacked reduction. */
function effectiveArmor(state: GameState, mobIndex: number): number {
  return state.mobs.armor[mobIndex] - state.mobs.armorReduce[mobIndex];
}

/** Raw damage a unit deals before armour and before on-hit effects. */
function baseDamage(unit: UnitInstance, def: UnitDef): number {
  return def.damage * (1 + unit.buffAtkPct / 100);
}

/** Apply damage through the armour curve and report whether it killed. */
function damageMob(
  state: GameState,
  unit: UnitInstance,
  mobIndex: number,
  amount: number,
  emit: (event: EngineEvent) => void
): void {
  const mobs = state.mobs;
  const dealt = amount * armorMultiplier(effectiveArmor(state, mobIndex));
  mobs.hp[mobIndex] -= dealt;
  emit({
    e: 'hit',
    unitId: unit.id,
    mobIndex,
    damage: dealt,
    killing: mobs.hp[mobIndex] <= 0,
  });
}

/** Mobs within `radius` of a point, on the same plot. */
function mobsNear(
  state: GameState,
  plot: number,
  x: number,
  z: number,
  radius: number,
  exclude: number,
  limit = Infinity
): number[] {
  const mobs = state.mobs;
  const radiusSq = radius * radius;
  const found: number[] = [];
  for (let i = 0; i < mobs.count && found.length < limit; i++) {
    if (!mobs.active[i] || mobs.plot[i] !== plot || i === exclude) continue;
    const dx = mobs.x[i] - x;
    const dz = mobs.z[i] - z;
    if (dx * dx + dz * dz <= radiusSq) found.push(i);
  }
  return found;
}

/** Shove a mob backwards along the lane. */
function knockback(state: GameState, mobIndex: number, distance: number): void {
  const mobs = state.mobs;
  if (mobs.isBoss[mobIndex]) return; // bosses hold their ground
  const lane = state.plots[mobs.plot[mobIndex]].lane;
  const s = wrapS(mobs.s[mobIndex] - distance, lane.length);
  mobs.s[mobIndex] = s;
  mobs.sPrev[mobIndex] = s;
  const p = lane.positionAt(s);
  const origin = state.plots[mobs.plot[mobIndex]].origin;
  mobs.x[mobIndex] = p.x + origin.x;
  mobs.z[mobIndex] = p.z + origin.z;
}

/** A filled mana bar goes off here. */
function castManaSkill(
  state: GameState,
  unit: UnitInstance,
  def: UnitDef,
  skill: 'nova' | 'execute' | 'bigHit',
  mobIndex: number,
  emit: (event: EngineEvent) => void
): void {
  const mobs = state.mobs;
  emit({ e: 'skill', unitId: unit.id, skill, x: unit.x, z: unit.z });

  switch (skill) {
    case 'nova': {
      // A burst around the unit: everything close takes a share of a big hit.
      const hit = mobsNear(state, unit.plot, unit.x, unit.z, MANA_SKILL.novaRadius, -1);
      for (const index of hit) {
        damageMob(state, unit, index, baseDamage(unit, def) * MANA_SKILL.novaPct, emit);
      }
      break;
    }
    case 'execute': {
      // Finishes anything already badly hurt; bosses are immune, as with 삭제.
      if (mobs.isBoss[mobIndex]) break;
      if (mobs.hp[mobIndex] / mobs.maxHp[mobIndex] <= MANA_SKILL.executeThreshold) {
        const damage = mobs.hp[mobIndex];
        mobs.hp[mobIndex] = 0;
        emit({ e: 'hit', unitId: unit.id, mobIndex, damage, killing: true });
      }
      break;
    }
    case 'bigHit':
      damageMob(state, unit, mobIndex, baseDamage(unit, def) * MANA_SKILL.bigHitPct, emit);
      break;
  }
}

export function resolveHit(
  state: GameState,
  unit: UnitInstance,
  def: UnitDef,
  mobIndex: number,
  emit: (event: EngineEvent) => void
): void {
  const mobs = state.mobs;
  const isBoss = mobs.isBoss[mobIndex] === 1;

  // 삭제 — an instant kill that bosses shrug off.
  for (const ability of def.abilities) {
    if (ability.kind === 'delete' && !isBoss && state.rng.chance(ability.chance)) {
      const damage = mobs.hp[mobIndex];
      mobs.hp[mobIndex] = 0;
      emit({ e: 'hit', unitId: unit.id, mobIndex, damage, killing: true });
      return;
    }
  }

  let damage = baseDamage(unit, def);

  for (const ability of def.abilities) {
    if (ability.kind === 'critical' && state.rng.chance(ability.chance)) {
      damage *= ability.multiplier;
    }
  }

  damage *= armorMultiplier(effectiveArmor(state, mobIndex));

  for (const ability of def.abilities) {
    if (ability.kind === 'percentDamage') {
      damage += (mobs.hp[mobIndex] * ability.pct) / 100;
    }
  }

  mobs.hp[mobIndex] -= damage;

  // Splash and multishot spread the same attack; both are scaled fractions of
  // the main hit rather than extra full attacks.
  for (const ability of def.abilities) {
    if (ability.kind === 'splash') {
      const splashed = mobsNear(
        state,
        unit.plot,
        mobs.x[mobIndex],
        mobs.z[mobIndex],
        ability.radius,
        mobIndex
      );
      for (const index of splashed) {
        damageMob(state, unit, index, baseDamage(unit, def) * ability.pct, emit);
      }
    }
    if (ability.kind === 'multishot') {
      const extra = mobsNear(
        state,
        unit.plot,
        unit.x,
        unit.z,
        def.range,
        mobIndex,
        ability.extraTargets
      );
      for (const index of extra) {
        damageMob(state, unit, index, baseDamage(unit, def) * ability.pct, emit);
      }
    }
  }

  for (const ability of def.abilities) {
    switch (ability.kind) {
      case 'stun':
        if (state.rng.chance(ability.chance)) {
          const seconds = ability.seconds * (isBoss ? STUN_BOSS_FACTOR : 1);
          mobs.stunUntil[mobIndex] = Math.max(mobs.stunUntil[mobIndex], state.time + seconds);
        }
        break;
      case 'slow':
        if (state.rng.chance(ability.chance)) {
          mobs.slowUntil[mobIndex] = state.time + ability.seconds;
          mobs.slowMul[mobIndex] = Math.min(mobs.slowMul[mobIndex], 1 - ability.amount);
        }
        break;
      case 'armorReduce':
        if (mobs.armorReduceStacks[mobIndex] < ability.maxStacks) {
          mobs.armorReduceStacks[mobIndex]++;
          mobs.armorReduce[mobIndex] += ability.amount;
        }
        mobs.armorReduceUntil[mobIndex] = state.time + ability.seconds;
        break;
      case 'knockback':
        if (state.rng.chance(ability.chance)) knockback(state, mobIndex, ability.distance);
        break;
      default:
        break;
    }
  }

  emit({
    e: 'hit',
    unitId: unit.id,
    mobIndex,
    damage,
    killing: mobs.hp[mobIndex] <= 0,
  });

  // Mana last, so the skill sees the state the attack left behind.
  for (const ability of def.abilities) {
    if (ability.kind !== 'manaSkill') continue;
    unit.mana += ability.perHit;
    if (unit.mana >= ability.max) {
      unit.mana = 0;
      castManaSkill(state, unit, def, ability.skill, mobIndex, emit);
    }
  }
}

export function updateCombat(
  state: GameState,
  dt: number,
  emit: (event: EngineEvent) => void
): void {
  for (const unit of state.units.values()) {
    const def = defOf(unit);
    if (!def || unit.walk) continue;

    const rate = 1 + unit.buffAtkSpeedPct / 100;
    unit.cooldown -= dt * rate;
    if (unit.cooldown > 0) continue;

    const target = unit.targetMob;
    if (target < 0 || !state.mobs.active[target]) continue;

    unit.cooldown += def.cooldown;
    if (unit.cooldown < 0) unit.cooldown = 0;
    resolveHit(state, unit, def, target, emit);
  }
}
