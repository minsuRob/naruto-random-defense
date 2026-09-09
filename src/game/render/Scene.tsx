import { CameraRig } from '@/game/camera/CameraRig';
import type { CameraRig as Rig } from '@/game/camera/camera-rig';
import type { Engine } from '@/game/engine/engine';
import type { InputController } from '@/game/input/types';
import type { SimClock } from '@/game/runtime/clock';
import type { HudSync } from '@/game/runtime/hud-sync';
import { Ground } from './Ground';
import { LaneMesh } from './LaneMesh';
import { Markers } from './Markers';
import { MobInstances } from './MobInstances';
import { PlotGrid } from './PlotGrid';
import { SimDriver } from './SimDriver';
import { UnitPreview } from './UnitPreview';

/** Scene graph root. */
export function Scene({
  engine,
  clock,
  hudSync,
  rig,
  input,
}: {
  engine: Engine;
  clock: SimClock;
  hudSync: HudSync;
  rig: Rig;
  input: InputController;
}) {
  const lane = engine.state.plots[0].lane;

  return (
    <>
      <color attach="background" args={['#0b0d10']} />
      <fog attach="fog" args={['#0b0d10', 40, 90]} />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#9fb8d0', '#2a2f22', 0.5]} />
      <directionalLight position={[12, 20, 8]} intensity={1.5} />

      <Ground />
      <LaneMesh lane={lane} />
      <PlotGrid />
      <Markers lane={lane} />
      <UnitPreview />
      <MobInstances engine={engine} clock={clock} />

      <SimDriver engine={engine} clock={clock} hudSync={hudSync} />
      <CameraRig rig={rig} input={input} />
    </>
  );
}
