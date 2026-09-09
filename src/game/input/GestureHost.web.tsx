import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { InputController } from './types';

/**
 * Web has no gesture layer: the DOM input controller attaches its own pointer
 * and keyboard listeners to the game host. This just keeps the tree identical
 * across platforms.
 */
export function GestureHost({
  input,
  children,
}: {
  input: InputController;
  children: ReactNode;
}) {
  void input;
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
