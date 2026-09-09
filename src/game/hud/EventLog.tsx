import { StyleSheet, Text, View } from 'react-native';

import { useGameStore } from '@/game/runtime/game-store';
import { HudColors } from './hud-theme';

/** The last few things that happened, oldest at the top and dimmest. */
export function EventLog() {
  const log = useGameStore((s) => s.log);
  const recent = log.slice(-8);

  return (
    <View style={styles.root}>
      {recent.map((line, i) => (
        <Text
          key={line.id}
          style={[styles.line, { opacity: 0.35 + (0.65 * (i + 1)) / recent.length }]}
          numberOfLines={1}
        >
          {line.text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 2, maxWidth: 320 },
  line: { color: HudColors.textDim, fontSize: 12 },
});
