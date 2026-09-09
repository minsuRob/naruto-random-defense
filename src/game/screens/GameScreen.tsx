import { StyleSheet, Text, View } from 'react-native';

import type { DifficultyDef } from '@/game/config/difficulty';
import { GameCanvas } from '@/game/render/GameCanvas';
import { Scene } from '@/game/render/Scene';

/**
 * Owns the canvas and the HUD overlay for one run.
 *
 * Loaded lazily from src/app/game.tsx so that nothing in here (three, expo-gl)
 * is ever evaluated during the static web export.
 */
export default function GameScreen({
  difficulty,
  seed,
}: {
  difficulty: DifficultyDef;
  seed: number;
}) {
  return (
    <View style={styles.root}>
      <GameCanvas>
        <Scene />
      </GameCanvas>

      {/* Placeholder HUD — replaced by src/game/hud/HudRoot.tsx in M2. */}
      <View pointerEvents="box-none" style={styles.hud}>
        <View style={styles.topBar}>
          <Text style={styles.topBarText}>NRD</Text>
          <Text style={styles.topBarDim}>난이도 {difficulty.nameKo}</Text>
          <Text style={styles.topBarDim}>데스카운트 {difficulty.deathCount}</Text>
          <Text style={styles.topBarDim}>seed {seed}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0d10' },
  hud: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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
  topBarText: { color: '#f0c674', fontWeight: '700', fontSize: 14 },
  topBarDim: { color: '#9aa3ad', fontSize: 13 },
});
