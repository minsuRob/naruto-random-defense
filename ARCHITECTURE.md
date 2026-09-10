# 구조와 인수인계

이 문서는 **다른 환경(다른 컴퓨터, 다른 에이전트 세션)에서 이 코드를 이어받기
위한** 것이다. `README.md`가 "무엇을 만들었나"라면, 이 문서는 "어디를 건드려야
하고, 무엇을 깨면 안 되고, 이미 어디서 한 번 넘어졌나"다.

- 대상: 워크래프트 3 유즈맵 **나루토 랜덤 디펜스**의 React Three Fiber 리메이크
- 플랫폼: **웹 우선**, Expo(iOS/Android)로 넘어갈 수 있는 구조
- 스택: Expo SDK 57.0.21 / expo-router 57 / React 19.2.3 / RN 0.86.3 /
  react-native-web 0.21 / TypeScript 6 strict / three 0.186 /
  @react-three/fiber 9.7 / @react-three/drei 10.7 / zustand 5 / vitest 4

> `AGENTS.md`가 걸어놓은 규칙: **Expo는 바뀌었다. 코드를 쓰기 전에
> <https://docs.expo.dev/versions/v57.0.0/> 의 해당 버전 문서를 읽어라.**
> SDK 56 이하의 기억으로 API를 쓰면 조용히 틀린다.

---

## 1. 새 환경에서 5분 안에 돌리기

```bash
npm install
npm run assets:stub   # 원본 맵이 없을 때: 빈 모델 매핑을 만든다 (아래 §5)
npm run web           # http://localhost:8081
```

`npm run assets:stub`을 **반드시 먼저** 해야 한다. `src/game/render/visuals/generated.ts`는
gitignore 대상이라 새 체크아웃에는 없고, `registry.ts`가 그걸 import하므로 없으면
번들이 깨진다. 스텁을 만들면 모든 유닛이 등급 색 프리미티브로 나오고 게임은 그대로 돌아간다.

원본 맵(`.w3x`)이 있으면 `npm run assets`로 진짜 모델까지 굽는다(§5).

검사:

```bash
npm test          # vitest, 현재 13파일 140개 통과
npm run typecheck # tsc --noEmit
npx expo export -p web
```

`expo export`는 단순한 빌드 확인이 아니라 **SSR 가드 회귀 테스트**다. `web.output`이
`static`이라 라우트가 Node에서 한 번 실행되는데, three/expo-gl이 그때 로드되면
`window is not defined`로 죽는다. `src/app/game.tsx`가 마운트 후 lazy import로
막고 있고, 이 명령이 그 가드가 살아 있는지를 증명한다.

---

## 2. 한 판의 규칙 (도메인 요약)

**진영 넷이 가운데 광장을 둘러싼다.** 광장에는 파쿤이 서 있는 받침대와, 상하좌우
네 방향의 제단이 있다. 진영은 대각선(모서리), 제단은 축 — 그래서 둘이 시각적으로
안 겹치고 "네 방향 중 하나"가 말 그대로가 된다. 지금은 진영 0(남서)에만 몹이 돌고,
나머지 셋은 `owner: -1`로 비어 있다.

몹은 시작 게이트에서 나와 진영 둘레를 **계속 돈다. 출구가 없다.** 라인에 남은
몹 수가 데스카운트를 넘는 순간 패배다. 그래서 "새는 걸 막는" 게임이 아니라
"쌓이는 속도보다 빨리 죽이는" 게임이다.

1. **초기 지급 + 준비 시간** — 난이도가 파쿤과 목재를 정한다(이지 7·19, 하드 9·19,
   헬 11·19). 유닛은 0개로 시작하므로 `PREP_SECONDS`(25초) 동안 첫 방어선을 세운다.
   원작의 "선택한 난이도의 초기지급 보상 …" 안내가 그대로 로그에 뜬다.
2. **파쿤** — 카운터가 아니라 **맵 위 실체**다. 광장 받침대의 자기 사분면에 서 있고,
   제단까지 걸어가야 결과가 나온다. Q·W·E·R가 그대로 네 방향이다 (↑ 노말+매직,
   → 골드 100, ↓ 노말, ← 목재 60%). 라운드마다 난이도만큼 더 들어온다.
3. **조합** — 목재와 재료 유닛으로 상위 유닛을 만든다. 등급이 오르면 수치만 커지는
   게 아니라 스플래시·멀티샷·크리티컬·넉백·마나 스킬이 붙는다.
