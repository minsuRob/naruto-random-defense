import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GAMBLE_COST, HIRE_COST, PAKKUN_GOLD } from '@/game/config/balance';
import type { Engine } from '@/game/engine/engine';
import type { Hotkey } from '@/game/input/types';
import { useGameStore } from '@/game/runtime/game-store';
import { handleHotkey } from '@/game/runtime/ui-actions';
import { HudColors, hudStyles } from './hud-theme';

/**
 * The Warcraft-style 4x3 command grid.
 *
 * Slot positions are fixed so muscle memory works: the top row is always the
 * pakkun options, the bottom row always acts on the selection. `T` swaps the
 * top row for the gamble tiers, exactly like a submenu in the original.
 */

interface Slot {
  key: Hotkey;
  label: string;
  hint: string;
  enabled: boolean;
}

export function CommandCard({ engine }: { engine: Engine }) {
  const uiMode = useGameStore((s) => s.uiMode);
  const selection = useGameStore((s) => s.selection);
  const pakkun = useGameStore((s) => s.hud.pakkun);
  const wood = useGameStore((s) => s.hud.wood);
  const gold = useGameStore((s) => s.hud.gold);

  const hasSelection = selection.length > 0;
  const gambling = uiMode === 'gamble';

  const topRow: Slot[] = gambling
    ? [
        { key: 'GAMBLE_1', label: 'Q', hint: `도박 ${GAMBLE_COST[1]}목`, enabled: wood >= GAMBLE_COST[1] },
        { key: 'GAMBLE_3', label: 'W', hint: `도박 ${GAMBLE_COST[3]}목`, enabled: wood >= GAMBLE_COST[3] },
        { key: 'GAMBLE_5', label: 'E', hint: `도박 ${GAMBLE_COST[5]}목`, enabled: wood >= GAMBLE_COST[5] },
        { key: 'CANCEL', label: 'Esc', hint: '취소', enabled: true },
      ]
    : // The four altars stand on the axes of the plaza, so the row is a map of
      // the four directions a pakkun can be sent rather than an arbitrary list.
      [
        { key: 'PAKKUN_UP', label: 'Q', hint: '↑ 노말+매직', enabled: pakkun > 0 },
        { key: 'PAKKUN_GOLD', label: 'W', hint: `→ 골드 ${PAKKUN_GOLD}`, enabled: pakkun > 0 },
        { key: 'PAKKUN_DOWN', label: 'E', hint: '↓ 노말', enabled: pakkun > 0 },
        { key: 'PAKKUN_WOOD', label: 'R', hint: '← 목재 60%', enabled: pakkun > 0 },
      ];

  const middleRow: Slot[] = [
    { key: 'GAMBLE', label: 'T', hint: '도박', enabled: wood >= GAMBLE_COST[1] },
    {
      key: 'HIRE_NORMAL',
      label: 'Z',
      hint: `용병 노말`,
      enabled: gold >= HIRE_COST.normal.gold && wood >= HIRE_COST.normal.wood,
    },
    {
      key: 'HIRE_MAGIC',
      label: 'X',
      hint: `용병 매직`,
      enabled: gold >= HIRE_COST.magic.gold && wood >= HIRE_COST.magic.wood,
    },
    { key: 'COMBO_BOOK', label: 'B', hint: '조합 도감', enabled: true },
  ];

  const bottomRow: Slot[] = [
    { key: 'SELL', label: 'S', hint: '판매', enabled: hasSelection },
    { key: 'MOVE', label: 'M', hint: uiMode === 'move' ? '이동 중…' : '이동', enabled: hasSelection },
    { key: 'COMBINE', label: 'C', hint: '조합', enabled: true },
    { key: 'CANCEL', label: 'Esc', hint: '취소', enabled: true },
  ];

  const press = (key: Hotkey) => handleHotkey(engine, key);

  return (
    <View style={[hudStyles.panel, styles.root]}>
      <Text style={styles.caption}>
        {gambling
          ? '목재 도박 — 등급을 걸고 뽑는다'
          : `파쿤 ${pakkun}마리 대기 — 네 방향 중 하나로 보내기`}
      </Text>
      {[topRow, middleRow, bottomRow].map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((slot, i) => (
            <Pressable
              key={`${rowIndex}-${i}`}
              disabled={!slot.enabled}
              onPress={() => press(slot.key)}
              style={[
                styles.slot,
                !slot.enabled && styles.slotDisabled,
                uiMode === 'move' && slot.key === 'MOVE' && styles.slotActive,
                gambling && rowIndex === 0 && styles.slotSubmenu,
              ]}
            >
              <Text style={[styles.key, !slot.enabled && styles.dim]}>{slot.label}</Text>
              <Text style={[styles.hint, !slot.enabled && styles.dim]} numberOfLines={2}>
                {slot.hint}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 6, gap: 4 },
  caption: { color: HudColors.textDim, fontSize: 10, paddingHorizontal: 2 },
  row: { flexDirection: 'row', gap: 4 },
  slot: {
    width: 74,
    height: 46,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 4,
    justifyContent: 'space-between',
    backgroundColor: '#1a1e24',
    borderWidth: 1,
    borderColor: HudColors.border,
  },
  slotDisabled: { opacity: 0.4 },
  slotActive: { borderColor: HudColors.accent, backgroundColor: '#241a17' },
  slotSubmenu: { borderColor: HudColors.gold },
  key: { color: HudColors.gold, fontSize: 11, fontWeight: '800' },
  hint: { color: HudColors.text, fontSize: 10, lineHeight: 12 },
  dim: { color: HudColors.textFaint },
});
