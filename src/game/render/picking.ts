import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';

/**
 * Screen -> ground picking.
 *
 * React Three Fiber does not handle `contextmenu`, so the Warcraft right-click
 * move order cannot be a mesh handler — it has to be raycast from the pointer
 * position the input controller reports.
 */

const raycaster = new Raycaster();
const pointer = new Vector2();
const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
const hit = new Vector3();

/**
 * Where a screen point lands on the ground plane, or null when the ray points
 * at or above the horizon.
 */
export function screenToGround(
  camera: Camera,
  x: number,
  y: number,
  viewport: { width: number; height: number }
): { x: number; z: number } | null {
  pointer.set((x / viewport.width) * 2 - 1, -(y / viewport.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const point = raycaster.ray.intersectPlane(groundPlane, hit);
  return point ? { x: point.x, z: point.z } : null;
}
