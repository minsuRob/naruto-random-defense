import { describe, expect, it } from 'vitest';

import { UNIT_DEFS } from './abilities';
import { GRADE_ORDER, type Grade } from './units';

/**
 * The unit table is extracted, not authored, so these guard the shape of what
 * comes out: no unit should be unusable, and the grades should still climb.
 */
describe('unit definitions', () => {
  it('gives every unit usable numbers', () => {
    for (const def of UNIT_DEFS) {
      expect(def.damage).toBeGreaterThan(0);
      expect(def.cooldown).toBeGreaterThan(0);
      expect(def.range).toBeGreaterThanOrEqual(1.5);
      expect(Number.isFinite(def.damage)).toBe(true);
    }
  });

  it('leaves no unit on the "no data" floor of 1 damage', () => {
    const stranded = UNIT_DEFS.filter((d) => d.damage <= 1);
    expect(stranded.map((d) => d.nameKo)).toEqual([]);
  });

  it('keeps damage climbing with grade', () => {
    const medianFor = (grade: Grade) => {
      const values = UNIT_DEFS.filter((d) => d.grade === grade).map((d) => d.damage).sort((a, b) => a - b);
      return values.length ? values[Math.floor(values.length / 2)] : null;
    };

    const ladder: Grade[] = ['normal', 'magic', 'rare', 'unique', 'legend'];
    const medians = ladder.map(medianFor).filter((v): v is number => v !== null);
    for (let i = 1; i < medians.length; i++) {
      expect(medians[i]).toBeGreaterThan(medians[i - 1]);
    }
  });

  it('covers every grade the roster uses', () => {
    const grades = new Set(UNIT_DEFS.map((d) => d.grade));
    for (const grade of grades) expect(GRADE_ORDER).toContain(grade);
  });
});
