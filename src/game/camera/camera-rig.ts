/**
 * Warcraft-3 style camera: fixed pitch, no free rotation, pan and zoom only.
 *
 * Pure state + math so it can be unit tested and reused on native. The R3F
 * component in ./CameraRig.tsx just drives it from the input controller and
 * copies the resulting pose onto the three camera.
 */

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CameraRigConfig {
  pitchDeg: number;
  fov: number;
  minDistance: number;
  maxDistance: number;
  startDistance: number;
  /** World units per second at `startDistance`; scales with zoom. */
  panSpeed: number;
  bounds: Bounds;
  /**
   * Where the camera opens, and how far out. Defaults to the centre of the
   * bounds at `startDistance`. Set rather than calling `centerOn` after
   * construction: that only moves the goal, so the run would begin with a
   * visible swoop across the map.
   */
  initialTarget?: { x: number; z: number };
  initialDistance?: number;
  /** How far past the bounds the look-at target may travel. */
  boundsMargin: number;
  /** Exponential smoothing rate; higher snaps faster. */
  smoothing: number;
}

export const DEFAULT_RIG_CONFIG: Omit<CameraRigConfig, 'bounds'> = {
  pitchDeg: 55,
  fov: 45,
  minDistance: 10,
  maxDistance: 55,
  startDistance: 22,
  panSpeed: 14,
  boundsMargin: 2,
  smoothing: 12,
};

export interface CameraPose {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export interface CameraRig {
  readonly config: CameraRigConfig;
  /** Smoothed look-at point on the ground plane. */
  readonly target: { x: number; z: number };
  readonly distance: number;
  readonly yaw: number;
  pan(dx: number, dz: number): void;
  panScreen(dxPixels: number, dyPixels: number, viewportHeight: number): void;
  zoomBy(factor: number): void;
  setGoalTarget(x: number, z: number): void;
  /** Jump to a point, resetting the zoom (to `startDistance` unless told otherwise). */
  centerOn(x: number, z: number, distance?: number): void;
  rotateBy(steps: number): void;
  update(dt: number): void;
  getPose(out?: CameraPose): CameraPose;
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createCameraRig(config: CameraRigConfig): CameraRig {
  const pitch = (config.pitchDeg * Math.PI) / 180;
  const cx = (config.bounds.minX + config.bounds.maxX) / 2;
  const cz = (config.bounds.minZ + config.bounds.maxZ) / 2;

  const start = config.initialTarget ?? { x: cx, z: cz };
  const target = { x: start.x, z: start.z };
  const goalTarget = { x: start.x, z: start.z };
  let distance = config.initialDistance ?? config.startDistance;
  let goalDistance = distance;
  let yaw = 0;
  let goalYaw = 0;

  const m = config.boundsMargin;
  function clampTarget() {
    goalTarget.x = clamp(goalTarget.x, config.bounds.minX - m, config.bounds.maxX + m);
    goalTarget.z = clamp(goalTarget.z, config.bounds.minZ - m, config.bounds.maxZ + m);
  }

  function pan(dx: number, dz: number) {
    // Pan in the camera's yaw frame so arrow keys stay intuitive after a rotate.
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    goalTarget.x += dx * c - dz * s;
    goalTarget.z += dx * s + dz * c;
    clampTarget();
  }

  function panScreen(dxPixels: number, dyPixels: number, viewportHeight: number) {
    // Pixels -> world units at the ground plane, for a perspective camera.
    const worldPerPixel =
      (2 * distance * Math.tan(((config.fov * Math.PI) / 180) / 2)) / Math.max(viewportHeight, 1);
    // Drag grabs the ground, so the target moves against the pointer.
    pan(-dxPixels * worldPerPixel, -dyPixels * worldPerPixel);
  }

  return {
    config,
    target,
    get distance() {
      return distance;
    },
    get yaw() {
      return yaw;
    },
    pan,
    panScreen,
    zoomBy(factor) {
      goalDistance = clamp(goalDistance * factor, config.minDistance, config.maxDistance);
    },
    setGoalTarget(x, z) {
      goalTarget.x = x;
      goalTarget.z = z;
      clampTarget();
    },
    centerOn(x, z, distance = config.startDistance) {
      goalTarget.x = x;
      goalTarget.z = z;
      goalDistance = clamp(distance, config.minDistance, config.maxDistance);
      clampTarget();
    },
    rotateBy(steps) {
      goalYaw += (steps * Math.PI) / 2;
    },
    update(dt) {
      const k = 1 - Math.exp(-config.smoothing * dt);
      target.x += (goalTarget.x - target.x) * k;
      target.z += (goalTarget.z - target.z) * k;
      distance += (goalDistance - distance) * k;
      yaw += (goalYaw - yaw) * k;
    },
    getPose(out?: CameraPose): CameraPose {
      const pose = out ?? { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } };
      const horizontal = distance * Math.cos(pitch);
      pose.position.x = target.x + horizontal * Math.sin(yaw);
      pose.position.y = distance * Math.sin(pitch);
      pose.position.z = target.z + horizontal * Math.cos(yaw);
      pose.target.x = target.x;
      pose.target.y = 0;
      pose.target.z = target.z;
      return pose;
    },
  };
}

/** Pan speed scales with zoom so the world moves at a constant screen rate. */
export function panSpeedFor(rig: CameraRig): number {
  return rig.config.panSpeed * (rig.distance / rig.config.startDistance);
}

/** The subset of InputController the camera reads, so tests can fake it. */
export interface CameraInput {
  update(dt: number, viewport: { width: number; height: number }): void;
  readonly panAxis: { x: number; y: number };
  consumeDragPan(): { dx: number; dy: number };
  consumeZoom(): number;
  consumeRotate(): number;
}

/**
 * One frame of input -> rig. Kept out of the R3F component so it can be tested
 * without a render loop (the browser only ticks useFrame when it is visible).
 */
export function stepCameraFromInput(
  rig: CameraRig,
  input: CameraInput,
  dt: number,
  viewport: { width: number; height: number }
): void {
  input.update(dt, viewport);

  const speed = panSpeedFor(rig) * dt;
  if (input.panAxis.x !== 0 || input.panAxis.y !== 0) {
    // panAxis.y is +north, and north is -z.
    rig.pan(input.panAxis.x * speed, -input.panAxis.y * speed);
  }

  const drag = input.consumeDragPan();
  if (drag.dx !== 0 || drag.dy !== 0) rig.panScreen(drag.dx, drag.dy, viewport.height);

  const zoom = input.consumeZoom();
  if (zoom !== 1) rig.zoomBy(zoom);

  const rotate = input.consumeRotate();
  if (rotate !== 0) rig.rotateBy(rotate);

  rig.update(dt);
}
