import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createInputController } from '@/game/input/input-controller.web';
import {
  DEFAULT_RIG_CONFIG,
  createCameraRig,
  stepCameraFromInput,
  type CameraRigConfig,
} from './camera-rig';

/**
 * Wires the real web input controller to the real rig.
 *
 * This is the seam that a browser check cannot cover reliably: useFrame only
 * ticks while the page is visible, so "did a held key actually move the
 * camera?" is answered here instead.
 */

const bounds = { minX: -14, maxX: 14, minZ: -14, maxZ: 14 };
const config: CameraRigConfig = { ...DEFAULT_RIG_CONFIG, bounds };
const viewport = { width: 800, height: 450 };

/** Minimal stand-ins for the two globals the controller touches. */
function installFakeDom() {
  const win = new EventTarget() as EventTarget & Record<string, unknown>;
  const el = new EventTarget() as EventTarget & Record<string, unknown>;
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: viewport.width, height: viewport.height });
  el.setPointerCapture = () => {};
  el.releasePointerCapture = () => {};
  (globalThis as Record<string, unknown>).window = win;
  return { win, el };
}

function key(type: 'keydown' | 'keyup', code: string) {
  return Object.assign(new Event(type), {
    code,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    preventDefault() {},
  });
}

let dom: ReturnType<typeof installFakeDom>;

beforeEach(() => {
  dom = installFakeDom();
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

/** Advance a number of 60 Hz frames. */
function run(rig: ReturnType<typeof createCameraRig>, input: ReturnType<typeof createInputController>, frames: number) {
  for (let i = 0; i < frames; i++) stepCameraFromInput(rig, input, 1 / 60, viewport);
}

describe('input -> camera', () => {
  it('pans west while an arrow key is held, and stops on release', () => {
    const rig = createCameraRig(config);
    const input = createInputController();
    input.attach(dom.el);

    dom.win.dispatchEvent(key('keydown', 'ArrowLeft'));
    run(rig, input, 30);
    expect(rig.target.x).toBeLessThan(-1);

    // Release, let the smoothing settle, then confirm it has truly stopped.
    dom.win.dispatchEvent(key('keyup', 'ArrowLeft'));
    run(rig, input, 120);
    const settled = rig.target.x;
    run(rig, input, 120);
    expect(rig.target.x).toBeCloseTo(settled, 6);
  });

  it('maps ArrowUp to north (-z)', () => {
    const rig = createCameraRig(config);
    const input = createInputController();
    input.attach(dom.el);

    dom.win.dispatchEvent(key('keydown', 'ArrowUp'));
    run(rig, input, 30);
    expect(rig.target.z).toBeLessThan(-1);
  });

  it('does not let diagonal input outrun a single axis', () => {
    /** Hold the given keys for 30 frames and report how far the target moved. */
    const travelFor = (codes: string[]) => {
      const rig = createCameraRig(config);
      const fake = installFakeDom();
      const input = createInputController();
      input.attach(fake.el);
      for (const code of codes) fake.win.dispatchEvent(key('keydown', code));
      run(rig, input, 30);
      return Math.hypot(rig.target.x, rig.target.z);
    };

    expect(travelFor(['ArrowLeft', 'ArrowUp'])).toBeLessThanOrEqual(
      travelFor(['ArrowLeft']) + 1e-6
    );
  });

  it('clears held keys when the window loses focus', () => {
    const rig = createCameraRig(config);
    const input = createInputController();
    input.attach(dom.el);

    dom.win.dispatchEvent(key('keydown', 'ArrowLeft'));
    run(rig, input, 10);
    expect(rig.target.x).toBeLessThan(-0.1);

    // Without the blur handler the key would stay "held" and pan forever.
    dom.win.dispatchEvent(new Event('blur'));
    run(rig, input, 120);
    const settled = rig.target.x;
    run(rig, input, 120);
    expect(rig.target.x).toBeCloseTo(settled, 6);
  });

  it('ignores input while disabled', () => {
    const rig = createCameraRig(config);
    const input = createInputController();
    input.attach(dom.el);
    input.setEnabled(false);

    dom.win.dispatchEvent(key('keydown', 'ArrowLeft'));
    run(rig, input, 30);
    expect(rig.target.x).toBeCloseTo(0, 6);
  });

  it('detaching stops the controller from listening', () => {
    const rig = createCameraRig(config);
    const input = createInputController();
    const detach = input.attach(dom.el);
    detach();

    dom.win.dispatchEvent(key('keydown', 'ArrowLeft'));
    run(rig, input, 30);
    expect(rig.target.x).toBeCloseTo(0, 6);
  });

  it('routes hotkeys to subscribers', () => {
    const input = createInputController();
    input.attach(dom.el);
    const seen: string[] = [];
    input.onHotkey((k) => seen.push(k));

    dom.win.dispatchEvent(key('keydown', 'KeyQ'));
    dom.win.dispatchEvent(key('keydown', 'KeyB'));
    dom.win.dispatchEvent(key('keydown', 'Space'));
    expect(seen).toEqual(['PAKKUN_DOWN', 'COMBO_BOOK', 'CENTER']);
  });

  it('remaps Q/W/E to wood tiers inside the gamble submenu', () => {
    const input = createInputController();
    input.attach(dom.el);
    const seen: string[] = [];
    input.onHotkey((k) => seen.push(k));

    dom.win.dispatchEvent(key('keydown', 'KeyT')); // opens the submenu
    dom.win.dispatchEvent(key('keydown', 'KeyW')); // 3 wood, not 파쿤↑
    dom.win.dispatchEvent(key('keydown', 'KeyW')); // submenu closed, back to 파쿤↑
    expect(seen).toEqual(['GAMBLE', 'GAMBLE_3', 'PAKKUN_UP']);
  });
});
