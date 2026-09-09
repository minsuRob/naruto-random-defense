import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GAMBLE_COST, HIRE_COST, PAKKUN_GOLD, PAKKUN_WOOD_CHANCE } from '@/game/config/balance';
import { ALTARS } from '@/game/config/map';
import { HudColors, hudStyles } from './hud-theme';

/**
 * F1 help, as the original has in its top-left corner.
 *
 * Written as the rules a new player actually needs: what ends the run, what the
 * pakkun tokens are for, and what the keys do.
 */
export function HelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <View style={styles.scrim}>
      <View style={[hudStyles.panel, styles.panel]}>
        <View style={styles.header}>
          <Text style={styles.title}>도움말</Text>
          <View style={styles.spacer} />
          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>닫기 (F1 / Esc)</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Section title="게임의 규칙">
            <Line>몹은 시작 게이트에서 나와 진영 둘레를 계속 돕니다. 빠져나가는 출구가 없습니다.</Line>
            <Line>라인에 남은 몹 수가 데스카운트를 넘기면 그 자리에서 패배합니다.</Line>
            <Line>라운드 1~9는 30초, 10부터 42초입니다. 끝자리 0은 서쪽, 3은 동쪽 게이트에서 보스가 나옵니다.</Line>
          </Section>

          <Section title="파쿤 (위젯)">
            <Line>파쿤은 진영 남쪽에 실체로 서 있습니다. 제단으로 보내야 결과가 나옵니다.</Line>
            {ALTARS.map((altar) => (
              <Line key={altar.kind}>
                {altar.nameKo} — {altar.hint}
                {altar.kind === 'gold' ? ` (${PAKKUN_GOLD} 확정)` : ''}
                {altar.kind === 'wood' ? ` (${PAKKUN_WOOD_CHANCE * 100}% 확률)` : ''}
              </Line>
            ))}
            <Line>Q W E R 로 가장 가까운 파쿤을 보내거나, 제단을 직접 클릭하세요.</Line>
          </Section>

          <Section title="목재">
            <Line>
              도박: {GAMBLE_COST[1]}목재 노말·매직 / {GAMBLE_COST[3]}목재 레어 /{' '}
              {GAMBLE_COST[5]}목재 유니크·스페셜
            </Line>
            <Line>
              용병: 노말 {HIRE_COST.normal.gold}골드 + 목재 {HIRE_COST.normal.wood}, 매직{' '}
              {HIRE_COST.magic.gold}골드 + 목재 {HIRE_COST.magic.wood}
            </Line>
            <Line>조합에도 목재가 듭니다. 5라운드마다 랭크 임무로 목재가 들어옵니다.</Line>
          </Section>

          <Section title="조작">
            <Line>좌클릭 선택 · 드래그 박스 · Shift 추가 · Ctrl 같은 종류 전체</Line>
            <Line>우클릭 이동 — 선택한 유닛 전부가 걸어갑니다. 걷는 동안은 공격하지 않습니다.</Line>
            <Line>Ctrl+숫자 부대 지정 · 숫자 호출 · Tab 순환 · F1 전체 선택</Line>
            <Line>방향키·화면 가장자리 이동 · 휠 줌 · Space 시점 복귀 · P 일시정지</Line>
            <Line>B 조합 도감 · C 선택 유닛이 재료인 조합 · S 판매 · M 이동 모드</Line>
          </Section>

          <Section title="배치">
            <Line>바깥쪽 칸일수록 레인에 사거리가 닿습니다. 한가운데는 제단이 차지합니다.</Line>
            <Line>공버프·공속 오라는 반경 안의 아군에게만 걸립니다. 뭉쳐 두면 이득입니다.</Line>
          </Section>
        </ScrollView>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <Text style={styles.line}>• {children}</Text>;
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
    backgroundColor: 'rgba(6,8,11,0.78)',
  },
  panel: { width: '90%', maxWidth: 720, maxHeight: '88%', padding: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { color: HudColors.text, fontSize: 18, fontWeight: '800' },
  spacer: { flex: 1 },
  close: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: HudColors.borderStrong,
  },
  closeText: { color: HudColors.textDim, fontSize: 12 },
  body: { gap: 12, paddingBottom: 8 },
  section: { gap: 3 },
  sectionTitle: { color: HudColors.gold, fontSize: 13, fontWeight: '800' },
  line: { color: HudColors.textDim, fontSize: 12, lineHeight: 18 },
});
