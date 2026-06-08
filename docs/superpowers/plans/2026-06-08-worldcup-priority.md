# 월드컵 우선 모드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 후보에 월드컵 경기가 있으면 모든 콘텐츠(이번 주 빅매치·인스타·유튜브·틱톡)의 메인 경기로 월드컵을 무조건 1순위로 뽑는다.

**Architecture:** `src/lib/hero-pick.ts` 한 곳에 전용 비교자 `compareHero`를 추가하고 `pickHeroMatch`/`pickHeroMatchesTop`의 정렬을 이걸로 교체한다. 모든 소비자가 이 두 함수만 호출하므로 단일 지점 변경으로 전 채널에 반영된다. `heroScore`(비월드컵 점수)는 손대지 않는다.

**Tech Stack:** TypeScript, Node.js built-in test runner (`node:test`) via `tsx`.

설계 문서: `docs/superpowers/specs/2026-06-08-worldcup-priority-design.md`

---

### Task 1: 월드컵 우선 정렬 (compareHero) — TDD

**Files:**
- Test: `src/lib/hero-pick.test.ts` (Create)
- Modify: `C:\Users\N333\Desktop\hwanee\한해설\src\lib\hero-pick.ts`
  - 추가: WC 상수/헬퍼 + `compareHero` (heroScore 함수 바로 뒤, line 217 이후)
  - 교체: `pickHeroMatch` 정렬 (line 223-232), `pickHeroMatchesTop` 정렬 (line 245-250)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/hero-pick.test.ts` 생성:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickHeroMatch } from "./hero-pick";
import type { Schedule } from "@/types/schedule";

function wc(
  home: string,
  away: string,
  league = "북중미 월드컵",
  time = "21:00",
): Schedule {
  return {
    id: `wc-${home}-${away}`,
    date: "2026-06-12",
    time,
    sport: "축구",
    league,
    homeTeam: home,
    awayTeam: away,
    platform: "JTBC",
    koreanCommentary: true,
  };
}

function club(
  home: string,
  away: string,
  league: string,
  time = "21:00",
): Schedule {
  return {
    id: `club-${home}-${away}`,
    date: "2026-06-12",
    time,
    sport: "축구",
    league,
    homeTeam: home,
    awayTeam: away,
    platform: "SPOTV NOW",
    koreanCommentary: true,
  };
}

test("월드컵 조별경기가 비월드컵 Tier S 빅매치보다 우선", () => {
  const wcGroup = wc("멕시코", "남아프리카 공화국");
  const ucl = club("레알 마드리드", "맨시티", "챔피언스리그");
  assert.equal(pickHeroMatch([ucl, wcGroup]), wcGroup);
});

test("같은 날 16강이 조별리그보다 우선 (라운드 우선)", () => {
  const r16 = wc("우루과이", "스코틀랜드", "북중미 월드컵 16강");
  const group = wc("브라질", "아르헨티나", "북중미 월드컵");
  assert.equal(pickHeroMatch([group, r16]), r16);
});

test("같은 라운드에서 대한민국 경기가 강호 vs 강호보다 우선", () => {
  const korea = wc("대한민국", "체코");
  const bigBig = wc("브라질", "프랑스");
  assert.equal(pickHeroMatch([bigBig, korea]), korea);
});

test("같은 라운드: 양팀 강호 > 한 팀 강호", () => {
  const bigBig = wc("브라질", "프랑스");
  const bigMid = wc("스페인", "파나마");
  assert.equal(pickHeroMatch([bigMid, bigBig]), bigBig);
});

test("같은 라운드·매치업 티어 → 이른 시간 우선", () => {
  const early = wc("브라질", "프랑스", "북중미 월드컵", "18:00");
  const late = wc("스페인", "독일", "북중미 월드컵", "22:00");
  assert.equal(pickHeroMatch([late, early]), early);
});

test("월드컵 없는 날: 기존 heroScore 순위 유지 (회귀 없음)", () => {
  const ucl = club("레알 마드리드", "맨시티", "챔피언스리그", "21:00");
  const kbo: Schedule = {
    id: "kbo-1",
    date: "2026-06-12",
    time: "18:30",
    sport: "야구",
    league: "KBO",
    homeTeam: "키움",
    awayTeam: "NC",
    platform: "SPOTV NOW",
    koreanCommentary: true,
  };
  assert.equal(pickHeroMatch([kbo, ucl]), ucl);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx --test src/lib/hero-pick.test.ts`
