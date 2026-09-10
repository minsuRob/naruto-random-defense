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
 * A single strip rather than a panel: the thing it is telling you about is the
 * plaza directly behind it, and a banner deep enough to cover the plaza would
 * hide the altars during the one stretch of the game that is only about them.
 */
export function PrepBanner() {
  const phase = useGameStore((s) => s.hud.phase);
  const prepLeft = useGameStore((s) => s.hud.prepLeft);
  const pakkun = useGameStore((s) => s.hud.pakkun);

  if (phase !== 'prep') return null;

  return (
    <View style={styles.wrap}>
      <View style={[hudStyles.panel, styles.strip]}>
        <Text style={styles.title}>준비</Text>
        <Text style={styles.timer}>{prepLeft}초</Text>
        <Text style={styles.lead}>
          가운데 광장의 파쿤 {pakkun}마리를 네 방향 중 하나로 보내세요
        </Text>
        {ALTARS.map((altar) => (
          <View key={altar.kind} style={styles.altar}>
            <Text style={styles.key}>{ALTAR_KEY[altar.kind]}</Text>
            <Text style={styles.altarName}>
              {altar.arrow} {altar.hint}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    alignItems: 'center',
    // The altars are on the map behind this; clicks have to reach them.
    pointerEvents: 'none',
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: '94%',
  },
  title: { color: HudColors.text, fontSize: 13, fontWeight: '800' },
  timer: { color: HudColors.accent, fontSize: 15, fontWeight: '800' },
  lead: { color: HudColors.textDim, fontSize: 11 },
  altar: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  key: { color: HudColors.gold, fontSize: 10, fontWeight: '800' },
  altarName: { color: HudColors.text, fontSize: 11 },
});
