/**
 * 저장된 매치 인사이트 중 "팀 흐름 주장"이 실제 전적과 반대인 글을 지운다.
 *
 * 대상은 **오늘 이후 경기**뿐이다. 지난 경기 글은 쓸 당시의 전적으로 판단해야 하는데
 * 지금 갖고 있는 team-records 는 현재 스냅샷이라 옛 글의 옳고 그름을 못 가린다.
 * 지운 자리는 생성 워크플로가 다시 채운다(이제 같은 검사를 통과해야 저장된다).
 *
 * 사용: npm run prune:bad-insights [-- --apply]
 */
import { readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { deriveFlow, findFormContradictions, streakFromLast5 } from "../lib/insights/form-claim";
import type { Schedule } from "../types/schedule";
import type { TeamRecordsData } from "../types/team-record";
import type { MatchInsight } from "../types/match-insight";

const DIR = path.join(process.cwd(), "src/data/match-insights");
const APPLY = process.argv.includes("--apply");

function todayKst(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

function loadSchedules(): Map<string, Schedule> {
  const map = new Map<string, Schedule>();
  for (const f of ["src/data/schedule.json", "src/data/schedule-archive.json", "src/data/worldcup.json"]) {
    try {
      const j = JSON.parse(readFileSync(f, "utf8")) as { schedules?: Schedule[] };
      for (const s of j.schedules ?? []) if (!map.has(s.id)) map.set(s.id, s);
    } catch {
      // 없으면 건너뛴다
    }
  }
  return map;
}

const schedules = loadSchedules();
const records = (JSON.parse(readFileSync("src/data/team-records.json", "utf8")) as TeamRecordsData)
  .records;
const today = todayKst();

let checked = 0;
const bad: Array<{ file: string; reason: string }> = [];

for (const file of readdirSync(DIR)) {
  if (!file.endsWith(".json")) continue;
  let insight: MatchInsight;
  try {
    insight = JSON.parse(readFileSync(path.join(DIR, file), "utf8")) as MatchInsight;
  } catch {
    bad.push({ file, reason: "깨진 JSON" });
    continue;
  }
  const match = schedules.get(insight.matchId);
  if (!match || match.date < today) continue;
  checked++;

  const leagueRecords = records[match.league] ?? {};
  const flowOf = (team: string) => {
    const rec = leagueRecords[team];
    const streak = rec?.streak ?? streakFromLast5(rec?.last5);
    return deriveFlow(rec?.last5, streak as { type: "W" | "L" | "D"; count: number } | undefined);
  };

  const text = [
    insight.sections.headline,
    insight.sections.recentForm,
    insight.sections.keyMatchup,
    ...insight.sections.watchPoints,
  ].join(" ");

  const hits = findFormContradictions(text, [
    { name: match.homeTeam, flow: flowOf(match.homeTeam) },
    { name: match.awayTeam ?? "", flow: flowOf(match.awayTeam ?? "") },
  ]);
  if (hits.length > 0) {
    bad.push({
      file,
      reason: hits
        .map((h) => `${h.team}: 실제 ${h.actual} ↔ 주장 ${h.claimed} — "${h.sentence}"`)
        .join(" / "),
    });
  }
}

console.log(`검사 ${checked}건(오늘 이후), 폐기 대상 ${bad.length}건`);
for (const b of bad) console.log(`  - ${b.file}\n      ${b.reason}`);
if (!APPLY) {
  console.log("\n(미적용 — 실제로 지우려면 `npm run prune:bad-insights -- --apply`)");
} else {
  for (const b of bad) rmSync(path.join(DIR, b.file));
  console.log(`\n🗑️  ${bad.length}건 삭제 — 생성 워크플로가 다시 채운다.`);
}
