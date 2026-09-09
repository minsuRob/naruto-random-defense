import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { UNIT_DEF_BY_ID } from '@/game/data/abilities';
import { GRADE_LABEL, UNIT_BY_ID } from '@/game/data/units';
import { RECIPES_BY_MATERIAL, type Recipe } from '@/game/data/recipes';
import type { Availability } from '@/game/engine/combine';
import { UnitPreviewCanvas } from '@/game/render/visuals/UnitPreviewCanvas';
import { GRADE_COLORS, HudColors, hudStyles } from '../hud-theme';

/**
 * Detail pane: a live 3D preview of what the recipe produces, its ability sheet,
 * and where the result goes next — the chain that makes planning possible.
 */
export function RecipeDetail({
  recipe,
  state,
  counts,
  onCombine,
  onFilterUnit,
}: {
  recipe: Recipe;
  state: Availability;
  counts: Record<string, number>;
  onCombine: () => void;
  onFilterUnit: (unitId: string) => void;
}) {
  const raw = UNIT_BY_ID.get(recipe.resultId);
  const def = UNIT_DEF_BY_ID.get(recipe.resultId);
  const color = GRADE_COLORS[recipe.category] ?? HudColors.text;
  const feedsInto = RECIPES_BY_MATERIAL.get(recipe.resultId) ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.preview}>
        <UnitPreviewCanvas unitId={recipe.resultId} grade={recipe.category} />
      </View>

      <ScrollView contentContainerStyle={styles.info}>
        <Text style={[styles.grade, { color }]}>{GRADE_LABEL[recipe.category]}</Text>
        <Text style={styles.name}>{recipe.resultNameKo}</Text>

        {def && (
          <View style={styles.stats}>
            <Stat label="데미지" value={def.damage.toFixed(0)} />
            <Stat label="공격속도" value={`${def.cooldown.toFixed(2)}초`} />
            <Stat label="사거리" value={def.range.toFixed(1)} />
          </View>
        )}

        {def && def.abilities.length > 0 && (
          <View style={styles.section}>
            <Text style={hudStyles.label}>능력</Text>
            {def.abilities.map((ability, i) => (
              <Text key={i} style={styles.line}>
                • {ability.kind}
                {'chance' in ability ? ` ${(ability.chance * 100).toFixed(1)}%` : ''}
                {'amount' in ability ? ` ${ability.amount}` : ''}
                {'pct' in ability ? ` ${ability.pct}%` : ''}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={hudStyles.label}>재료</Text>
          {recipe.materials.map((material, i) => {
            const have = counts[material.unitId] ?? 0;
            const enough = have >= material.count;
            return (
              <Text key={i} style={[styles.line, enough ? styles.have : styles.lacking]}>
                • {material.nameKo} {have}/{material.count}
              </Text>
            );
          })}
          <Text style={[styles.line, state.woodOk ? styles.have : styles.lacking]}>
            • 목재 {recipe.wood}
          </Text>
        </View>

        {feedsInto.length > 0 && (
          <View style={styles.section}>
            <Text style={hudStyles.label}>이 유닛이 재료인 조합</Text>
            {feedsInto.slice(0, 6).map((next) => (
              <Pressable key={next.id} onPress={() => onFilterUnit(recipe.resultId)}>
                <Text style={styles.link}>→ {next.resultNameKo}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {raw && (
          <Pressable
            disabled={!state.ok}
            onPress={onCombine}
            style={[styles.combine, !state.ok && styles.combineDisabled]}
          >
            <Text style={[styles.combineText, !state.ok && styles.lacking]}>
              {state.ok ? '조합하기' : '재료 부족'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
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

const styles = StyleSheet.create({
  root: { flex: 1, gap: 8 },
  preview: {
    height: 190,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: HudColors.border,
    backgroundColor: '#0e1116',
    overflow: 'hidden',
  },
  info: { gap: 8, paddingBottom: 8 },
  grade: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  name: { color: HudColors.text, fontSize: 17, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 14 },
  stat: { gap: 1 },
  statValue: { color: HudColors.text, fontSize: 13, fontWeight: '700' },
  section: { gap: 2 },
  line: { color: HudColors.textDim, fontSize: 11, lineHeight: 15 },
  have: { color: HudColors.textDim },
  lacking: { color: '#a2584f' },
  link: { color: HudColors.accent, fontSize: 11, lineHeight: 16 },
  combine: {
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: HudColors.good,
  },
  combineDisabled: { backgroundColor: '#252a31' },
  combineText: { color: '#0b0d10', fontWeight: '800' },
});