Expected: FAIL — 월드컵 우선 테스트들이 실패 (현재는 heroScore로만 정렬되어 챔스가 월드컵 조별경기보다 위로 뽑힘)

- [ ] **Step 3: WC 상수/헬퍼 + compareHero 구현**

`src/lib/hero-pick.ts`에서 `heroScore` 함수(line 210-217) **바로 뒤**에 아래 블록을 추가:

```ts
// ====================================================================
// 월드컵 우선 모드 (2026 북중미 월드컵, 개막 2026-06-12)
// 후보에 월드컵 경기가 있으면 무조건 최우선.
// 월드컵끼리: 라운드 티어 → 매치업 티어(대한민국 최우선 → 강호) → 시간.
// 데이터(public/worldcup.json) 부재 시 자동 비활성(대회 종료 후 현행 동작).
// ====================================================================

const WC_LEAGUE_PREFIX = "북중미 월드컵";

// 라운드 티어 (높을수록 우선). 조별리그 league는 정확히 "북중미 월드컵"이라
// 맵에 없으면 기본 1로 처리.
const WC_ROUND_TIER: Record<string, number> = {
  "북중미 월드컵 결승": 7,
  "북중미 월드컵 4강": 6,
  "북중미 월드컵 3·4위전": 5,
  "북중미 월드컵 8강": 4,
  "북중미 월드컵 16강": 3,
  "북중미 월드컵 32강": 2,
  "북중미 월드컵": 1,
};

// 강호 풀 (시즌 중 편집 가능). 대한민국은 별도 최우선 처리.
// schedule.json/worldcup.json 국가명 표기 그대로.
const WC_POWERHOUSES = new Set<string>([
  "브라질", "아르헨티나", "프랑스", "잉글랜드", "스페인", "독일",
  "포르투갈", "네덜란드", "벨기에", "크로아티아", "우루과이",
  "일본", "멕시코", "남아프리카 공화국", "체코",
]);

const WC_KOREA = "대한민국";

export function isWorldCup(m: Schedule): boolean {
  return m.league.startsWith(WC_LEAGUE_PREFIX);
}

function wcRoundTier(m: Schedule): number {
  return WC_ROUND_TIER[m.league] ?? 1;
}

function wcMatchupTier(m: Schedule): number {
  if (m.homeTeam === WC_KOREA || m.awayTeam === WC_KOREA) return 3;
  const homeBig = WC_POWERHOUSES.has(m.homeTeam);
  const awayBig = m.awayTeam ? WC_POWERHOUSES.has(m.awayTeam) : false;
  if (homeBig && awayBig) return 2;
  if (homeBig || awayBig) return 1;
  return 0;
}

/**
 * Hero 정렬 비교자. 음수면 a가 우선.
 * 1) 월드컵 vs 비월드컵 → 월드컵 우선
 * 2) 둘 다 월드컵 → 라운드 티어 desc → 매치업 티어 desc → 시간 asc
 * 3) 둘 다 비월드컵 → heroScore desc → 시간 asc
 */
export function compareHero(a: Schedule, b: Schedule): number {
  const wa = isWorldCup(a);
  const wb = isWorldCup(b);
  if (wa !== wb) return wa ? -1 : 1;

  if (wa && wb) {
    const ra = wcRoundTier(a);
    const rb = wcRoundTier(b);
    if (ra !== rb) return rb - ra;
    const ma = wcMatchupTier(a);
    const mb = wcMatchupTier(b);
    if (ma !== mb) return mb - ma;
    return a.time.localeCompare(b.time);
  }

  const sa = heroScore(a);
  const sb = heroScore(b);
  if (sa !== sb) return sb - sa;
  return a.time.localeCompare(b.time);
}
```

