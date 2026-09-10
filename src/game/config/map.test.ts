import { describe, expect, it } from 'vitest';

import {
  ALTARS,
  ISLAND_HALF,
  LANE_CORNER_RADIUS,
  LANE_HALF,
  LANE_WIDTH,
  PAKKUN_ROW,
  PLAZA_HALF,
  PLAZA_PEDESTAL_RADIUS,
  PLOT_COUNT,
  PLOT_HALF,
  mapBounds,
  pakkunHoldingSpot,
  plotOrigin,
} from './map';

/**
 * Geometry invariants for the four islands and the plaza they surround.
 *
 * These numbers only work together. Nudging any one of PLOT_OFFSET,
 * PLAZA_HALF, ALTAR_RADIUS or LANE_HALF can push an island into the plaza or a
 * pakkun queue on top of an altar, and nothing else in the suite would notice —
 * the game would just look wrong. This file is the thing that notices.
 */

const origins = Array.from({ length: PLOT_COUNT }, (_, i) => plotOrigin(i));

/**
 * How far the lane's silhouette actually reaches along the diagonal.
 *
 * Less than ISLAND_HALF, because the corner an island points at the plaza is
 * rounded — that rounding is what buys the plaza its room.
 */
const DIAGONAL_REACH =
  LANE_HALF - LANE_CORNER_RADIUS + (LANE_CORNER_RADIUS + LANE_WIDTH / 2) * Math.SQRT1_2;

describe('island layout', () => {
  it('places one island per quadrant, with dense ids', () => {
    expect(origins).toHaveLength(4);

    const quadrants = origins.map((o) => `${Math.sign(o.x)},${Math.sign(o.z)}`);
    expect(new Set(quadrants).size).toBe(4);
    // Plot ids index a Uint8Array and a plots array position alike.
    expect(plotOrigin(0)).toEqual(plotOrigin(PLOT_COUNT));
  });

  it('keeps the islands clear of each other', () => {
    for (let a = 0; a < origins.length; a++) {
      for (let b = a + 1; b < origins.length; b++) {
        const gap = Math.max(
          Math.abs(origins[a].x - origins[b].x),
          Math.abs(origins[a].z - origins[b].z)
        );
        expect(gap).toBeGreaterThan(ISLAND_HALF * 2);
      }
    }
  });

  it('keeps the islands out of the plaza', () => {
    const plazaCorner = PLAZA_HALF * Math.SQRT2;
    for (const origin of origins) {
      const centreDistance = Math.hypot(origin.x, origin.z);
      expect(centreDistance - DIAGONAL_REACH).toBeGreaterThan(plazaCorner);
    }
  });

  it('draws bounds that contain every island', () => {
    const b = mapBounds();
    for (const origin of origins) {
      expect(origin.x - ISLAND_HALF).toBeGreaterThan(b.minX);
      expect(origin.x + ISLAND_HALF).toBeLessThan(b.maxX);
      expect(origin.z - ISLAND_HALF).toBeGreaterThan(b.minZ);
      expect(origin.z + ISLAND_HALF).toBeLessThan(b.maxZ);
    }
  });
});

describe('plaza layout', () => {
  it('puts each altar in the plaza, off the pedestal, one per direction', () => {
    for (const altar of ALTARS) {
      expect(Math.abs(altar.pos.x)).toBeLessThan(PLAZA_HALF);
      expect(Math.abs(altar.pos.z)).toBeLessThan(PLAZA_HALF);
      expect(Math.hypot(altar.pos.x, altar.pos.z)).toBeGreaterThan(PLAZA_PEDESTAL_RADIUS);
      // On an axis: exactly one coordinate is zero. That is what makes the
      // four of them read as up / right / down / left.
      expect([altar.pos.x === 0, altar.pos.z === 0].filter(Boolean)).toHaveLength(1);
    }
    expect(new Set(ALTARS.map((a) => a.arrow)).size).toBe(4);
  });

  it('parks every queue on the pedestal without crossing an altar', () => {
    for (let plot = 0; plot < PLOT_COUNT; plot++) {
      // A dozen tokens is more than any round hands out; they all fit on the
      // pedestal rather than spilling onto the plaza floor.
      for (let slot = 0; slot < PAKKUN_ROW * 3; slot++) {
        expect(
          Math.hypot(...Object.values(pakkunHoldingSpot(plot, slot)))
        ).toBeLessThan(PLAZA_PEDESTAL_RADIUS);
      }

      for (let slot = 0; slot < 24; slot++) {
        const spot = pakkunHoldingSpot(plot, slot);
        expect(Math.abs(spot.x)).toBeLessThan(PLAZA_HALF);
        expect(Math.abs(spot.z)).toBeLessThan(PLAZA_HALF);
        for (const altar of ALTARS) {
          expect(Math.hypot(spot.x - altar.pos.x, spot.z - altar.pos.z)).toBeGreaterThan(1);
        }
      }
    }
  });

  it('gives each player their own quadrant of the pedestal', () => {
    // A queue leans toward its own island, so no two players ever overlap.
    for (let plot = 0; plot < PLOT_COUNT; plot++) {
      const origin = plotOrigin(plot);
      for (let slot = 0; slot < PAKKUN_ROW * 3; slot++) {
        const spot = pakkunHoldingSpot(plot, slot);
        expect(Math.sign(spot.x)).toBe(Math.sign(origin.x));
        expect(Math.sign(spot.z)).toBe(Math.sign(origin.z));
      }
    }
  });

  it('sits clear of every island build grid', () => {
    for (const origin of origins) {
      const nearestCorner = Math.hypot(
        Math.abs(origin.x) - PLOT_HALF,
        Math.abs(origin.z) - PLOT_HALF
      );
      expect(nearestCorner).toBeGreaterThan(PLAZA_HALF * Math.SQRT2);
    }
  });
});
