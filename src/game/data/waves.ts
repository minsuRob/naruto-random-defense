import raw from './generated/waves.raw.json';

/**
 * Round table, read from the source map (tools/w3x/mobs-from-w3u.mjs, part of
 * units-from-w3u.mjs). These are the original numbers: HP 40 on round 1 up to
 * 2.1M on round 100, armor starting at -47 and climbing past +250.
 *
 * Some rounds ship more than one mob type; the first entry is the one that
 * defines the round.
 */

export interface RawWave {
  round: number;
  nameKo: string;
  w3uId: string;
  hp: number;
  armor: number;
  armorType: string;
  moveSpeed: number;
  scale: number;
  model: string | null;
}

export interface RawBoss {
  slot: string;
  nameKo: string;
  w3uId: string;
  hp: number;
  armor: number;
  armorType: string;
  scale: number;
  model: string | null;
}

export const WAVES = raw.waves as RawWave[];
export const BOSSES = raw.bosses as RawBoss[];

/** The last round the source map defines. */
export const FINAL_ROUND = WAVES.reduce((max, w) => Math.max(max, w.round), 0);

const BY_ROUND = new Map<number, RawWave>();
for (const wave of WAVES) {
  if (!BY_ROUND.has(wave.round)) BY_ROUND.set(wave.round, wave);
}

export function waveFor(round: number): RawWave {
  const exact = BY_ROUND.get(round);
  if (exact) return exact;
  // Past the table, keep extrapolating from the last defined round.
  const last = BY_ROUND.get(FINAL_ROUND)!;
  const over = round - FINAL_ROUND;
  return { ...last, round, hp: last.hp * Math.pow(1.15, over) };
}

/**
 * Boss for a round, following the original cadence: rounds ending in 0 use the
 * west gate, rounds ending in 3 the east gate.
 */
export function bossFor(round: number): { boss: RawBoss; gate: 'west' | 'east' } | null {
  const gate = round % 10 === 0 ? 'west' : round % 10 === 3 ? 'east' : null;
  if (!gate || round < 3) return null;
  // Slots run 1-1, 1-2, 2-1, 2-2, ...; step through them in round order.
  const index = Math.floor((round - 3) / 10) * 2 + (gate === 'west' ? 1 : 0);
  const boss = BOSSES[Math.min(index, BOSSES.length - 1)];
  return boss ? { boss, gate } : null;
}
