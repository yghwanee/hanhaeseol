# 커버 후킹 + 히어로 선정 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 소셜 커버의 주인공을 매일 다르게 뽑고(히어로 가중치 개편), 커버에 슬롯별 후킹 문구를 얹는다.

**Architecture:** 두 층으로 나뉜다. L1은 `hero-pick.ts` 의 점수 함수를 고쳐 리그명이 아니라 팀명으로 빅클럽을 잡고, 한국선수 가중치를 낮추고, 내한경기에 가점을 주고, 직전 2일 히어로에 감점을 준다. L2는 새 파일 `cover-hook.ts` 가 슬롯별 문구 풀(각 8개)을 갖고 `reel-title-card.ts` 가 그 문구를 슬롯별 레이아웃·액센트로 그린다. 아침 커버는 좌패널(V7)에서 풀이미지로 옮긴다.

**Tech Stack:** TypeScript · `@napi-rs/canvas` · `node:test` (tsx) · GitHub Actions

## Global Constraints

- 설계 근거는 `docs/superpowers/specs/2026-08-05-cover-hook-design.md`. 값이 어긋나면 스펙이 정본이다.
- 테스트는 `node:test` + `assert/strict`, 실행은 `tsx --test`. 기존 `src/lib/hero-pick.test.ts` 형식을 따른다.
- 새 테스트는 `package.json` 스크립트와 `.github/workflows/test.yml` 에 **둘 다** 등록한다. 하나만 하면 CI 에서 안 돈다.
- 액센트 색: 아침 `#ffb02e` · 저녁 `#8fff3d`. 날짜·요일은 흰색 계열로 고정한다(강조는 후킹에만).
- 팀명 비교는 전부 `norm()`(공백 제거) 을 거친다. 데이터에 `AT. 마드리드`(공백 있음)가 실재한다.
- 줄바꿈은 **어절 단위**. 강조 조각 기준으로 자르면 `맨시티가` 가 `맨시티 / 가` 로 조사가 떨어져 나간다.
- 시각 문자열은 `speakTime()` 결과(`새벽 3시 20분`)를 쓴다. 문구 템플릿에 시간대 낱말을 하드코딩하지 않는다.
- `renderHookV7` 을 삭제하지 않는다. 아침 릴스 v1 이 세이프존 변형(`pad=85`)을 쓰고 있어 한 번에 걷어내면 영상이 깨진다.
- `src/data/schedule-archive.json` 은 `{ lastUpdated, schedules }` 형태다(배열 아님).
- 커밋 메시지는 한 줄 한국어 + Conventional Commits 접두어.

---

### Task 1: 히어로 점수 — 글로벌 빅클럽 · 이벤트 등급 · 내한 가점 · 코리안 하향

**Files:**
- Modify: `src/lib/hero-pick.ts`
- Test: `src/lib/hero-pick.test.ts`

**Interfaces:**
- Consumes: 없음(첫 태스크)
- Produces: `heroScore(m: Schedule, recentTeams?: ReadonlySet<string>): number` · `compareHero(a: Schedule, b: Schedule, recentTeams?: ReadonlySet<string>): number` · `pickHeroMatch(matches: Schedule[], recentTeams?: ReadonlySet<string>): Schedule | null` · `HERO_WEIGHTS` 에 `globalBigBoth`/`globalBigOne`/`homeEvent`/`repeatPenalty` 추가

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/hero-pick.test.ts` 맨 아래에 덧붙인다. 파일 위쪽 `club()` 헬퍼가 이미 있으니 재사용한다.

```ts
import { heroScore, pickHeroMatch } from "./hero-pick";

test("내한경기 맨시티가 코리안리거 MLB 를 이긴다", () => {
  const manCity = club("팀 K리그", "맨시티", "쿠팡플레이 시리즈", "19:00");
  const leeJungHoo = club("텍사스 레인저스", "샌프란시스코 자이언츠", "MLB", "09:05");
  const hero = pickHeroMatch([leeJungHoo, manCity]);
  assert.equal(hero?.awayTeam, "맨시티");
});

test("친선경기여도 글로벌 빅클럽이면 팀 점수를 받는다", () => {
  const friendly = club("첼시", "유벤투스", "클럽 친선경기", "20:30");
  const plain = club("팔레르모", "조호르", "클럽 친선경기", "20:30");
  assert.ok(heroScore(friendly) > heroScore(plain) + 15);
});

test("AT. 마드리드 표기(공백 있음)도 빅클럽으로 잡힌다", () => {
  const spaced = club("맨시티", "AT. 마드리드", "쿠팡플레이 시리즈", "18:30");
  const oneBig = club("맨시티", "팀 K리그", "쿠팡플레이 시리즈", "18:30");
  assert.ok(heroScore(spaced) > heroScore(oneBig));
});

test("코리안리거 가중치는 18 이다", () => {
  const withKorean = club("LA 다저스", "캔자스시티 로열스", "MLB", "11:10");
  const withoutKorean = club("캔자스시티 로열스", "미네소타 트윈스", "MLB", "11:10");
  assert.equal(heroScore(withKorean) - heroScore(withoutKorean), 18);
});

