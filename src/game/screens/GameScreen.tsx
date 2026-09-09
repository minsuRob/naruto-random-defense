import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DEFAULT_RIG_CONFIG, createCameraRig } from '@/game/camera/camera-rig';
import type { DifficultyDef } from '@/game/config/difficulty';
import { mapBounds } from '@/game/config/map';
import { createEngine } from '@/game/engine/engine';
import { EventLog } from '@/game/hud/EventLog';
import { GameOverOverlay } from '@/game/hud/GameOverOverlay';
import { Minimap } from '@/game/hud/Minimap';
import { TopBar } from '@/game/hud/TopBar';
import { createInputController } from '@/game/input/input-controller';
import { GameCanvas } from '@/game/render/GameCanvas';
import { Scene } from '@/game/render/Scene';
import { createSimClock } from '@/game/runtime/clock';
import { useGameStore } from '@/game/runtime/game-store';
import { createHudSync } from '@/game/runtime/hud-sync';
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

  useEffect(() => {
    useGameStore.getState().reset();
    setViewHandle({ rig, input, engine });

    // On web the View ref is the DOM node; on native attach() is a no-op today.
    const detach = input.attach(hostRef.current);
    const offHotkey = input.onHotkey((key) => {
      if (key === 'CENTER') rig.centerOn(0, 0);
      if (key === 'ZOOM_IN') rig.zoomBy(1 / 1.2);
      if (key === 'ZOOM_OUT') rig.zoomBy(1.2);
      if (key === 'PAUSE') {
        const paused = !clock.paused;
        clock.setPaused(paused);
        useGameStore.getState().setPaused(paused);
      }
    });

    return () => {
      offHotkey();
      detach();
      input.dispose();
      clearViewHandle();
    };
  }, [clock, engine, input, rig]);

  const lane = engine.state.plots[0].lane;

  return (
    <View ref={hostRef} style={styles.root}>
      <GameCanvas>
        <Scene engine={engine} clock={clock} hudSync={hudSync} rig={rig} input={input} />
      </GameCanvas>

      <View style={styles.hud}>
        <TopBar difficulty={difficulty} />

        <View style={styles.bottomLeft}>
          <EventLog />
          <Minimap lane={lane} />
          <Text style={styles.hint}>
            방향키·화면 가장자리로 이동 · 휠 줌 · 휠클릭 드래그 · Space 복귀 · P 일시정지
          </Text>
        </View>

        <GameOverOverlay onRestart={onRestart} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0d10' },
  hud: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'box-none' },
  bottomLeft: { position: 'absolute', left: 12, bottom: 12, gap: 8, alignItems: 'flex-start' },
  hint: { color: '#6d757f', fontSize: 11, maxWidth: 180, lineHeight: 15 },
});
