/**
 * 토픽 글 사실 게이트(auto-publish-draft.yml). 인자로 받은 글에서 이미 끝난 KBO 포스트시즌
 * 시리즈를 진행 중으로 쓴 문장을 찾는다. 하나라도 있으면 exit 1(머지 안 함 + 텔레그램).
 * 근거는 `src/lib/guides/fact-check.ts`.
 */
import fs from "node:fs";
import path from "node:path";
import type { Schedule } from "@/types/schedule";
import type { ResultsData } from "@/types/results";
import type { StandingsData } from "@/types/standings";
import { postseasonGames, postseasonSeeds, seriesStatuses } from "@/lib/kbo-postseason";
import { findResult } from "@/lib/results/lookup";
import { staleSeriesClaims } from "@/lib/guides/fact-check";

const read = <T>(rel: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), rel), "utf8")) as T;
  } catch {
    return null;
  }
};

const files = process.argv.slice(2);
const standings = read<StandingsData>("src/data/standings.json");
const kbo = standings?.baseball?.find((l) => l.id === "kbo");
const teams = kbo?.teams ?? [];
const schedules = [
  ...(read<{ schedules: Schedule[] }>("src/data/schedule-archive.json")?.schedules ?? []),
  ...(read<{ schedules: Schedule[] }>("src/data/schedule.json")?.schedules ?? []),
];
const results = read<ResultsData>("src/data/results.json");
const archive = read<ResultsData>("src/data/results-archive.json");
const seedOf = new Map(postseasonSeeds(teams).map((t) => [t.teamName, t.rank]));
const statuses = seriesStatuses(
  postseasonGames(schedules, teams, kbo?.season ?? new Date().getFullYear().toString()),
  seedOf,
  (g) => findResult(archive, g.schedule) ?? findResult(results, g.schedule),
);

let bad = 0;
for (const f of files) {
  const claims = staleSeriesClaims(fs.readFileSync(f, "utf8"), statuses);
  for (const c of claims) console.log(`✗ ${path.basename(f)}: ${c}`);
  bad += claims.length;
}
console.log(bad === 0 ? `사실 게이트 통과 (${files.length}편)` : `사실 게이트 실패 ${bad}건`);
process.exit(bad === 0 ? 0 : 1);
