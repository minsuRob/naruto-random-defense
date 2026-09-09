import {
  ARMOR_REDUCE_MAX_STACKS,
  ARMOR_REDUCE_SECONDS,
  AURA_RADIUS,
  DEFAULT_SLOW_AMOUNT,
  DEFAULT_SLOW_SECONDS,
  DEFAULT_STUN_SECONDS,
  UNIT_DAMAGE_SCALE,
  rangeToWorld,
} from '@/game/config/balance';
import type { Ability, UnitDef } from '@/game/engine/types';
import { UNITS, type Grade, type RawUnit } from './units';

/**
 * Turns the map's raw unit rows into engine unit definitions.
 *
 * The source map encodes abilities as Warcraft ability codes (A06X, A0HK, ...)
 * which we cannot interpret, so v1 derives an ability sheet from the columns of
 * the 91W chart instead: which effects a unit carries is authored here, keyed by
 * unit id, and everything else falls back to a plain attacker.
 *
 * `SHEETS` is deliberately a plain table — filling in the rest of the roster is
 * data entry, not code.
 */

export interface AbilitySheet {
  /** 썬더클랩 — stun chance in percent. */
  thunderclapPct?: number;
  /** 스턴 — stun duration in seconds. */
  stunSec?: number;
  /** 이감 — slow chance in percent. */
  slowPct?: number;
  /** Movement-speed reduction, 0..1. */
  slowAmount?: number;
  slowSec?: number;
  /** 방깍 — flat armour reduction. */
  armorReduce?: number;
  /** 공속 — attack-speed aura, percent. */
  atkSpeedPct?: number;
  /** 공버프 — attack-damage aura, percent. */
  atkBuffPct?: number;
  /** 퍼센트 데미지 — percent of the target's current HP per hit. */
  percentDmgPct?: number;
  /** 삭제 — instant-kill chance in percent. Bosses are immune. */
  deletePct?: number;
  damageType?: 'phys' | 'magic';
}

/**
 * Ability sheets from the 91W chart. Unit ids come from units.raw.json, so the
 * lookup is by Korean name to keep this table readable and stable across
 * re-extractions.
 */
const SHEETS_BY_NAME: Record<string, AbilitySheet> = {
  // 썬더클랩(스턴)
  겐게츠: { thunderclapPct: 30, stunSec: 1 },
  '휴우가 히나타 백안': { thunderclapPct: 30, stunSec: 0.6 },
  '사루토비 아스마 제10반 대장': { thunderclapPct: 15, stunSec: 0.7 },
  '호시가키 키사메 꼬리없는 미수': { thunderclapPct: 20, stunSec: 1 },
  '아키미치 쵸지 각성모드': { thunderclapPct: 15, stunSec: 1 },
  '센쥬 하시라마 1대 호카게': { thunderclapPct: 15, stunSec: 1.3 },

  // 이감(슬로우)
  '쿠레나이': { slowPct: 15, slowAmount: 0.3, slowSec: 2, damageType: 'magic' },
  '테마리 풍둔술사': { slowPct: 15, slowAmount: 0.35, slowSec: 2 },
  '센쥬 토비라마 2대 호카게': { slowPct: 15, slowAmount: 0.4, slowSec: 2, damageType: 'magic' },
  '호즈키 만게츠 예토전생': { slowPct: 15, slowAmount: 0.35, slowSec: 2 },
  '모모치 자부자 예토전생': { slowPct: 7, slowAmount: 0.3, slowSec: 2 },
  '야구라 3미의 인주력': { slowPct: 15, slowAmount: 0.35, slowSec: 2 },

  // 방깍
  '우치하 마다라': { armorReduce: 11 },
  '우치하 오비토 윤회안': { armorReduce: 5.3 },
  '우치하 사스케 기린': { armorReduce: 5 },
  '휴우가 네지 백안': { armorReduce: 2.5 },
  '하타케 카카시 만화경사륜안': { armorReduce: 5.3 },
  '모모치 자부자': { armorReduce: 2.5 },

  // 삭제
  '시무라 단조': { deletePct: 10, damageType: 'magic' },
  '오오노키 츠치카게': { deletePct: 2 },
  '칸쿠로 흑비기 인형술사': { deletePct: 1 },

  // 공속·공버프 오라
  '하루노 사쿠라': { atkBuffPct: 45 },
  '야쿠시 카부토': { atkBuffPct: 45 },
  '우즈마키 나루토': { atkSpeedPct: 20 },
  '나미카제 미나토 금빛섬광': { atkSpeedPct: 20 },

  // 퍼센트 데미지
  '가아라 카제카게': { percentDmgPct: 2 },
  '1미 슈카쿠': { percentDmgPct: 3 },
};

