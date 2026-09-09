import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DEFAULT_RIG_CONFIG, createCameraRig } from '@/game/camera/camera-rig';
import type { DifficultyDef } from '@/game/config/difficulty';
import { mapBounds, type AltarKind } from '@/game/config/map';
import { createEngine } from '@/game/engine/engine';
import { localToCell, type Cell } from '@/game/engine/grid';
import { CommandCard } from '@/game/hud/CommandCard';
import { DraftOverlay } from '@/game/hud/DraftOverlay';
import { EventLog } from '@/game/hud/EventLog';
import { GameOverOverlay } from '@/game/hud/GameOverOverlay';
import { Minimap } from '@/game/hud/Minimap';
import { PauseMenu } from '@/game/hud/PauseMenu';
import { PlayerPanel } from '@/game/hud/PlayerPanel';
import { SelectionBox } from '@/game/hud/SelectionBox';
import { SelectionPanel } from '@/game/hud/SelectionPanel';
import { TopBar } from '@/game/hud/TopBar';
import { ComboBookModal } from '@/game/hud/combo-book/ComboBookModal';
import { GestureHost } from '@/game/input/GestureHost';
import { createInputController } from '@/game/input/input-controller';
import { GameCanvas } from '@/game/render/GameCanvas';
import type { MoveMarkerHandle } from '@/game/render/MoveMarker';
import { screenToGround } from '@/game/render/picking';
import { Scene } from '@/game/render/Scene';
import { createSimClock } from '@/game/runtime/clock';
import { useGameStore } from '@/game/runtime/game-store';
import { clearEffectBus } from '@/game/runtime/effect-bus';
import { createHudSync } from '@/game/runtime/hud-sync';
import {
  applySelection,
  assignControlGroup,
  cycleSelection,
  moveSelection,
  recallControlGroup,
  selectAll,
  selectSameType,
  toggleSelection,
  unitsInBox,
} from '@/game/runtime/selection';
import { LOCAL_PLAYER, handleHotkey } from '@/game/runtime/ui-actions';
import { useConstant } from '@/game/runtime/use-constant';
import { clearViewHandle, getViewHandle, setViewHandle } from '@/game/runtime/view-handle';

/**
 * Owns one run: the engine, the clock, the camera rig and the input controller,
 * plus the HUD overlay.
 *
 * Loaded lazily from src/app/game.tsx so nothing here (three, expo-gl) is ever
 * evaluated during the static web export.
 */
export default function GameScreen({
  difficulty,
  seed,
}: {
  difficulty: DifficultyDef;
  seed: number;
}) {
  // Remounting the whole tree is how a restart resets every piece of state.
  const [runId, setRunId] = useState(0);
  return (
    <Run
      key={runId}
      difficulty={difficulty}
      seed={seed + runId}
      onRestart={() => setRunId((n) => n + 1)}
    />
  );
}

