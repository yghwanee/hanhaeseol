# 야구 선발투수 표시 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/match/[slug]` 야구 경기 페이지에 네이버에서 가져온 선발투수 매치업(이름·ERA·이닝·승패·탈삼진·WHIP)을 구조화 카드로 표시한다.

**Architecture:** 네이버 스포츠 API(`api-gw.sports.naver.com`)에서 KBO·MLB 예고 선발+성적을 크롤해 `src/data/starters.json`에 저장(방향무관 키 + 팀명→선발 맵). `/match` 페이지가 렌더 시 (날짜+정렬팀명) 키로 조회해 카드로 표시. LLM 미사용 = 0원. GitHub Actions가 하루 3회(KST 03/10/21시) 갱신.

**Tech Stack:** Next.js 14 App Router(서버 컴포넌트), TypeScript, Tailwind, `node:test`+`tsx` 테스트, GitHub Actions.

**검증된 사실(2026-06-02):**
- KBO `currentSeasonStats`: `{era, inn:"63.1", inn2:"63 1/3", w, l, kk, whip, ...}`, 이름 `playerInfo.name`
- MLB `currentSeasonStats`: `{era, inn:"30.0", w, l, kk, ...}` — **whip 없음, inn2 없음, teamName 없음**
- 엔드포인트: 목록 `GET /schedule/games?categoryId={kbo|mlb}&fromDate&toDate`, 상세 `GET /schedule/games/{gameId}/preview` → `result.previewData.homeStarter/awayStarter`
- 팀명: KBO는 편성·네이버 동일. MLB는 편성 풀네임("샌디에이고 파드리스") ≠ 네이버 축약("샌디에이고") → 30팀 매핑 필요.
- 헤더: `Referer: https://m.sports.naver.com/`, 모바일 UA (기존 `src/lib/standings/naver.ts`와 동일)
- 테스트 컨벤션: `import { test } from "node:test"; import assert from "node:assert/strict";`, 실행 `npx tsx <파일>` (기존 `src/lib/insights/safety-filter.test.ts` 참고)

---

## File Structure

- Create `src/types/starter.ts` — 타입(StarterStat, MatchStarters, StartersData, MatchStarterView)
- Create `src/lib/starters/teams.ts` — `normalizeTeamName` (MLB 30팀 매핑 + KBO passthrough)
- Create `src/lib/starters/format.ts` — `formatInnings` (야구 소수→⅓/⅔)
- Create `src/lib/starters/lookup.ts` — `buildStarterKey`, `getStartersForMatch`
- Create `src/lib/starters/naver.ts` — `fetchGameList`, `fetchStarters`, `parseStarter`
- Create `src/scripts/crawl-starters.ts` — 크롤러(7일치 KBO+MLB → starters.json)
- Create `src/data/starters.json` — 데이터 파일(초기 빈 시드 → 크롤러가 덮어씀)
- Create `src/app/match/[slug]/_components/MatchStarters.tsx` — 표시 컴포넌트
- Modify `src/app/match/[slug]/page.tsx` — import + 렌더(인사이트 섹션 직전)
- Modify `package.json` — `crawl:starters`, `test:starters` 스크립트
- Create `.github/workflows/crawl-starters.yml` — 하루 3회 자동화
- Tests: `src/lib/starters/teams.test.ts`, `format.test.ts`, `lookup.test.ts`, `naver.test.ts`

---

## Task 1: 타입 정의

**Files:**
- Create: `src/types/starter.ts`

- [ ] **Step 1: 타입 파일 작성**

```ts
// 선발투수 한 명의 시즌 성적. whip은 KBO만 제공(MLB 응답엔 없음) → optional.
export interface StarterStat {
  name: string;
  era: string; // 네이버 원본 문자열 보존 (예 "3.45")
  ip: string;  // 포맷된 이닝 (예 "57⅓"); 데이터 없으면 ""
  w: number;
  l: number;
  so: number;  // 탈삼진 (네이버 kk)
  whip?: string;
}

// 한 경기의 양 팀 선발. teams는 정규화된 팀명 -> 성적.
export interface MatchStarters {
  league: "kbo" | "mlb";
  teams: Record<string, StarterStat>;
}

export interface StartersData {
  lastUpdated: string;
  starters: Record<string, MatchStarters>;
}

// 렌더용 — 특정 경기의 홈/원정 선발(없으면 null).
export interface MatchStarterView {
  home: StarterStat | null;
  away: StarterStat | null;
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 통과(에러 없음). 만약 환경상 tsc 직접 실행이 안 되면 `npm run lint` 사용.

- [ ] **Step 3: 커밋**

```bash
git add src/types/starter.ts
git commit -m "feat(starters): 선발투수 타입 정의"
```

---

## Task 2: MLB 팀명 정규화

**Files:**
- Create: `src/lib/starters/teams.ts`
- Test: `src/lib/starters/teams.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTeamName } from "./teams";