/** Grade -> a small baseline sheet, so every unit contributes something. */
const GRADE_BASELINE: Partial<Record<Grade, AbilitySheet>> = {
  rare: { slowPct: 5, slowAmount: 0.2, slowSec: 1.5 },
  unique: { armorReduce: 1 },
  legend: { armorReduce: 2, thunderclapPct: 8, stunSec: 0.5 },
  hidden: { thunderclapPct: 10, stunSec: 0.8 },
  jinchuriki: { slowPct: 12, slowAmount: 0.3, slowSec: 2 },
  bijuu: { percentDmgPct: 1, armorReduce: 2 },
  elite: { armorReduce: 3, atkSpeedPct: 10 },
  limit: { thunderclapPct: 15, stunSec: 1, armorReduce: 3 },
  epic: { armorReduce: 4, atkBuffPct: 10 },
  infinity: { armorReduce: 5, deletePct: 1 },
  creation: { armorReduce: 6, deletePct: 2, atkBuffPct: 15 },
  special: { atkSpeedPct: 15 },
  ruin: { deletePct: 3, armorReduce: 4 },
};

export function sheetFor(unit: RawUnit): AbilitySheet {
  return SHEETS_BY_NAME[unit.nameKo] ?? GRADE_BASELINE[unit.grade] ?? {};
}

export function sheetToAbilities(sheet: AbilitySheet): Ability[] {
  const abilities: Ability[] = [];

  if (sheet.thunderclapPct) {
    abilities.push({
      kind: 'stun',
      chance: sheet.thunderclapPct / 100,
      seconds: sheet.stunSec ?? DEFAULT_STUN_SECONDS,
    });
  }
  if (sheet.slowPct) {
    abilities.push({
      kind: 'slow',
      chance: sheet.slowPct / 100,
      amount: sheet.slowAmount ?? DEFAULT_SLOW_AMOUNT,
      seconds: sheet.slowSec ?? DEFAULT_SLOW_SECONDS,
    });
  }
  if (sheet.armorReduce) {
    abilities.push({
      kind: 'armorReduce',
      amount: sheet.armorReduce,
      seconds: ARMOR_REDUCE_SECONDS,
      maxStacks: ARMOR_REDUCE_MAX_STACKS,
    });
  }
  if (sheet.deletePct) abilities.push({ kind: 'delete', chance: sheet.deletePct / 100 });
  if (sheet.percentDmgPct) abilities.push({ kind: 'percentDamage', pct: sheet.percentDmgPct });
  if (sheet.atkSpeedPct) {
    abilities.push({ kind: 'auraAtkSpeed', pct: sheet.atkSpeedPct, radius: AURA_RADIUS });
  }
  if (sheet.atkBuffPct) {
    abilities.push({ kind: 'auraAtk', pct: sheet.atkBuffPct, radius: AURA_RADIUS });
  }
  return abilities;
}

function toUnitDef(unit: RawUnit): UnitDef {
  const sheet = sheetFor(unit);
  // Warcraft rolls base + dice d sides; the average is what the engine uses.
  const averageDamage = unit.attack.base + (unit.attack.dice * (unit.attack.sides + 1)) / 2;
  return {
    id: unit.id,
    nameKo: unit.nameKo,
    grade: unit.grade,
    damage: Math.max(1, averageDamage * UNIT_DAMAGE_SCALE),
    cooldown: unit.attack.cooldown > 0 ? unit.attack.cooldown : 1,
    range: Math.max(1.5, rangeToWorld(unit.attack.range)),
    damageType: sheet.damageType ?? 'phys',
    abilities: sheetToAbilities(sheet),
  };
}

export const UNIT_DEFS: UnitDef[] = UNITS.map(toUnitDef);
export const UNIT_DEF_BY_ID = new Map<string, UnitDef>(UNIT_DEFS.map((d) => [d.id, d]));
