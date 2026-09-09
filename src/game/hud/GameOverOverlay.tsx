import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useGameStore } from '@/game/runtime/game-store';
import { HudColors, hudStyles } from './hud-theme';

/** Shown when the death count trips, a timed boss round expires, or you win. */
export function GameOverOverlay({ onRestart }: { onRestart: () => void }) {
  const router = useRouter();
  const over = useGameStore((s) => s.hud.over);
  const outcome = useGameStore((s) => s.hud.outcome);
  const round = useGameStore((s) => s.hud.round);

  if (!over) return null;
  const won = outcome === 'win';

  return (
    <View style={styles.scrim}>
      <View style={[hudStyles.panel, styles.card]}>
        <Text style={[styles.title, { color: won ? HudColors.good : HudColors.danger }]}>
          {won ? '클리어' : '패배'}
        </Text>
        <Text style={styles.detail}>도달 라운드 {round}</Text>
        <View style={styles.actions}>
          <Pressable style={[styles.button, styles.primary]} onPress={onRestart}>
            <Text style={styles.primaryText}>다시 시작</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => router.replace('/')}>
            <Text style={styles.buttonText}>타이틀로</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,8,11,0.72)',
  },
  card: { padding: 28, alignItems: 'center', gap: 6, minWidth: 280 },
  title: { fontSize: 30, fontWeight: '800' },
  detail: { color: HudColors.textDim, fontSize: 14, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HudColors.borderStrong,
  },
  buttonText: { color: HudColors.text, fontWeight: '700' },
  primary: { backgroundColor: HudColors.accent, borderColor: HudColors.accent },
  primaryText: { color: '#0b0d10', fontWeight: '800' },
});
