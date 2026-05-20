import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import type { ScheduleData } from "@/types/schedule";
import type { TeamRecordsData } from "@/types/team-record";
import type { StandingsData } from "@/types/standings";
import type { ResultsData } from "@/types/results";
import { generateInsightForMatch } from "@/lib/insights/generate";

const DAYS_AHEAD = Number(process.env.INSIGHTS_DAYS_AHEAD ?? "3");
// OpenRouter 무료 한도: 일 200 req, 분당 10 req. 6.5초 간격이면 안전 마진.
const SLEEP_MS = Number(process.env.INSIGHTS_SLEEP_MS ?? "6500");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY is required");
    process.exit(1);
  }

  const schedule = loadJson<ScheduleData>("src/data/schedule.json");
  const teamRecordsData = loadJson<TeamRecordsData>(
    "src/data/team-records.json",
  );
  const standingsData = loadJson<StandingsData>("src/data/standings.json");
  const resultsData = loadJson<ResultsData>("src/data/results-archive.json");

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
