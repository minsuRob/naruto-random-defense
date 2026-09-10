import { describe, expect, it } from 'vitest';

import { DIFFICULTIES } from '@/game/config/difficulty';
import { UNIT_BY_ID } from '@/game/data/units';
import { addUnit, moveUnit } from '@/game/engine/economy';
import { createEngine, skipPrep } from '@/game/engine/engine';
import { unitAnimationFor } from './unit-animation';

/**
 * Clip selection. The clips themselves are checked against three's loader in
 * tools/w3x/mdx2glb.test.mts; this is the rule that decides which one plays.
 */

function engineWithUnit() {
  const engine = createEngine({ difficulty: DIFFICULTIES.easy, seed: 1 });
  skipPrep(engine);
  engine.state.plots[0].occupancy.fill(0);
  const defId = [...UNIT_BY_ID.keys()][0];
  const unit = addUnit(engine.state, 0, defId, 'gacha', () => {})!;
  return { engine, unit };
}

describe('unit animation', () => {
  it('stands by default', () => {
    const { engine, unit } = engineWithUnit();
    expect(unitAnimationFor(engine, unit.id)).toBe('stand');
  });

  it('walks while under a move order', () => {
    const { engine, unit } = engineWithUnit();
    moveUnit(engine.state, unit.id, { cx: 9, cy: 9 });
    expect(unitAnimationFor(engine, unit.id)).toBe('walk');

    for (let i = 0; i < 20 * 6; i++) engine.tick();
    expect(unitAnimationFor(engine, unit.id)).toBe('stand');
  });

  it('attacks while it holds a live target', () => {
    const { engine, unit } = engineWithUnit();
    // Run until the wave arrives and the unit engages something.
    let sawAttack = false;
    for (let i = 0; i < 20 * 30; i++) {
      engine.tick();
      if (unitAnimationFor(engine, unit.id) === 'attack') {
        sawAttack = true;
        break;
      }
    }
    expect(sawAttack).toBe(true);
  });

  it('prefers walking over attacking — a moving unit holds fire', () => {
    const { engine, unit } = engineWithUnit();
    for (let i = 0; i < 20 * 30 && unit.targetMob < 0; i++) engine.tick();
    expect(unit.targetMob).toBeGreaterThanOrEqual(0);

    moveUnit(engine.state, unit.id, { cx: 5, cy: 5 });
    expect(unitAnimationFor(engine, unit.id)).toBe('walk');
  });

  it('stands for a unit that no longer exists', () => {
    const { engine } = engineWithUnit();
    expect(unitAnimationFor(engine, 9999)).toBe('stand');
  });
});
