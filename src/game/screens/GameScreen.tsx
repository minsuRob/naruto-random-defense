import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DEFAULT_RIG_CONFIG, createCameraRig } from '@/game/camera/camera-rig';
import type { DifficultyDef } from '@/game/config/difficulty';
import { mapBounds } from '@/game/config/map';
import { createLane } from '@/game/engine/lane';
import { Minimap } from '@/game/hud/Minimap';
import { createInputController } from '@/game/input/input-controller';
import { GameCanvas } from '@/game/render/GameCanvas';
import { Scene } from '@/game/render/Scene';
import { useConstant } from '@/game/runtime/use-constant';
import { clearViewHandle, setViewHandle } from '@/game/runtime/view-handle';

/**
 * Owns one run: builds the lane, the camera rig and the input controller, then
 * renders the 3D view plus the HUD overlay.
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
  const hostRef = useRef<View | null>(null);

  // These own identity (event listeners, smoothed state), so they must be
  // created exactly once — see useConstant on why useMemo is not enough here.
  const lane = useConstant(createLane);
  const input = useConstant(createInputController);
  const rig = useConstant(() =>
    createCameraRig({ ...DEFAULT_RIG_CONFIG, bounds: mapBounds(1) })
  );

  useEffect(() => {
    setViewHandle({ rig, input });
    // On web the View ref *is* the DOM node; on native attach() is a no-op today.
    const detach = input.attach(hostRef.current);
    const offHotkey = input.onHotkey((key) => {
      if (key === 'CENTER') rig.centerOn(0, 0);
      if (key === 'ZOOM_IN') rig.zoomBy(1 / 1.2);
      if (key === 'ZOOM_OUT') rig.zoomBy(1.2);
    });
    return () => {
      offHotkey();
      detach();
      input.dispose();
      clearViewHandle();
    };
  }, [input, rig]);

  return (
    <View ref={hostRef} style={styles.root}>
      <GameCanvas>
        <Scene lane={lane} rig={rig} input={input} />
      </GameCanvas>

      <View style={styles.hud}>
        <View style={styles.topBar}>
          <Text style={styles.brand}>NRD</Text>
          <Text style={styles.dim}>난이도 {difficulty.nameKo}</Text>
          <Text style={styles.dim}>데스카운트 {difficulty.deathCount}</Text>
          <Text style={styles.dim}>seed {seed}</Text>
        </View>

        <View style={styles.bottomLeft}>
          <Minimap lane={lane} />
          <Text style={styles.hint}>
            방향키·화면 가장자리로 이동 · 휠 줌 · 휠클릭 드래그 · Space 복귀
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0d10' },
  hud: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'box-none' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    alignSelf: 'flex-start',
    margin: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(12,14,18,0.82)',
    borderWidth: 1,
    borderColor: '#2b3038',
  },
  brand: { color: '#f0c674', fontWeight: '700', fontSize: 14 },
  dim: { color: '#9aa3ad', fontSize: 13 },
  bottomLeft: { position: 'absolute', left: 12, bottom: 12, gap: 8, alignItems: 'flex-start' },
  hint: { color: '#6d757f', fontSize: 11, maxWidth: 180, lineHeight: 15 },
});
