/**
 * Every tuning number the engine reads, and the conversions from Warcraft's
 * scales to ours. Keeping them here means a rebalance never means hunting
 * through the simulation.
 */

/** Simulation ticks per second. Fixed step; rendering interpolates between. */
export const TICK_RATE = 20;
export const TICK_DT = 1 / TICK_RATE;

/** A Warcraft terrain cell is 128 map units; ours is 1 world unit. */
export const MAP_UNITS_PER_CELL = 128;

/** Attack range: Warcraft map units -> world units. */
export function rangeToWorld(mapUnits: number): number {
  return mapUnits / MAP_UNITS_PER_CELL;
}

/**
 * Mob movement. The source map's speeds (500-522) are in map units per second;
 * at our scale that would cross the whole loop in four seconds, which reads as
 * chaos on a 10x10 plot, so lane speed is authored directly instead.
 */
export const MOB_SPEED = 2.5;
export const BOSS_SPEED = 2.0;

/** How fast a repositioned unit walks, in cells per second. */
export const UNIT_WALK_SPEED = 3;
/** Pakkun tokens trot to their altar faster than a unit repositions. */
export const PAKKUN_WALK_SPEED = 6;

/** Round timing, from the original: 30s for rounds 1-9, 42s from 10 on. */
export function roundDuration(round: number): number {
  return round < 10 ? 30 : 42;
}

/** Rounds with a hard time limit; failing to clear them ends the run. */
export const HARD_LIMIT_ROUNDS = new Set([80, 85]);
export const HARD_LIMIT_SECONDS = 300;

export const MOBS_PER_WAVE = 20;
export const SPAWN_INTERVAL = 0.6;
/** Ceiling on live mobs; the death count always trips well before this. */
export const MOB_CAPACITY = 512;

/** Death count tightens for the last stretch, as in the original. */
export const FINAL_STRETCH_ROUND = 80;

export const START_PAKKUN = 7;
export const PAKKUN_PER_ROUND = 2;
export const PAKKUN_GOLD = 100;
export const PAKKUN_WOOD_CHANCE = 0.6;

export const HIRE_COST = {
  normal: { gold: 200, wood: 1 },
  magic: { gold: 250, wood: 1 },
} as const;

export const GAMBLE_COST = { 1: 1, 3: 3, 5: 5 } as const;

/** Kill rewards. */
export function killBounty(round: number): number {
  return 2 + Math.floor(round / 10);
}
export const BOSS_BOUNTY_GOLD = 30;
export const BOSS_BOUNTY_WOOD = 1;

/** Sell refunds by grade: gold for the cheap tiers, wood for the rest. */
export const SELL_REFUND: Record<string, { gold?: number; wood?: number }> = {
  normal: { gold: 40 },
  magic: { gold: 60 },
  rare: { wood: 1 },
  unique: { wood: 2 },
  hidden: { wood: 3 },
  jinchuriki: { wood: 3 },
  bijuu: { wood: 3 },
  legend: { wood: 3 },
  elite: { wood: 4 },
  limit: { wood: 5 },
  epic: { wood: 5 },
  infinity: { wood: 6 },
  creation: { wood: 8 },
  special: { wood: 3 },
  ruin: { wood: 6 },
};

/** Rank missions every five rounds. */
export const MISSION_INTERVAL = 5;
export const MISSION_TABLE = [
  { rank: 'S' as const, chance: 0.099, wood: 20, oncePerGame: true },
  { rank: 'A' as const, chance: 0.101, wood: 5, oncePerGame: false },
  { rank: 'B' as const, chance: 0.3, wood: 3, oncePerGame: false },
  { rank: 'C' as const, chance: 0.5, wood: 1, oncePerGame: false },
];

/**
 * Warcraft's armour curve. Positive armour gives diminishing reduction;
 * negative armour amplifies damage — which matters here, because the source
 * map's early mobs sit at -47 armour.
 */
export function armorMultiplier(armor: number): number {
  if (armor >= 0) return 1 - (0.06 * armor) / (1 + 0.06 * armor);
  return 2 - Math.pow(0.94, -armor);
}

/** Unit damage is scaled down from the map's numbers to keep rounds readable. */
export const UNIT_DAMAGE_SCALE = 1;
/** Mob HP is scaled likewise; the source curve is tuned for 3 co-op players. */
export const MOB_HP_SCALE = 0.35;

export const STUN_BOSS_FACTOR = 0.25;
export const DEFAULT_SLOW_AMOUNT = 0.3;
export const DEFAULT_SLOW_SECONDS = 2;
export const DEFAULT_STUN_SECONDS = 1;
export const ARMOR_REDUCE_SECONDS = 4;
export const ARMOR_REDUCE_MAX_STACKS = 3;
export const AURA_RADIUS = 4;

/** Mana skills: what a filled bar actually does. */
export const MANA_SKILL = {
  /** 노바 — a burst around the caster. */
  novaRadius: 3,
  novaPct: 1.5,
  /** 처형 — finishes a target already below this share of its health. */
  executeThreshold: 0.2,
  /** 강타 — one oversized hit on the current target. */
  bigHitPct: 4,
} as const;
