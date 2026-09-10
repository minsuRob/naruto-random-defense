import { Vector3, type Camera } from 'three';

/**
 * Where the four view-frustum corners land on the ground plane (y = 0).
 * The minimap draws this as the "what you can see" trapezoid.
 *
 * A ray that points at or above the horizon never hits the plane, so it is
 * clamped to `maxDistance` — otherwise a shallow camera would blow the polygon
 * out to infinity. Keep it well past the rig's own zoom ceiling, or the minimap
 * quietly draws a smaller box than the player can actually see.
 */
const NDC_CORNERS: [number, number][] = [
  [-1, 1],
  [1, 1],
  [1, -1],
  [-1, -1],
];

const ray = new Vector3();
const origin = new Vector3();

export function groundFrustum(
  camera: Camera,
  out: { x: number; z: number }[],
  maxDistance = 200
): { x: number; z: number }[] {
  camera.getWorldPosition(origin);

  for (let i = 0; i < 4; i++) {
    const [nx, ny] = NDC_CORNERS[i];
    ray.set(nx, ny, 0.5).unproject(camera).sub(origin).normalize();

    let t: number;
    if (ray.y < -1e-4) {
      t = -origin.y / ray.y; // downward ray meets the plane
      if (t > maxDistance) t = maxDistance;
    } else {
      t = maxDistance; // at or above the horizon
    }

    const p = out[i] ?? (out[i] = { x: 0, z: 0 });
    p.x = origin.x + ray.x * t;
    p.z = origin.z + ray.z * t;
  }
  out.length = 4;
  return out;
}
