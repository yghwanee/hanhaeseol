# AI 관전 포인트 (Match Insights) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate AI-powered "관전 포인트" (viewing points) for each Korean-commentated match using Gemini 2.0 Flash free tier, render on `/match/[slug]` pages.

**Architecture:** Daily GitHub Actions cron job loads schedule + standings + team-records, calls Gemini API with Google Search grounding, runs safety filter, saves per-match JSON files into `src/data/match-insights/`. Next.js server component reads those JSON files at request time and renders the insight section with AdSense in-article slot + Article schema.org JSON-LD.

**Tech Stack:** Next.js 14 (App Router, RSC), TypeScript, Node 24+ built-in `node:test`, tsx for script execution, Google Gemini 2.0 Flash API (free tier), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-05-20-ai-match-insights-design.md`

---

## File Structure

### Create

```
src/
├── types/
│   └── match-insight.ts                     # Type definitions
├── lib/
│   └── insights/
│       ├── safety-filter.ts                 # Betting word regex filter
│       ├── safety-filter.test.ts            # node:test unit tests
│       ├── build-context.ts                 # Compose data context for prompt
│       ├── prompt.ts                        # Prompt template
│       ├── gemini-client.ts                 # Gemini API wrapper (fetch)
│       ├── storage.ts                       # Read/write insight JSON files
│       └── generate.ts                      # Orchestration
├── scripts/
│   └── generate-match-insights.ts           # Entry script
├── data/
│   └── match-insights/
│       └── .gitkeep                         # Empty dir marker
└── app/
    └── match/[slug]/
        └── _components/
            └── MatchInsight.tsx             # UI component

.github/workflows/
└── generate-match-insights.yml              # GitHub Actions workflow
```

### Modify

```
src/app/match/[slug]/page.tsx                # Add insight render + Article JSON-LD + env gate
package.json                                 # Add insights:generate script
```

### Not Touched (already done)

- `src/app/_components/ScheduleCard.tsx` — already wraps in `<Link href="/match/...">` (line 51-55).

---

## Task 1: Type Definitions + Empty Directory

**Files:**
- Create: `src/types/match-insight.ts`
- Create: `src/data/match-insights/.gitkeep`

- [ ] **Step 1: Write the type definitions**

`src/types/match-insight.ts`:

```typescript
export interface MatchInsightSections {
  headline: string;
  recentForm: string;
  keyMatchup: string;
  watchPoints: string[];
  viewingInfo: string;
}

export interface MatchInsight {
  matchId: string;
  generatedAt: string;
  model: string;
  sections: MatchInsightSections;
}
```

- [ ] **Step 2: Create empty data directory marker**

`src/data/match-insights/.gitkeep` (empty file).

- [ ] **Step 3: Commit**

```bash
git add src/types/match-insight.ts src/data/match-insights/.gitkeep
git commit -m "feat(insights): add MatchInsight types + data directory"
```

---

## Task 2: Safety Filter (Betting Word Detection) — TDD

**Files:**
- Create: `src/lib/insights/safety-filter.ts`
- Create: `src/lib/insights/safety-filter.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/insights/safety-filter.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { containsBettingTerms, BETTING_TERMS } from "./safety-filter";

test("flags 배당", () => {
  assert.equal(containsBettingTerms("이번 경기는 배당이 좋아 보입니다"), true);
});

test("flags 픽", () => {
  assert.equal(containsBettingTerms("오늘의 픽은 맨시티 승"), true);
});

test("flags 승률 예측", () => {
  assert.equal(containsBettingTerms("승률은 65%로 예측됩니다"), true);
});

test("flags 적중", () => {
  assert.equal(containsBettingTerms("3연속 적중"), true);
});

test("flags 토토 / 꽁머니", () => {
  assert.equal(containsBettingTerms("토토 정보"), true);
  assert.equal(containsBettingTerms("꽁머니 이벤트"), true);
});

