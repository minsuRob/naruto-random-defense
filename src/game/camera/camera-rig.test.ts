import { describe, expect, it } from 'vitest';

import { DEFAULT_RIG_CONFIG, createCameraRig, type CameraRigConfig } from './camera-rig';

const bounds = { minX: -14, maxX: 14, minZ: -14, maxZ: 14 };
const config: CameraRigConfig = { ...DEFAULT_RIG_CONFIG, bounds };

/** Run the smoothing long enough that the rig has settled on its goal. */
function settle(rig: ReturnType<typeof createCameraRig>) {
  for (let i = 0; i < 400; i++) rig.update(1 / 60);
}

describe('camera rig', () => {
  it('starts centred on the map', () => {
    const rig = createCameraRig(config);
    expect(rig.target.x).toBeCloseTo(0, 10);
    expect(rig.target.z).toBeCloseTo(0, 10);
    expect(rig.distance).toBeCloseTo(config.startDistance, 10);
  });

  it('places the camera above and behind the target at the configured pitch', () => {
    const rig = createCameraRig(config);
    const pose = rig.getPose();
    expect(pose.target).toEqual({ x: 0, y: 0, z: 0 });

    const pitch = (config.pitchDeg * Math.PI) / 180;
    expect(pose.position.y).toBeCloseTo(config.startDistance * Math.sin(pitch), 10);
    // Yaw 0 looks north, so the camera sits to the south (+z).
    expect(pose.position.z).toBeCloseTo(config.startDistance * Math.cos(pitch), 10);
    expect(pose.position.x).toBeCloseTo(0, 10);
    // Distance from target is preserved.
    const d = Math.hypot(pose.position.x, pose.position.y, pose.position.z);
    expect(d).toBeCloseTo(config.startDistance, 10);
  });

  it('clamps panning to the bounds plus margin', () => {
    const rig = createCameraRig(config);
    for (let i = 0; i < 100; i++) rig.pan(10, 10);
    settle(rig);
    expect(rig.target.x).toBeCloseTo(bounds.maxX + config.boundsMargin, 6);
    expect(rig.target.z).toBeCloseTo(bounds.maxZ + config.boundsMargin, 6);

    for (let i = 0; i < 200; i++) rig.pan(-10, -10);
    settle(rig);
    expect(rig.target.x).toBeCloseTo(bounds.minX - config.boundsMargin, 6);
    expect(rig.target.z).toBeCloseTo(bounds.minZ - config.boundsMargin, 6);
  });

  it('clamps zoom to the configured range', () => {
    const rig = createCameraRig(config);
    for (let i = 0; i < 100; i++) rig.zoomBy(1.5);
    settle(rig);
    expect(rig.distance).toBeCloseTo(config.maxDistance, 6);

    for (let i = 0; i < 200; i++) rig.zoomBy(0.5);
    settle(rig);
    expect(rig.distance).toBeCloseTo(config.minDistance, 6);
  });

  it('drags the ground with the pointer', () => {
    const rig = createCameraRig(config);
    // Dragging right should move the world right, i.e. the target moves left.
    rig.panScreen(100, 0, 800);
    settle(rig);
    expect(rig.target.x).toBeLessThan(0);
  });

  it('recentres on demand', () => {
    const rig = createCameraRig(config);
    for (let i = 0; i < 50; i++) rig.pan(5, 5);
    rig.zoomBy(1.4);
    settle(rig);
    expect(Math.hypot(rig.target.x, rig.target.z)).toBeGreaterThan(1);

    rig.centerOn(0, 0);
    settle(rig);
    expect(rig.target.x).toBeCloseTo(0, 6);
    expect(rig.target.z).toBeCloseTo(0, 6);
    expect(rig.distance).toBeCloseTo(config.startDistance, 6);
  });

  it('pans in the rotated frame after a yaw step', () => {
    const rig = createCameraRig(config);
    rig.rotateBy(1); // +90 degrees
    settle(rig);
    expect(rig.yaw).toBeCloseTo(Math.PI / 2, 4);

    const before = { ...rig.target };
    rig.pan(1, 0);
    settle(rig);
    // With yaw = 90 degrees, "east" input walks along +z instead of +x.
    expect(rig.target.z - before.z).toBeGreaterThan(0.5);
    expect(Math.abs(rig.target.x - before.x)).toBeLessThan(0.1);
  });
});
