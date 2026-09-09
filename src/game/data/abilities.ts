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
import type { Ability, ManaSkill, UnitDef } from '@/game/engine/types';
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
  /** 스플래시 — radius in cells, and the share of the hit it carries. */
  splashRadius?: number;
  splashPct?: number;
  /** 멀티샷 — extra targets struck by the same attack. */
  multishot?: number;
  multishotPct?: number;
  /** 크리티컬 — chance in percent, and the multiplier. */
  critPct?: number;
  critMultiplier?: number;
  /** 넉백 — chance in percent, and how far back along the lane it shoves. */
  knockbackPct?: number;
  knockbackDistance?: number;
  /** 마나 — how much a bar holds, how much a hit adds, and what it casts. */
  mana?: number;
  manaPerHit?: number;
  manaSkill?: ManaSkill;
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
  '센쥬 하시라마 1대 호카게': { thunderclapPct: 15, stunSec: 1.3, mana: 100, manaPerHit: 12, manaSkill: 'nova' },

  // 이감(슬로우)
  '쿠레나이': { slowPct: 15, slowAmount: 0.3, slowSec: 2, damageType: 'magic' },
  '테마리 풍둔술사': { slowPct: 15, slowAmount: 0.35, slowSec: 2 },
  '센쥬 토비라마 2대 호카게': { slowPct: 15, slowAmount: 0.4, slowSec: 2, damageType: 'magic' },
  '호즈키 만게츠 예토전생': { slowPct: 15, slowAmount: 0.35, slowSec: 2 },
  '모모치 자부자 예토전생': { slowPct: 7, slowAmount: 0.3, slowSec: 2 },
  '야구라 3미의 인주력': { slowPct: 15, slowAmount: 0.35, slowSec: 2 },

  // 방깍
  '우치하 마다라': { armorReduce: 11, mana: 120, manaPerHit: 10, manaSkill: 'nova' },
  '우치하 오비토 윤회안': { armorReduce: 5.3 },
  '우치하 사스케 기린': { armorReduce: 5, mana: 100, manaPerHit: 12, manaSkill: 'bigHit' },
  '휴우가 네지 백안': { armorReduce: 2.5 },
  '하타케 카카시 만화경사륜안': { armorReduce: 5.3, mana: 100, manaPerHit: 15, manaSkill: 'execute' },
  '모모치 자부자': { armorReduce: 2.5 },

  // 삭제
  '시무라 단조': { deletePct: 10, damageType: 'magic' },
  '오오노키 츠치카게': { deletePct: 2 },
  '칸쿠로 흑비기 인형술사': { deletePct: 1 },

  // 공속·공버프 오라
  '하루노 사쿠라': { atkBuffPct: 45 },
  '야쿠시 카부토': { atkBuffPct: 45 },
  '우즈마키 나루토': { atkSpeedPct: 20 },
  '나미카제 미나토 금빛섬광': { atkSpeedPct: 20, mana: 80, manaPerHit: 14, manaSkill: 'execute' },

  // 퍼센트 데미지
  '가아라 카제카게': { percentDmgPct: 2 },
  '1미 슈카쿠': { percentDmgPct: 3 },

  // 스플래시 — 광역기를 쓰는 캐릭터들
  '데이다라 아카츠키': { splashRadius: 2, splashPct: 0.5 },
  '데이다라 예토전생': { splashRadius: 2.5, splashPct: 0.55 },
  '가아라 반수화 상태': { splashRadius: 2.2, splashPct: 0.45, knockbackPct: 12 },
  '우치하 이타치 아마테라스': { splashRadius: 2, splashPct: 0.6, damageType: 'magic' },
  '킬러 비 미수화': { splashRadius: 2.4, splashPct: 0.5 },

  // 멀티샷 — 분신·다중 공격
  '나루토 나선수리검': { multishot: 2, multishotPct: 0.6 },
  '텐텐': { multishot: 2, multishotPct: 0.5 },
  '사이': { multishot: 1, multishotPct: 0.7 },
  '호즈키 스이게츠': { multishot: 2, multishotPct: 0.55 },

  // 크리티컬 — 한 방이 무거운 근접형
  '록리': { critPct: 20, critMultiplier: 2.5 },
  '마이트 가이': { critPct: 25, critMultiplier: 3 },
  '키미마로': { critPct: 18, critMultiplier: 2.2 },
  '휴우가 네지': { critPct: 20, critMultiplier: 2 },

  // 넉백 — 밀어내는 술법
  '테마리': { knockbackPct: 25, knockbackDistance: 2, slowPct: 10 },
  '다루이 혈계한계 람둔': { knockbackPct: 18, knockbackDistance: 1.5, thunderclapPct: 12 },

};

/**
 * Grade -> a baseline sheet, so every unit contributes something even before it
 * gets an entry of its own. Higher grades pick up more of the kit, which is what
 * makes a combination feel like a step up rather than just a bigger number.
 */
