import { StyleSheet, Text, View } from 'react-native';

import type { DifficultyDef } from '@/game/config/difficulty';
import { useGameStore } from '@/game/runtime/game-store';
import { HudColors, hudStyles } from './hud-theme';

/**
 * Round, timer, lane pressure and the three currencies — the numbers a player
 * checks between waves. Each field subscribes on its own so a gold change does
 * not re-render the timer.
 */
export function TopBar({ difficulty }: { difficulty: DifficultyDef }) {
  const round = useGameStore((s) => s.hud.round);
  const timeLeft = useGameStore((s) => s.hud.timeLeft);
  const aliveOnLane = useGameStore((s) => s.hud.aliveOnLane);
  const deathCount = useGameStore((s) => s.hud.deathCount);
  const gold = useGameStore((s) => s.hud.gold);
  const wood = useGameStore((s) => s.hud.wood);
  const pakkun = useGameStore((s) => s.hud.pakkun);

  const pressure = deathCount > 0 ? aliveOnLane / deathCount : 0;
  const laneColor =
    pressure > 0.85 ? HudColors.danger : pressure > 0.6 ? HudColors.gold : HudColors.text;

  return (
    <View style={[hudStyles.panel, styles.root]}>
      <Field label="라운드" value={String(round)} />
      <Field label="남은 시간" value={`${timeLeft}s`} />
      <View style={styles.divider} />
      <Field
        label="라인 / 데스카운트"
        value={`${aliveOnLane} / ${deathCount}`}
        color={laneColor}
      />
      <View style={styles.divider} />
      <Field label="골드" value={String(gold)} color={HudColors.gold} />
      <Field label="목재" value={String(wood)} color={HudColors.wood} />
      <Field label="파쿤" value={String(pakkun)} color={HudColors.pakkun} />
      <View style={styles.divider} />
      <Field label="난이도" value={difficulty.nameKo} color={HudColors.textDim} />
    </View>
  );
}

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.field}>
      <Text style={hudStyles.label}>{label}</Text>
      <Text style={[hudStyles.value, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
    margin: 12,
  },
  field: { gap: 1, minWidth: 46 },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: HudColors.border },
});
