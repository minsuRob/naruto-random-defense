import { StyleSheet, Text, View } from 'react-native';

import { useGameStore } from '@/game/runtime/game-store';
import { LOCAL_PLAYER } from '@/game/runtime/ui-actions';
import { HudColors, hudStyles } from './hud-theme';

/**
 * The four-slot roster board, as the original shows on the right.
 *
 * The engine is already written against a player array, so this reads from a
 * list and would show real co-op numbers unchanged. v1 fills one slot and marks
 * the rest 대기 — the single-player path is the one that has to be solid.
 */
const SLOTS = 4;

export function PlayerPanel() {
  const round = useGameStore((s) => s.hud.round);
  const aliveOnLane = useGameStore((s) => s.hud.aliveOnLane);
  const deathCount = useGameStore((s) => s.hud.deathCount);
  const units = useGameStore((s) => s.roster.units.length);

  const rows = Array.from({ length: SLOTS }, (_, i) => {
    if (i !== LOCAL_PLAYER) return { name: `슬롯 ${i + 1}`, waiting: true, count: 0, lane: 0 };
    return { name: '나', waiting: false, count: units, lane: aliveOnLane };
  });

  return (
    <View style={[hudStyles.panel, styles.root]}>
      <Text style={styles.title}>★ NRD SEASON 1 ★</Text>
      <View style={styles.headerRow}>
        <Text style={[styles.cell, styles.head, styles.nameCell]}>플레이어</Text>
        <Text style={[styles.cell, styles.head]}>유닛</Text>
        <Text style={[styles.cell, styles.head]}>라인</Text>
      </View>

      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          <Text
            style={[styles.cell, styles.nameCell, row.waiting ? styles.waiting : styles.me]}
            numberOfLines={1}
          >
            {row.name}
          </Text>
          <Text style={[styles.cell, row.waiting && styles.waiting]}>
            {row.waiting ? '—' : row.count}
          </Text>
          <Text style={[styles.cell, row.waiting && styles.waiting]}>
            {row.waiting ? '—' : `${row.lane}/${deathCount}`}
          </Text>
        </View>
      ))}

      <Text style={styles.footer}>Round {round}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 8, gap: 3, width: 210 },
  title: { color: HudColors.gold, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: HudColors.border,
    paddingBottom: 3,
  },
  row: { flexDirection: 'row' },
  cell: { color: HudColors.text, fontSize: 11, width: 44, textAlign: 'right' },
  nameCell: { flex: 1, textAlign: 'left' },
  head: { color: HudColors.textFaint, fontSize: 10 },
  me: { color: HudColors.good, fontWeight: '700' },
  waiting: { color: HudColors.textFaint },
  footer: {
    color: HudColors.textFaint,
    fontSize: 10,
    textAlign: 'right',
    borderTopWidth: 1,
    borderTopColor: HudColors.border,
    paddingTop: 3,
  },
});
