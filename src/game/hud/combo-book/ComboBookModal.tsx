import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GRADE_LABEL, type Grade } from '@/game/data/units';
import {
  RECIPES,
  RECIPES_BY_MATERIAL,
  RECIPE_CATEGORIES,
  type Recipe,
} from '@/game/data/recipes';
import { availability } from '@/game/engine/combine';
import type { Engine } from '@/game/engine/engine';
import { useGameStore } from '@/game/runtime/game-store';
import { LOCAL_PLAYER } from '@/game/runtime/ui-actions';
import { GRADE_COLORS, HudColors, hudStyles } from '../hud-theme';
import { RecipeDetail } from './RecipeDetail';
import { RecipeRow } from './RecipeRow';

/**
 * The combination book — the original's 조합식존, but browsable.
 *
 * Every recipe is grouped by the grade it produces, materials show owned/missing
 * counts against the live roster, and a recipe you can afford combines in one
 * click. Selecting a unit and pressing C opens it filtered to that unit.
 */
export function ComboBookModal({ engine }: { engine: Engine }) {
  const open = useGameStore((s) => s.comboBook.open);
  const filterUnitId = useGameStore((s) => s.comboBook.filterUnitId);
  const counts = useGameStore((s) => s.roster.countsByDef);
  const wood = useGameStore((s) => s.hud.wood);
  const setComboBook = useGameStore((s) => s.setComboBook);

  const [category, setCategory] = useState<Grade>(RECIPE_CATEGORIES[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const recipes = useMemo(() => {
    if (filterUnitId) return RECIPES_BY_MATERIAL.get(filterUnitId) ?? [];
    return RECIPES.filter((r) => r.category === category);
  }, [category, filterUnitId]);

  // Completable recipes first, then the ones only missing wood.
  const sorted = useMemo(() => {
    const scored = recipes.map((recipe) => ({
      recipe,
      state: availability(recipe, counts, wood),
    }));
    scored.sort((a, b) => {
      if (a.state.ok !== b.state.ok) return a.state.ok ? -1 : 1;
      return a.state.missing.length - b.state.missing.length;
    });
    return scored;
  }, [counts, recipes, wood]);

  const selected: Recipe | null =
    sorted.find((s) => s.recipe.id === selectedId)?.recipe ?? sorted[0]?.recipe ?? null;

  if (!open) return null;

  const combine = (recipe: Recipe) => {
    engine.enqueue({
      t: 'COMBINE',
      player: LOCAL_PLAYER,
      recipeId: recipe.id,
      preferIds: useGameStore.getState().selection,
    });
  };

  return (
    <View style={styles.scrim}>
      <View style={[hudStyles.panel, styles.modal]}>
        <View style={styles.header}>
          <Text style={styles.title}>조합 도감</Text>
          <Text style={styles.subtitle}>
            {filterUnitId ? '선택 유닛이 재료인 조합' : `${RECIPES.length}개 조합`} · 보유 목재{' '}
            <Text style={{ color: HudColors.wood }}>{wood}</Text>
          </Text>
          <Pressable style={styles.close} onPress={() => setComboBook({ open: false })}>
            <Text style={styles.closeText}>닫기 (Esc)</Text>
          </Pressable>
        </View>

        {!filterUnitId && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow}>
            <View style={styles.tabs}>
              {RECIPE_CATEGORIES.map((grade) => {
                const active = grade === category;
                return (
                  <Pressable
                    key={grade}
                    onPress={() => {
                      setCategory(grade);
                      setSelectedId(null);
                    }}
                    style={[
                      styles.tab,
                      active && { borderColor: GRADE_COLORS[grade], backgroundColor: '#1c2129' },
                    ]}
                  >
                    <Text
                      style={[styles.tabText, active && { color: GRADE_COLORS[grade] }]}
                    >
                      {GRADE_LABEL[grade]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}

        {filterUnitId && (
          <Pressable style={styles.clearFilter} onPress={() => setComboBook({ filterUnitId: null })}>
            <Text style={styles.clearFilterText}>전체 조합 보기</Text>
          </Pressable>
        )}

        <View style={styles.body}>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {sorted.length === 0 && <Text style={styles.empty}>해당하는 조합이 없습니다</Text>}
            {sorted.map(({ recipe, state }) => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                state={state}
                counts={counts}
                selected={selected?.id === recipe.id}
                onSelect={() => setSelectedId(recipe.id)}
                onCombine={() => combine(recipe)}
              />
            ))}
          </ScrollView>

          <View style={styles.detail}>
            {selected ? (
              <RecipeDetail
                recipe={selected}
                state={availability(selected, counts, wood)}
                counts={counts}
                onCombine={() => combine(selected)}
                onFilterUnit={(unitId) => setComboBook({ filterUnitId: unitId })}
              />
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,8,11,0.7)',
  },
  modal: { width: '92%', maxWidth: 1000, height: '86%', padding: 14, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: HudColors.text, fontSize: 18, fontWeight: '800' },
  subtitle: { color: HudColors.textDim, fontSize: 12, flex: 1 },
  close: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: HudColors.borderStrong,
  },
  closeText: { color: HudColors.textDim, fontSize: 12 },
  tabsRow: { flexGrow: 0 },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: HudColors.border,
  },
  tabText: { color: HudColors.textDim, fontSize: 12, fontWeight: '700' },
  clearFilter: { alignSelf: 'flex-start' },
  clearFilterText: { color: HudColors.accent, fontSize: 12 },
  body: { flex: 1, flexDirection: 'row', gap: 12 },
  list: { flex: 1.3 },
  listContent: { gap: 6, paddingRight: 6 },
  detail: { flex: 1 },
  empty: { color: HudColors.textFaint, fontSize: 13, padding: 12 },
});
