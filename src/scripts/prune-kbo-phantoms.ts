/**
 * 시리즈가 끝나 열리지 않는 KBO 포스트시즌 경기를 `schedule.json` 에서 뺀다.
 *
 * 🔴 왜 (2026-10-22): 티빙은 「필요 시 개최」 4·5차전을 그날까지 편성에 남겨 둔다. 사이트는
 * 읽을 때 걸러 내지만, 푸시 발송(`/api/push/dispatch`)·소셜 게시는 레포의 `schedule.json` 을
 * 그대로 읽어서 찜한 팀 팬에게 열리지도 않을 경기의 「경기 예고」가 갈 수 있었다.
 * 그래서 원본에서 뺀다. 편성 크롤(`crawl.ts`)이 끝날 때, 그리고 결과 크롤 직후(시리즈가
 * 끝난 바로 그 시점) 돈다. 아카이브는 건드리지 않는다 — 매치 페이지가 그 행으로
 * 「열리지 않은 경기」 안내를 띄운다.
 */
import fs from "node:fs";
import path from "node:path";
import type { Schedule, ScheduleData } from "@/types/schedule";
import type { ResultsData } from "@/types/results";
import type { StandingsData } from "@/types/standings";
import { kboPhantomKeysFrom, phantomKey } from "@/lib/kbo-postseason";
import { findResult } from "@/lib/results/lookup";

const root = process.cwd();
const readJson = <T>(rel: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8")) as T;
  } catch {
    return null;
  }
};

export function pruneKboPhantoms(): number {
  const schedule = readJson<ScheduleData>("src/data/schedule.json");
  const standings = readJson<StandingsData>("src/data/standings.json");
  if (!schedule || !standings) return 0;
  const kbo = standings.baseball?.find((l) => l.id === "kbo");
  const archived = readJson<{ schedules: Schedule[] }>("src/data/schedule-archive.json")?.schedules ?? [];
  const results = readJson<ResultsData>("src/data/results.json");
  const archive = readJson<ResultsData>("src/data/results-archive.json");
  const phantoms = kboPhantomKeysFrom(
    [...archived, ...schedule.schedules],
    kbo?.teams ?? [],
    kbo?.season ?? new Date().getFullYear().toString(),
    (s) => findResult(archive, s) ?? findResult(results, s),
  );
  const before = schedule.schedules.length;
  const kept = schedule.schedules.filter((s) => !phantoms.has(phantomKey(s)));
  const removed = before - kept.length;
  if (removed === 0) return 0;
  for (const s of schedule.schedules) {
    if (phantoms.has(phantomKey(s))) console.log(`  ⊘ 미개최 KBO 경기 제외: ${s.platform} ${s.date} ${s.time} ${s.homeTeam} vs ${s.awayTeam}`);
  }
  const out = JSON.stringify({ ...schedule, schedules: kept }, null, 2);
  fs.writeFileSync(path.join(root, "src/data/schedule.json"), out, "utf8");
  fs.writeFileSync(path.join(root, "public/schedule.json"), out, "utf8");
  return removed;
}

if (process.argv[1] && /prune-kbo-phantoms/.test(process.argv[1])) {
  console.log(`[prune-kbo-phantoms] removed ${pruneKboPhantoms()}`);
}