test("KBO 팀명은 그대로 통과", () => {
  assert.equal(normalizeTeamName("KIA"), "KIA");
  assert.equal(normalizeTeamName("롯데"), "롯데");
});

test("MLB 편성 풀네임과 네이버 축약이 같은 canonical로", () => {
  assert.equal(normalizeTeamName("샌디에이고 파드리스"), normalizeTeamName("샌디에이고"));
  assert.equal(normalizeTeamName("시카고 화이트삭스"), normalizeTeamName("시카고W"));
  assert.equal(normalizeTeamName("시카고 컵스"), normalizeTeamName("시카고컵스"));
  assert.notEqual(normalizeTeamName("시카고 컵스"), normalizeTeamName("시카고 화이트삭스"));
  assert.equal(normalizeTeamName("LA 다저스"), normalizeTeamName("LA다저스"));
  assert.notEqual(normalizeTeamName("LA 다저스"), normalizeTeamName("LA 에인절스"));
});

test("공백 차이 무시", () => {
  assert.equal(normalizeTeamName(" 보스턴 레드삭스 "), normalizeTeamName("보스턴"));
});

test("미지의 팀명은 trim만 해서 반환", () => {
  assert.equal(normalizeTeamName(" 알수없는팀 "), "알수없는팀");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx src/lib/starters/teams.test.ts`
Expected: FAIL — `normalizeTeamName` 모듈 없음.

- [ ] **Step 3: 구현**

```ts
// MLB 팀명 정규화. 편성(schedule)은 풀네임("샌디에이고 파드리스"),
// 네이버는 축약("샌디에이고", "시카고W")을 쓴다. 둘 다 같은 canonical 코드로 통일.
// 뉴욕/시카고/LA는 같은 도시 2팀이라 도시명만으론 구분 불가 → 명시 매핑 필수.
// 키는 공백 제거 후 비교한다.
const MLB_ALIASES: Record<string, string> = {
  "LA다저스": "LAD",
  "LA에인절스": "LAA",
  "뉴욕메츠": "NYM",
  "뉴욕양키스": "NYY",
  "디트로이트타이거스": "DET", "디트로이트": "DET",
  "미네소타트윈스": "MIN", "미네소타": "MIN",
  "밀워키브루어스": "MIL", "밀워키": "MIL",
  "보스턴레드삭스": "BOS", "보스턴": "BOS",
  "볼티모어오리올스": "BAL", "볼티모어": "BAL",
  "샌디에이고파드리스": "SD", "샌디에이고": "SD",
  "샌프란시스코자이언츠": "SF", "샌프란시스코": "SF",
  "세인트루이스카디널스": "STL", "세인트루이스": "STL",
  "시애틀매리너스": "SEA", "시애틀": "SEA",
  "시카고컵스": "CHC",
  "시카고화이트삭스": "CWS", "시카고W": "CWS",
  "신시내티레즈": "CIN", "신시내티": "CIN",
  "애리조나다이아몬드백스": "ARI", "애리조나": "ARI",
  "애슬레틱스": "ATH",
  "애틀랜타브레이브스": "ATL", "애틀랜타": "ATL",
  "워싱턴내셔널스": "WSH", "워싱턴": "WSH",
  "캔자스시티로열스": "KC", "캔자스시티": "KC",
  "콜로라도로키스": "COL", "콜로라도": "COL",
  "클리블랜드가디언스": "CLE", "클리블랜드": "CLE",
  "탬파베이레이스": "TB", "탬파베이": "TB",
  "텍사스레인저스": "TEX", "텍사스": "TEX",
  "토론토블루제이스": "TOR", "토론토": "TOR",
  "피츠버그파이리츠": "PIT", "피츠버그": "PIT",
  "필라델피아필리스": "PHI", "필라델피아": "PHI",
  "휴스턴애스트로스": "HOU", "휴스턴": "HOU",
  "마이애미말린스": "MIA", "마이애미": "MIA",
};

export function normalizeTeamName(name: string): string {
  const trimmed = name.trim();
  const key = trimmed.replace(/\s+/g, "");
  return MLB_ALIASES[key] ?? trimmed;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx src/lib/starters/teams.test.ts`
Expected: PASS (모든 test 통과).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/starters/teams.ts src/lib/starters/teams.test.ts
git commit -m "feat(starters): MLB 팀명 정규화 매핑"
```

---

## Task 3: 이닝 포맷터

**Files:**
- Create: `src/lib/starters/format.ts`
- Test: `src/lib/starters/format.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatInnings } from "./format";

test("야구 소수표기 .1=⅓ .2=⅔", () => {
  assert.equal(formatInnings("63.1"), "63⅓");
  assert.equal(formatInnings("57.2"), "57⅔");
  assert.equal(formatInnings("30.0"), "30");
});

test("정수 이닝", () => {
  assert.equal(formatInnings("12"), "12");
});

test("0이닝대", () => {
  assert.equal(formatInnings("0.1"), "0⅓");
});

test("빈 문자열은 빈 문자열", () => {
  assert.equal(formatInnings(""), "");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx src/lib/starters/format.test.ts`
Expected: FAIL — `formatInnings` 없음.

- [ ] **Step 3: 구현**

```ts
// 야구 이닝 표기: 소수 .1 = ⅓, .2 = ⅔ (아웃 카운트). "63.1"->"63⅓", "30.0"->"30".
export function formatInnings(inn: string): string {
  if (!inn) return "";
  const [whole, frac] = inn.split(".");
  const mark = frac === "1" ? "⅓" : frac === "2" ? "⅔" : "";
  return `${whole}${mark}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx src/lib/starters/format.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/starters/format.ts src/lib/starters/format.test.ts
git commit -m "feat(starters): 이닝 포맷터"
```

---

## Task 4: 키 생성 & 조회

**Files:**
- Create: `src/lib/starters/lookup.ts`
- Test: `src/lib/starters/lookup.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStarterKey, getStartersForMatch } from "./lookup";
import type { StartersData } from "@/types/starter";

test("키는 팀 순서와 무관하게 동일", () => {
  assert.equal(
    buildStarterKey("2026-06-02", "롯데", "KIA"),
    buildStarterKey("2026-06-02", "KIA", "롯데"),
  );
});

const DATA: StartersData = {
  lastUpdated: "x",
  starters: {
    [buildStarterKey("2026-06-02", "KIA", "롯데")]: {
      league: "kbo",
      teams: {
        KIA: { name: "네일", era: "3.84", ip: "63⅓", w: 2, l: 4, so: 48, whip: "1.11" },
        "롯데": { name: "나균안", era: "3.45", ip: "57⅓", w: 2, l: 5, so: 48, whip: "1.34" },
      },
    },
  },
};

test("야구 경기 조회 — 홈/원정 매핑", () => {
  const v = getStartersForMatch(DATA, {
    date: "2026-06-02", homeTeam: "롯데", awayTeam: "KIA", sport: "야구",
  });
  assert.ok(v);
  assert.equal(v!.home!.name, "나균안");
  assert.equal(v!.away!.name, "네일");
});

test("야구 아닌 종목은 null", () => {
  const v = getStartersForMatch(DATA, {
    date: "2026-06-02", homeTeam: "토트넘", awayTeam: "아스널", sport: "축구",
  });
  assert.equal(v, null);
});

test("데이터 없는 야구 경기는 home/away 모두 null", () => {
  const v = getStartersForMatch(DATA, {
    date: "2026-06-09", homeTeam: "삼성", awayTeam: "두산", sport: "야구",
  });
  assert.ok(v);
  assert.equal(v!.home, null);
  assert.equal(v!.away, null);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx src/lib/starters/lookup.test.ts`
Expected: FAIL — `lookup` 없음.

- [ ] **Step 3: 구현**

```ts
import type { StartersData, MatchStarterView } from "@/types/starter";
import { normalizeTeamName } from "./teams";

// 방향 무관 키: 날짜 + 정규화된 두 팀명을 정렬해 결합.
export function buildStarterKey(date: string, teamA: string, teamB: string): string {
  const a = normalizeTeamName(teamA);
  const b = normalizeTeamName(teamB);
  return `${date}|${[a, b].sort().join("-")}`;
}

interface MatchLike {
  date: string;
  homeTeam: string;
  awayTeam: string;
  sport: string;
}

// 야구 경기면 항상 view 반환(데이터 없으면 home/away null). 야구 아니면 null.
export function getStartersForMatch(
  data: StartersData,
  match: MatchLike,
): MatchStarterView | null {
  if (match.sport !== "야구") return null;
  const entry = data.starters[buildStarterKey(match.date, match.homeTeam, match.awayTeam)];
  return {
    home: entry?.teams[normalizeTeamName(match.homeTeam)] ?? null,
    away: entry?.teams[normalizeTeamName(match.awayTeam)] ?? null,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx src/lib/starters/lookup.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/starters/lookup.ts src/lib/starters/lookup.test.ts
git commit -m "feat(starters): 키 생성 및 경기별 선발 조회"
```

---

## Task 5: 네이버 fetch & 파싱

**Files:**
- Create: `src/lib/starters/naver.ts`
- Test: `src/lib/starters/naver.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** (`parseStarter`는 순수 함수 — 네트워크 없이 픽스처로 테스트)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStarter } from "./naver";

// KBO 응답 형태 (whip 있음, inn 소수표기)
const KBO_RAW = {
  playerInfo: { name: "네일" },
  currentSeasonStats: { era: "3.84", inn: "63.1", w: 2, l: 4, kk: 48, whip: "1.11" },
};
// MLB 응답 형태 (whip 없음)
const MLB_RAW = {
  playerInfo: { name: "잭스" },
  currentSeasonStats: { era: "3.30", inn: "30.0", w: 1, l: 3, kk: 27 },
};

test("KBO 선발 파싱 — whip 포함, 이닝 포맷", () => {
  const s = parseStarter(KBO_RAW);
  assert.deepEqual(s, { name: "네일", era: "3.84", ip: "63⅓", w: 2, l: 4, so: 48, whip: "1.11" });
});

test("MLB 선발 파싱 — whip 없음", () => {
  const s = parseStarter(MLB_RAW);
  assert.deepEqual(s, { name: "잭스", era: "3.30", ip: "30", w: 1, l: 3, so: 27 });
});

test("이름 없으면 null", () => {
  assert.equal(parseStarter({ currentSeasonStats: { era: "1.00" } }), null);
});

test("era 없으면 null", () => {
  assert.equal(parseStarter({ playerInfo: { name: "X" } }), null);
});

test("null/undefined 안전", () => {
  assert.equal(parseStarter(null), null);
  assert.equal(parseStarter(undefined), null);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx src/lib/starters/naver.test.ts`
Expected: FAIL — `parseStarter` 없음.

- [ ] **Step 3: 구현**

```ts
import type { StarterStat } from "@/types/starter";
import { formatInnings } from "./format";

const BASE = "https://api-gw.sports.naver.com";
const HEADERS = {
  Referer: "https://m.sports.naver.com/",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
};

async function naverGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Naver HTTP ${res.status}: ${path}`);
  const json = (await res.json()) as { result?: T };
  if (!json.result) throw new Error(`Naver empty result: ${path}`);
  return json.result;
}

export interface NaverGame {
  gameId: string;
  gameDate: string;
  homeTeamName: string;
  awayTeamName: string;
}

export async function fetchGameList(
  categoryId: string,
  fromDate: string,
  toDate: string,
): Promise<NaverGame[]> {
  const r = await naverGet<{ games?: NaverGame[] }>(
    `/schedule/games?categoryId=${categoryId}&fromDate=${fromDate}&toDate=${toDate}`,
  );
  return (r.games ?? []).map((g) => ({
    gameId: g.gameId,
    gameDate: g.gameDate,
    homeTeamName: g.homeTeamName,
    awayTeamName: g.awayTeamName,
  }));
}

interface RawStarter {
  playerInfo?: { name?: string };
  currentSeasonStats?: {
    era?: string;
    inn?: string;
    w?: number;
    l?: number;
    kk?: number;
    whip?: string;
  };
}

// preview의 한 선발 객체 -> StarterStat. 이름 또는 era 없으면 null.
export function parseStarter(raw: RawStarter | null | undefined): StarterStat | null {
  if (!raw) return null;
  const name = raw.playerInfo?.name?.trim();
  const st = raw.currentSeasonStats;
  if (!name || !st || !st.era) return null;
  const out: StarterStat = {
    name,
    era: st.era,
    ip: st.inn ? formatInnings(st.inn) : "",
    w: typeof st.w === "number" ? st.w : 0,
    l: typeof st.l === "number" ? st.l : 0,
    so: typeof st.kk === "number" ? st.kk : 0,
  };
  if (st.whip) out.whip = st.whip;
  return out;
}

export interface GameStarters {
  home: StarterStat | null;
  away: StarterStat | null;
}

export async function fetchStarters(gameId: string): Promise<GameStarters> {
  const r = await naverGet<{
    previewData?: { homeStarter?: RawStarter; awayStarter?: RawStarter };
  }>(`/schedule/games/${gameId}/preview`);
  return {
    home: parseStarter(r.previewData?.homeStarter),
    away: parseStarter(r.previewData?.awayStarter),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx src/lib/starters/naver.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/starters/naver.ts src/lib/starters/naver.test.ts
git commit -m "feat(starters): 네이버 fetch 및 선발 파싱"
```

---

## Task 6: 초기 데이터 파일 시드

**Files:**
- Create: `src/data/starters.json`

(페이지가 import하므로 크롤러 실행 전에도 파일이 존재해야 빌드된다.)

- [ ] **Step 1: 빈 시드 파일 작성**

```json
{
  "lastUpdated": "",
  "starters": {}
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/data/starters.json
git commit -m "feat(starters): 빈 데이터 파일 시드"
```

---

## Task 7: 크롤러 스크립트

**Files:**
- Create: `src/scripts/crawl-starters.ts`
- Modify: `package.json` (scripts에 `crawl:starters` 추가)

- [ ] **Step 1: 크롤러 작성**

```ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import type { StartersData, MatchStarters } from "@/types/starter";
import { fetchGameList, fetchStarters } from "@/lib/starters/naver";
import { buildStarterKey } from "@/lib/starters/lookup";
import { normalizeTeamName } from "@/lib/starters/teams";

const LEAGUES: Array<{ categoryId: string; league: "kbo" | "mlb" }> = [
  { categoryId: "kbo", league: "kbo" },
  { categoryId: "mlb", league: "mlb" },
];
const DAYS = 7;
const SLEEP_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function rangeDates(today: string, days: number): string[] {
  const [y, m, d] = today.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    out.push(new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
  }
  return out;
}

async function main() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const dates = rangeDates(today, DAYS);
  const starters: Record<string, MatchStarters> = {};

  for (const { categoryId, league } of LEAGUES) {
    for (const date of dates) {
      let games;
      try {
        games = await fetchGameList(categoryId, date, date);
      } catch (e) {
        console.warn(`[starters] list fail ${categoryId} ${date}: ${(e as Error).message}`);
        continue;
      }
      for (const g of games) {
        await sleep(SLEEP_MS);
        let s;
        try {
          s = await fetchStarters(g.gameId);
        } catch (e) {
          console.warn(`[starters] preview fail ${g.gameId}: ${(e as Error).message}`);
          continue;
        }
        if (!s.home && !s.away) continue;
        const teams: MatchStarters["teams"] = {};
        if (s.home) teams[normalizeTeamName(g.homeTeamName)] = s.home;
        if (s.away) teams[normalizeTeamName(g.awayTeamName)] = s.away;
        starters[buildStarterKey(g.gameDate, g.homeTeamName, g.awayTeamName)] = {
          league,
          teams,
        };
      }
    }
  }

  const data: StartersData = {
    lastUpdated: new Date().toISOString(),
    starters,
  };
  const out = path.join(process.cwd(), "src/data/starters.json");
  fs.writeFileSync(out, JSON.stringify(data, null, 2) + "\n");
  console.log(`[starters] wrote ${Object.keys(starters).length} matches → ${out}`);
}

main().catch((err) => {
  console.error("[starters] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: package.json에 스크립트 추가**

`scripts` 객체에서 `"crawl:results": ...` 줄 아래에 추가:

```json
    "crawl:starters": "tsx src/scripts/crawl-starters.ts",
```

- [ ] **Step 3: 크롤러 실제 실행(통합 검증)**

Run: `npm run crawl:starters`
Expected: `[starters] wrote N matches → .../starters.json` (N > 0, 현재 KBO/MLB 시즌 중이면 수십 건). 에러 없이 종료.

- [ ] **Step 4: 생성물 점검**

Run: `node -e "const d=require('./src/data/starters.json'); const k=Object.keys(d.starters); console.log('matches:',k.length); console.log(JSON.stringify(d.starters[k[0]],null,2))"`
Expected: 첫 경기에 `league`, `teams`(팀명→{name,era,ip,w,l,so,(whip)}) 표시. 값이 합리적인지 눈으로 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/scripts/crawl-starters.ts package.json src/data/starters.json
git commit -m "feat(starters): 네이버 선발 크롤러 + 데이터 생성"
```

---

## Task 8: 표시 컴포넌트

**Files:**
- Create: `src/app/match/[slug]/_components/MatchStarters.tsx`

기존 `page.tsx` 스코어 블록(VS 중심 2열, `flex items-center justify-center gap`, `flex-1 text-right`/`text-left`)과 다크모드 톤(zinc/emerald)을 그대로 맞춘다.

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import type { StarterStat } from "@/types/starter";

interface Props {
  home: StarterStat | null;
  away: StarterStat | null;
  homeTeam: string;
  awayTeam: string;
}

function statLines(s: StarterStat): { primary: string; secondary: string } {
  // primary: 승패 + 이닝, secondary: 탈삼진 (+ WHIP 있으면)
  const primaryParts = [`${s.w}승 ${s.l}패`];
  if (s.ip) primaryParts.push(`${s.ip}이닝`);
  const secondaryParts = [`${s.so}K`];
  if (s.whip) secondaryParts.push(`WHIP ${s.whip}`);
  return { primary: primaryParts.join(" · "), secondary: secondaryParts.join(" · ") };
}

function StarterCol({
  team,
  starter,
  align,
}: {
  team: string;
  starter: StarterStat | null;
  align: "left" | "right";
}) {
  const alignCls = align === "right" ? "text-right" : "text-left";
  if (!starter) {
    return (
      <div className={`flex-1 ${alignCls}`}>
        <p className="truncate text-xs text-zinc-400 sm:text-sm">{team}</p>
        <p className="mt-1 text-sm text-zinc-600">선발 미발표</p>
      </div>
    );
  }
  const { primary, secondary } = statLines(starter);
  return (
    <div className={`flex-1 ${alignCls}`}>
      <p className="truncate text-xs text-zinc-400 sm:text-sm">{team}</p>
      <p className="mt-0.5 truncate text-base font-bold text-white sm:text-lg">{starter.name}</p>
      <p className="mt-1 text-sm font-semibold text-emerald-400">ERA {starter.era}</p>
      <p className="mt-0.5 text-[11px] text-zinc-400 sm:text-xs">{primary}</p>
      <p className="text-[11px] text-zinc-500 sm:text-xs">{secondary}</p>
    </div>
  );
}

export function MatchStarters({ home, away, homeTeam, awayTeam }: Props) {
  return (
    <section className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-5 sm:p-6">
      <h2 className="mb-3 text-center text-[11px] font-medium tracking-wide text-zinc-500 sm:text-xs">
        선발 매치업
      </h2>
      {!home && !away ? (
        <p className="text-center text-sm text-zinc-600">선발 미발표</p>
      ) : (
        <div className="flex items-start justify-center gap-4 sm:gap-6">
          <StarterCol team={homeTeam} starter={home} align="right" />
          <div className="self-center text-xs font-bold text-zinc-600 sm:text-sm">VS</div>
          <StarterCol team={awayTeam} starter={away} align="left" />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 통과. (안 되면 `npm run lint`.)

- [ ] **Step 3: 커밋**

```bash
git add "src/app/match/[slug]/_components/MatchStarters.tsx"
git commit -m "feat(starters): 선발 매치업 표시 컴포넌트"
```

---

## Task 9: 페이지 연결

**Files:**
- Modify: `src/app/match/[slug]/page.tsx`

- [ ] **Step 1: import 추가**

`import { MatchInsightSection } from "./_components/MatchInsight";` (현재 23번째 줄 부근) 아래에 추가:

```ts
import { MatchStarters } from "./_components/MatchStarters";
import { getStartersForMatch } from "@/lib/starters/lookup";
import type { StartersData } from "@/types/starter";
import startersData from "@/data/starters.json";
```

- [ ] **Step 2: 컴포넌트 본문에서 선발 view 계산**

`MatchPage` 함수 본문, `const insight = readInsight(match.id);` (240번째 줄 부근) 아래에 추가:

```ts
  const starters = getStartersForMatch(startersData as unknown as StartersData, match);
```

- [ ] **Step 3: 인사이트 섹션 직전에 렌더**

현재 `{insight && <MatchInsightSection insight={insight} />}` (569번째 줄 부근) **바로 위 줄**에 추가:

```tsx
        {starters && (
          <MatchStarters
            home={starters.home}
            away={starters.away}
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
          />
        )}
```

- [ ] **Step 4: 타입 체크 + 빌드 확인**

Run: `npx tsc --noEmit`
Expected: 통과.
Run: `npm run build`
Expected: 빌드 성공. (`/match/[slug]` 라우트 생성 에러 없음.)

- [ ] **Step 5: 로컬 육안 확인**

Run: `npm run dev` 후 브라우저에서 오늘 KBO 경기의 `/match/<slug>` 접속.
Expected: "선발 매치업" 카드에 양 팀 선발 이름·ERA·승패·이닝·K(·WHIP) 표시. 선발 없는 먼 날짜 경기는 "선발 미발표".

- [ ] **Step 6: 커밋**

```bash
git add "src/app/match/[slug]/page.tsx"
git commit -m "feat(starters): /match 페이지에 선발 매치업 연결"
```

---

## Task 10: 자동화 워크플로우

**Files:**
- Create: `.github/workflows/crawl-starters.yml`

기존 `.github/workflows/generate-match-insights.yml` 구조를 참고하되 LLM/텔레그램 없음.

- [ ] **Step 1: 워크플로우 작성**

```yaml
name: Crawl Starting Pitchers

on:
  schedule:
    # KST 03:00 / 10:00 / 21:00 = UTC 18:00(전날) / 01:00 / 12:00
    - cron: '0 18 * * *'
    - cron: '0 1 * * *'
    - cron: '0 12 * * *'
  workflow_dispatch: {}

permissions:
  contents: write

jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v6
        with:
          node-version: '20'

      - run: npm ci

      - name: Crawl starters
        run: npm run crawl:starters

      - name: Commit & push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git pull --rebase --autostash origin main
          git add src/data/starters.json
          if git diff --staged --quiet; then
            echo "No starter changes"
          else
            git commit -m "chore: update starting pitchers"
            git push
          fi
```

- [ ] **Step 2: YAML 검증(로컬)**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/crawl-starters.yml','utf8'); console.log(y.includes('crawl:starters')?'ok':'MISSING')"`
Expected: `ok`.

- [ ] **Step 3: 커밋**

```bash
git add .github/workflows/crawl-starters.yml
git commit -m "ci(starters): 하루 3회 선발 크롤 워크플로우"
```

---

## Task 11: 전체 테스트 스크립트(편의)

**Files:**
- Modify: `package.json`

- [ ] **Step 1: test 스크립트 추가**

`scripts`에 추가:

```json
    "test:starters": "tsx --test src/lib/starters/*.test.ts",
```

- [ ] **Step 2: 전체 테스트 실행**

Run: `npm run test:starters`
Expected: teams/format/lookup/naver 모든 test 통과 (fail 0). 만약 `tsx --test` 글롭이 환경에서 안 먹으면 각 파일을 `npx tsx <파일>`로 개별 실행.

- [ ] **Step 3: 커밋**

```bash
git add package.json
git commit -m "chore(starters): 선발 테스트 스크립트"
```

---

## 완료 후

- 다음 자동 실행(또는 `gh workflow run "Crawl Starting Pitchers"`)에서 무인 갱신 확인.
- 메인 브랜치까지 푸시 필요(사용자 정책: "푸시"는 main까지).

## 비고 / 알려진 제약

- MLB 선발 성적엔 WHIP이 없어 MLB 카드엔 WHIP 미표시(정상).
- MLB 팀명 매핑은 2026-06-02 편성/네이버 표기 기준. 표기가 바뀌면 `teams.ts`의 `MLB_ALIASES` 보강 필요(매칭 실패 시 "선발 미발표"로 안전하게 표시됨).
- 경기 종료 후에도 예고 선발은 그대로 보일 수 있음(현재 범위에선 허용).
