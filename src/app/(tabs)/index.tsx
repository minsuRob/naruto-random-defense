import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  type DifficultyId,
} from '@/game/config/difficulty';

export default function TitleScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<DifficultyId>('easy');

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.root}>
      <Text style={styles.kicker}>NARUTO</Text>
      <Text style={styles.title}>랜덤 디펜스</Text>
      <Text style={styles.subtitle}>
        시작 게이트에서 출발한 몹이 진영을 한 바퀴 돕니다. 라인에 남은 몹이 데스카운트를
        넘기기 전에 정리하세요.
      </Text>

      <Text style={styles.sectionLabel}>난이도</Text>
      <View style={styles.cards}>
        {DIFFICULTY_ORDER.map((id) => {
          const def = DIFFICULTIES[id];
          const active = selected === id;
          return (
            <Pressable
              key={id}
              onPress={() => setSelected(id)}
              style={[styles.card, active && styles.cardActive]}
            >
              <Text style={[styles.cardName, active && styles.cardNameActive]}>
                {def.nameKo}
              </Text>
              <Text style={styles.cardStat}>데스카운트 {def.deathCount}</Text>
              <Text style={styles.cardStat}>몹 체력 ×{def.hpMult}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={styles.start}
        onPress={() =>
          router.push({ pathname: '/game', params: { difficulty: selected } })
        }
      >
        <Text style={styles.startText}>게임 시작</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0d10' },
  content: { padding: 24, paddingTop: 72, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  kicker: { color: '#e8623c', fontSize: 13, letterSpacing: 4, fontWeight: '700' },
  title: { color: '#f5f6f8', fontSize: 40, fontWeight: '800', marginTop: -4 },
  subtitle: { color: '#8f97a1', fontSize: 14, lineHeight: 21, marginBottom: 12 },
  sectionLabel: { color: '#6d757f', fontSize: 12, letterSpacing: 2, fontWeight: '700' },
  cards: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  card: {
    flexGrow: 1,
    minWidth: 140,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#14171c',
    borderWidth: 1,
    borderColor: '#22272e',
    gap: 3,
  },
  cardActive: { borderColor: '#f0c674', backgroundColor: '#1b1a14' },
  cardName: { color: '#c9d1d9', fontSize: 20, fontWeight: '700' },
  cardNameActive: { color: '#f0c674' },
  cardStat: { color: '#727a84', fontSize: 12 },
  start: {
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#e8623c',
  },
  startText: { color: '#0b0d10', fontSize: 16, fontWeight: '800' },
});
