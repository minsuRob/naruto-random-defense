import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GRADE_LABEL, UNIT_BY_ID } from '@/game/data/units';
import type { Recipe } from '@/game/data/recipes';
import type { Availability } from '@/game/engine/combine';
import { GRADE_COLORS, HudColors } from '../hud-theme';

/**
 * One recipe: result on the left, its materials with owned/missing counts, and
 * a combine button that only lights up when the recipe is actually completable.
 */
export function RecipeRow({
  recipe,
  state,
  counts,
  selected,
  onSelect,
  onCombine,
}: {
  recipe: Recipe;
  state: Availability;
  counts: Record<string, number>;
  selected: boolean;
  onSelect: () => void;
  onCombine: () => void;
}) {
  const color = GRADE_COLORS[recipe.category] ?? HudColors.text;

  return (
    <Pressable
      onPress={onSelect}
      style={[styles.root, selected && styles.selected, state.ok && styles.ready]}
    >
      <View style={styles.head}>
        <View style={[styles.badge, { borderColor: color }]}>
          <Text style={[styles.badgeText, { color }]}>{GRADE_LABEL[recipe.category]}</Text>
        </View>
        <Text style={styles.result} numberOfLines={1}>
          {recipe.resultNameKo}
        </Text>
        <Text style={[styles.wood, !state.woodOk && styles.lacking]}>목재 {recipe.wood}</Text>
        <Pressable
          disabled={!state.ok}
          onPress={onCombine}
          style={[styles.combine, !state.ok && styles.combineDisabled]}
        >
          <Text style={[styles.combineText, !state.ok && styles.lacking]}>조합</Text>
        </Pressable>
      </View>

      <View style={styles.materials}>
        {recipe.materials.map((material, i) => {
          const have = counts[material.unitId] ?? 0;
          const enough = have >= material.count;
          const grade = UNIT_BY_ID.get(material.unitId)?.grade ?? 'normal';
          return (
            <Text key={i} style={[styles.material, enough ? styles.have : styles.lacking]}>
              <Text style={{ color: GRADE_COLORS[grade] }}>[{GRADE_LABEL[grade]}]</Text>{' '}
              {material.nameKo} {have}/{material.count}
            </Text>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: 8,
    gap: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: HudColors.border,
    backgroundColor: '#161a20',
  },
  selected: { borderColor: HudColors.borderStrong, backgroundColor: '#1c2129' },
  ready: { borderColor: HudColors.good },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1 },
  badgeText: { fontSize: 9, fontWeight: '800' },
  result: { color: HudColors.text, fontSize: 13, fontWeight: '700', flex: 1 },
  wood: { color: HudColors.wood, fontSize: 11 },
  combine: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: HudColors.good,
  },
  combineDisabled: { backgroundColor: '#252a31' },
  combineText: { color: '#0b0d10', fontSize: 11, fontWeight: '800' },
  materials: { gap: 1 },
  material: { fontSize: 11, lineHeight: 15 },
  have: { color: HudColors.textDim },
  lacking: { color: '#a2584f' },
});
