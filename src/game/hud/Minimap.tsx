import { StyleSheet, View } from 'react-native';

import type { Lane } from '@/game/engine/lane';

/**
 * Native minimap placeholder.
 *
 * The projection math in ./minimap-math.ts is platform-neutral and already
 * unit-tested, so the M5 pass only has to draw with Skia instead of Canvas 2D.
 */
export function Minimap(_props: { lane: Lane; plotCount?: number }) {
  return <View style={styles.root} />;
}

const styles = StyleSheet.create({
  root: {
    width: 120,
    height: 120,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2b3038',
    backgroundColor: '#0e1116',
  },
});
