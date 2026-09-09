import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Suspense, lazy, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { resolveDifficulty } from '@/game/config/difficulty';

// three / expo-gl must never be evaluated during the static web export
// (app.json sets web.output: "static", so routes are rendered in node).
const GameScreen = lazy(() => import('@/game/screens/GameScreen'));

export default function GameRoute() {
  const { difficulty, seed } = useLocalSearchParams<{ difficulty?: string; seed?: string }>();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const difficultyDef = resolveDifficulty(difficulty);
  const seedNumber = Number(seed) || 1;

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {mounted ? (
        <Suspense fallback={<Loading />}>
          <GameScreen difficulty={difficultyDef} seed={seedNumber} />
        </Suspense>
      ) : (
        <Loading />
      )}
    </View>
  );
}

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color="#f0c674" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0d10' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
