import { AURA_RADIUS, STUN_BOSS_FACTOR, armorMultiplier } from '@/game/config/balance';
import { UNIT_DEF_BY_ID } from '@/game/data/abilities';
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

  let damage = def.damage * (1 + unit.buffAtkPct / 100);
  damage *= armorMultiplier(effectiveArmor(state, mobIndex));

  for (const ability of def.abilities) {
    if (ability.kind === 'percentDamage') {
      damage += (mobs.hp[mobIndex] * ability.pct) / 100;
    }
  }

  mobs.hp[mobIndex] -= damage;

  for (const ability of def.abilities) {
    switch (ability.kind) {
      case 'stun':
        if (state.rng.chance(ability.chance)) {
          const seconds = ability.seconds * (isBoss ? STUN_BOSS_FACTOR : 1);
          mobs.stunUntil[mobIndex] = Math.max(
            mobs.stunUntil[mobIndex],
            state.time + seconds
          );
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
}

export function updateCombat(
  state: GameState,
  dt: number,
  emit: (event: EngineEvent) => void
): void {
  for (const unit of state.units.values()) {
    const def = defOf(unit);
    if (!def) continue;

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
