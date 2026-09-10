import { CameraRig } from '@/game/camera/CameraRig';
import type { CameraRig as Rig } from '@/game/camera/camera-rig';
import type { Cell } from '@/game/engine/grid';
import type { Engine } from '@/game/engine/engine';
import type { InputController } from '@/game/input/types';
import type { SimClock } from '@/game/runtime/clock';
import type { HudSync } from '@/game/runtime/hud-sync';
import type { AltarKind } from '@/game/config/map';
import { Altars } from './Altars';
import { Ground } from './Ground';
import { GroundPicker } from './GroundPicker';
import { LaneMesh } from './LaneMesh';
import { Markers } from './Markers';
import { MobHealthBars } from './MobHealthBars';
import { MobInstances } from './MobInstances';
import { PakkunTokens } from './PakkunTokens';
import { Plaza } from './Plaza';
import { PlotGrid } from './PlotGrid';
import { SlotPillar } from './SlotPillar';
import { SimDriver } from './SimDriver';
import { MoveMarker, type MoveMarkerHandle } from './MoveMarker';
import { Units } from './Units';
import { HitFlashes } from './effects/HitFlashes';
import { SkillBursts } from './effects/SkillBursts';

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
  onSendPakkun,
  localPlotId,
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
  onSendPakkun: (kind: AltarKind) => void;
  localPlotId: number;
  moveMode: boolean;
}) {
  const plots = engine.state.plots;
  const idlePakkun = engine.state.pakkuns.some((p) => !p.target);

  return (
    <>
      <color attach="background" args={['#0b0d10']} />
      {/* Wide enough to reach the far islands: at 40 they were fogged out
          entirely and the map read as one base again. */}
      <fog attach="fog" args={['#0b0d10', 60, 150]} />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#9fb8d0', '#2a2f22', 0.5]} />
      <directionalLight position={[12, 20, 8]} intensity={1.5} />

      <Ground plotCount={plots.length} onClick={onClearSelection} />
      <Plaza />
      <Altars onSend={onSendPakkun} highlight={idlePakkun} />

      {/* Each island draws in its own local frame; the group carries the
          origin. Everything below this block is already world-space. */}
      {plots.map((plot) => (
        <group key={plot.id} position={[plot.origin.x, 0, plot.origin.z]}>
          <PlotGrid dim={plot.owner < 0} />
          <LaneMesh lane={plot.lane} dim={plot.owner < 0} />
          <Markers lane={plot.lane} dim={plot.owner < 0} />
          <SlotPillar slot={plot.id} dim={plot.owner < 0} />
          {plot.id === localPlotId && (
            <GroundPicker
              origin={plot.origin}
              onCommand={onGroundCommand}
              onClearSelection={onClearSelection}
              active={moveMode}
            />
          )}
        </group>
      ))}
      <PakkunTokens engine={engine} />
      <Units engine={engine} onSelect={onSelectUnit} />
      <MoveMarker handleRef={moveMarkerRef} />
      <MobInstances engine={engine} clock={clock} />
      <MobHealthBars engine={engine} clock={clock} />
      <HitFlashes engine={engine} />
      <SkillBursts />

      <SimDriver engine={engine} clock={clock} hudSync={hudSync} />
      <CameraRig rig={rig} input={input} />
    </>
  );
}
