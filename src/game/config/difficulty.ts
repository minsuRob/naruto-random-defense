/**
 * Difficulty tiers.
 *
 * The original map ships 7 (이지/하드/헬/전설/익스트림/이자나기/무한츠쿠요미). v1 implements
 * the first three; the remaining slots are listed so balance work can fill them in later.
 */

export type DifficultyId = 'easy' | 'hard' | 'hell';

export interface DifficultyDef {
  id: DifficultyId;
  nameKo: string;
  /** Mobs alive on your lane that ends the run. */
  deathCount: number;
  /** Tightened death count from round 80 on (the original drops to 50). */
  finalDeathCount: number;
  /** Multiplier applied to the wave HP table. */
  hpMult: number;
  /** Multiplier applied to kill bounties. */
  goldMult: number;
  /**
   * Opening grant. The original announces it up front — "선택한 난이도의 초기지급
   * 보상 파쿤 7개 나무 19개" — and hands the harder tiers extra pakkun to pay for
   * the tougher waves.
   */
  startPakkun: number;
  startWood: number;
  /** Pakkun handed out at the end of every round. */
  pakkunPerRound: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  easy: {
    id: 'easy',
    nameKo: '이지',
    deathCount: 100,
    finalDeathCount: 50,
    hpMult: 1,
    goldMult: 1,
    startPakkun: 7,
    startWood: 19,
    pakkunPerRound: 4,
  },
  hard: {
    id: 'hard',
    nameKo: '하드',
    deathCount: 85,
    finalDeathCount: 50,
    hpMult: 1.8,
    goldMult: 1.15,
    startPakkun: 9,
    startWood: 19,
    pakkunPerRound: 4,
  },
  hell: {
    id: 'hell',
    nameKo: '헬',
    deathCount: 70,
    finalDeathCount: 50,
    hpMult: 3.2,
    goldMult: 1.3,
    startPakkun: 11,
    startWood: 19,
    pakkunPerRound: 5,
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = ['easy', 'hard', 'hell'];

export function resolveDifficulty(id: string | undefined): DifficultyDef {
  return DIFFICULTIES[(id as DifficultyId) ?? 'easy'] ?? DIFFICULTIES.easy;
}