4. 라운드 1~9는 30초, 10부터 42초. 끝자리 0은 서쪽 보스, 3은 동쪽 보스. 80·85는
   제한시간 300초 보스 라운드(못 잡으면 그 자리에서 패배). 86이 최종.

난이도별 데스카운트: 이지 100 / 하드 85 / 헬 70, 80라운드부터 50. HP 배수 1 / 1.8 / 3.2.

---

## 3. 층 구조와 경계 규칙

```
src/game/
  engine/    순수 TypeScript 시뮬레이션. React·three·react-native import 금지
  runtime/   엔진 ↔ React 경계 (zustand 스토어, 클럭, HUD 동기화, 선택, 이펙트 버스)
  render/    R3F 씬. GameCanvas만 웹/네이티브 분리
  camera/    WC3식 고정 피치 팬·줌 리그 (순수 로직 + 얇은 R3F 래퍼)
  input/     InputController 인터페이스 + 웹(DOM 이벤트) / 네이티브(제스처) 구현
  hud/       RN 프리미티브 오버레이 (three 없음)
  data/      원본 맵에서 추출한 테이블 + 능력 시트
  config/    맵 치수, 밸런스 상수, 난이도
  screens/   GameScreen — 한 판의 소유자
tools/w3x/   맵 추출·변환 파이프라인 (Node, .mjs)
```

### 지켜야 하는 경계

**엔진은 뷰를 모른다.** `src/game/engine/*`는 React도 three도 import하지 않는다.
덕분에 vitest에서 브라우저 없이 3000틱을 돌릴 수 있고, 나중에 워커나 서버로
옮겨도 그대로다. 이 규칙을 깨는 순간 테스트 전략 전체가 무너진다.

**매 틱 변하는 값은 스토어에 넣지 않는다.** 몹 위치·체력·카메라는 typed array와
ref에 두고 `useFrame`에서 직접 읽는다. 텍스트로 보이는 값만 zustand에 **10Hz**로,
그것도 shallow diff를 거쳐 발행한다(`runtime/hud-sync.ts`). 20Hz 틱마다 HUD를
다시 그리면 게임이 아니라 리렌더 벤치마크가 된다.

**한 프레임짜리 시각 효과는 스토어가 아니라 이펙트 버스로.** 마나 스킬이 터지는
건 상태가 아니다. `runtime/effect-bus.ts`가 hud-sync에서 받아 `SkillBursts`에
직접 넘긴다.

| 어디에 사는가 | 무엇이 |
|---|---|
| typed array / ref | MobPool, 유닛 좌표, 카메라 리그, 입력 컨트롤러 내부, 드래그 박스 |
| zustand (`game-store.ts`) | hud 스냅샷, roster, selection, controlGroups, uiMode, comboBook, log, paused, settings |
| 이펙트 버스 | 스킬 발동 |

---

## 4. 엔진 틱 (20Hz 고정)

`engine/engine.ts`의 `tick()`. 순서가 곧 의미다.

```
applyCommands      큐에 쌓인 명령을 도착 순서대로 — UI가 언제 넣었든 결정론 유지
advanceRound       준비 시간 카운트다운 / 라운드 경과
flushSpawns        예약된 스폰을 시간 도달 순으로
updateStatus       스턴·슬로우·방깍 만료
updateMovement     s += speed·slowMul·dt, 레인을 따라 랩
updateUnitWalks    이동 명령을 받은 유닛의 보간
updatePakkuns      제단으로 걸어가는 위젯, 도착 시 resolveAltar
updateAuras        버프 초기화 후 재계산
updateTargeting    사거리×1.1 히스테리시스로 기존 타겟 유지
updateCombat       쿨다운, 히트스캔 명중
updateDeaths       현상금, 라인 카운트 감소
checkDeathCount    라인 초과 시 패배
checkRoundEnd      시간 종료 / 보스 처치
```

- **결정론**: 모든 난수는 `state.rng`(mulberry32) 한 곳을 지난다. `Math.random()`을
  엔진에 쓰면 안 된다. 같은 시드·같은 명령열이면 3000틱 뒤까지 상태가 일치한다
  (`engine.test.ts`가 확인).
- **명령은 다음 틱에 적용된다.** `enqueue` 직후에 상태를 읽으면 아직 안 바뀌어 있다.
  테스트에서 `while (player.pakkun > 2) enqueue(...)`를 돌렸다가 무한 루프로 OOM이
  났던 자리다. 반복 횟수는 미리 계산해서 넣어라.
- **준비 시간이 다 지나야 1라운드가 시작된다.** `advanceRound`가 `prepLeft`를 깎고,
  0이 되는 틱에 `startRound(1)`을 부른다.