test("내한 가점은 글로벌 빅클럽이 낀 쿠팡플레이 시리즈에만 붙는다", () => {
  const withBig = club("팀 K리그", "맨시티", "쿠팡플레이 시리즈", "19:00");
  const withoutBig = club("팀 K리그", "조호르", "쿠팡플레이 시리즈", "19:00");
  // 내한 10 + 한쪽 빅클럽 12 = 22 차이
  assert.equal(heroScore(withBig) - heroScore(withoutBig), 22);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test src/lib/hero-pick.test.ts`
Expected: FAIL. 맨시티 테스트는 `hero?.awayTeam` 이 `undefined`(이정후 경기가 뽑힘), 코리안 18 테스트는 `30 !== 18`.

- [ ] **Step 3: `hero-pick.ts` 를 고친다**

`KOREAN_PLAYER_TEAMS` 선언 아래에 상수를 넣는다.

```ts
/** 표기 흔들림 흡수 — 데이터는 `AT. 마드리드`(공백 있음), 상수는 `AT.마드리드` 로 갈린다. */
function norm(s: string): string {
  return s.replace(/\s+/g, "");
}

/**
 * 리그 무관 글로벌 빅클럽 (유럽 축구).
 *
 * BIG_TEAMS 는 리그별 맵이라 리그명이 `클럽 친선경기`·`쿠팡플레이 시리즈` 면
 * 맨시티도 첼시도 조회 자체가 안 돼 0점을 받았다(2026-08-05 실측: 맨시티 20점 =
 * 롯데 vs 키움과 동점). 리그가 아니라 팀이 값어치인 경기가 실재한다.
 *
 * MLB·KBO·NBA 팀은 넣지 않는다. 이미 리그 스코프 BIG_TEAMS 로 점수를 받고 있고,
 * 여기 또 넣으면 코리안리거 MLB 가 다시 부풀어 이번 개편 목적이 뒤집힌다.
 */
const GLOBAL_BIG_CLUBS = new Set(
  [
    "맨시티", "맨유", "리버풀", "아스날", "첼시", "토트넘",
    "레알 마드리드", "바르셀로나", "아틀레티코 마드리드", "AT.마드리드",
    "바이에른 뮌헨", "도르트문트",
    "유벤투스", "인터 밀란", "AC 밀란", "나폴리",
    "PSG", "파리 생제르망",
  ].map(norm),
);

/** 등급표에 없어 최하 5점을 받던 이벤트성 대회 */
const EVENT_LEAGUE_TIER: Record<string, number> = {
  "쿠팡플레이 시리즈": 15,
  "클럽 친선경기": 10,
  "카라바오컵": 10,
};

/** 국내 개최 — 상대가 누구냐보다 "그 팀이 한국에 온다"가 화제성이다 */
const HOME_EVENT_LEAGUES = new Set(["쿠팡플레이 시리즈"]);
```

`HERO_WEIGHTS` 를 이렇게 바꾼다(기존 키는 그대로 두고 `koreanPlayer` 값만 내리고 네 개를 더한다).

```ts
export const HERO_WEIGHTS = {
  // 30 → 18. 30 일 때는 글로벌 빅클럽·이벤트 등급을 넣어도 7일 시뮬레이션 결과가
  // 현행과 완전히 동일했다. 이 값이 실제로 작동한 유일한 레버다.
  koreanPlayer: 18,

  leagueS: 20,
  leagueA: 15,
  leagueB: 10,
  leagueC: 5,

  primeEvening: 15,
  primeAfternoon: 10,
  primeMorning: 5,
  primeDawn: 0,

  rivalry: 10,
  bigVsBig: 10,
  bigVsMid: 5,

  globalBigBoth: 20,
  globalBigOne: 12,
  homeEvent: 10,
  repeatPenalty: 12,
};
```

`scoreLeagueTier` 의 마지막 폴백 앞에 이벤트 등급 조회를 넣는다.

```ts
function scoreLeagueTier(m: Schedule): number {
  if (LEAGUE_TIER_S.has(m.league)) return HERO_WEIGHTS.leagueS;
  if (LEAGUE_TIER_A.has(m.league)) return HERO_WEIGHTS.leagueA;
  if (LEAGUE_TIER_B.has(m.league)) return HERO_WEIGHTS.leagueB;
  const event = EVENT_LEAGUE_TIER[m.league];
  if (event !== undefined) return event;
  return HERO_WEIGHTS.leagueC;
}
```

`isRivalry` 와 `scoreBigMatchup` 을 `norm` 기반으로 바꾸고 글로벌 빅클럽을 얹는다.

```ts
function pairKeyNorm(a: string, b: string): string {
  return [norm(a), norm(b)].sort().join("|");
}

function isRivalry(m: Schedule): boolean {
  if (!m.awayTeam) return false;
  return RIVALRY_KEYS_NORM.has(pairKeyNorm(m.homeTeam, m.awayTeam));
}

function scoreGlobalBig(m: Schedule): number {
  const homeBig = GLOBAL_BIG_CLUBS.has(norm(m.homeTeam));
  const awayBig = m.awayTeam ? GLOBAL_BIG_CLUBS.has(norm(m.awayTeam)) : false;
  if (homeBig && awayBig) return HERO_WEIGHTS.globalBigBoth;
  if (homeBig || awayBig) return HERO_WEIGHTS.globalBigOne;
  return 0;
}

function scoreBigMatchup(m: Schedule): number {
  if (isRivalry(m)) return HERO_WEIGHTS.rivalry;

  let league = 0;
  const bigs = BIG_TEAMS[m.league];
  if (bigs) {
    const homeBig = bigs.has(m.homeTeam);
    const awayBig = m.awayTeam ? bigs.has(m.awayTeam) : false;
    league = homeBig && awayBig ? HERO_WEIGHTS.bigVsBig : homeBig || awayBig ? HERO_WEIGHTS.bigVsMid : 0;
  }
  // 리그 기반과 글로벌 기반은 같은 성격이라 큰 쪽만 취한다(중복 가산 금지).
  return Math.max(league, scoreGlobalBig(m));
}

function scoreHomeEvent(m: Schedule): number {
  if (!HOME_EVENT_LEAGUES.has(m.league)) return 0;
  return scoreGlobalBig(m) > 0 ? HERO_WEIGHTS.homeEvent : 0;
}
```

`RIVALRY_KEYS` 상수를 `RIVALRY_KEYS_NORM` 으로 바꾼다(선언부도 `pairKeyNorm` 사용).

```ts
const RIVALRY_KEYS_NORM = new Set(RIVALRIES.map((r) => pairKeyNorm(...r.teams)));
```

`getRivalryName` 이 쓰는 `RIVALRY_NAME_MAP` 도 같은 키로 맞춘다.

```ts
const RIVALRY_NAME_MAP = new Map<string, string>(
  RIVALRIES.filter((r) => r.name).map((r) => [pairKeyNorm(...r.teams), r.name!]),
);

export function getRivalryName(home: string, away: string | undefined): string | undefined {
  if (!away) return undefined;
  return RIVALRY_NAME_MAP.get(pairKeyNorm(home, away));
}
```

`heroScore` 에 `recentTeams` 인자를 더한다(Task 2 에서 쓴다. 지금은 감점 경로만 만들어 둔다).

```ts
function inRecent(m: Schedule, recentTeams: ReadonlySet<string>): boolean {
  if (recentTeams.has(norm(m.homeTeam))) return true;
  return m.awayTeam ? recentTeams.has(norm(m.awayTeam)) : false;
}

/** 종합 점수. 디버깅/로그용으로도 export. */
export function heroScore(m: Schedule, recentTeams?: ReadonlySet<string>): number {
  const base =
    scoreKoreanPlayer(m) +
    scoreLeagueTier(m) +
    scorePrimeTimeKr(m) +
    scoreBigMatchup(m) +
    scoreHomeEvent(m);
  if (recentTeams && recentTeams.size > 0 && inRecent(m, recentTeams)) {
    return base - HERO_WEIGHTS.repeatPenalty;
  }
  return base;
}
```

`compareHero` 와 `pickHeroMatch`·`pickHeroMatchesTop` 에 인자를 통과시킨다.

```ts
export function compareHero(a: Schedule, b: Schedule, recentTeams?: ReadonlySet<string>): number {
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

  const sa = heroScore(a, recentTeams);
  const sb = heroScore(b, recentTeams);
  if (sa !== sb) return sb - sa;
  return a.time.localeCompare(b.time);
}

export function pickHeroMatch(
  matches: Schedule[],
  recentTeams?: ReadonlySet<string>,
): Schedule | null {
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => compareHero(a, b, recentTeams))[0];
}

export function pickHeroMatchesTop(
  matches: Schedule[],
  max: number,
  recentTeams?: ReadonlySet<string>,
): Schedule[] {
  if (matches.length === 0 || max <= 0) return [];
  const sorted = [...matches].sort((a, b) => compareHero(a, b, recentTeams));
  // 이하 기존 로직 그대로
  const out: Schedule[] = [];
  const seenSports = new Set<Sport>();
  for (const m of sorted) {
    if (out.length >= max) break;
    if (seenSports.has(m.sport)) continue;
    out.push(m);
    seenSports.add(m.sport);
  }
  for (const m of sorted) {
    if (out.length >= max) break;
    if (out.includes(m)) continue;
    out.push(m);
  }
  return out;
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `npx tsx --test src/lib/hero-pick.test.ts`
Expected: PASS (기존 월드컵 테스트 포함 전부).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/hero-pick.ts src/lib/hero-pick.test.ts
git commit -m "feat(hero): 리그 무관 글로벌 빅클럽·이벤트 등급·내한 가점 도입, 코리안 가중치 30→18"
```

---

### Task 2: 연속 방지 — 직전 2일 히어로 감점

**Files:**
- Modify: `src/lib/instagram.ts` (`pickHeroForDate` 부근)
- Test: `src/lib/hero-pick.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `pickHeroMatch(matches, recentTeams?)` · `HERO_WEIGHTS.repeatPenalty`
- Produces: `pickHeroForDate(today: string): Schedule | null` (시그니처 불변, 내부에서 감점 적용) · `recentHeroTeams(today: string): Set<string>` (export, 테스트용)

`schedule.json` 은 오늘부터 7일치라 어제가 없다. 과거는 `schedule-archive.json`(2026-05-19~) 에서 읽는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/hero-pick.test.ts` 에 덧붙인다.

```ts
test("직전 2일에 나온 팀은 감점을 받는다", () => {
  const repeat = club("샌프란시스코 자이언츠", "휴스턴 애스트로스", "MLB", "10:45");
  const fresh = club("LA 다저스", "캔자스시티 로열스", "MLB", "11:10");
  const recent = new Set(["샌프란시스코자이언츠", "디트로이트타이거스"]);

  // 감점 없으면 샌프란시스코가 이긴다(휴스턴도 BIG_TEAMS.MLB 라 bigVsBig).
  assert.equal(pickHeroMatch([repeat, fresh])?.homeTeam, "샌프란시스코 자이언츠");
  // 감점이 붙으면 뒤집힌다.
  assert.equal(pickHeroMatch([repeat, fresh], recent)?.homeTeam, "LA 다저스");
});

test("recentTeams 가 비면 감점이 없다", () => {
  const m = club("샌프란시스코 자이언츠", "휴스턴 애스트로스", "MLB", "10:45");
  assert.equal(heroScore(m, new Set()), heroScore(m));
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test src/lib/hero-pick.test.ts`
Expected: 첫 테스트가 FAIL — 감점을 줘도 여전히 `샌프란시스코 자이언츠` 가 나온다면 Task 1 의 `inRecent` 가 `norm` 을 안 거친 것이다. (테스트의 `recent` 는 공백 없는 정규화 표기다.)

- [ ] **Step 3: `instagram.ts` 에 과거 조회를 붙인다**

파일 위쪽 import 에 아카이브를 더한다.

```ts
import scheduleArchive from "@/data/schedule-archive.json";
```

`pickHeroForDate` 를 이렇게 바꾼다.

```ts
/** YYYY-MM-DD 를 days 만큼 민다. */
function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 아카이브에서 특정 날짜의 한국어 해설 경기를 읽는다. schedule.json 은 오늘부터라 과거가 없다. */
function archivedKoreanMatches(date: string): Schedule[] {
  const all = (scheduleArchive as { schedules: Schedule[] }).schedules ?? [];
  return all.filter((s) => s.date === date && s.koreanCommentary === true);
}

/**
 * 직전 2일 히어로에 등장한 팀. 같은 팀이 사흘 내리 주인공이 되는 것을 막는다.
 * 여기서 뽑을 때는 감점을 걸지 않는다 — 또 과거를 보면 재귀가 끝나지 않는다.
 */
export function recentHeroTeams(today: string): Set<string> {
  const teams = new Set<string>();
  for (let back = 1; back <= 2; back++) {
    const date = shiftYmd(today, -back);
    const hero = pickHeroMatch(archivedKoreanMatches(date));
    if (!hero) continue;
    teams.add(hero.homeTeam.replace(/\s+/g, ""));
    if (hero.awayTeam) teams.add(hero.awayTeam.replace(/\s+/g, ""));
  }
  return teams;
}

/** 그날 히어로 매치: 한국어해설 경기 우선, 없으면 그날 전체 경기에서 폴백. (카드 렌더러 공용) */
export function pickHeroForDate(today: string): Schedule | null {
  const recent = recentHeroTeams(today);
  return (
    pickHeroMatch(loadKoreanMatchesAll(today), recent) ??
    pickHeroMatch(loadAllMatchesForDate(today), recent)
  );
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `npx tsx --test src/lib/hero-pick.test.ts`
Expected: PASS.

- [ ] **Step 5: 7일 히어로를 실제로 찍어 눈으로 확인한다**

`generated/_preview/hero-check.ts` 를 만들어 돌린다(`/generated/` 는 gitignore 안이다).

```ts
import { getKstToday, pickHeroForDate } from "@/lib/instagram";

for (let i = 0; i < 7; i++) {
  const { today } = getKstToday(i);
  const h = pickHeroForDate(today);
  console.log(today, h ? `${h.league} ${h.time} ${h.homeTeam} vs ${h.awayTeam ?? "-"}` : "(없음)");
}
```

Run: `npx tsx generated/_preview/hero-check.ts`
Expected: 8/05 에 `쿠팡플레이 시리즈 19:00 팀 K리그 vs 맨시티`, 8/09 에 `맨시티 vs AT. 마드리드`. 같은 매치업이 사흘 연속 나오지 않는다.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/instagram.ts src/lib/hero-pick.test.ts
git commit -m "feat(hero): 직전 2일 히어로 팀 감점으로 같은 얼굴 반복 차단"
```

---

### Task 3: 커버 후킹 문구 풀

**Files:**
- Create: `src/lib/cover-hook.ts`
- Create: `src/lib/cover-hook.test.ts`
- Modify: `package.json` (스크립트 `test:cover-hook`)
- Modify: `.github/workflows/test.yml`

**Interfaces:**
- Consumes: Task 2 의 `pickHeroForDate(today)` · 기존 `getPostSlot`/`rotateIndex` (`src/lib/post-slot.ts`) · 기존 `speakTime` (`src/lib/tiktok-caption.ts`) · 기존 `KOREAN_PLAYERS`/`loadKoreanMatchesAll` (`src/lib/instagram.ts`)
- Produces:
  - `interface CoverHookCtx { who: string; isPlayer: boolean; time: string; daypart: "새벽" | "아침" | "낮" | "저녁"; games: number; platform: string; isWeekday: boolean }`
  - `interface CoverHook { small: string; big: string; accent: string }` — `small` 은 작은 줄, `big` 은 큰 줄, `accent` 는 `big` 또는 `small` 안에서 액센트 색으로 칠할 조각
  - `buildCoverHook(today: string, slot?: PostSlot): CoverHook`
  - `MORNING_COVER_HOOKS` · `EVENING_COVER_HOOKS` (테스트용 export)

아침은 `small`(작은 윗줄) → `big`(큰 아랫줄) 순으로 그리고, 저녁은 `big`(큰 줄) → `small`(설명 줄) 순으로 그린다. 순서는 Task 4 의 렌더러가 슬롯을 보고 정한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/cover-hook.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCoverHook,
  MORNING_COVER_HOOKS,
  EVENING_COVER_HOOKS,
} from "./cover-hook";
import { getKstToday } from "./instagram";

test("풀은 슬롯당 8개다", () => {
  assert.equal(MORNING_COVER_HOOKS.length, 8);
  assert.equal(EVENING_COVER_HOOKS.length, 8);
});

test("같은 날짜의 아침과 저녁 문구가 절대 같지 않다", () => {
  // 작업82 재발 방지 — 저녁판과 다음날 아침판은 대상 날짜가 같다.
  for (let i = 0; i < 14; i++) {
    const { today } = getKstToday(i);
    const m = buildCoverHook(today, "morning");
    const e = buildCoverHook(today, "evening");
    assert.notEqual(`${m.small}|${m.big}`, `${e.small}|${e.big}`, `${today} 에서 충돌`);
  }
});

test("같은 날 같은 슬롯을 다시 부르면 같은 문구가 나온다", () => {
  const { today } = getKstToday(0);
  assert.deepEqual(buildCoverHook(today, "morning"), buildCoverHook(today, "morning"));
});

test("액센트 조각은 실제 문구 안에 있다", () => {
  for (let i = 0; i < 14; i++) {
    const { today } = getKstToday(i);
    for (const slot of ["morning", "evening"] as const) {
      const h = buildCoverHook(today, slot);
      const joined = `${h.small} ${h.big}`;
      assert.ok(joined.includes(h.accent), `${today}/${slot}: "${h.accent}" 없음`);
    }
  }
});

test("조사가 앞말에서 떨어지지 않는다", () => {
  // "맨시티 가 옵니다" 처럼 조사 앞에 공백이 생기면 실패.
  const JOSA_SPLIT = /\s(?:가|이|은|는|을|를|의|에|도)\s/;
  for (let i = 0; i < 14; i++) {
    const { today } = getKstToday(i);
    for (const slot of ["morning", "evening"] as const) {
      const h = buildCoverHook(today, slot);
      assert.ok(!JOSA_SPLIT.test(`${h.small} / ${h.big}`), `${today}/${slot}: ${h.big}`);
    }
  }
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test src/lib/cover-hook.test.ts`
Expected: FAIL — `Cannot find module './cover-hook'`.

- [ ] **Step 3: `src/lib/cover-hook.ts` 를 만든다**

```ts
// src/lib/cover-hook.ts
//
// 커버 카드(인스타 캐러셀 1장 = 릴스 cover = 쇼츠 첫 프레임)의 후킹 문구.
//
// 아침은 작은 윗줄 → 큰 아랫줄(대비 2줄), 저녁은 큰 줄 → 설명 줄로 그린다.
// 구조를 상하로 갈라 두면 레이아웃이 같아도 두 게시물이 같은 그림이 되지 않는다.
//
// 풀은 슬롯당 8개다. 3~4개면 같은 틀이 사나흘마다 돌아와 몰아 보면 티가 난다.

import { KOREAN_PLAYERS, loadKoreanMatchesAll, pickHeroForDate } from "./instagram";
import { getPostSlot, rotateIndex, type PostSlot } from "./post-slot";
import { speakTime } from "./tiktok-caption";

export type Daypart = "새벽" | "아침" | "낮" | "저녁";

export interface CoverHookCtx {
  /** 한국선수가 있으면 선수명, 없으면 팀명(빅클럽 쪽 우선) */
  who: string;
  isPlayer: boolean;
  /** "새벽 3시 20분" */
  time: string;
  daypart: Daypart;
  /** 그날 한국어 해설 경기 수 */
  games: number;
  platform: string;
  isWeekday: boolean;
}

export interface CoverHook {
  /** 작은 줄 */
  small: string;
  /** 큰 줄 */
  big: string;
  /** small 또는 big 안에서 액센트 색으로 칠할 조각 */
  accent: string;
}

interface HookTemplate {
  build: (c: CoverHookCtx) => CoverHook;
  /** 조건이 있으면 안 맞는 날엔 후보에서 빠진다. `자기 전에` 를 낮 경기에 붙이지 않기 위한 것. */
  when?: (c: CoverHookCtx) => boolean;
}

/** 선수면 "나옵니다", 팀이면 "옵니다" — 주어에 맞는 서술어. */
const comes = (c: CoverHookCtx) => (c.isPlayer ? "나옵니다" : "옵니다");

export const MORNING_COVER_HOOKS: HookTemplate[] = [
  {
    build: (c) => ({ small: `오늘 ${c.time} · ${c.platform}`, big: `${c.who} 오늘 ${comes(c)}`, accent: c.who }),
  },
  {
    build: (c) => ({ small: "오늘 뭐 보지 싶을 때", big: `${c.who} 보세요`, accent: c.who }),
  },
  {
    build: (c) => ({ small: "퇴근하고 볼 거 있습니다", big: `${c.who} ${c.time}`, accent: c.who }),
    when: (c) => c.daypart === "저녁",
  },
  {
    build: (c) => ({ small: "오늘 중계 어디서 보나", big: `${c.who}는 ${c.platform}`, accent: c.platform }),
  },
  {
    build: (c) => ({ small: "한국어 해설 됩니다", big: `${c.who} 오늘 ${c.time}`, accent: c.who }),
  },
  {
    build: (c) => ({ small: "이 시간 비워두세요", big: `오늘 ${c.time} ${c.who}`, accent: c.time }),
  },
  {
    build: (c) => ({ small: "아침에 봐두면 편합니다", big: `오늘은 ${c.who}`, accent: c.who }),
  },
  {
    build: (c) => ({ small: "평일에 이런 게 다 있네요", big: `${c.who} 오늘 ${c.time}`, accent: c.who }),
    when: (c) => c.isWeekday,
  },
];

export const EVENING_COVER_HOOKS: HookTemplate[] = [
  {
    build: (c) => ({ big: `내일 ${c.time}`, small: `${c.who} 출전 · 한국어 해설 ${c.games}경기`, accent: c.time }),
  },
  {
    build: (c) => ({ big: `${c.who} 내일 ${comes(c)}`, small: `${c.time} · ${c.platform}`, accent: c.who }),
  },
  {
    build: (c) => ({ big: "내일 놓치면 아까운 경기", small: `${c.who} ${c.time}`, accent: c.who }),
  },
  {
    build: (c) => ({ big: "내일 볼 거 미리 찍어두세요", small: `${c.who} ${c.time} · ${c.platform}`, accent: c.who }),
  },
  {
    build: (c) => ({ big: `내일 ${c.who} 나오는 날`, small: `${c.time} · 한국어 해설`, accent: c.who }),
  },
  {
    build: (c) => ({ big: "오늘 밤 지나면 바로", small: `${c.who} ${c.time}`, accent: c.who }),
    when: (c) => c.daypart === "새벽",
  },
  {
    build: (c) => ({ big: "내일치 편성 나왔습니다", small: `${c.who} ${c.time} · ${c.platform}`, accent: c.who }),
  },
  {
    build: (c) => ({ big: "미리 알려드립니다", small: `내일 ${c.time} ${c.who}`, accent: c.time }),
  },
];

function daypartOf(hhmm: string): Daypart {
  const h = Number.parseInt(hhmm.slice(0, 2), 10);
  if (!Number.isFinite(h)) return "저녁";
  if (h < 7) return "새벽";
  if (h < 12) return "아침";
  if (h < 18) return "낮";
  return "저녁";
}

function isWeekdayKst(today: string): boolean {
  const [y, m, d] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow >= 1 && dow <= 5;
}

/** 히어로에서 후킹 재료를 뽑는다. 경기가 없으면 null. */
export function coverHookContext(today: string): CoverHookCtx | null {
  const hero = pickHeroForDate(today);
  if (!hero) return null;

  const home = hero.homeTeam !== "미정" ? hero.homeTeam : null;
  const away = hero.awayTeam && hero.awayTeam !== "미정" ? hero.awayTeam : null;
  if (!home && !away) return null;

  const player = KOREAN_PLAYERS.find((p) => p.team === hero.homeTeam || p.team === hero.awayTeam);

  // 한국선수가 없으면 팀명을 쓴다. 매치업 전체("A vs B")는 큰 글자에 안 들어가므로
  // 한 팀만 고른다 — 이름값이 큰 쪽이 후킹이다.
  const headliner = pickHeadliner(home, away);

  return {
    who: player ? player.name : headliner,
    isPlayer: Boolean(player),
    time: speakTime(hero.time),
    daypart: daypartOf(hero.time),
    games: loadKoreanMatchesAll(today).length,
    platform: hero.platform,
    isWeekday: isWeekdayKst(today),
  };
}

/** 두 팀 중 후킹으로 쓸 한 팀. 글로벌 빅클럽이 있으면 그쪽, 없으면 원정팀(보통 방문팀이 화제). */
function pickHeadliner(home: string | null, away: string | null): string {
  const HEADLINE_CLUBS = [
    "맨시티", "맨유", "리버풀", "아스날", "첼시", "토트넘",
    "레알 마드리드", "바르셀로나", "아틀레티코 마드리드", "AT.마드리드",
    "바이에른 뮌헨", "도르트문트",
    "유벤투스", "인터 밀란", "AC 밀란", "나폴리",
    "PSG", "파리 생제르망",
  ].map((s) => s.replace(/\s+/g, ""));

  const norm = (s: string) => s.replace(/\s+/g, "");
  if (away && HEADLINE_CLUBS.includes(norm(away))) return away;
  if (home && HEADLINE_CLUBS.includes(norm(home))) return home;
  return (away ?? home)!;
}

/** 후킹 재료가 없는 날(경기 0)에 쓰는 문구. */
function fallbackHook(slot: PostSlot): CoverHook {
  return slot === "morning"
    ? { small: "오늘 편성 정리했습니다", big: "한국어 해설 확인", accent: "한국어 해설" }
    : { big: "내일치 편성 나왔습니다", small: "한국어 해설 편성표", accent: "한국어 해설" };
}

export function buildCoverHook(today: string, slot: PostSlot = getPostSlot(today)): CoverHook {
  const ctx = coverHookContext(today);
  if (!ctx) return fallbackHook(slot);

  const pool = slot === "morning" ? MORNING_COVER_HOOKS : EVENING_COVER_HOOKS;
  const eligible = pool.filter((t) => !t.when || t.when(ctx));
  const usable = eligible.length > 0 ? eligible : pool;
  const idx = rotateIndex(today, slot, usable.length);
  const picked = usable[idx].build(ctx);

  // `when` 조건 때문에 후보 수가 슬롯마다 달라진다. rotateIndex 의 2칸 밀기만으로는
  // 두 슬롯이 같은 문구를 낼 수 있어(풀 길이가 갈리면 밀기가 무의미해진다) 직접 막는다.
  // morning 은 재귀하지 않으므로 무한 루프가 없다.
  if (slot === "evening") {
    const morning = buildCoverHook(today, "morning");
    if (`${picked.small}|${picked.big}` === `${morning.small}|${morning.big}`) {
      return usable[(idx + 1) % usable.length].build(ctx);
    }
  }
  return picked;
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `npx tsx --test src/lib/cover-hook.test.ts`
Expected: PASS.

- [ ] **Step 5: 스크립트와 CI 에 등록한다**

`package.json` `scripts` 에 추가:

```json
"test:cover-hook": "tsx --test src/lib/cover-hook.test.ts",
```

`.github/workflows/test.yml` 의 테스트 나열 블록(`npm run test:autolink` 줄 다음)에 추가:

```yaml
          npm run test:cover-hook
```

- [ ] **Step 6: 커밋**

```bash
git add src/lib/cover-hook.ts src/lib/cover-hook.test.ts package.json .github/workflows/test.yml
git commit -m "feat(cover): 슬롯별 커버 후킹 문구 풀 8종 + 아침·저녁 충돌 가드"
```

---

### Task 4: 커버 렌더 — 슬롯별 레이아웃·액센트

**Files:**
- Modify: `src/lib/reel-title-card.ts`

**Interfaces:**
- Consumes: Task 3 의 `buildCoverHook(today, slot)` · `CoverHook`
- Produces: `renderReelTitleText(today, aspect?, opts?)` 시그니처 유지(내부 동작만 교체) · `renderReelTitleCard(imagePath, today, aspect?, opts?)` 시그니처 유지 · 새 export `SLOT_ACCENT: Record<PostSlot, string>`

- [ ] **Step 1: 상수와 헬퍼를 넣는다**

`reel-title-card.ts` 상단 `const ACCENT = "#8fff3d";` 를 이렇게 바꾼다.

```ts
/** 슬롯별 액센트 — 레이아웃이 같아져도 썸네일 그리드에서 한눈에 갈린다. */
export const SLOT_ACCENT: Record<PostSlot, string> = {
  morning: "#ffb02e",
  evening: "#8fff3d",
};
```

`ACCENT` 를 쓰던 자리는 전부 지역 변수 `accent` 로 바꾼다(`renderReelTitleText` 안에서 `const accent = SLOT_ACCENT[slot];`).

어절 단위 줄바꿈과 액센트 렌더 헬퍼를 파일에 더한다.

```ts
/**
 * 어절 단위로 줄을 나눈다.
 * 강조 조각 기준으로 자르면 `맨시티가` 가 `맨시티 / 가` 로 조사가 떨어져 나간다.
 * 한국어에서 조사는 앞말에 붙여 쓴다.
 */
function wrapByWord(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** 강조 조각만 액센트 색으로 칠하며 중앙 정렬로 그린다. */
function drawAccented(
  ctx: SKRSContext2D,
  text: string,
  accentPart: string,
  accentColor: string,
  cx: number,
  y: number,
): void {
  if (!accentPart || !text.includes(accentPart)) {
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, cx, y);
    return;
  }
  const [head, tail] = text.split(accentPart);
  const hw = ctx.measureText(head).width;
  const aw = ctx.measureText(accentPart).width;
  const tw = ctx.measureText(tail).width;
  let x = cx - (hw + aw + tw) / 2;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(head, x, y);
  x += hw;
  ctx.fillStyle = accentColor;
  ctx.fillText(accentPart, x, y);
  x += aw;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(tail, x, y);
  ctx.textAlign = prev;
}
```

- [ ] **Step 2: 타이틀 콘텐츠 결정부를 `buildCoverHook` 으로 교체한다**

`renderReelTitleText` 안에서 `const koreanMatches = loadKoreanMatchesAll(today);` 부터 `bigLine`/`subLine` 을 정하는 블록 전체를 지우고 다음으로 바꾼다.

```ts
  const slot = opts.slot ?? getPostSlot(today);
  const accent = SLOT_ACCENT[slot];
  const hook = buildCoverHook(today, slot);
```

`import { buildCoverHook } from "./cover-hook";` 를 추가하고, 더 이상 쓰지 않는 import 는 지운다(남기면 ESLint 가 잡는다):

- `loadKoreanMatchesAll` · `loadAllMatchesForDate` · `pickHeroMatch` · `KOREAN_PLAYERS` (전부 `./instagram`)
- `eventWord` (`./hero-pick`)
- `rotateIndex` (`./post-slot`) — 문구 순환이 `cover-hook.ts` 로 옮겨가 여기서는 안 쓴다. `getPostSlot` 과 `type PostSlot` 은 남긴다.
- `Schedule` 타입 import 도 안 쓰게 되면 지운다.

- [ ] **Step 3: 날짜를 흰색으로 바꾸고 슬롯별로 순서를 나눈다**

날짜 그리는 부분에서 `ctx.fillStyle = ACCENT;` 를 `ctx.fillStyle = "#ffffff";` 로, 요일은 `"rgba(255,255,255,0.72)"` 로 바꾼다. 그리고 큰 줄/작은 줄 배치를 슬롯으로 가른다.

```ts
  const DATE_BASELINE = Math.round(H * 0.6875);
  const BIG_Y = Math.round(H * 0.7813);
  const SUB_Y = Math.round(H * 0.8333);

  const drawBig = (text: string, y: number) => {
    const size = fitText(ctx, text, W - 120, 140, "900", 88);
    ctx.font = `900 ${size}px Pretendard`;
    const lines = wrapByWord(ctx, text, W - 120);
    let ly = y - (lines.length - 1) * (size + 12);
    for (const line of lines) {
      drawAccented(ctx, line, hook.accent, accent, centerX, ly);
      ly += size + 12;
    }
  };

  // 작은 줄도 액센트를 그린다. 저녁 풀 8번(`미리 알려드립니다` / `내일 {time} {who}`)처럼
  // 강조 조각이 작은 줄에 들어가는 템플릿이 있어서, 큰 줄만 처리하면 액센트가 안 보인다.
  const drawSmall = (text: string, y: number) => {
    const size = fitText(ctx, text, W - 160, 60, "600", 44);
    ctx.font = `600 ${size}px Pretendard`;
    if (hook.accent && text.includes(hook.accent) && !hook.big.includes(hook.accent)) {
      drawAccented(ctx, text, hook.accent, accent, centerX, y);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(text, centerX, y);
    }
  };

  if (slot === "morning") {
    // 아침 = 작은 윗줄 → 큰 아랫줄 (대비 2줄)
    drawSmall(hook.small, BIG_Y - 30);
    drawBig(hook.big, BIG_Y + 90);
  } else {
    // 저녁 = 큰 줄 → 설명 줄
    drawBig(hook.big, BIG_Y);
    drawSmall(hook.small, SUB_Y);
  }
```

- [ ] **Step 4: 두 슬롯을 실제로 렌더해 눈으로 확인한다**

`generated/_preview/render-check.ts`:

```ts
import fs from "fs";
import { registerFonts, getKstToday } from "@/lib/instagram";
import { pickHookImage } from "@/lib/hook-card";
import { renderReelTitleCard } from "@/lib/reel-title-card";

async function main() {
  registerFonts();
  fs.mkdirSync("generated/_preview/out", { recursive: true });
  const { today } = getKstToday(0);
  for (const slot of ["morning", "evening"] as const) {
    const img = pickHookImage(today, slot);
    const buf = await renderReelTitleCard(img, today, "4:5", { slot });
    fs.writeFileSync(`generated/_preview/out/${slot}.png`, buf);
    console.log(`✅ ${slot}`);
  }
}
main();
```

Run: `npx tsx generated/_preview/render-check.ts`
Expected: 두 PNG 생성. 아침은 앰버 액센트 + 작은 줄이 위, 저녁은 라임 액센트 + 큰 줄이 위. 조사가 `맨시티 가` 처럼 갈리지 않는다. 날짜는 흰색.

- [ ] **Step 5: 타입 검사와 린트**

Run: `npx tsc --noEmit && npx eslint src/lib/reel-title-card.ts src/lib/cover-hook.ts`
Expected: 오류 0.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/reel-title-card.ts
git commit -m "feat(cover): 슬롯별 액센트·배치 적용, 날짜 흰색, 어절 단위 줄바꿈"
```

---

### Task 5: 아침 커버를 좌패널에서 풀이미지로 전환

**Files:**
- Modify: `src/scripts/post-instagram-all.ts:33-55`
- Modify: `src/scripts/make-reel.ts`

**Interfaces:**
- Consumes: Task 4 의 `renderReelTitleCard(imagePath, today, aspect, { slot })`
- Produces: `generated/instagram/main-MMDD.png`(4:5, 두 슬롯 공통) · `generated/instagram/main-reel-MMDD.png`(아침 릴스 v1 첫 프레임)

아침 워크플로는 `HHS_LEGACY_MORNING=1` 로 돌고, `make-reel.ts`(v1) 가 `main-reel-MMDD.png` 를 첫 프레임으로 쓴다. 이 파일 이름을 유지해야 영상이 안 깨진다.

- [ ] **Step 1: `post-instagram-all.ts` 의 메인 카드 블록을 바꾼다**

기존 `if (LEGACY_MORNING) { ... } else { ... }` 를 통째로 다음으로 교체한다.

```ts
  // 1) 메인 — 두 슬롯 모두 reel-title-card 4:5.
  //    슬롯별 액센트·배치가 갈리므로 레이아웃 통일로 인한 중복 신호는 생기지 않는다.
  //    아침(LEGACY_MORNING)은 릴스 v1 이 첫 프레임으로 쓰는 세이프존 변형을 하나 더 만든다.
  {
    const slot = getPostSlot(today);
    const hookImg = pickHookImage(today, slot);
    const filename = `main-${mm}${dd}.png`;

    const buf = await renderReelTitleCard(hookImg, today, "4:5", { slot });
    fs.writeFileSync(path.join(outDir, filename), buf);
    items.push({ buf, filename, caption: `${mm}/${dd} 한해설 한국어 중계 편성표` });

    if (LEGACY_MORNING) {
      // 릴스 v1 은 9:16 을 첫 프레임으로 쓴다.
      const reelBuf = await renderReelTitleCard(hookImg, today, "9:16", { slot });
      fs.writeFileSync(path.join(outDir, `main-reel-${mm}${dd}.png`), reelBuf);
      console.log("✅ 메인 (reel-title 4:5 + 9:16) — 캐러셀 + 릴스 v1 첫 프레임");
    } else {
      console.log("✅ 메인 (reel-title 4:5) — 캐러셀 + 릴스 cover 공용");
    }
  }
```

import 를 정리한다. `renderHookV7` 은 더 이상 이 파일에서 안 쓰므로 지우고 `getPostSlot` 을 더한다.

```ts
import { pickHookImage } from "@/lib/hook-card";
import { renderReelTitleCard } from "@/lib/reel-title-card";
import { getPostSlot } from "@/lib/post-slot";
```

- [ ] **Step 2: `pickHookImage` 호출에 슬롯을 넘기는지 확인한다**

`src/scripts/make-reel-v2.ts:42` 의 `pickHookImage(today)` 는 기본값이 `getPostSlot(today)` 라 그대로 둬도 된다. 바꾸지 않는다.

- [ ] **Step 3: 아침 경로를 실제로 돌려 파일이 나오는지 본다**

Run: `HHS_LEGACY_MORNING=1 npx tsx src/scripts/post-instagram-all.ts`

이 스크립트는 카드를 만든 뒤 텔레그램 전송까지 간다. 토큰이 없어 뒤에서 실패해도 좋다 —
확인할 것은 **카드 생성까지**다.
Expected: `generated/instagram/main-MMDD.png` 와 `main-reel-MMDD.png` 가 둘 다 생기고, 앞의 것이 4:5(1080x1350), 뒤의 것이 9:16(1080x1920).

크기 확인:
```bash
npx tsx -e "
import sharp from 'sharp';
for (const f of ['main','main-reel']) {
  const m = await sharp('generated/instagram/' + f + '-0805.png').metadata();
  console.log(f, m.width + 'x' + m.height);
}
"
```

- [ ] **Step 4: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 오류 0. `renderHookV7` 이 `hook-card.ts` 에 남아 있으나 참조가 줄었을 뿐이라 문제 없다.

- [ ] **Step 5: 커밋**

```bash
git add src/scripts/post-instagram-all.ts
git commit -m "feat(cover): 아침 커버를 좌패널(V7)에서 풀이미지 슬롯 레이아웃으로 전환"
```

---

### Task 6: 쇼츠 제목 풀 8개로 확장 + 후킹 재료 공유

**Files:**
- Modify: `src/lib/shorts-title.ts`
- Modify: `src/lib/shorts-title.test.ts`

**Interfaces:**
- Consumes: Task 2 의 `pickHeroForDate(today)` · Task 3 의 `coverHookContext(today)`
- Produces: `buildShortsTitle(mm, dd, today, slot?)` · `buildHookLine(today, slot?)` (시그니처 불변)

`shorts-title.ts` 의 `hookContext` 는 `pickHeroMatch(loadKoreanMatchesAll(today))` 를 직접 부른다. 그러면 연속 방지가 안 걸려 커버와 제목의 주인공이 갈릴 수 있다. `coverHookContext` 를 쓰도록 바꿔 재료를 하나로 모은다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/shorts-title.test.ts` 에 덧붙인다.

```ts
test("제목 풀은 슬롯당 8개다", () => {
  // 4개면 같은 틀이 나흘마다 돌아온다.
  const seen = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const { today, mm, dd } = getKstToday(i);
    seen.add(buildShortsTitle(mm, dd, today, "morning").replace(/[0-9]/g, "#"));
  }
  assert.ok(seen.size >= 6, `틀이 ${seen.size}종뿐`);
});
```

`getKstToday` 가 이미 import 돼 있지 않으면 `import { getKstToday } from "./instagram";` 를 더한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test src/lib/shorts-title.test.ts`
Expected: FAIL — `틀이 4종뿐`.

- [ ] **Step 3: 풀을 8개로 늘리고 재료를 공유한다**

`MORNING_HOOKS` 와 `EVENING_HOOKS` 에 네 개씩 더한다.

```ts
const MORNING_HOOKS: Array<(c: HookCtx) => string> = [
  (c) => `오늘 ${c.who} 경기 ${c.emoji} 한국어 중계 어디서 봐요?`,
  (c) => `${c.who} 오늘 ${c.time} ${start(c)} ${c.emoji} 한국어 중계 채널은`,
  (c) => `오늘 한국어 해설 ${c.games}경기 ${c.emoji} ${c.who}부터 확인`,
  (c) => `${c.who} 오늘 중계 ${c.emoji} 채널 하나로 정리했습니다`,
  (c) => `${c.who} 오늘 어디서 보나 ${c.emoji} 한국어 해설 채널 정리`,
  (c) => `오늘 ${c.time} ${c.who} ${c.emoji} 한국어 중계 되는 곳`,
  (c) => `오늘 볼 경기 골랐습니다 ${c.emoji} ${c.who} 한국어 중계`,
  (c) => `${c.who} 한국어 해설 ${c.emoji} 오늘 ${c.time} 시작`,
];

const EVENING_HOOKS: Array<(c: HookCtx) => string> = [
  (c) => `내일 ${c.who} ${appear(c)} ${c.emoji} ${c.time} 한국어 중계`,
  (c) => `${c.who} 내일 ${c.time} ${c.emoji} 한국어 중계 미리 확인`,
  (c) => `내일 놓치면 아까운 경기 ${c.emoji} ${c.who} 한국어 중계`,
  (c) => `내일 한국어 해설 ${c.games}경기 ${c.emoji} ${c.who} 알람 맞추세요`,
  (c) => `내일치 편성 나왔습니다 ${c.emoji} ${c.who} ${c.time} 한국어 중계`,
  (c) => `${c.who} 내일 어디서 보나 ${c.emoji} ${c.time} 한국어 해설`,
  (c) => `내일 볼 거 미리 찍어두세요 ${c.emoji} ${c.who} ${c.time}`,
  (c) => `내일 ${c.time} ${c.who} ${c.emoji} 한국어 중계 채널 정리`,
];
```

`hookContext` 를 `coverHookContext` 재사용으로 바꾼다.

```ts
import { coverHookContext } from "./cover-hook";

/** 히어로 재료는 커버와 공유한다 — 커버와 제목의 주인공이 갈리면 안 된다. */
function hookContext(today: string): HookCtx | null {
  const c = coverHookContext(today);
  if (!c) return null;
  const hero = pickHeroForDate(today);
  return {
    who: c.who,
    isPlayer: c.isPlayer,
    time: c.time,
    games: c.games,
    emoji: hero ? SPORT_EMOJI[hero.sport] : "⚽",
  };
}
```

`import { KOREAN_PLAYERS, inferDayLabel, loadKoreanMatchesAll, pickHeroMatch } from "./instagram";` 에서 안 쓰게 된 것을 빼고 `pickHeroForDate` 를 더한다.

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `npx tsx --test src/lib/shorts-title.test.ts`
Expected: PASS (기존 7건 + 신규 1건).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/shorts-title.ts src/lib/shorts-title.test.ts
git commit -m "feat(shorts): 제목 풀 4→8종 확장, 히어로 재료를 커버와 공유"
```

---

### Task 7: 전체 검증

**Files:**
- Modify: 없음(검증만). 문제가 나오면 해당 태스크로 돌아간다.

**Interfaces:**
- Consumes: Task 1~6 전부
- Produces: 없음

- [ ] **Step 1: 타입·린트·전체 테스트**

```bash
npx tsc --noEmit
npx eslint src --ext .ts,.tsx
npm run test:cover-hook
npm run test:shorts-title
npx tsx --test src/lib/hero-pick.test.ts
```
Expected: 전부 통과.

- [ ] **Step 2: 빌드**

Run: `npm run build`
Expected: 성공. 페이지 수는 직전과 같아야 한다(사이트 화면은 안 바뀐다 — 바꾼 라이브러리는 전부 게시 스크립트 전용이다).

- [ ] **Step 3: `src/app` 이 새 코드를 안 끌어가는지 확인한다**

```bash
grep -rn "cover-hook\|reel-title-card\|shorts-title" src/app || echo "참조 0건 — 사이트 영향 없음"
```
Expected: `참조 0건`.

- [ ] **Step 4: 두 슬롯 커버를 실제로 렌더해 나란히 본다**

Run: `npx tsx generated/_preview/render-check.ts`
그리고 `generated/_preview/out/morning.png` 와 `evening.png` 를 연다.

확인 항목:
- 아침 앰버 `#ffb02e` / 저녁 라임 `#8fff3d`
- 아침은 작은 줄이 위, 저녁은 큰 줄이 위
- 날짜·요일이 흰색
- 조사가 앞말에서 안 떨어짐
- 큰 줄이 로고나 날짜와 겹치지 않음

- [ ] **Step 5: 7일치 문구를 뽑아 반복을 본다**

`generated/_preview/copy-check.ts`:

```ts
import { getKstToday } from "@/lib/instagram";
import { buildCoverHook } from "@/lib/cover-hook";

for (let i = 0; i < 10; i++) {
  const { today } = getKstToday(i);
  const m = buildCoverHook(today, "morning");
  const e = buildCoverHook(today, "evening");
  console.log(`${today}`);
  console.log(`  아침  ${m.small} / ${m.big}   [${m.accent}]`);
  console.log(`  저녁  ${e.big} / ${e.small}   [${e.accent}]`);
}
```

Run: `npx tsx generated/_preview/copy-check.ts`
Expected: 같은 날 아침·저녁이 다르고, 열흘 안에서 같은 틀이 두 번 이상 안 나온다.

- [ ] **Step 6: 미리보기 산출물을 지운다**

```bash
rm -rf generated/_preview
```

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "chore(cover): 커버 후킹·히어로 개편 검증 완료"
```

---

## 배포 전 확인

작업82 관찰창(2026-08-04 저녁부터 쇼츠 피드 배포 눌림)이 안 끝났다.
머지 시점은 사용자가 정한다 — 계획 완료 후 물어본다.