test("passes clean viewing-guide text", () => {
  const safe = "맨시티는 최근 5경기 4승1무로 좋은 흐름. 홀란드의 폼이 관전 포인트";
  assert.equal(containsBettingTerms(safe), false);
});

test("BETTING_TERMS is exposed and non-empty", () => {
  assert.ok(BETTING_TERMS.length > 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/insights/safety-filter.test.ts`
Expected: ALL fail with "Cannot find module './safety-filter'".

- [ ] **Step 3: Write minimal implementation**

`src/lib/insights/safety-filter.ts`:

```typescript
export const BETTING_TERMS = [
  "배당",
  "픽",
  "승률",
  "예측",
  "적중",
  "토토",
  "꽁머니",
  "베팅",
  "도박",
  "북메이커",
  "오즈",
  "환급률",
  "당첨",
  "단폴",
  "복합",
] as const;

const PATTERN = new RegExp(BETTING_TERMS.join("|"), "i");

export function containsBettingTerms(text: string): boolean {
  return PATTERN.test(text);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/insights/safety-filter.test.ts`
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/safety-filter.ts src/lib/insights/safety-filter.test.ts
git commit -m "feat(insights): add betting-term safety filter with tests"
```

---

## Task 3: Context Builder

**Files:**
- Create: `src/lib/insights/build-context.ts`

- [ ] **Step 1: Write the module**

`src/lib/insights/build-context.ts`:

```typescript
import type { Schedule } from "@/types/schedule";
import type { TeamRecord } from "@/types/team-record";
import type { Standing } from "@/types/standings";
import type { MatchResult } from "@/types/results";

export interface InsightContext {
  matchId: string;
  league: string;
  sport: string;
  date: string;
  time: string;
  platform: string;
  homeTeam: string;
  awayTeam: string;
  homeRank?: number;
  awayRank?: number;
  homeRecentForm?: string; // e.g. "WWLDW"
  awayRecentForm?: string;
  headToHead?: string; // e.g. "최근 5번 맞대결: 홈 3승 2패"
}

export interface ContextInputs {
  schedule: Schedule;
  teamRecords: Record<string, TeamRecord>;
  standings: Standing[];
  resultsArchive: MatchResult[];
}

export function buildInsightContext({
  schedule,
  teamRecords,
  standings,
  resultsArchive,
}: ContextInputs): InsightContext {
  const home = teamRecords[schedule.homeTeam];
  const away = teamRecords[schedule.awayTeam];

  const homeStanding = standings.find(
    (s) => s.team === schedule.homeTeam && s.league === schedule.league,
  );
  const awayStanding = standings.find(
    (s) => s.team === schedule.awayTeam && s.league === schedule.league,
  );

  const h2h = buildHeadToHead(
    resultsArchive,
    schedule.homeTeam,
    schedule.awayTeam,
  );

  return {
    matchId: schedule.id,
    league: schedule.league,
    sport: schedule.sport,
    date: schedule.date,
    time: schedule.time,
    platform: schedule.platform,
    homeTeam: schedule.homeTeam,
    awayTeam: schedule.awayTeam,
    homeRank: homeStanding?.rank,
    awayRank: awayStanding?.rank,
    homeRecentForm: home?.last5,
    awayRecentForm: away?.last5,
    headToHead: h2h,
  };
}

function buildHeadToHead(
  results: MatchResult[],
  home: string,
  away: string,
): string | undefined {
  const matchups = results.filter(
    (r) =>
      (r.homeTeam === home && r.awayTeam === away) ||
      (r.homeTeam === away && r.awayTeam === home),
  );
  if (matchups.length === 0) return undefined;

  const recent = matchups.slice(-5);
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  for (const m of recent) {
    if (typeof m.homeScore !== "number" || typeof m.awayScore !== "number") continue;
    const homeScored = m.homeTeam === home ? m.homeScore : m.awayScore;
    const awayScored = m.homeTeam === home ? m.awayScore : m.homeScore;
    if (homeScored > awayScored) homeWins++;
    else if (homeScored < awayScored) awayWins++;
    else draws++;
  }
  return `최근 ${recent.length}번 맞대결: ${home} ${homeWins}승 ${draws}무 ${awayWins}패`;
}
```

- [ ] **Step 2: Verify types referenced exist**

Run: `npx tsc --noEmit src/lib/insights/build-context.ts 2>&1 | head -30`

If imports `@/types/team-record`, `@/types/standings`, `@/types/results` resolve, types match the existing shape — proceed.

If a type doesn't exist or has a different shape, stop and read the relevant file to align.
Likely locations: `src/types/team-record.ts`, `src/types/standings.ts`, `src/types/results.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/insights/build-context.ts
git commit -m "feat(insights): add context builder from schedule/standings/records"
```

---

## Task 4: Prompt Builder

**Files:**
- Create: `src/lib/insights/prompt.ts`

- [ ] **Step 1: Write the module**

`src/lib/insights/prompt.ts`:

```typescript
import type { InsightContext } from "./build-context";

export function buildPrompt(ctx: InsightContext): string {
  const homeInfo = [
    ctx.homeTeam,
    ctx.homeRank ? `현재 ${ctx.homeRank}위` : null,
    ctx.homeRecentForm ? `최근 5경기 ${ctx.homeRecentForm}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const awayInfo = [
    ctx.awayTeam,
    ctx.awayRank ? `현재 ${ctx.awayRank}위` : null,
    ctx.awayRecentForm ? `최근 5경기 ${ctx.awayRecentForm}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return `당신은 한국 스포츠 팬을 위한 관전 가이드 작성자입니다.
픽, 배당, 베팅, 승률, 예측에 대한 언급은 절대 하지 않습니다.
부상자나 라인업이 확실하지 않다면 그 부분은 생략합니다.

[경기 정보]
- 리그: ${ctx.league}
- 종목: ${ctx.sport}
- 홈팀: ${homeInfo}
- 원정팀: ${awayInfo}
${ctx.headToHead ? `- ${ctx.headToHead}` : ""}
- 한국 시간 킥오프: ${ctx.date} ${ctx.time} KST
- 한국어 해설 플랫폼: ${ctx.platform}

[출력 형식]
반드시 다음 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "headline": "60자 이내, 경기의 핵심 매력 한 줄",
  "recentForm": "양 팀 최근 흐름. 100-150자",
  "keyMatchup": "주목할 선수 맞대결 또는 전술적 포인트. 150-200자",
  "watchPoints": ["관전 포인트 1", "관전 포인트 2", "관전 포인트 3"],
  "viewingInfo": "한국어 해설 시청 안내. ${ctx.platform}에서 ${ctx.time}부터 시청 가능 안내 포함. 50-100자"
}

[작성 규칙]
- 전체 600-1000자
- 베팅/확률/예측/배당/픽/승률 단어 절대 금지
- "관전 포인트", "보는 재미", "주목할 부분" 중심
- 추측이 아닌 사실 위주
`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/insights/prompt.ts
git commit -m "feat(insights): add prompt template builder"
```

---

## Task 5: Gemini API Client

**Files:**
- Create: `src/lib/insights/gemini-client.ts`

- [ ] **Step 1: Write the client**

`src/lib/insights/gemini-client.ts`:

```typescript
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface GeminiCallOptions {
  apiKey: string;
  prompt: string;
  enableSearchGrounding?: boolean;
  timeoutMs?: number;
}

export class GeminiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "GeminiError";
  }
}

export async function callGemini({
  apiKey,
  prompt,
  enableSearchGrounding = true,
  timeoutMs = 60_000,
}: GeminiCallOptions): Promise<string> {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
    },
    ...(enableSearchGrounding ? { tools: [{ googleSearch: {} }] } : {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new GeminiError(
        `Gemini API ${res.status}: ${errText.slice(0, 200)}`,
        res.status,
      );
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new GeminiError("Empty response from Gemini");
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export { GEMINI_MODEL };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/insights/gemini-client.ts
git commit -m "feat(insights): add Gemini 2.0 Flash API client with search grounding"
```

---

## Task 6: Storage Layer

**Files:**
- Create: `src/lib/insights/storage.ts`

- [ ] **Step 1: Write the module**

`src/lib/insights/storage.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";
import type { MatchInsight } from "@/types/match-insight";

const INSIGHTS_DIR = path.join(process.cwd(), "src/data/match-insights");

export function insightFilePath(matchId: string): string {
  // matchId may contain characters unsafe for filenames on some FS;
  // sanitize to alphanumerics + dash/underscore.
  const safe = matchId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(INSIGHTS_DIR, `${safe}.json`);
}

export function readInsight(matchId: string): MatchInsight | null {
  const filePath = insightFilePath(matchId);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as MatchInsight;
  } catch {
    return null;
  }
}

export function writeInsight(insight: MatchInsight): void {
  if (!fs.existsSync(INSIGHTS_DIR)) {
    fs.mkdirSync(INSIGHTS_DIR, { recursive: true });
  }
  const filePath = insightFilePath(insight.matchId);
  fs.writeFileSync(filePath, JSON.stringify(insight, null, 2) + "\n", "utf-8");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/insights/storage.ts
git commit -m "feat(insights): add storage layer for insight JSON files"
```

---

## Task 7: Generation Orchestration

**Files:**
- Create: `src/lib/insights/generate.ts`

- [ ] **Step 1: Write the orchestrator**

`src/lib/insights/generate.ts`:

```typescript
import type { Schedule } from "@/types/schedule";
import type { MatchInsight, MatchInsightSections } from "@/types/match-insight";
import { buildInsightContext, type ContextInputs } from "./build-context";
import { buildPrompt } from "./prompt";
import { callGemini, GEMINI_MODEL, GeminiError } from "./gemini-client";
import { containsBettingTerms } from "./safety-filter";
import { writeInsight, readInsight } from "./storage";

export type GenerateOutcome =
  | { status: "created"; insight: MatchInsight }
  | { status: "skipped"; matchId: string; reason: string };

const MIN_TOTAL_LENGTH = 300;
const MAX_RETRIES = 1;

export async function generateInsightForMatch(
  inputs: ContextInputs,
  apiKey: string,
  options: { force?: boolean } = {},
): Promise<GenerateOutcome> {
  const ctx = buildInsightContext(inputs);

  if (!options.force && readInsight(ctx.matchId)) {
    return { status: "skipped", matchId: ctx.matchId, reason: "already-exists" };
  }

  const prompt = buildPrompt(ctx);
  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await callGemini({ apiKey, prompt });
      const sections = parseSections(raw);
      if (!sections) {
        lastError = "json-parse-failed";
        continue;
      }
      const fullText = [
        sections.headline,
        sections.recentForm,
        sections.keyMatchup,
        ...sections.watchPoints,
        sections.viewingInfo,
      ].join(" ");

      if (fullText.length < MIN_TOTAL_LENGTH) {
        lastError = "too-short";
        continue;
      }
      if (containsBettingTerms(fullText)) {
        lastError = "betting-terms-detected";
        continue;
      }

      const insight: MatchInsight = {
        matchId: ctx.matchId,
        generatedAt: new Date().toISOString(),
        model: GEMINI_MODEL,
        sections,
      };
      writeInsight(insight);
      return { status: "created", insight };
    } catch (err) {
      if (err instanceof GeminiError) {
        lastError = `gemini-${err.status ?? "err"}`;
      } else {
        lastError = `unexpected-${(err as Error).message ?? "err"}`;
      }
    }
  }

  return { status: "skipped", matchId: ctx.matchId, reason: lastError || "unknown" };
}

function parseSections(raw: string): MatchInsightSections | null {
  // Gemini returns JSON; strip any code fences or surrounding whitespace.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!isValidSections(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isValidSections(v: unknown): v is MatchInsightSections {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.headline === "string" &&
    typeof o.recentForm === "string" &&
    typeof o.keyMatchup === "string" &&
    Array.isArray(o.watchPoints) &&
    o.watchPoints.every((x) => typeof x === "string") &&
    typeof o.viewingInfo === "string"
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/insights/generate.ts
git commit -m "feat(insights): add generation orchestration with safety + retry"
```

---

## Task 8: Entry Script + package.json

**Files:**
- Create: `src/scripts/generate-match-insights.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the entry script**

`src/scripts/generate-match-insights.ts`:

```typescript
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import type { ScheduleData } from "@/types/schedule";
import type { TeamRecord } from "@/types/team-record";
import type { Standing } from "@/types/standings";
import type { ResultsData } from "@/types/results";
import { generateInsightForMatch } from "@/lib/insights/generate";

const DAYS_AHEAD = Number(process.env.INSIGHTS_DAYS_AHEAD ?? "3");

function loadJson<T>(relPath: string): T {
  const full = path.join(process.cwd(), relPath);
  return JSON.parse(fs.readFileSync(full, "utf-8")) as T;
}

function inDateRange(date: string, todayKst: Date, daysAhead: number): boolean {
  const d = new Date(`${date}T00:00:00+09:00`);
  const today = new Date(todayKst);
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + daysAhead);
  return d >= today && d <= end;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is required");
    process.exit(1);
  }

  const schedule = loadJson<ScheduleData>("src/data/schedule.json");
  const teamRecords = loadJson<Record<string, TeamRecord>>(
    "src/data/team-records.json",
  );
  const standings = loadJson<{ data: Standing[] }>("src/data/standings.json");
  const results = loadJson<ResultsData>("src/data/results-archive.json");

  // KST today
  const nowKst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );

  const targets = schedule.schedules.filter(
    (s) =>
      s.koreanCommentary === true &&
      inDateRange(s.date, nowKst, DAYS_AHEAD),
  );

  console.log(
    `[insights] target matches: ${targets.length} (next ${DAYS_AHEAD} days, KR commentary only)`,
  );

  let created = 0;
  let skipped = 0;
  const skipReasons: Record<string, number> = {};

  for (const match of targets) {
    const outcome = await generateInsightForMatch(
      {
        schedule: match,
        teamRecords,
        standings: standings.data,
        resultsArchive: results.results ?? [],
      },
      apiKey,
    );
    if (outcome.status === "created") {
      created++;
      console.log(`  ✓ ${match.id}`);
    } else {
      skipped++;
      skipReasons[outcome.reason] = (skipReasons[outcome.reason] ?? 0) + 1;
      console.log(`  - ${match.id} (${outcome.reason})`);
    }
  }

  console.log(
    `[insights] done — created=${created} skipped=${skipped} reasons=${JSON.stringify(skipReasons)}`,
  );

  // Emit summary for downstream telegram step
  const summary = {
    created,
    skipped,
    skipReasons,
    targets: targets.length,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(process.cwd(), "insights-summary.json"),
    JSON.stringify(summary, null, 2),
  );
}

main().catch((err) => {
  console.error("[insights] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the script's type imports resolve**

Check that `src/types/team-record.ts`, `src/types/standings.ts`, `src/types/results.ts` define `TeamRecord`, `Standing`, `ResultsData`. If a field name differs from what `build-context.ts` assumes (e.g. `last5` vs `recentFive`), align `build-context.ts` accordingly before continuing.

Read each of the three files and confirm shape matches usage in:
- `build-context.ts`: `home?.last5`, `awayStanding?.rank`, `standings.find(s => s.team === ..., s.league === ...)`
- `generate-match-insights.ts`: `results.results`, `standings.data`

If shape mismatches, adjust the orchestrator/builder. Don't modify the type files.

- [ ] **Step 3: Update package.json**

Add to scripts section in `package.json`:

```json
"insights:generate": "tsx src/scripts/generate-match-insights.ts"
```

- [ ] **Step 4: Local dry-run smoke test**

```bash
# Get a free Gemini API key from https://aistudio.google.com/apikey
# Add to .env: GEMINI_API_KEY=...
npm run insights:generate
```

Expected output:
```
[insights] target matches: N (next 3 days, KR commentary only)
  ✓ <match-id>
  ...
[insights] done — created=X skipped=Y reasons={...}
```

Verify a JSON file appears in `src/data/match-insights/`, opens cleanly, and has the 5 required sections.

If `created=0` and all skipped with `betting-terms-detected` or `json-parse-failed`: stop, inspect raw Gemini output by temporarily logging `raw` in `generate.ts`, adjust prompt.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/generate-match-insights.ts package.json
git commit -m "feat(insights): add entry script + npm command"
```

---

## Task 9: MatchInsight UI Component

**Files:**
- Create: `src/app/match/[slug]/_components/MatchInsight.tsx`

- [ ] **Step 1: Write the component**

`src/app/match/[slug]/_components/MatchInsight.tsx`:

```tsx
import type { MatchInsight } from "@/types/match-insight";

export function MatchInsightSection({ insight }: { insight: MatchInsight }) {
  const { sections, generatedAt } = insight;

  return (
    <section className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-5 sm:p-6">
      <header className="mb-4 flex items-center gap-2">
        <span className="text-sm">✨</span>
        <h2 className="text-base font-semibold text-white sm:text-lg">
          AI 관전 포인트
        </h2>
      </header>

      <h3 className="text-lg font-bold text-white sm:text-xl">
        {sections.headline}
      </h3>

      <div className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-300">
        <Block title="최근 폼" body={sections.recentForm} />
        <Block title="핵심 매치업" body={sections.keyMatchup} />

        {/* AdSense in-article slot */}
        <div
          className="my-4 min-h-[100px] rounded-md border border-dashed border-zinc-800/60 bg-zinc-950/30 px-3 py-4 text-center text-xs text-zinc-600"
          data-ad-slot="match-insight-inarticle"
          aria-label="광고 영역"
        >
          {/* AdSense unit injected by existing global ad loader */}
          광고
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            관전 포인트
          </h4>
          <ul className="mt-2 space-y-1.5">
            {sections.watchPoints.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-zinc-600">·</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <Block title="시청 안내" body={sections.viewingInfo} />
      </div>

      <footer className="mt-5 border-t border-zinc-800/60 pt-3 text-[11px] text-zinc-600">
        AI 보조 작성 · 베팅 추천 아님 · 한국어 해설 안내 목적 ·{" "}
        <time dateTime={generatedAt}>
          {new Date(generatedAt).toLocaleDateString("ko-KR")} 생성
        </time>
      </footer>
    </section>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h4>
      <p className="mt-1.5">{body}</p>
    </div>
  );
}
```

Note: the AdSense slot is a placeholder div. Existing project AdSense setup uses global scripts — if the project uses a `<AdSlot>` component, swap in that component here. Read `src/app/_components/AdSkeleton.tsx` first to see the existing pattern.

- [ ] **Step 2: Reconcile AdSlot with existing project pattern**

Read `src/app/_components/AdSkeleton.tsx` (and grep for other ad-related components if found). If the project already has an in-article ad component, replace the placeholder div with it. If only skeleton exists, keep the placeholder div but mirror its className/structure.

- [ ] **Step 3: Commit**

```bash
git add src/app/match/[slug]/_components/MatchInsight.tsx
git commit -m "feat(insights): add MatchInsight UI component"
```

---

## Task 10: Integrate into /match/[slug] Page

**Files:**
- Modify: `src/app/match/[slug]/page.tsx`

- [ ] **Step 1: Add insight loader + render**

Modify `src/app/match/[slug]/page.tsx`:

a) Add import at top with existing imports:

```typescript
import { readInsight } from "@/lib/insights/storage";
import { MatchInsightSection } from "./_components/MatchInsight";
```

b) Inside `MatchPage` component, after `const result = ...`, add:

```typescript
  const insight =
    process.env.NEXT_PUBLIC_INSIGHTS_ENABLED === "true"
      ? readInsight(match.id)
      : null;
```

c) Insert `<MatchInsightSection>` after the closing `</article>` (line 392 area) and before the `relatedByLeague` section:

```tsx
        {insight && <MatchInsightSection insight={insight} />}
```

d) Add Article JSON-LD into the `@graph` array (inside the existing JSON-LD `@graph: [...]`), conditional on insight existence:

```typescript
        ...(insight
          ? [
              {
                "@type": "Article",
                headline: insight.sections.headline,
                datePublished: insight.generatedAt,
                dateModified: insight.generatedAt,
                author: { "@type": "Organization", name: "한해설" },
                publisher: {
                  "@type": "Organization",
                  name: "한해설",
                  logo: {
                    "@type": "ImageObject",
                    url: "https://haeseol.com/icon.png",
                  },
                },
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": `https://haeseol.com/match/${params.slug}`,
                },
                about: {
                  "@type": "SportsEvent",
                  name: `${match.league} ${match.homeTeam} vs ${match.awayTeam}`,
                },
              },
            ]
          : []),
```

Place this addition immediately after the BreadcrumbList object in the `@graph` array.

- [ ] **Step 2: Verify locally**

```bash
# In .env.local for dev:
NEXT_PUBLIC_INSIGHTS_ENABLED=true

npm run dev
```

Visit a match page whose JSON exists in `src/data/match-insights/`. Confirm:
- Insight section renders with headline, sections, watch points, footer.
- Without `NEXT_PUBLIC_INSIGHTS_ENABLED=true`, section does not render even if JSON exists.
- For a match with no insight JSON, no error and no empty section.
- View page source: Article JSON-LD present alongside existing SportsEvent + BreadcrumbList.

- [ ] **Step 3: Commit**

```bash
git add src/app/match/[slug]/page.tsx
git commit -m "feat(insights): render MatchInsight section + Article JSON-LD on /match/[slug]"
```

---

## Task 11: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/generate-match-insights.yml`

- [ ] **Step 1: Read existing workflow for pattern**

Read `.github/workflows/crawl.yml` to see the exact patterns used for:
- Node setup version
- git commit/push
- Telegram notification

Mirror that pattern in the new workflow.

- [ ] **Step 2: Write the workflow**

`.github/workflows/generate-match-insights.yml`:

```yaml
name: Generate Match Insights

on:
  schedule:
    # 매일 06:13 KST = 21:13 UTC 전날
    - cron: '13 21 * * *'
  workflow_dispatch:
    inputs:
      days_ahead:
        description: 'How many days ahead (default 3)'
        required: false
        default: '3'

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Generate insights
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          INSIGHTS_DAYS_AHEAD: ${{ github.event.inputs.days_ahead || '3' }}
        run: npm run insights:generate

      - name: Commit + push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git pull --rebase origin main
          git add src/data/match-insights/
          if ! git diff --staged --quiet; then
            git commit -m "chore: regenerate match insights"
            git push
          else
            echo "No insight changes"
          fi

      - name: Telegram notification
        if: always()
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          if [ -f insights-summary.json ]; then
            SUMMARY=$(cat insights-summary.json)
            MSG="✨ 관전 포인트 생성 완료%0A$SUMMARY"
          else
            MSG="❌ 관전 포인트 생성 실패 (요약 파일 없음)"
          fi
          curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d "chat_id=$TELEGRAM_CHAT_ID" \
            -d "text=$MSG"
```

- [ ] **Step 3: Add GitHub secret**

Manual step (the engineer cannot do this from code):
- Go to GitHub repo → Settings → Secrets and variables → Actions → New repository secret
- Name: `GEMINI_API_KEY`
- Value: API key from https://aistudio.google.com/apikey

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/generate-match-insights.yml
git commit -m "ci: add daily match-insights generation workflow"
```

- [ ] **Step 5: Trigger once manually**

Push to main, then on GitHub:
- Actions tab → "Generate Match Insights" → "Run workflow" → run
- Check job logs
- Verify JSON files committed to `src/data/match-insights/`
- Check Telegram for notification

---

## Task 12: Phase 1 Rollout — Env-Gated Render

**Files:**
- Modify: Vercel env vars (manual)

- [ ] **Step 1: Initial deploy with insights off**

In Vercel project settings:
- Environment Variable: `NEXT_PUBLIC_INSIGHTS_ENABLED` = unset (or `false`)
- Deploy

This deploys all code without rendering insights. Schema-org Article also not emitted (gated by same flag in Task 10).

- [ ] **Step 2: Run workflow, generate JSON files**

Manually trigger the workflow once. Verify JSON files committed.

- [ ] **Step 3: Spot-check 10 generated insights**

Open 10 random JSON files in `src/data/match-insights/`. For each:
- Read the headline + sections aloud (or quickly skim).
- Look for any betting/odds/픽/배당 language that the safety filter missed.
- Look for obvious factual errors (wrong team names, wrong date).
- Look for empty / boilerplate text.

If any fail, adjust prompt in `prompt.ts`, re-generate (delete the bad JSON files first), repeat.

- [ ] **Step 4: Flip the flag on**

When 10/10 spot-checks pass:
- Vercel env: `NEXT_PUBLIC_INSIGHTS_ENABLED` = `true`
- Trigger redeploy
- Open production `/match/{slug}` URL for an EPL match — insight section should render.

- [ ] **Step 5: Confirm Phase 1 in CLAUDE.md or project memory**

Document in CLAUDE.md "작업 진행 상황":
- Add line: `29. AI 관전 포인트 (Match Insights) Phase 1 시작 — Gemini 무료, /match/[slug]에 노출`

Commit:

```bash
git add CLAUDE.md
git commit -m "docs: log AI match insights Phase 1 start"
```

---

## Phase 2 / Phase 3 (Not in This Plan)

Phase 2 (multi-sport) and Phase 3 (index ON, AdSense re-review) are operator-driven decisions based on Phase 1 observation. They don't require new code — only:
- Toggling Vercel env vars
- Optional `robots` meta changes in `generateMetadata`
- Re-submitting AdSense

If Phase 2 or 3 reveals a code gap, write a follow-up plan.

---

## Self-Review

**Spec coverage:**
- ✅ Architecture (cron + Gemini + JSON storage) → Tasks 5, 6, 7, 8, 11
- ✅ Data model (matchId, generatedAt, model, sections) → Task 1
- ✅ Prompt strategy → Task 4
- ✅ Safety filter (regex + footer) → Tasks 2, 9
- ✅ Phased rollout → Task 12
- ✅ UI on /match/[slug] + Article JSON-LD → Tasks 9, 10
- ✅ Monitoring (Telegram) → Task 11
- ✅ Cost (Gemini free) → Tasks 5, 11
- ✅ ScheduleCard already clickable → not needed (noted at top)
- ✅ AdSense in-article slot → Task 9

**Placeholder scan:** No "TBD"/"TODO"/"implement later" remain. All code blocks contain complete implementations.

**Type consistency:** `MatchInsight` shape is identical across `match-insight.ts`, `generate.ts`, `storage.ts`, `MatchInsight.tsx`. `InsightContext` shape consistent across `build-context.ts`, `prompt.ts`, `generate.ts`. Task 8 Step 2 explicitly verifies external types (`TeamRecord`, `Standing`, `ResultsData`) match before proceeding.

**Scope check:** Single feature, one plan. Tasks are independently committable. Phase 2/3 explicitly out of scope.
