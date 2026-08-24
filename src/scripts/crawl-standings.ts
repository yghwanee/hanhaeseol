import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import {
  BASEBALL_LEAGUES,
  SOCCER_LEAGUES,
  fetchBaseballLeague,
  fetchSoccerLeague,
} from "@/lib/standings/naver";
import { pruneDeadEmblems } from "@/lib/standings/emblem-check";
import type {
  BaseballLeagueStandings,
  SoccerLeagueStandings,
  StandingsData,
} from "@/types/standings";

async function safe<T>(label: string, fn: () => Promise<T | null>): Promise<T | null> {
  try {
    const v = await fn();
    if (v === null) console.log(`  ${label}: (no data)`);
    return v;
  } catch (e) {
    console.error(`  ${label}: ❌ ${(e as Error).message}`);
    return null;
  }
}

async function main() {
  console.log("순위 크롤링 시작");

  console.log("[축구]");
  const soccerResults = await Promise.all(
    SOCCER_LEAGUES.map((m) =>
      safe(m.name, () => fetchSoccerLeague(m)).then((r) => ({ meta: m, data: r })),
    ),
  );
  const soccer: SoccerLeagueStandings[] = [];
  for (const { meta, data } of soccerResults) {
    if (data) {
      soccer.push(data);
      console.log(`  ${meta.name}: ${data.teams.length}팀 (season=${data.season})`);
    }
  }

  console.log("[야구]");
  const baseballResults = await Promise.all(
    BASEBALL_LEAGUES.map((m) =>
      safe(m.name, () => fetchBaseballLeague(m)).then((r) => ({ meta: m, data: r })),
    ),
  );
  const baseball: BaseballLeagueStandings[] = [];
  for (const { meta, data } of baseballResults) {
    if (data) {
      baseball.push(data);
      console.log(`  ${meta.name}: ${data.teams.length}팀 (season=${data.season})`);
    }
  }

  const data: StandingsData = {
    soccer,
    baseball,
    basketball: [], // 다음 단계에서 NBA·KBL 추가
    lastUpdated: new Date().toISOString(),
  };

  // 네이버가 준 앰블럼 URL 중 404 인 것만 null 로 떨군다(근거는 emblem-check.ts 주석).
  // 죽은 URL 을 그대로 두면 화면에 깨진 이미지가 뜨고 /api/emblem 이 502 를 낸다.
  console.log("[앰블럼 검증]");
  const pruned = await pruneDeadEmblems(data);
  console.log(`  ${pruned.checked}개 확인 · 죽은 URL ${pruned.dead.length}개 · ${pruned.cleared}팀 정리`);
  for (const u of pruned.dead) console.log(`    404 ${u}`);

  const jsonStr = JSON.stringify(data, null, 2);
  const srcPath = path.join(process.cwd(), "src/data/standings.json");
  // public 카피본은 더 이상 만들지 않음 — 모든 페이지가 @/data/standings.json만 import.
  await fs.writeFile(srcPath, jsonStr, "utf-8");

  console.log(`완료 → ${srcPath}`);
}

main().catch((err) => {
  console.error("순위 크롤링 실패:", err);
  process.exit(1);
});
