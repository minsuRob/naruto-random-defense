import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { UNIT_DEF_BY_ID } from '@/game/data/abilities';
import { GRADE_LABEL, UNIT_BY_ID } from '@/game/data/units';
import { DRAFT_PICKS, type DraftPick } from '@/game/engine/draft';
import type { Engine } from '@/game/engine/engine';
import { UnitPreviewCanvas } from '@/game/render/visuals/UnitPreviewCanvas';
import { useGameStore } from '@/game/runtime/game-store';
import { LOCAL_PLAYER } from '@/game/runtime/ui-actions';
import { GRADE_COLORS, HudColors, hudStyles } from './hud-theme';

/**
 * The opening selection window.
 *
 * The original hands you a ranked 비급서 and shows a set of random candidates;
 * you take one, and repeat. Ranks climb across the picks, so the last one is
 * the pick that decides how the early rounds go.
 *
 * Reads the draft straight off the engine rather than through the store: it is
 * a short-lived screen with its own countdown, and nothing else needs the data.
 */
export function DraftOverlay({ engine }: { engine: Engine }) {
  const phase = useGameStore((s) => s.hud.phase);
  const [, force] = useState(0);
  const [hovered, setHovered] = useState(0);

  // The countdown is engine state, so tick the view alongside it.
  useEffect(() => {
    if (phase !== 'draft') return;
    const id = setInterval(() => force((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => setHovered(0), [engine.state.draft.pickIndex]);

  if (phase !== 'draft') return null;

  const draft = engine.state.draft;
  const pick: DraftPick | undefined = draft.picks[draft.pickIndex];
  if (!pick) return null;

  const choose = (index: number) => {
    engine.enqueue({ t: 'DRAFT_PICK', player: LOCAL_PLAYER, optionIndex: index });
  };

  const selected = pick.options[hovered];

  return (
    <View style={styles.scrim}>
      <View style={[hudStyles.panel, styles.panel]}>
        <View style={styles.header}>
          <Text style={styles.scroll}>[비급서]</Text>
          <Text style={styles.rank}>{pick.rankKo}</Text>
          <Text style={styles.progress}>
            {draft.pickIndex + 1} / {DRAFT_PICKS}
          </Text>
          <View style={styles.spacer} />
          <Text style={styles.timer}>{Math.max(0, Math.ceil(draft.timeLeft))}초</Text>
        </View>

        <Text style={styles.lead}>
          유닛 하나를 고르세요. 시간이 지나면 무작위로 정해집니다.
        </Text>

        <View style={styles.body}>
          <View style={styles.cards}>
            {pick.options.map((option, index) => {
              const raw = UNIT_BY_ID.get(option.defId);
              const def = UNIT_DEF_BY_ID.get(option.defId);
              const color = GRADE_COLORS[option.grade] ?? HudColors.text;
              const active = index === hovered;

              return (
                <Pressable
                  key={option.defId}
                  onHoverIn={() => setHovered(index)}
                  onPress={() => (active ? choose(index) : setHovered(index))}
                  style={[styles.card, active && { borderColor: color, backgroundColor: '#1c2129' }]}
                >
                  <Text style={[styles.cardGrade, { color }]}>
                    {GRADE_LABEL[option.grade]}
                  </Text>
                  <Text style={styles.cardName} numberOfLines={2}>
                    {raw?.nameKo ?? option.defId}
                  </Text>
                  {def && (
                    <Text style={styles.cardStats}>
                      공격 {def.damage.toFixed(0)} · {def.cooldown.toFixed(2)}초 · 사거리{' '}
                      {def.range.toFixed(1)}
                    </Text>
                  )}
                  <Text style={[styles.cardAction, active && { color }]}>
                    {active ? '한 번 더 눌러 선택' : '보기'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.detail}>
            <View style={styles.preview}>
              {selected && (
                <UnitPreviewCanvas unitId={selected.defId} grade={selected.grade} />
              )}
            </View>
            {selected && <AbilityList defId={selected.defId} />}
            <Pressable
              style={styles.confirm}
              onPress={() => choose(hovered)}
              disabled={!selected}
            >
              <Text style={styles.confirmText}>이 유닛으로 결정</Text>
            </Pressable>
          </View>
        </View>

        {draft.chosen.length > 0 && (
          <Text style={styles.chosen}>
            지금까지:{' '}
            {draft.chosen.map((id) => UNIT_BY_ID.get(id)?.nameKo ?? id).join(' · ')}
          </Text>
        )}
      </View>
    </View>
  );
}

function AbilityList({ defId }: { defId: string }) {
  const def = UNIT_DEF_BY_ID.get(defId);
  if (!def || !def.abilities.length) {
    return <Text style={styles.noAbility}>특수 능력 없음</Text>;
  }
  return (
    <View style={styles.abilities}>
      {def.abilities.map((ability, i) => (
        <Text key={i} style={styles.ability}>
          • {ability.kind}
          {'chance' in ability ? ` ${(ability.chance * 100).toFixed(0)}%` : ''}
          {'amount' in ability ? ` ${ability.amount}` : ''}
          {'pct' in ability ? ` ${ability.pct}%` : ''}
        </Text>
      ))}
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
    backgroundColor: 'rgba(6,8,11,0.82)',
  },
  panel: { width: '92%', maxWidth: 980, padding: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  scroll: { color: HudColors.gold, fontSize: 16, fontWeight: '800' },
  rank: { color: HudColors.text, fontSize: 20, fontWeight: '800' },
  progress: { color: HudColors.textDim, fontSize: 13 },
  spacer: { flex: 1 },
  timer: { color: HudColors.accent, fontSize: 20, fontWeight: '800' },
  lead: { color: HudColors.textDim, fontSize: 12 },
  body: { flexDirection: 'row', gap: 12 },
  cards: { flex: 1.4, gap: 8 },
  card: {
    padding: 10,
    gap: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HudColors.border,
    backgroundColor: '#161a20',
  },
  cardGrade: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  cardName: { color: HudColors.text, fontSize: 15, fontWeight: '700' },
  cardStats: { color: HudColors.textDim, fontSize: 11 },
  cardAction: { color: HudColors.textFaint, fontSize: 10, marginTop: 2 },
  detail: { flex: 1, gap: 8 },
  preview: {
    height: 180,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HudColors.border,
    backgroundColor: '#0e1116',
    overflow: 'hidden',
  },
  abilities: { gap: 2 },
  ability: { color: HudColors.textDim, fontSize: 11, lineHeight: 15 },
  noAbility: { color: HudColors.textFaint, fontSize: 11 },
  confirm: {
    marginTop: 'auto',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: HudColors.accent,
  },
  confirmText: { color: '#0b0d10', fontWeight: '800' },
  chosen: { color: HudColors.textFaint, fontSize: 11 },
});
