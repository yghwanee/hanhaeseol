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
  const teamRecordsData = loadJson<TeamRecordsData>(
    "src/data/team-records.json",
  );
  const standingsData = loadJson<StandingsData>("src/data/standings.json");
  const resultsData = loadJson<ResultsData>("src/data/results-archive.json");

  const todayStr = todayKstDateStr();
  const targets = schedule.schedules.filter(
    (s) =>
      s.koreanCommentary === true &&
      inDateRange(s.date, todayStr, DAYS_AHEAD),
  );

  console.log(
    `[insights] today KST=${todayStr}, days_ahead=${DAYS_AHEAD}, target matches: ${targets.length} (KR commentary only)`,
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
