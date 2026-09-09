import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DEFAULT_RIG_CONFIG, createCameraRig } from '@/game/camera/camera-rig';
import type { DifficultyDef } from '@/game/config/difficulty';
import { mapBounds } from '@/game/config/map';
import { createEngine } from '@/game/engine/engine';
import type { Cell } from '@/game/engine/grid';
import { CommandCard } from '@/game/hud/CommandCard';
import { EventLog } from '@/game/hud/EventLog';
import { GameOverOverlay } from '@/game/hud/GameOverOverlay';
import { Minimap } from '@/game/hud/Minimap';
import { PauseMenu } from '@/game/hud/PauseMenu';
import { SelectionPanel } from '@/game/hud/SelectionPanel';
import { TopBar } from '@/game/hud/TopBar';
import { ComboBookModal } from '@/game/hud/combo-book/ComboBookModal';
import { GestureHost } from '@/game/input/GestureHost';
import { createInputController } from '@/game/input/input-controller';
import { GameCanvas } from '@/game/render/GameCanvas';
import { Scene } from '@/game/render/Scene';
import { createSimClock } from '@/game/runtime/clock';
import { useGameStore } from '@/game/runtime/game-store';
import { createHudSync } from '@/game/runtime/hud-sync';
import { LOCAL_PLAYER, handleHotkey } from '@/game/runtime/ui-actions';
import { useConstant } from '@/game/runtime/use-constant';
import { clearViewHandle, setViewHandle } from '@/game/runtime/view-handle';

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
        default:
          handleHotkey(engine, key);
      }
    });

    return () => {
      offHotkey();
      detach();
      input.dispose();
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

  const selectUnit = useCallback((unitId: number, additive: boolean) => {
    const store = useGameStore.getState();
    const current = store.selection;
    if (additive) {
      store.setSelection(
        current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId]
      );
    } else {
      store.setSelection([unitId]);
    }
  }, []);

  const groundCommand = useCallback(
    (cell: Cell) => {
      const store = useGameStore.getState();
      const [unitId] = store.selection;
      if (unitId === undefined) return;
      engine.enqueue({ t: 'MOVE', player: LOCAL_PLAYER, unitId, cell });
      store.setUiMode('idle');
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
            onGroundCommand={groundCommand}
            moveMode={moveMode}
          />
        </GameCanvas>
      </GestureHost>

      <View style={styles.hud}>
        <TopBar difficulty={difficulty} />

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
            방향키·가장자리 이동 · 휠 줌 · 좌클릭 선택 · 우클릭 이동 · Space 복귀 · P 일시정지
          </Text>
        </View>

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
  bottomLeft: { position: 'absolute', left: 12, bottom: 12, gap: 8, alignItems: 'flex-start' },
  bottomCenter: { position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' },
  bottomRight: { position: 'absolute', right: 12, bottom: 12, gap: 6, alignItems: 'flex-end' },
  hint: { color: '#6d757f', fontSize: 10, maxWidth: 320, textAlign: 'right' },
});