- 테스트에서 준비 시간을 건너뛰려면 `skipPrep(engine)` (engine.ts에서 export).

### 레인 (§"360도로 도는 구조")

`engine/lane.ts` — 둥근 사각형 폐곡선. 반폭 7, 코너 반경 2.5, 전체 길이 **L ≈ 51.71**.
`positionAt(s)`/`tangentAt(s)`는 세그먼트 테이블로 O(1).

**`reversed`가 기본 `true`다.** 몹이 서쪽으로 가야 한다는 요구를 곡선을 다시 만들지
않고 같은 곡선을 거꾸로 걸어 해결했다(`toBase(s) = wrapS(-s, L)`, 탄젠트는 부호 반전).
시작 게이트 위치와 코너가 그대로 유지된다. 보스 게이트도 `toLaneS()`로 같이 매핑된다.

### 배치 그리드와 좌표

`engine/grid.ts`의 `findFreeCell`은 **바깥에서 안쪽으로** 채운다. 플롯 한가운데 셀은
레인까지 사거리가 닿지 않아서, 중앙부터 채우면 첫 유닛들이 아무것도 못 쏜다.

**월드 좌표를 `localToCell`에 그대로 넣지 마라.** 그리드는 진영 로컬이고 피킹은
월드다. `worldToCell(origin, x, z)` / `cellToWorld(origin, cx, cy)`가 유일한 다리이고,
플레이어 기준으로는 `runtime/selection.ts`의 `plotCellAt(engine, playerId, x, z)`를 쓴다.
내 진영 밖이면 `null` — 광장도 남의 진영도 명령을 받지 않는다.

진영 0이 원점에 있던 시절에는 이 구분 없이도 전부 동작했다. 그래서
`grid.test.ts`의 "원점 아닌 진영 왕복" 테스트가 중요하다: 로컬 왕복 테스트는 게임 안
모든 클릭이 깨져도 계속 통과한다.

---

## 5. 데이터와 에셋: 무엇이 커밋되고 무엇이 아닌가

게임 수치와 3D 모델은 **사용자 본인이 가진 `.w3x` 맵**에서 뽑는다. 개인 학습용
전제이고, 저장소에는 **변환 스크립트만** 들어간다.

| 경로 | 커밋? | 비고 |
|---|---|---|
| `tools/w3x/*.mjs` | O | 변환 파이프라인 |
| `src/game/data/generated/*.raw.json` | O | 추출된 수치 테이블 (유닛 255, 라운드 1~100, 보스 29, 조합식 197) |
| `src/game/render/visuals/generated.ts` | **X** | 모델 매핑. `npm run assets` 또는 `assets:stub`으로 생성 |
| `assets/models/generated/` | **X** | glb·png |
| `tools/w3x/out/` | **X** | 중간 산출물 |
| `.w3x` 원본 | **X** | 복사하지 않는다 |

```bash
node tools/w3x/units-from-w3u.mjs --map ~/Downloads/nrd-seaon1-7.96_Ez.w3x
node tools/w3x/recipes.mjs
node tools/w3x/mdx2glb.mjs
node tools/w3x/build-visuals.mjs
npm run assets        # 위 넷을 한 번에
npm run assets:stub   # 맵 없이 빈 매핑만
```

파서는 `mdx-m3-viewer@5.12.0`(devDependency). MPQ/w3x/w3u/w3a/MDX/BLP를 읽는다.

### 변환기에서 알아둘 것

- **glb는 직접 쓴다** (`tools/w3x/glb.mjs`). three의 `GLTFExporter`는 Node에 없는
  `Blob`/`FileReader`를 요구해서 쓸 수 없다. BLP→PNG도 node `zlib`로 직접.
- **모델 전체가 루트 노드 하나에 매달린다.** 그 노드가 Z-up→Y-up 회전
  (`[-√½, 0, 0, √½]`)과 스케일 `1/128`을 맡는다. 정점·본 피벗·애니메이션 키에
  각각 굽지 않는 이유는 쿼터니언 트랙을 손대지 않기 위해서다. MDX는 바인드 회전이
  항등이라 역바인드 행렬이 단순 평행이동이 된다.
- **스케일은 1/128.** 워크래프트 지형 셀 하나가 128 맵 유닛이다. 1/64로 뒀다가
  모델이 플롯을 덮어버렸다.
