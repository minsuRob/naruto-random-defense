import { StyleSheet, Text, View } from 'react-native';

import { UNIT_DEF_BY_ID } from '@/game/data/abilities';
import type { Ability } from '@/game/engine/types';
import { GRADE_LABEL, UNIT_BY_ID } from '@/game/data/units';
import { useGameStore } from '@/game/runtime/game-store';
import { GRADE_COLORS, HudColors, hudStyles } from './hud-theme';

/**
 * What is selected: the unit's stats and what its abilities actually do.
 * With several selected it collapses to a count plus the first unit's card.
 */
export function SelectionPanel() {
  const selection = useGameStore((s) => s.selection);
  const units = useGameStore((s) => s.roster.units);

  if (!selection.length) return null;

  const primary = units.find((u) => u.id === selection[0]);
  if (!primary) return null;

  const raw = UNIT_BY_ID.get(primary.defId);
  const def = UNIT_DEF_BY_ID.get(primary.defId);
  if (!raw || !def) return null;

  const color = GRADE_COLORS[raw.grade] ?? HudColors.text;

  return (
    <View style={[hudStyles.panel, styles.root]}>
      <View style={styles.header}>
        <View style={[styles.portrait, { borderColor: color }]}>
          <Text style={[styles.portraitGrade, { color }]}>{GRADE_LABEL[raw.grade]}</Text>
        </View>
        <View style={styles.title}>
          <Text style={styles.name} numberOfLines={2}>
            {raw.nameKo}
          </Text>
          {selection.length > 1 && (
            <Text style={styles.multi}>외 {selection.length - 1}기 선택됨</Text>
          )}
        </View>
      </View>

      <View style={styles.stats}>
        <Stat label="데미지" value={def.damage.toFixed(0)} />
        <Stat label="공격속도" value={`${def.cooldown.toFixed(2)}초`} />
        <Stat label="사거리" value={def.range.toFixed(1)} />
        <Stat label="타입" value={def.damageType === 'magic' ? '마법' : '물리'} />
      </View>

      {def.abilities.length > 0 && (
        <View style={styles.abilities}>
          {def.abilities.map((ability, i) => (
            <Text key={i} style={styles.ability}>
              • {describeAbility(ability)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={hudStyles.label}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function describeAbility(ability: Ability): string {
  switch (ability.kind) {
    case 'stun':
      return `썬더클랩 ${(ability.chance * 100).toFixed(0)}% — ${ability.seconds}초 스턴`;
    case 'slow':
      return `이감 ${(ability.chance * 100).toFixed(0)}% — 이동속도 ${(
        ability.amount * 100
      ).toFixed(0)}% 감소`;
    case 'armorReduce':
      return `방깍 -${ability.amount} (최대 ${ability.maxStacks}중첩)`;
    case 'delete':
      return `삭제 ${(ability.chance * 100).toFixed(1)}% (보스 면역)`;
    case 'percentDamage':
      return `퍼센트 데미지 ${ability.pct}%`;
    case 'auraAtkSpeed':
      return `공속 오라 +${ability.pct}%`;
    case 'auraAtk':
      return `공버프 오라 +${ability.pct}%`;
  }
}

const styles = StyleSheet.create({
  root: { padding: 10, gap: 8, width: 260 },
  header: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  portrait: {
    width: 46,
    height: 46,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: '#1a1e24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitGrade: { fontSize: 10, fontWeight: '800' },
  title: { flex: 1, gap: 2 },
  name: { color: HudColors.text, fontSize: 14, fontWeight: '700' },
  multi: { color: HudColors.textDim, fontSize: 11 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { minWidth: 54, gap: 1 },
  statValue: { color: HudColors.text, fontSize: 13, fontWeight: '600' },
  abilities: { gap: 2, borderTopWidth: 1, borderTopColor: HudColors.border, paddingTop: 6 },
  ability: { color: HudColors.textDim, fontSize: 11, lineHeight: 15 },
});
