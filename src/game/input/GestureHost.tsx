import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import type { NativeInputController } from './input-controller';

/**
 * Native gesture surface: two-finger drag pans, pinch zooms, a tap picks.
 *
 * Gestures run on the UI thread and hand the JS side small numeric deltas, so
 * three never sees a gesture and the sim never blocks one. On web this file is
 * replaced by GestureHost.web.tsx, which renders nothing — the DOM controller
 * already listens for itself.
 */
export function GestureHost({
  input,
  children,
}: {
  input: NativeInputController;
  children: ReactNode;
}) {
  const pan = Gesture.Pan()
    .minPointers(2)
    .onChange((event) => {
      runOnJS(input.pushDragPan)(event.changeX, event.changeY);
    });

  const pinch = Gesture.Pinch().onChange((event) => {
    // scale > 1 means fingers spreading, which should move the camera closer.
    if (event.scaleChange > 0) runOnJS(input.pushZoom)(1 / event.scaleChange);
  });

  const tap = Gesture.Tap().onEnd((event) => {
    runOnJS(input.pushPointer)({
      kind: 'click',
      x: event.x,
      y: event.y,
      button: 0,
      shift: false,
      ctrl: false,
      alt: false,
    });
  });

  const composed = Gesture.Simultaneous(pan, pinch, tap);

  return (
    <GestureDetector gesture={composed}>
      <View style={styles.root} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
