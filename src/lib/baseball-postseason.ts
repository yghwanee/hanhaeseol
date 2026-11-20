// src/lib/baseball-postseason.ts
//
// 이 야구 경기가 포스트시즌(가을야구)인가 — 히어로 종목 서열에서 축구와 같은 칸으로 올린다.
//
// 🔴 왜 (2026-11-20 화니 지시): 종목 서열을 축구 > 야구 > 농구·배구로 바꾸자 8/1~11/25 시뮬레이션에서
// KBO 포스트시즌(10/27 삼성 vs KIA)과 다저스 포스트시즌 5일이 ACL·네이션스리그·EPL 정규전에 밀렸다.
// 정규시즌은 축구 아래, 포스트시즌은 축구와 같은 서열.
//
// 판정 근거(둘 다 데이터에서, 날짜를 코드에 적지 않는다):
//   - KBO : 네이버 gameId. 정규시즌은 연도로 시작(`20261009SSSK02026`), 포스트시즌은 아니다
//           (`55551030SSHT02026`, 2026-11-20 실측). gameId 는 결과 데이터(results*.json)에서 찾는다.
//   - MLB : MLB StatsAPI 시즌 날짜(`standings.json` 의 `mlbSeason`, 순위 크롤이 매일 받는다).
//           날짜는 미국 기준이고 우리 편성은 KST 라 하루 당겨 비교한다(MLB 경기는 KST 새벽~낮).

import fs from "node:fs";
import path from "node:path";
import type { Schedule } from "@/types/schedule";
import type { ResultsData } from "@/types/results";
import type { StandingsData } from "@/types/standings";
import { findResult } from "./results/lookup";

let resultsCache: ResultsData[] | null = null;
function loadResults(): ResultsData[] {
  if (resultsCache) return resultsCache;
  resultsCache = [];
  for (const f of ["src/data/results.json", "src/data/results-archive.json"]) {
    try {
      resultsCache.push(JSON.parse(fs.readFileSync(path.resolve(f), "utf-8")) as ResultsData);
    } catch {
      /* 없으면 건너뛴다 */
    }
  }
  return resultsCache;
}

let seasonCache: StandingsData["mlbSeason"] | null | undefined;
function loadMlbSeason(): StandingsData["mlbSeason"] | null {
  if (seasonCache !== undefined) return seasonCache;
  try {
    const s = JSON.parse(fs.readFileSync(path.resolve("src/data/standings.json"), "utf-8")) as StandingsData;
    seasonCache = s.mlbSeason ?? null;
  } catch {
    seasonCache = null;
  }
  return seasonCache;
}

/** KBO gameId 가 포스트시즌 것인가(연도로 시작하지 않으면). */
export function isKboPostseasonGameId(gameId: string | undefined, date: string): boolean {
  return Boolean(gameId) && /^\d{4}/.test(gameId!) && !gameId!.startsWith(date.slice(0, 4));
}

/** KST 날짜가 MLB 포스트시즌(미국 날짜) 안인가. */
export function isMlbPostseasonDate(
  kstDate: string,
  season: { postSeasonStartDate: string; postSeasonEndDate: string } | null | undefined,
): boolean {
  if (!season) return false;
  const d = new Date(`${kstDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const us = d.toISOString().slice(0, 10);
  return us >= season.postSeasonStartDate && us <= season.postSeasonEndDate;
}

export function isBaseballPostseason(m: Schedule): boolean {
  if (m.sport !== "야구") return false;
  if (m.league === "MLB") return isMlbPostseasonDate(m.date, loadMlbSeason());
  if (m.league === "KBO") {
    for (const data of loadResults()) {
      const r = findResult(data, m, { fuzzy: false });
      if (r?.gameId) return isKboPostseasonGameId(r.gameId, m.date);
    }
  }
  return false;
}
