import type { ManaSkill } from '@/game/engine/types';

/**
 * A tiny fan-out for engine events the renderer wants but the store should not
 * carry.
 *
 * A skill going off is a one-frame visual, not state: putting it in zustand
 * would re-render the HUD for something no component displays. hud-sync pushes
 * the events here as it drains them, and the effect components subscribe.
 */

export interface SkillCastEvent {
  unitId: number;
  skill: ManaSkill;
  x: number;
  z: number;
}

type Listener = (event: SkillCastEvent) => void;

const listeners = new Set<Listener>();

export function onSkillCast(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSkillCast(event: SkillCastEvent): void {
  for (const listener of listeners) listener(event);
}

/** Dropped between runs so a new game never replays the last one's effects. */
export function clearEffectBus(): void {
  listeners.clear();
}
