import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fetchGoals } from "@/lib/results/naver";
import { resultKey } from "@/lib/results/lookup";
import type { MatchResult, ResultsData } from "@/types/results";
import type { ScheduleData } from "@/types/schedule";

/**
 * 지난 월드컵 경기의 득점자·득점시간을 results-archive.json(+results.json)에 백필한다.
 * - worldcup.json의 일정 id는 `worldcup-${gameId}` 라 네이버 gameId를 역추출할 수 있다.
 * - 과거 종료 경기(오늘 이전)만 대상. 골이 없으면(0-0 등) 건너뜀.
 * - 월드컵은 팀명이 네이버와 정확히 일치 → key(date|worldcup|home|away)로 바로 매칭.
 */
const KST_TODAY = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

async function readJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

async function writeBoth(rel: string, data: unknown) {
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(path.join(process.cwd(), "src/data", rel), json, "utf-8");
  await fs.writeFile(path.join(process.cwd(), "public", rel), json, "utf-8");
}

/** 한 결과 파일에 goals를 주입(키 매칭). 변경된 건수 반환. byKey/results 모두 갱신. */
function applyGoals(
  data: ResultsData,
  goalsByKey: Map<string, MatchResult["goals"]>,
): number {
  let n = 0;
  const setOn = (r: MatchResult) => {
    const k = resultKey(r.date, r.categoryId, r.homeTeam, r.awayTeam);
    const g = goalsByKey.get(k);
    if (g && g.length > 0) {
      r.goals = g;
      n++;
    }
  };
  for (const r of data.results) setOn(r);
  // byKey는 results와 같은 객체를 참조하지 않을 수 있으니 별도 주입.
  for (const r of Object.values(data.byKey)) setOn(r);
  return n;
}

async function main() {
  const cwd = process.cwd();
  const wc = await readJson<ScheduleData>(path.join(cwd, "public/worldcup.json"));
  if (!wc) {
    console.error("worldcup.json 없음 — 중단");
    process.exit(1);
  }

  // 과거(오늘 이전) 월드컵 경기만, gameId 추출.
  const past = wc.schedules.filter(
    (s) => s.league.startsWith("북중미 월드컵") && s.date < KST_TODAY,
  );
  console.log(`지난 월드컵 경기 ${past.length}건 득점자 조회...`);

  const goalsByKey = new Map<string, MatchResult["goals"]>();
  for (const s of past) {
    const gameId = s.id.replace(/^worldcup-/, "");
    try {
      const goals = await fetchGoals(gameId);
      if (goals.length > 0) {
        goalsByKey.set(resultKey(s.date, "worldcup", s.homeTeam, s.awayTeam), goals);
        console.log(`  ✓ ${s.date} ${s.homeTeam} ${s.awayTeam} — 득점 ${goals.length}`);
      }
    } catch (e) {
      console.error(`  ✗ ${s.date} ${s.homeTeam} ${s.awayTeam}: ${(e as Error).message}`);
    }
  }
  console.log(`득점 있는 경기 ${goalsByKey.size}건`);

  for (const rel of ["results-archive.json", "results.json"]) {
    const data = await readJson<ResultsData>(path.join(cwd, "public", rel));
    if (!data) {
      console.log(`  - ${rel} 없음, 건너뜀`);
      continue;
    }
    const n = applyGoals(data, goalsByKey);
    await writeBoth(rel, data);
    console.log(`  → ${rel}: ${n}건 주입`);
  }
  console.log("백필 완료");
}

main().catch((err) => {
  console.error("백필 실패:", err);
  process.exit(1);
});
