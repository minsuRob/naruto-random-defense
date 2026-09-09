import type { Bounds } from '@/game/camera/camera-rig';

/**
 * World <-> minimap transform. The minimap is north-up regardless of camera yaw:
 * -z (away from the viewer) is the top of the map, matching a yaw-0 camera.
 */
export interface MinimapProjection {
  width: number;
  height: number;
  bounds: Bounds;
  worldToMap(x: number, z: number, out?: [number, number]): [number, number];
  mapToWorld(px: number, py: number, out?: [number, number]): [number, number];
}

export function createMinimapProjection(
  bounds: Bounds,
  width: number,
  height: number
): MinimapProjection {
  const sx = width / (bounds.maxX - bounds.minX);
  const sz = height / (bounds.maxZ - bounds.minZ);

  return {
    width,
    height,
    bounds,
    worldToMap(x, z, out = [0, 0]) {
      out[0] = (x - bounds.minX) * sx;
      out[1] = (z - bounds.minZ) * sz;
      return out;
    },
    mapToWorld(px, py, out = [0, 0]) {
      out[0] = bounds.minX + px / sx;
      out[1] = bounds.minZ + py / sz;
      return out;
    },
  };
}