function Run({
  difficulty,
  seed,
  onRestart,
}: {
  difficulty: DifficultyDef;
  seed: number;
  onRestart: () => void;
}) {
  const hostRef = useRef<View | null>(null);
  const moveMarkerRef = useRef<MoveMarkerHandle | null>(null);

  // These own identity (listeners, smoothed state, typed arrays), so they must
  // be created exactly once — see useConstant on why useMemo is not enough.
  const engine = useConstant(() => createEngine({ difficulty, seed }));
  const clock = useConstant(createSimClock);
  const hudSync = useConstant(() => createHudSync(engine));
  const input = useConstant(createInputController);
  const rig = useConstant(() =>
    createCameraRig({ ...DEFAULT_RIG_CONFIG, bounds: mapBounds(1) })
  );

  const comboBookOpen = useGameStore((s) => s.comboBook.open);
  const moveMode = useGameStore((s) => s.uiMode === 'move');
  const settings = useGameStore((s) => s.settings);

  useEffect(() => {
    useGameStore.getState().reset();
    setViewHandle({ rig, input, engine });

    // On web the View ref is the DOM node; on native attach() is a no-op today.
    const detach = input.attach(hostRef.current);
    const offHotkey = input.onHotkey((key) => {
      switch (key) {
        case 'CENTER':
          rig.centerOn(0, 0);
          break;
        case 'ZOOM_IN':
          rig.zoomBy(1 / 1.2);
          break;
        case 'ZOOM_OUT':
          rig.zoomBy(1.2);
          break;
        case 'PAUSE': {
          const paused = !clock.paused;
          clock.setPaused(paused);
          useGameStore.getState().setPaused(paused);
          break;
        }
        case 'CYCLE':
          cycleSelection(engine, LOCAL_PLAYER);
          break;
        case 'SELECT_ALL':
          selectAll(engine, LOCAL_PLAYER);
          break;
        default:
          handleHotkey(engine, key);
      }
    });

    // Drag-box select, resolved against the live camera on release.
    const offBox = input.onBoxSelect((box, additive) => {
      const { camera } = getViewHandle();
      const host = hostRef.current as unknown as HTMLElement | null;
      if (!camera || !host?.getBoundingClientRect) return;
      const rect = host.getBoundingClientRect();
      const ids = unitsInBox(engine, camera, box, {
        width: rect.width,
        height: rect.height,
      });
      applySelection(ids, additive);
    });

    // Right-click move orders. React Three Fiber has no contextmenu event, so
    // the pointer position is raycast onto the ground here instead.
    const offPointer = input.onPointer((event) => {
      if (event.kind !== 'contextmenu') return;
      const { camera } = getViewHandle();
      const host = hostRef.current as unknown as HTMLElement | null;
      if (!camera || !host?.getBoundingClientRect) return;
      if (!useGameStore.getState().selection.length) return;

      const rect = host.getBoundingClientRect();
      const ground = screenToGround(camera, event.x, event.y, {
        width: rect.width,
        height: rect.height,
      });
      if (!ground) return;
      const cell = localToCell(ground.x, ground.z);
      if (!cell) return;

      moveSelection(engine, LOCAL_PLAYER, cell);
      moveMarkerRef.current?.show(ground.x, ground.z);
    });

    const offGroup = input.onControlGroup((slot, mode) => {
      if (mode === 'assign') assignControlGroup(slot);
      else recallControlGroup(engine, slot, mode === 'append');
    });

    return () => {
      offPointer();
      offGroup();
      offBox();
      offHotkey();
      detach();
      input.dispose();
      clearEffectBus();
      clearViewHandle();
    };
  }, [clock, engine, input, rig]);

  // The combo book owns the keyboard while it is open, apart from B and Esc.
  useEffect(() => {
    input.setEnabled(!comboBookOpen);
  }, [comboBookOpen, input]);

  useEffect(() => {
    input.setSettings(settings);
  }, [input, settings]);

  const togglePause = useCallback(() => {
    const paused = !clock.paused;
    clock.setPaused(paused);
    useGameStore.getState().setPaused(paused);
  }, [clock]);

  const selectUnit = useCallback(
    (unitId: number, additive: boolean, sameType: boolean) => {
      if (sameType) selectSameType(engine, unitId, additive);
      else toggleSelection(unitId, additive);
    },
    [engine]
  );

  const groundCommand = useCallback(
    (cell: Cell, point: { x: number; z: number }) => {
      if (!useGameStore.getState().selection.length) return;
      moveSelection(engine, LOCAL_PLAYER, cell);
      moveMarkerRef.current?.show(point.x, point.z);
    },
    [engine]
  );

  const clearSelection = useCallback(() => {
    useGameStore.getState().setSelection([]);
  }, []);

  const sendPakkun = useCallback(
    (altar: AltarKind) => {
      engine.enqueue({ t: 'PAKKUN_SEND', player: LOCAL_PLAYER, altar });
    },
    [engine]
  );

  const lane = engine.state.plots[0].lane;

  return (
    <View ref={hostRef} style={styles.root}>
      <GestureHost input={input}>
        <GameCanvas>
          <Scene
            engine={engine}
            clock={clock}
            hudSync={hudSync}
            rig={rig}
            input={input}
            onSelectUnit={selectUnit}
            moveMarkerRef={moveMarkerRef}
            onGroundCommand={groundCommand}
            onClearSelection={clearSelection}
            onSendPakkun={sendPakkun}
            moveMode={moveMode}
          />
        </GameCanvas>
      </GestureHost>

      <View style={styles.hud}>
        <View style={styles.topRow}>
          <TopBar difficulty={difficulty} />
          <View style={styles.spacer} />
          <View style={styles.topRight}>
            <PlayerPanel />
          </View>
        </View>

        {/* One bottom bar rather than three floating corners, so the panels
            cannot overlap each other on a narrow window. */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomLeft}>
            <EventLog />
            <Minimap lane={lane} />
          </View>

          <View style={styles.bottomCenter}>
            <SelectionPanel />
          </View>

          <View style={styles.bottomRight}>
            <CommandCard engine={engine} />
            <Text style={styles.hint}>
              좌클릭·드래그 선택 · Shift 추가 · Ctrl 동일유닛 · 우클릭 이동{'\n'}
              Ctrl+숫자 부대지정 · 숫자 호출 · Tab 순환 · F1 전체{'\n'}
              방향키·가장자리 이동 · 휠 줌 · Space 복귀 · P 일시정지
            </Text>
          </View>
        </View>

        <SelectionBox input={input} />
        <DraftOverlay engine={engine} />
        <ComboBookModal engine={engine} />
        <PauseMenu onResume={togglePause} />
        <GameOverOverlay onRestart={onRestart} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0d10' },
  hud: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'box-none' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', pointerEvents: 'box-none' },
  spacer: { flex: 1 },
  topRight: { margin: 12 },
  bottomBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    pointerEvents: 'box-none',
  },
  bottomLeft: { gap: 8, alignItems: 'flex-start' },
  bottomCenter: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bottomRight: { gap: 6, alignItems: 'flex-end' },
  hint: { color: '#6d757f', fontSize: 10, maxWidth: 330, textAlign: 'right', lineHeight: 14 },
});