- **텍스처 경로가 빈 geoset은 버린다.** 팀 컬러·그림자용 교체 텍스처인데, 남겨두면
  불투명한 흰 사각형으로 렌더된다. WC3 필터 모드는 glTF alpha mode로 매핑.
- 189개 중 178개가 `stand`/`walk`/`attack`/`death` 클립을 갖는다.

### 수치 추출의 함정

**워크래프트 오브젝트 파일은 기본 유닛과 *다른* 필드만 기록한다.** 레어 유닛 23종 중
21종에 `ua1b`(공격력)가 아예 없어서 전부 공격력 1로 나왔다. `data/abilities.ts`의
`GRADE_FALLBACK`이 **같은 등급이 실제로 기록한 값의 중앙값**으로 메운다(노말 19,
매직 99, 레어 399 — 지어낸 수가 아니다). `abilities.test.ts`가 "어떤 유닛도 데미지
바닥에 앉아 있지 않고, 등급이 오르면 데미지도 오른다"를 지킨다.

조합식은 스크립트 문자열(26개)이 아니라 **`war3map.w3a`의 조합 능력 툴팁**에서
197개를 뽑았다. 스크립트 쪽만 보면 대부분을 놓친다.

---

## 6. 작업별 파일 지도

| 하려는 일 | 여는 파일 |
|---|---|
| 밸런스 숫자 | `config/balance.ts` (전부 여기 있다), `config/difficulty.ts` |
| 맵 치수·진영 배치·광장·제단 | `config/map.ts` (기하 불변식은 `map.test.ts`가 지킨다) |
| 새 능력 종류 | `engine/types.ts`의 `Ability` 유니온 → `engine/combat.ts`의 `resolveHit` → `data/abilities.ts`의 시트 매핑 → `hud/SelectionPanel.tsx`의 `describeAbility` |
| 라운드·보스 규칙 | `engine/rounds.ts`, `data/waves.ts` |
| 경제(파쿤·도박·용병·판매·임무) | `engine/economy.ts`, `engine/pakkun.ts` |
| 조합 | `engine/combine.ts`, `data/recipes.ts`, `hud/combo-book/*` |
| 초기 지급·준비 시간 | `config/difficulty.ts`, `config/balance.ts`의 `PREP_SECONDS`, `hud/PrepBanner.tsx` |
| 키 바인딩 | `input/keymap.ts` (`Hotkey` 유니온 → 키 코드) |
| 웹 입력 동작 | `input/input-controller.web.ts` |
| 선택 로직 | `runtime/selection.ts` |
| 커맨드 카드 버튼 | `hud/CommandCard.tsx`, `runtime/ui-actions.ts` |
| 한 판의 배선 | `screens/GameScreen.tsx` |
| 씬에 오브젝트 추가 | `render/Scene.tsx` |

`describeAbility`는 `SelectionPanel.tsx`에서 export되어 드래프트·조합 도감·선택
패널 세 곳이 함께 쓴다. 능력을 추가하면 여기도 반드시 같이 고쳐야 문구가 생긴다.

---

## 7. 이미 한 번 넘어진 곳

다른 환경에서 다시 발견하지 않도록 남긴다.

1. **`useMemo`로 아이덴티티를 가진 객체를 만들지 마라.** `useMemo`는 캐싱 *힌트*이고
   React Compiler + StrictMode에서 실제로 버려진다. 이펙트는 A 인스턴스에 리스너를
   달았는데 렌더 트리는 B를 쓰는 상황이 실제로 났다(키를 눌러도 카메라가 안 움직였다).
   `runtime/use-constant.ts`의 `useConstant`(lazy `useRef`)를 쓴다. 엔진·클럭·리그·
   입력 컨트롤러가 전부 이걸로 만들어진다.
2. **명령형 R3F 컴포넌트에는 `'use no memo'`를 붙인다.** `SimDriver`, `CameraRig`,
   `MobInstances`, `Units`, `Minimap.web`, `SkillBursts` 등. `useFrame` 안에서 ref를
   변이하는 코드는 컴파일러가 건드리면 안 된다.
3. **R3F에는 `onContextMenu` 이벤트가 없다.** 번들을 뒤져서 확인했다. 우클릭 이동은
   `render/picking.ts`의 `screenToGround`로 직접 레이캐스트한다(`GameScreen.tsx`).
4. **네이티브 `CanvasProps`에는 `dpr`이 없다**(Omit되어 있다). 웹 `GameCanvas.web.tsx`
   에만 있다. 모바일 성능 레버는 다른 데서 찾아야 한다.
