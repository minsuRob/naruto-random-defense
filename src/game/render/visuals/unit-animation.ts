import type { Engine } from '@/game/engine/engine';

/** What the unit is doing, which decides the clip. */
export type UnitAnimation = 'stand' | 'walk' | 'attack';

/**
 * Pick the clip for a unit from engine state.
 *
 * Walking wins over attacking because a unit under a move order holds fire —
 * see updateTargeting. "Attacking" means having a live target, not the instant
 * a shot lands, so the clip plays for as long as the unit is engaged.
 */
export function unitAnimationFor(engine: Engine, unitId: number): UnitAnimation {
  const unit = engine.state.units.get(unitId);
  if (!unit) return 'stand';
  if (unit.walk) return 'walk';
  if (unit.targetMob >= 0 && engine.state.mobs.active[unit.targetMob]) return 'attack';
  return 'stand';
}
