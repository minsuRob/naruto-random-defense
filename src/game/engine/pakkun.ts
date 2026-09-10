import { PAKKUN_WALK_SPEED } from '@/game/config/balance';
import { ALTAR_BY_KIND, pakkunHoldingSpot, type AltarKind } from '@/game/config/map';
import type { EngineEvent, GameState, PakkunToken } from './types';

/**
 * The pakkun tokens.
 *
 * This is the widget the original hands you: a little dog you walk into one of
 * the altars, and what comes out depends on which altar you picked. Making it a
 * thing on the map rather than a counter is the point — you can see how many you
 * are holding, and sending one somewhere takes a moment.
 *
 * The tokens wait on the pedestal at the centre of the shared plaza, each
 * player's queue in the quadrant facing their own island.
 */

/** Idle tokens wait on the plaza pedestal, in the order they arrived. */
function holdingSpot(state: GameState, playerId: number, slot: number) {
  const plot = state.plots.find((p) => p.owner === playerId);
  return pakkunHoldingSpot(plot?.id ?? 0, slot);
}

/** Re-line the idle tokens so gaps close up when one is spent. */
export function restack(state: GameState, playerId: number): void {
  let slot = 0;
  for (const token of state.pakkuns) {
    if (token.owner !== playerId || token.target) continue;
    const spot = holdingSpot(state, playerId, slot++);
    token.x = spot.x;
    token.z = spot.z;
  }
}

export function grantPakkun(state: GameState, playerId: number, count: number): void {
  for (let i = 0; i < count; i++) {
    // Slot is this player's own queue length — the array holds every player's.
    const spot = holdingSpot(state, playerId, countPakkun(state, playerId));
    state.pakkuns.push({
      id: state.nextPakkunId++,
      owner: playerId,
      x: spot.x,
      z: spot.z,
      target: null,
      elapsed: 0,
      duration: 0,
      fromX: spot.x,
      fromZ: spot.z,
    });
  }
  restack(state, playerId);
}

export function idlePakkuns(state: GameState, playerId: number): PakkunToken[] {
  return state.pakkuns.filter((p) => p.owner === playerId && !p.target);
}

export function countPakkun(state: GameState, playerId: number): number {
  return state.pakkuns.filter((p) => p.owner === playerId).length;
}

/**
 * World position of an altar. The plaza is shared, so this is the same point
 * for every player — which is exactly what makes it a meeting place.
 */
export function altarPosition(kind: AltarKind): { x: number; z: number } {
  return ALTAR_BY_KIND[kind].pos;
}

/** Send one token to an altar. Returns false when there is nothing to send. */
export function sendPakkun(
  state: GameState,
  playerId: number,
  kind: AltarKind,
  tokenId?: number
): boolean {
  const token =
    tokenId !== undefined
      ? state.pakkuns.find((p) => p.id === tokenId && p.owner === playerId && !p.target)
      : idlePakkuns(state, playerId)[0];
  if (!token) return false;

  const to = altarPosition(kind);
  const distance = Math.hypot(to.x - token.x, to.z - token.z);
  token.target = kind;
  token.fromX = token.x;
  token.fromZ = token.z;
  token.elapsed = 0;
  token.duration = Math.max(0.05, distance / PAKKUN_WALK_SPEED);
  restack(state, playerId);
  return true;
}

/**
 * Advance walking tokens. On arrival the token is consumed and `onArrive`
 * decides what it turns into — that lives in economy.ts so this file stays
 * about movement.
 */
export function updatePakkuns(
  state: GameState,
  dt: number,
  onArrive: (playerId: number, kind: AltarKind, emit: (e: EngineEvent) => void) => void,
  emit: (event: EngineEvent) => void
): void {
  const arrived: PakkunToken[] = [];

  for (const token of state.pakkuns) {
    if (!token.target) continue;
    token.elapsed += dt;
    const t = Math.min(1, token.elapsed / token.duration);
    const to = altarPosition(token.target);
    token.x = token.fromX + (to.x - token.fromX) * t;
    token.z = token.fromZ + (to.z - token.fromZ) * t;
    if (t >= 1) arrived.push(token);
  }

  if (!arrived.length) return;

  for (const token of arrived) {
    const index = state.pakkuns.indexOf(token);
    if (index >= 0) state.pakkuns.splice(index, 1);
    onArrive(token.owner, token.target!, emit);
  }
  for (const player of state.players) restack(state, player.id);
}