const GRADE_BASELINE: Partial<Record<Grade, AbilitySheet>> = {
  rare: { slowPct: 5, slowAmount: 0.2, slowSec: 1.5, critPct: 8 },
  unique: { armorReduce: 1, critPct: 10, splashRadius: 1.4, splashPct: 0.25 },
  legend: {
    armorReduce: 2,
    thunderclapPct: 8,
    stunSec: 0.5,
    critPct: 12,
    splashRadius: 1.6,
    splashPct: 0.3,
  },
  hidden: { thunderclapPct: 10, stunSec: 0.8, multishot: 1, multishotPct: 0.45 },
  jinchuriki: { slowPct: 12, slowAmount: 0.3, slowSec: 2, knockbackPct: 10 },
  bijuu: { percentDmgPct: 1, armorReduce: 2, splashRadius: 2, splashPct: 0.4 },
  elite: { armorReduce: 3, atkSpeedPct: 10, critPct: 15, critMultiplier: 2.2 },
  limit: {
    thunderclapPct: 15,
    stunSec: 1,
    armorReduce: 3,
    mana: 110,
    manaPerHit: 10,
    manaSkill: 'bigHit',
  },
  epic: {
    armorReduce: 4,
    atkBuffPct: 10,
    splashRadius: 2,
    splashPct: 0.4,
    mana: 120,
    manaPerHit: 9,
    manaSkill: 'nova',
  },
  infinity: {
    armorReduce: 5,
    deletePct: 1,
    multishot: 2,
    multishotPct: 0.5,
    mana: 100,
    manaPerHit: 12,
    manaSkill: 'execute',
  },
  creation: {
    armorReduce: 6,
    deletePct: 2,
    atkBuffPct: 15,
    splashRadius: 2.6,
    splashPct: 0.6,
    mana: 90,
    manaPerHit: 14,
    manaSkill: 'nova',
  },
  special: { atkSpeedPct: 15, critPct: 12 },
  ruin: { deletePct: 3, armorReduce: 4, multishot: 1, multishotPct: 0.6 },
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
  if (sheet.splashRadius) {
    abilities.push({
      kind: 'splash',
      radius: sheet.splashRadius,
      pct: sheet.splashPct ?? 0.4,
    });
  }
  if (sheet.multishot) {
    abilities.push({
      kind: 'multishot',
      extraTargets: sheet.multishot,
      pct: sheet.multishotPct ?? 0.6,
    });
  }
  if (sheet.critPct) {
    abilities.push({
      kind: 'critical',
      chance: sheet.critPct / 100,
      multiplier: sheet.critMultiplier ?? 2,
    });
  }
  if (sheet.knockbackPct) {
    abilities.push({
      kind: 'knockback',
      chance: sheet.knockbackPct / 100,
      distance: sheet.knockbackDistance ?? 1.5,
    });
  }
  if (sheet.mana && sheet.manaSkill) {
    abilities.push({
      kind: 'manaSkill',
      max: sheet.mana,
      perHit: sheet.manaPerHit ?? 10,
      skill: sheet.manaSkill,
    });
  }
  return abilities;
}

/**
 * Warcraft object files only record fields that *differ* from the base unit, so
 * a lot of rows carry no damage or cooldown at all — those values live in the
 * game's own unit data, which is not in the map.
 *
 * The stated values are strongly grouped by grade (every 노말 is 19, every 매직
 * is 99, and so on), so the gap is filled with the median of what that grade
 * does state. That is derived from the map rather than invented, and it fixes
 * itself if the extraction ever learns to resolve inheritance.
 */
function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const GRADE_FALLBACK = new Map<Grade, { damage: number; cooldown: number; range: number }>();
{
  const byGrade = new Map<Grade, RawUnit[]>();
  for (const unit of UNITS) {
    const list = byGrade.get(unit.grade) ?? [];
    list.push(unit);
    byGrade.set(unit.grade, list);
  }
  for (const [grade, units] of byGrade) {
    GRADE_FALLBACK.set(grade, {
      damage: median(units.map((u) => u.attack.base).filter((v) => v > 0)),
      cooldown: median(units.map((u) => u.attack.cooldown).filter((v) => v > 0)),
      range: median(units.map((u) => u.attack.range).filter((v) => v > 0)),
    });
  }
}

function toUnitDef(unit: RawUnit): UnitDef {
  const sheet = sheetFor(unit);
  const fallback = GRADE_FALLBACK.get(unit.grade);

  // Warcraft rolls base + dice d sides; the average is what the engine uses.
  const stated = unit.attack.base + (unit.attack.dice * (unit.attack.sides + 1)) / 2;
  const damage = unit.attack.base > 0 ? stated : (fallback?.damage ?? 1);
  const cooldown = unit.attack.cooldown > 0 ? unit.attack.cooldown : (fallback?.cooldown ?? 1);
  const range = unit.attack.range > 0 ? unit.attack.range : (fallback?.range ?? 700);

  return {
    id: unit.id,
    nameKo: unit.nameKo,
    grade: unit.grade,
    damage: Math.max(1, damage * UNIT_DAMAGE_SCALE),
    cooldown: cooldown > 0 ? cooldown : 1,
    range: Math.max(1.5, rangeToWorld(range)),
    damageType: sheet.damageType ?? 'phys',
    abilities: sheetToAbilities(sheet),
  };
}

export const UNIT_DEFS: UnitDef[] = UNITS.map(toUnitDef);
export const UNIT_DEF_BY_ID = new Map<string, UnitDef>(UNIT_DEFS.map((d) => [d.id, d]));
