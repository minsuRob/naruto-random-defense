import { describe, expect, it } from 'vitest';

import { createMinimapProjection } from './minimap-math';

const bounds = { minX: -14, maxX: 14, minZ: -14, maxZ: 14 };
const proj = createMinimapProjection(bounds, 180, 180);

describe('minimap projection', () => {
  it('puts the map centre at the widget centre', () => {
    expect(proj.worldToMap(0, 0)).toEqual([90, 90]);
  });

  it('puts -z at the top', () => {
    const [, topY] = proj.worldToMap(0, bounds.minZ);
    const [, bottomY] = proj.worldToMap(0, bounds.maxZ);
    expect(topY).toBe(0);
    expect(bottomY).toBe(180);
  });

  it('round-trips world -> map -> world', () => {
    for (const [x, z] of [
      [0, 0],
      [-14, -14],
      [14, 14],
      [7.5, -3.25],
    ]) {
      const [px, py] = proj.worldToMap(x, z);
      const [wx, wz] = proj.mapToWorld(px, py);
      expect(wx).toBeCloseTo(x, 10);
      expect(wz).toBeCloseTo(z, 10);
    }
  });

  it('scales a non-square widget independently per axis', () => {
    const wide = createMinimapProjection(bounds, 360, 180);
    expect(wide.worldToMap(bounds.maxX, bounds.maxZ)).toEqual([360, 180]);
  });
});
