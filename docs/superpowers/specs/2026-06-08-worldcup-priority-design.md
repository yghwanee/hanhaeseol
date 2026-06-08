# 월드컵 우선 모드 (World Cup Priority Mode)

작성일: 2026-06-08
대상: 2026 북중미 월드컵 (개막 2026-06-12)

## 배경 / 목적

2026-06-12 월드컵 개막 이후, 한해설의 모든 "메인 경기" 선정에서 **월드컵 경기를
무조건 최우선**으로 뽑아야 한다. 영향 범위:

- 메인 페이지 "이번 주 빅매치" 섹션 (`WeekHighlights` → `pickWeekHeroMatches`)
- 인스타 캐러셀 / 릴스 / 스토리
- 유튜브 쇼츠
- 틱톡

이들은 전부 `src/lib/hero-pick.ts`의 `pickHeroMatch()` / `pickHeroMatchesTop()`을
통해 메인 경기를 고른다. 따라서 **이 한 지점**만 고치면 전 채널에 일괄 반영된다.

확인 결과: 코드베이스 내 어떤 호출부도 `heroScore`를 직접 정렬에 쓰지 않고,
모두 `pickHeroMatch` / `pickHeroMatchesTop`만 호출한다. (소비자: `hook-card.ts`,
`instagram.ts`, `hashtags.ts`, `reel-bigmatch-card.ts`, `reel-title-card.ts`,
`social-comment.ts`, `highlight-summary.ts`)

## 데이터 사실

`public/worldcup.json` (104경기). `loadScheduleData()`가 로드 시 메인 스케줄에 병합.

- `league`: `"북중미 월드컵"`(조별) / `"북중미 월드컵 32강"` / `16강` / `8강` /
  `4강` / `3·4위전` / `결승`
- `sport`: `"축구"`, `koreanCommentary`: `true` (항상)
- `homeTeam`/`awayTeam`: 국가명 (대한민국 포함). 미정 경기는 `"미정"`
- 첫 경기일: 2026-06-12

`koreanCommentary=true`이므로, 호출부의 "한국어 매치 우선" 1차 후보에 자연히 포함된다.

## 선정 규칙

### 1. 월드컵 절대 우선

후보 목록에 월드컵 경기가 하나라도 있으면, **모든 비월드컵 경기보다 위**.
(예: "멕시코 vs 남아공" 조별경기가 손흥민 클럽경기·엘클라시코보다 위)

`isWorldCup(m)` = `m.league`가 `"북중미 월드컵"`으로 시작.

별도 날짜 게이팅 불필요: 월드컵 경기는 6/12부터만 데이터에 존재하고, 대회 종료 후
사라지면 규칙은 자동으로 비활성화된다.

### 2. 월드컵끼리 순위 (정렬 키, 위에서부터 우선)

1. **라운드 티어** (높을수록 위)
   | 라운드 | league 문자열 | 티어 |
   |---|---|---|
   | 결승 | `북중미 월드컵 결승` | 7 |
   | 4강 | `북중미 월드컵 4강` | 6 |
   | 3·4위전 | `북중미 월드컵 3·4위전` | 5 |
   | 8강 | `북중미 월드컵 8강` | 4 |
   | 16강 | `북중미 월드컵 16강` | 3 |
   | 32강 | `북중미 월드컵 32강` | 2 |
   | 조별리그 | `북중미 월드컵` | 1 |

2. **매치업 티어** (같은 라운드 내)
   - 🇰🇷 **대한민국 포함 → 최상위** (3)
   - 양팀 다 강호 → 2 / 한 팀 강호 → 1 / 둘 다 일반 → 0
   - 강호 풀: 브라질, 아르헨티나, 프랑스, 잉글랜드, 스페인, 독일, 포르투갈,
     네덜란드, 벨기에, 크로아티아, 우루과이, 일본, 멕시코, 남아프리카공화국, 체코

3. **시간** 빠른 순 (최종 동점 처리)

### 3. 비월드컵 경기

기존 `heroScore`(한국선수 / 리그등급 / 시간대 / 빅매치업) 로직 **그대로**.
월드컵이 없는 날(대회 종료 후 포함)은 현행과 100% 동일하게 동작.

## 구현

`src/lib/hero-pick.ts`:

- 상단 상수로 분리(시즌 중 편집 용이):
  - `WC_ROUND_TIER: Record<string, number>` (조별은 기본값 1)
  - `WC_POWERHOUSES: Set<string>` (강호 풀)
- 헬퍼:
  - `isWorldCup(m): boolean`
  - `wcRoundTier(m): number`
  - `wcMatchupTier(m): number` (대한민국 우선 → 강호 매치업)
- **전용 비교자** `compareHero(a, b): number` (음수면 a가 우선):
  1. 월드컵 vs 비월드컵 → 월드컵 우선
  2. 둘 다 월드컵 → 라운드 티어 desc → 매치업 티어 desc → 시간 asc
  3. 둘 다 비월드컵 → `heroScore` desc → 시간 asc
- `pickHeroMatch`, `pickHeroMatchesTop`의 정렬을 `compareHero`로 교체.
  `heroScore` 자체는 변경하지 않음(비월드컵 점수/로그 의미 보존).

`pickHeroMatchesTop`의 종목 다양성 2-pass 로직은 유지. 1-pass에서 축구 슬롯을
월드컵이 차지 → 월드컵이 항상 리드.

## 테스트 (검증)

`compareHero` 단위 검증으로 다음을 확인:

1. 월드컵 조별경기 > 비월드컵 Tier S(예: 챔스 빅매치)
2. 같은 날 16강 > 조별리그(라운드 우선)
3. 같은 라운드에서 대한민국 경기 > 강호 vs 강호
4. 같은 라운드·매치업 티어 → 이른 시간 우선
5. 월드컵 없는 날: 기존 `heroScore` 순위 그대로 (회귀 없음)

빌드 확인 필수: `npx tsc --noEmit` + `npm run build` (Vercel 배포 실패 방지).

## 범위 밖 (YAGNI)

- UI 카드 디자인 변경 없음 (국기 엠블럼은 이미 `proxyLogo`로 렌더됨)
- 가중치 수치 튜닝 UI 없음 (상수 직접 편집)
- 월드컵 종료일 하드코딩 없음 (데이터 부재로 자동 비활성화)
