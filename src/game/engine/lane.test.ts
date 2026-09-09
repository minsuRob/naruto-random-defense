import { describe, expect, it } from 'vitest';

import { LANE_CORNER_RADIUS, LANE_HALF } from '@/game/config/map';
import { createLane, lerpWrapped, wrapS } from './lane';

const lane = createLane();

describe('lane geometry', () => {
  it('has the arc length of a rounded rectangle', () => {
    const straight = 2 * (LANE_HALF - LANE_CORNER_RADIUS);
    const expected = 4 * straight + 2 * Math.PI * LANE_CORNER_RADIUS;
    expect(lane.length).toBeCloseTo(expected, 10);
  });

  it('closes the loop', () => {
    const a = lane.positionAt(0);
    const b = lane.positionAt(lane.length);
    expect(b.x).toBeCloseTo(a.x, 10);
    expect(b.z).toBeCloseTo(a.z, 10);
  });

  it('starts at the north edge heading west', () => {
    const p = lane.positionAt(lane.spawnS);
    expect(p.z).toBeCloseTo(-LANE_HALF, 10);
    const t = lane.tangentAt(lane.spawnS);
    expect(t.x).toBeCloseTo(-1, 10);
    expect(t.z).toBeCloseTo(0, 10);
  });

  it('can be built the other way round', () => {
    const clockwise = createLane({ reversed: false });
    const t = clockwise.tangentAt(clockwise.spawnS);
    expect(t.x).toBeCloseTo(1, 10);
    // Same shape either way.
    expect(clockwise.length).toBeCloseTo(lane.length, 10);
  });

  it('reaches the west corner before the east one', () => {
    // A short step from the gate must move west, not east.
    const start = lane.positionAt(lane.spawnS);
    const stepped = lane.positionAt(lane.spawnS + 1);
    expect(stepped.x).toBeLessThan(start.x);
  });

  it('is continuous across every segment boundary', () => {
    const eps = 1e-6;
    for (let s = 0; s < lane.length; s += lane.length / 512) {
      const a = lane.positionAt(s);
      const b = lane.positionAt(s + eps);
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(1e-4);
    }
  });

  it('keeps the tangent continuous and unit length', () => {
    const eps = 1e-4;
    for (let s = 0; s < lane.length; s += lane.length / 512) {
      const t = lane.tangentAt(s);
      expect(Math.hypot(t.x, t.z)).toBeCloseTo(1, 8);
      const next = lane.tangentAt(s + eps);
      // No corner in the centreline: direction may rotate, never flip.
      expect(t.x * next.x + t.z * next.z).toBeGreaterThan(0.99);
    }
  });

  it('never leaves the rounded-rect envelope', () => {
    for (let i = 0; i < 512; i++) {
      const p = lane.positionAt((i / 512) * lane.length);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(LANE_HALF + 1e-9);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(LANE_HALF + 1e-9);
    }
  });

  it('puts the boss gates on the west and east edges', () => {
    const left = lane.positionAt(lane.leftBossS);
    expect(left.x).toBeCloseTo(-LANE_HALF, 10);
    expect(left.z).toBeCloseTo(0, 10);

    const right = lane.positionAt(lane.rightBossS);
    expect(right.x).toBeCloseTo(LANE_HALF, 10);
    expect(right.z).toBeCloseTo(0, 10);
  });

  it('samples the centreline', () => {
    expect(lane.samples.length).toBe(256 * 2);
    const first = lane.positionAt(0);
    expect(lane.samples[0]).toBeCloseTo(first.x, 10);
    expect(lane.samples[1]).toBeCloseTo(first.z, 10);
  });
});

describe('wrapS', () => {
  it('wraps negative values forward', () => {
    expect(wrapS(-1, 10)).toBe(9);
    expect(wrapS(11, 10)).toBe(1);
    expect(wrapS(0, 10)).toBe(0);
  });
});

describe('lerpWrapped', () => {
  it('interpolates inside the loop', () => {
    expect(lerpWrapped(2, 6, 0.5, 10)).toBeCloseTo(4, 10);
  });

  it('interpolates across the seam', () => {
    // 9 -> 1 is a forward step of 2, so halfway is 10 % 10 === 0.
    expect(lerpWrapped(9, 1, 0.5, 10)).toBeCloseTo(0, 10);
    expect(lerpWrapped(9, 1, 0.25, 10)).toBeCloseTo(9.5, 10);
  });
});
