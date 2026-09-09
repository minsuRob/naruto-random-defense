import type { DifficultyDef } from '@/game/config/difficulty';
import type { Grade } from '@/game/data/units';
import type { DraftState } from './draft';
import type { Lane } from './lane';
import type { Rng } from './rng';

/** Everything the simulation knows. No React, no three, no react-native. */

export type DamageType = 'phys' | 'magic';

export type Ability =
  | { kind: 'stun'; chance: number; seconds: number }
  | { kind: 'slow'; chance: number; amount: number; seconds: number }
  | { kind: 'armorReduce'; amount: number; seconds: number; maxStacks: number }
  | { kind: 'delete'; chance: number }
  | { kind: 'percentDamage'; pct: number }
  | { kind: 'auraAtkSpeed'; pct: number; radius: number }
  | { kind: 'auraAtk'; pct: number; radius: number };

export interface UnitDef {
  id: string;
  nameKo: string;
  grade: Grade;
  damage: number;
  cooldown: number;
  /** World units. */
  range: number;
  damageType: DamageType;
  abilities: Ability[];
}

export interface MobDef {
  id: string;
  nameKo: string;
  hp: number;
  armor: number;
  damageType: DamageType;
  speed: number;
  scale: number;
  isBoss: boolean;
  bounty: number;
}

/**
 * Mobs live in a struct-of-arrays pool: hundreds of them are updated every
 * tick, and typed arrays keep that allocation-free.
 */
export interface MobPool {
  readonly capacity: number;
  /** Highest slot ever used; iterate [0, count). */
  count: number;
  alive: number;
  active: Uint8Array;
  plot: Uint8Array;
  defIndex: Int16Array;
  /** Arc-length position on the lane, and the previous tick's, for interpolation. */
  s: Float32Array;
  sPrev: Float32Array;
  x: Float32Array;
  z: Float32Array;
  hp: Float32Array;
  maxHp: Float32Array;
  speed: Float32Array;
  armor: Float32Array;
  stunUntil: Float32Array;
  slowUntil: Float32Array;
  slowMul: Float32Array;
  armorReduce: Float32Array;
  armorReduceUntil: Float32Array;
  armorReduceStacks: Uint8Array;
  isBoss: Uint8Array;
  lap: Uint16Array;
  freeList: number[];
}

export interface UnitInstance {
  id: number;
  defId: string;
  owner: number;
  plot: number;
  /** The cell the unit owns. Set the moment a move is ordered, not on arrival. */
  cell: { cx: number; cy: number };
  x: number;
  z: number;
  cooldown: number;
  targetMob: number;
  buffAtkSpeedPct: number;
  buffAtkPct: number;
  /**
   * Warcraft units walk to where you send them, and hold fire until they get
   * there. Non-null while a unit is in transit.
   */
  walk: {
    fromX: number;
    fromZ: number;
    toX: number;
    toZ: number;
    elapsed: number;
    duration: number;
  } | null;
}

export interface Plot {
  id: number;
  owner: number;
  origin: { x: number; z: number };
  lane: Lane;
  occupancy: Uint8Array;
}

export interface Player {
  id: number;
  gold: number;
  wood: number;
  pakkun: number;
  sMissionUsed: boolean;
  alive: boolean;
}

export type RoundPhase = 'draft' | 'prep' | 'wave' | 'ended';

export interface SpawnEntry {
  at: number;
  defIndex: number;
  plot: number;
  s: number;
}

export interface RoundState {
  number: number;
  phase: RoundPhase;
  elapsed: number;
  duration: number;
  hardLimit: number | null;
  spawnQueue: SpawnEntry[];
  spawned: number;
  bossAlive: boolean;
}

export interface GameState {
  tick: number;
  time: number;
  seed: number;
  rng: Rng;
  difficulty: DifficultyDef;
  over: boolean;
  outcome: 'win' | 'lose' | null;
  players: Player[];
  plots: Plot[];
  mobs: MobPool;
  mobDefs: MobDef[];
  units: Map<number, UnitInstance>;
  nextUnitId: number;
  rosterVersion: number;
  round: RoundState;
  aliveOnLane: Uint16Array;
  draft: DraftState;
}

export type Command =
  | { t: 'PAKKUN_DOWN' | 'PAKKUN_UP' | 'PAKKUN_GOLD' | 'PAKKUN_WOOD'; player: number }
  | { t: 'GAMBLE'; player: number; tier: 1 | 3 | 5 }
  | { t: 'HIRE'; player: number; grade: 'normal' | 'magic' }
  | { t: 'SELL'; player: number; unitIds: number[] }
  | { t: 'MOVE'; player: number; unitId: number; cell: { cx: number; cy: number } }
  | { t: 'COMBINE'; player: number; recipeId: string; preferIds?: number[] }
  | { t: 'DRAFT_PICK'; player: number; optionIndex: number };

export type EngineEvent =
  | { e: 'roundStart'; round: number }
  | { e: 'roundEnd'; round: number }
  | { e: 'mobDie'; index: number; x: number; z: number; boss: boolean }
  | { e: 'hit'; unitId: number; mobIndex: number; damage: number; killing: boolean }
  | { e: 'unitAdd'; unitId: number; defId: string; via: 'gacha' | 'combine' | 'hire' }
  | { e: 'unitRemove'; unitId: number; defId: string }
  | { e: 'mission'; rank: 'S' | 'A' | 'B' | 'C'; wood: number }
  | { e: 'log'; text: string }
  | { e: 'draftPick'; rankKo: string; defId: string; auto: boolean }
  | { e: 'draftDone' }
  | { e: 'gameOver'; outcome: 'win' | 'lose' };
