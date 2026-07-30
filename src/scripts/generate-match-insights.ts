import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import type { ScheduleData } from "@/types/schedule";
import type { TeamRecordsData } from "@/types/team-record";
import type { StandingsData } from "@/types/standings";
import type { ResultsData } from "@/types/results";
import { generateInsightForMatch } from "@/lib/insights/generate";

const DAYS_AHEAD = Number(process.env.INSIGHTS_DAYS_AHEAD ?? "0");
// Gemini 2.5 Flash 무료 한도: 일 1,500 req, 분당 15 RPM. 4.5초 간격이면 안전 마진.
const SLEEP_MS = Number(process.env.INSIGHTS_SLEEP_MS ?? "4500");
// 인사이트 컨텍스트(팀 폼/순위/연승)는 매일 바뀌므로 미리 생성한 인사이트는 stale이 된다.
// 야구처럼 매일 경기하는 종목은 D+1 인사이트도 전날 결과를 반영해야 함. true면 매일 overwrite.
const FORCE_REGEN = process.env.INSIGHTS_FORCE_REGEN === "true";
// 개막 전 월드컵 백필용: grounding(실시간 검색)을 꺼서 무료 grounding quota(~20/일)를
// 우회. 개막 전엔 검색할 결과가 없어 grounding 불필요 → 기본 1,500 req/일 한도 안에서 전 경기 생성.
const DISABLE_GROUNDING = process.env.INSIGHTS_DISABLE_GROUNDING === "true";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadJson<T>(relPath: string): T {
  const full = path.join(process.cwd(), relPath);
  return JSON.parse(fs.readFileSync(full, "utf-8")) as T;
}

function todayKstDateStr(): string {
  // KST 기준 "YYYY-MM-DD" 문자열. en-CA 로케일이 ISO 형식을 반환.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function inDateRange(date: string, todayKstStr: string, daysAhead: number): boolean {
  if (date < todayKstStr) return false;
  // todayKstStr + daysAhead → 끝 날짜 문자열. Date.UTC가 day overflow 자동 처리.
  const [y, m, d] = todayKstStr.split("-").map(Number);
  const endStr = new Date(Date.UTC(y, m - 1, d + daysAhead))
    .toISOString()
    .slice(0, 10);
  return date <= endStr;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is required");
    process.exit(1);
  }

  const schedule = loadJson<ScheduleData>("src/data/schedule.json");
  // 월드컵 편성은 별도 파일이므로 인사이트 대상 풀에 합친다. (없으면 무시)
  let worldcup: ScheduleData = { lastUpdated: "", schedules: [] };
  try {
    worldcup = loadJson<ScheduleData>("src/data/worldcup.json");
  } catch {
    // worldcup.json 없으면 무시
  }
  const teamRecordsData = loadJson<TeamRecordsData>(
    "src/data/team-records.json",
  );
  const standingsData = loadJson<StandingsData>("src/data/standings.json");
  const resultsData = loadJson<ResultsData>("src/data/results-archive.json");

  const todayStr = todayKstDateStr();
  // 월드컵을 앞에 둬서 무료 quota가 모자라도 월드컵 미리보기가 우선 생성되게 함.
  const targets = [...worldcup.schedules, ...schedule.schedules].filter(
    (s) =>
      s.koreanCommentary === true &&
      // 토너먼트 진출 미확정(미정 vs 미정) 경기는 미리보기 생성 제외
      s.homeTeam !== "미정" &&
      s.awayTeam !== "미정" &&
      inDateRange(s.date, todayStr, DAYS_AHEAD),
  );

  console.log(
    `[insights] today KST=${todayStr}, days_ahead=${DAYS_AHEAD}, target matches: ${targets.length} (KR commentary only)` +
      `${DISABLE_GROUNDING ? " [no-grounding]" : ""}`,
  );

  let created = 0;
  let skipped = 0;
  const skipReasons: Record<string, number> = {};

  for (let i = 0; i < targets.length; i++) {
    if (i > 0) await sleep(SLEEP_MS);
    const match = targets[i];
    const outcome = await generateInsightForMatch(
      {
        schedule: match,
        teamRecords: teamRecordsData.records,
        standingsData,
        resultsArchive: resultsData.results,
      },
      apiKey,
      { force: FORCE_REGEN, disableGrounding: DISABLE_GROUNDING },
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
    path.join(process.cwd(), "src/data/insights-summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );
}

main().catch((err) => {
  console.error("[insights] fatal:", err);
  process.exit(1);
});