5. **입력 컨트롤러의 window 리스너는 host 엘리먼트 없이도 등록해야 한다.** 초기 구현이
   host가 없으면 `attach()`에서 바로 빠져나가는 바람에 키보드가 통째로 죽어 있었다.
6. **브라우저 패널이 숨겨지면 `requestAnimationFrame`이 멈춘다** → `useFrame`이 안
   돌고, 스크린샷에는 Suspense 폴백만 찍히고 카메라는 영원히 제자리다. **코드 버그가
   아니다.** 그래서 카메라 로직은 `stepCameraFromInput`이라는 순수 함수로 뽑아
   테스트로 검증한다. 스크린샷만으로 `useFrame` 동작을 판단하지 마라.
7. **Metro는 실패한 모듈 해석을 캐시한다.** `assets/models/generated/`를 지우고 다시
   만들면 `.expo/web/cache`와 `node_modules/.cache`를 지우고 서버를 재시작해야 한다.
   `.claude/launch.json`의 dev 명령에 `--clear`가 붙어 있는 이유다.
8. **`StyleSheet.absoluteFillObject`는 RN 0.86 타입에서 사라졌다.** `position:'absolute'`
   + `top/left/right/bottom: 0`을 직접 쓴다. `props.pointerEvents`도 deprecated —
   `style.pointerEvents`로.
9. **drei와 fiber 둘 다 package.json에 `react-native` 필드를 선언**하므로 Metro가
   네이티브 빌드를 알아서 고른다. `@react-three/fiber/native`를 명시적으로 import하는
   곳은 `GameCanvas.tsx` 하나뿐이다(props가 다르다).
10. **컨테이너에서 `setPointerCapture`를 무조건 부르지 마라.** 입력 컨트롤러의 리스너는
    캔버스와 HUD를 함께 담은 컨테이너에 붙어 있다. HUD 버튼을 누른 pointerdown에서
    캡처를 잡으면 이후 pointerup과 호환 click까지 컨테이너로 리타깃되어 **게임 안의
    모든 버튼이 죽는다.** 캔버스에서 시작한 드래그와 휠클릭 팬일 때만 잡는다
    (`camera-input.test.ts`가 회귀를 잡는다).
11. **주인 없는 진영은 `owner: -1`이고, 엔진이 이미 그걸 견딘다** — `engine.ts`의
    `state.players[plot.owner]`가 `?.`와 `if (owner)`로 막혀 있다. 진짜로 지켜야 하는
    건 `rounds.ts`의 `if (plot.owner < 0) continue` **한 줄**이다. 이게 빠지면 빈
    진영에 몹이 쏟아지고 아무도 못 죽인다(`plots.test.ts`가 잡는다).
12. **heredoc 안에 백틱이 든 템플릿 리터럴을 넣지 마라** — 노드 스크립트를 생성하다
    문자열이 조기 종료됐다. 배열 `.join("\n")`으로 우회했다.

---

## 8. 현재 상태

| | |
|---|---|
| 테스트 | 15파일 163개 통과 |
| 타입 | `tsc --noEmit` 클린 |
| 웹 export | `/game` 20KB, SSR 가드 정상 |
| 밸런스 실측 (시드 6개) | 이지 60~66라운드 / 하드 41~60 / 헬 38~53 |

커밋 메시지는 **한국어**로 쓴다(기존 히스토리 전체를 한국어로 재작성해둠).

### 아직 안 된 것

- 네이티브는 제스처 입력과 캔버스까지 준비돼 있지만 **실기기 검증을 한 번도 안 했다.**
- `hud/Minimap.tsx`(네이티브)는 자리만 잡힌 스텁. 웹은 Canvas 2D로 그린다.
- 4인은 **진영 넷이 실제로 만들어져 있고**(`PLOT_COUNT = 4`), 주인 없는 셋은
  `owner: -1`이다. `createEngine({ playerCount })`만 올리면 자리가 채워진다.
  실제 멀티 연결은 없다 — 단일 플레이어 안정성이 우선이라는 결정.
- 좁은 창에서 HUD 패널이 서로 가린다.
- 인주력은 조합 대상이 아니라 S랭크 임무 보상으로만 나온다(원작과 동일).

### 밸런스 스모크 테스트

`engine/playthrough.test.ts`는 매 라운드 자원을 다 쓰는 플레이어를 시뮬레이션해서
어디까지 가는지 본다. 규칙 단위 테스트로는 절대 잡히지 않는 "숫자가 게임이 되는가"를
확인하는 자리다. 밸런스를 건드렸으면 이 테스트의 도달 라운드를 보고 판단하면 된다.
