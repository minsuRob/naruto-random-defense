import { CameraRig } from '@/game/camera/CameraRig';
import type { CameraRig as Rig } from '@/game/camera/camera-rig';
import type { Lane } from '@/game/engine/lane';
import type { InputController } from '@/game/input/types';
import { Ground } from './Ground';
import { LaneMesh } from './LaneMesh';
import { Markers } from './Markers';
import { PlotGrid } from './PlotGrid';

/** Scene graph root. Mobs and units join here in M2/M3. */
export function Scene({
  lane,
  rig,
  input,
}: {
  lane: Lane;
  rig: Rig;
  input: InputController;
}) {
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

      <CameraRig rig={rig} input={input} />
    </>
  );
}
