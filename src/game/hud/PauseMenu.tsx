import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useGameStore } from '@/game/runtime/game-store';
import { HudColors, hudStyles } from './hud-theme';

/**
 * Pause overlay with the two input settings that change how the camera feels.
 *
 * WASD panning is off by default because W and S belong to the command card;
 * turning it on moves those two commands onto Shift.
 */
export function PauseMenu({ onResume }: { onResume: () => void }) {
  const paused = useGameStore((s) => s.paused);
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  const over = useGameStore((s) => s.hud.over);

  if (!paused || over) return null;

  return (
    <View style={styles.scrim}>
      <View style={[hudStyles.panel, styles.card]}>
        <Text style={styles.title}>일시정지</Text>

        <Row
          label="화면 가장자리로 이동"
          hint="포인터를 가장자리에 두면 카메라가 따라갑니다"
          value={settings.edgeScroll}
          onChange={(edgeScroll) => setSettings({ edgeScroll })}
        />
        <Row
          label="WASD로 카메라 이동"
          hint="켜면 파쿤↑는 Shift+W, 판매는 Shift+S"
          value={settings.wasdPan}
          onChange={(wasdPan) => setSettings({ wasdPan })}
        />

        <Pressable style={styles.resume} onPress={onResume}>
          <Text style={styles.resumeText}>계속하기 (P)</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
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
    backgroundColor: 'rgba(6,8,11,0.66)',
  },
  card: { padding: 22, gap: 14, width: 360 },
  title: { color: HudColors.text, fontSize: 20, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 2 },
  label: { color: HudColors.text, fontSize: 13, fontWeight: '600' },
  hint: { color: HudColors.textFaint, fontSize: 11 },
  resume: {
    marginTop: 4,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: HudColors.accent,
  },
  resumeText: { color: '#0b0d10', fontWeight: '800' },
});
