import raw from './generated/units.raw.json';

/**
 * Unit table, read from the source map (tools/w3x/units-from-w3u.mjs).
 *
 * The raw rows keep Warcraft's own scales — range in map units (100 per cell),
 * cooldown in seconds. Converting them into engine values happens in
 * config/balance.ts so the numbers live in one place.
 */

export type Grade =
  | 'normal'
  | 'magic'
  | 'rare'
  | 'unique'
  | 'legend'
  | 'hidden'
  | 'jinchuriki'
  | 'bijuu'
  | 'elite'
  | 'limit'
  | 'epic'
  | 'infinity'
  | 'creation'
  | 'special'
  | 'ruin';

export const GRADE_ORDER: Grade[] = [
  'normal',
  'magic',
  'rare',
  'unique',
  'legend',
  'hidden',
  'jinchuriki',
  'bijuu',
  'elite',
  'limit',
  'epic',
  'infinity',
  'creation',
  'special',
  'ruin',
];

export const GRADE_LABEL: Record<Grade, string> = {
  normal: '노말',
  magic: '매직',
  rare: '레어',
  unique: '유니크',
  legend: '전설',
  hidden: '히든',
  jinchuriki: '인주력',
  bijuu: '미수',
  elite: '엘리트',
  limit: '리미트',
  epic: '에픽',
  infinity: '인피니티',
  creation: '창조',
  special: '스페셜',
  ruin: '파멸',
};

export interface RawUnit {
  id: string;
  nameKo: string;
  grade: Grade;
  w3uId: string;
  w3uIds: string[];
  attack: {
    base: number;
    dice: number;
    sides: number;
    cooldown: number;
    /** Warcraft map units; 100 of them is one placement cell. */
    range: number;
    type: string;
  };
  hp: number;
  moveSpeed: number;
  scale: number;
  abilities: string[];
  model: string | null;
}

export const UNITS = raw.units as RawUnit[];

export const UNIT_BY_ID = new Map<string, RawUnit>(UNITS.map((u) => [u.id, u]));

export function unitsOfGrade(grade: Grade): RawUnit[] {
  return UNITS.filter((u) => u.grade === grade);
}
