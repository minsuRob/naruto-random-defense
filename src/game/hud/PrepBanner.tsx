import { StyleSheet, Text, View } from 'react-native';

import { ALTARS, type AltarKind } from '@/game/config/map';
import { useGameStore } from '@/game/runtime/game-store';
import { HudColors, hudStyles } from './hud-theme';

/** Which key sends a pakkun where — kept beside the altar it belongs to. */
const ALTAR_KEY: Record<AltarKind, string> = {
  magic: 'Q',
  gold: 'W',
  normal: 'E',
  wood: 'R',
};

/**
 * The setup window before round 1.
 *
 * This is where a run actually begins: you are handed pakkun and nothing else,
 * and what you send them into decides the opening. A banner rather than a modal
 * on purpose — the altars are on the map behind it and you need to be able to
 * click them while this is up.
 */
export function PrepBanner() {
  const phase = useGameStore((s) => s.hud.phase);
  const prepLeft = useGameStore((s) => s.hud.prepLeft);
  const pakkun = useGameStore((s) => s.hud.pakkun);

  if (phase !== 'prep') return null;

  return (
    <View style={styles.wrap}>
      <View style={[hudStyles.panel, styles.panel]}>
        <View style={styles.headline}>
          <Text style={styles.title}>준비 시간</Text>
          <Text style={styles.timer}>{prepLeft}초</Text>
        </View>
        <Text style={styles.lead}>
          파쿤 {pakkun}마리를 제단으로 보내 유닛을 받으세요. 제단을 클릭하거나 Q·W·E·R.
        </Text>
        <View style={styles.altars}>
          {ALTARS.map((altar) => (
            <View key={altar.kind} style={styles.altar}>
              <Text style={styles.key}>{ALTAR_KEY[altar.kind]}</Text>
              <Text style={styles.altarName}>{altar.nameKo}</Text>
              <Text style={styles.altarHint}>{altar.hint}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 74,
    left: 0,
    right: 0,
    alignItems: 'center',
    // The altars are on the map behind this; clicks have to reach them.
    pointerEvents: 'none',
  },
  panel: { padding: 12, gap: 8, alignItems: 'center', maxWidth: 560 },
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  title: { color: HudColors.text, fontSize: 17, fontWeight: '800' },
  timer: { color: HudColors.accent, fontSize: 17, fontWeight: '800' },
  lead: { color: HudColors.textDim, fontSize: 12, textAlign: 'center' },
  altars: { flexDirection: 'row', gap: 8 },
  altar: {
    minWidth: 104,
    gap: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: HudColors.border,
    backgroundColor: '#161a20',
  },
  key: { color: HudColors.gold, fontSize: 10, fontWeight: '800' },
  altarName: { color: HudColors.text, fontSize: 12, fontWeight: '700' },
  altarHint: { color: HudColors.textFaint, fontSize: 10 },
});
