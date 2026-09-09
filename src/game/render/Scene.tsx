import { CameraRig } from '@/game/camera/CameraRig';
import type { CameraRig as Rig } from '@/game/camera/camera-rig';
import type { Cell } from '@/game/engine/grid';
import type { Engine } from '@/game/engine/engine';
import type { InputController } from '@/game/input/types';
import type { SimClock } from '@/game/runtime/clock';
import type { HudSync } from '@/game/runtime/hud-sync';
import { Ground } from './Ground';
import { GroundPicker } from './GroundPicker';
import { LaneMesh } from './LaneMesh';
import { Markers } from './Markers';
import { MobHealthBars } from './MobHealthBars';
import { MobInstances } from './MobInstances';
import { PlotGrid } from './PlotGrid';
import { SimDriver } from './SimDriver';
import { MoveMarker, type MoveMarkerHandle } from './MoveMarker';
import { Units } from './Units';
import { HitFlashes } from './effects/HitFlashes';

/** Scene graph root. */
export function Scene({
  engine,
  clock,
  hudSync,
  rig,
  input,
  onSelectUnit,
  moveMarkerRef,
  onGroundCommand,
  onClearSelection,
  moveMode,
}: {
  engine: Engine;
  clock: SimClock;
  hudSync: HudSync;
  rig: Rig;
  input: InputController;
  onSelectUnit: (unitId: number, additive: boolean, sameType: boolean) => void;
  moveMarkerRef: { current: MoveMarkerHandle | null };
  onGroundCommand: (cell: Cell, point: { x: number; z: number }) => void;
  onClearSelection: () => void;
  moveMode: boolean;
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
      <GroundPicker
        onCommand={onGroundCommand}
        onClearSelection={onClearSelection}
        active={moveMode}
      />
      <Units engine={engine} onSelect={onSelectUnit} />
      <MoveMarker handleRef={moveMarkerRef} />
      <MobInstances engine={engine} clock={clock} />
      <MobHealthBars engine={engine} clock={clock} />
      <HitFlashes engine={engine} />

      <SimDriver engine={engine} clock={clock} hudSync={hudSync} />
      <CameraRig rig={rig} input={input} />
    </>
  );
}