- [ ] **Step 4: pickHeroMatch 정렬을 compareHero로 교체**

`src/lib/hero-pick.ts` line 223-232 기존:

```ts
export function pickHeroMatch(matches: Schedule[]): Schedule | null {
  if (matches.length === 0) return null;
  const sorted = [...matches].sort((a, b) => {
    const sa = heroScore(a);
    const sb = heroScore(b);
    if (sa !== sb) return sb - sa;
    return a.time.localeCompare(b.time);
  });
  return sorted[0];
}
```

를 아래로 교체:

```ts
export function pickHeroMatch(matches: Schedule[]): Schedule | null {
  if (matches.length === 0) return null;
  return [...matches].sort(compareHero)[0];
}
```

- [ ] **Step 5: pickHeroMatchesTop 정렬을 compareHero로 교체**

`src/lib/hero-pick.ts`의 `pickHeroMatchesTop` 내부 정렬(line 245-250) 기존:

```ts
  const sorted = [...matches].sort((a, b) => {
    const sa = heroScore(a);
    const sb = heroScore(b);
    if (sa !== sb) return sb - sa;
    return a.time.localeCompare(b.time);
  });
```

를 아래로 교체 (종목 다양성 2-pass 로직은 그대로 유지):

```ts
  const sorted = [...matches].sort(compareHero);
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx tsx --test src/lib/hero-pick.test.ts`
Expected: PASS — 6개 테스트 모두 통과

- [ ] **Step 7: 커밋**

```bash
git add src/lib/hero-pick.ts src/lib/hero-pick.test.ts
git commit -m "feat(worldcup): 월드컵 경기 메인 픽 최우선 — 라운드/한국·강호 티어 정렬"
```

---

### Task 2: 타입체크 + 빌드 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없이 종료 (exit 0)

- [ ] **Step 2: 프로덕션 빌드**

Run: `npm run build`
Expected: 빌드 성공 (Vercel 배포 실패 방지 — 코드 변경 시 필수)

- [ ] **Step 3: (실데이터 sanity) 오늘~7일 이번 주 빅매치 픽 확인**

월드컵 데이터가 병합된 상태에서 6/12 이후 날짜의 hero가 월드컵으로 뽑히는지 즉석 확인:

```bash
npx tsx -e "const {loadScheduleData}=require('./src/lib/server-data'); const {pickWeekHeroMatches}=require('./src/lib/highlight-summary'); const d=loadScheduleData(); for(const h of pickWeekHeroMatches(d.schedules)) console.log(h.date, h.time, h.league, h.homeTeam, 'vs', h.awayTeam);"
```

Expected: 6/12~ 날짜 행의 `league`가 `북중미 월드컵*`로 표시됨. (월드컵 없는 날은 기존대로 다른 리그가 나올 수 있음)

---

## Self-Review

- **Spec coverage:**
  - 월드컵 절대 우선 → Task1 Step3 `compareHero` 규칙 1 + 테스트1 ✓
  - 라운드 티어 → `WC_ROUND_TIER` + 테스트2 ✓
  - 매치업 티어(대한민국 최우선 → 강호) → `wcMatchupTier` + 테스트3·4 ✓
  - 시간 동점 → 테스트5 ✓
  - 비월드컵 회귀 없음 → `heroScore` 미변경 + 테스트6 ✓
  - 단일 지점(pickHeroMatch/pickHeroMatchesTop) → Task1 Step4·5 ✓
  - 빌드 확인 필수 → Task2 ✓
- **Placeholder scan:** 없음. 모든 코드/명령 실제 내용 포함.
- **Type consistency:** `compareHero(a,b): number`, `isWorldCup(m): boolean`, `wcRoundTier`/`wcMatchupTier` 시그니처 Task 전반 일치. 팀명 `"남아프리카 공화국"`(공백 포함) worldcup.json 표기와 일치.
