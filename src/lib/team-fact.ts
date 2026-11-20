// src/lib/team-fact.ts
//
// 선수 주어가 없는 경기(WKBL·야구·선수 기록 못 받음)의 후킹 근거 한 조각.
//
// 🔴 왜 있는가 (2026-11-20 화니 지적): 그때는 문장이 `삼성생명 블루밍스 오늘 한국어 중계` 처럼
// 팀명만 갈아 끼운 틀이었다. 이제 주어를 매치업으로 세우고, 순위표(`src/data/standings.json`,
// 네이버 순위 크롤이 매일 채운다)에서 **검증 가능한 사실 하나**를 붙인다 — `5연승` · `1위`.
// 없으면 붙이지 않는다(지어내지 않는다).
//
// 우선순위: 3연승 이상 > 3연패 이상 > 리그 3위 이내. 연패도 후킹이다(탈출하느냐).
// NBA·MLB 는 순위가 컨퍼런스·지구 기준이라 "1위" 만 떼어 쓰면 틀린 말이 된다 → 연승·연패만.
// 연승·연패는 시즌 첫 경기도 안 치렀으면 의미가 없어 `gameCount/matchesPlayed ≥ 3` 일 때만.

import fs from "node:fs";
import path from "node:path";
import type { Schedule } from "@/types/schedule";
import { categoriesForLeague } from "./results/lookup";
import { resolveTeamNames } from "./korean-players/crawl";

export interface TeamFact {
  /** 사실이 붙는 팀(편성 표기) */
  team: string;
  /** "5연승" · "3연패" · "1위" */
  fact: string;
}

interface StandingRow {
  rank?: number;
  teamName?: string;
  gameCount?: number;
  matchesPlayed?: number;
  streak?: { type?: string; count?: number } | null;
}
interface LeagueStandings {
  id: string;
  teams?: StandingRow[];
}
type StandingsFile = Partial<Record<"soccer" | "baseball" | "basketball" | "volleyball", LeagueStandings[]>>;

const NO_RANK = new Set(["nba", "mlb"]);
const norm = (s: string) => s.replace(/\s+/g, "");

let cache: StandingsFile | null | undefined;
function loadStandings(file: string): StandingsFile | null {
  if (cache !== undefined && file === DEFAULT_FILE) return cache;
  let data: StandingsFile | null = null;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf-8")) as StandingsFile;
  } catch {
    data = null;
  }
  if (file === DEFAULT_FILE) cache = data;
  return data;
}
const DEFAULT_FILE = path.resolve("src/data/standings.json");

/** 한 팀의 사실 한 조각. 없으면 null. */
export function factForTeam(row: StandingRow, leagueId: string): string | null {
  const played = Number(row.gameCount ?? row.matchesPlayed ?? 0);
  const n = Number(row.streak?.count ?? 0);
  if (played >= 3 && n >= 3 && row.streak?.type === "W") return `${n}연승`;
  if (played >= 3 && n >= 3 && row.streak?.type === "L") return `${n}연패`;
  if (!NO_RANK.has(leagueId) && played >= 3 && Number(row.rank) >= 1 && Number(row.rank) <= 3) return `${row.rank}위`;
  return null;
}

/**
 * 편성 팀명과 네이버 팀명이 같은 팀인가. 별칭 표가 먼저고, 없으면 편성 표기가 네이버 표기로
 * **시작**하면 같은 팀으로 본다 — WKBL 은 편성이 `삼성생명 블루밍스`·`신한은행 에스버드` 인데
 * 네이버는 `삼성생명`·`신한은행` 이고 별칭 표가 없다(2026-11-20 실측). 3글자 미만은 접두 비교 안 한다.
 */
export function sameTeam(scheduleLeague: string, scheduleName: string, naverName: string): boolean {
  if (resolveTeamNames(scheduleLeague, naverName).some((n) => norm(n) === norm(scheduleName))) return true;
  const nv = norm(naverName);
  return nv.length >= 3 && norm(scheduleName).startsWith(nv);
}

function findRow(leagues: LeagueStandings[], ids: string[], scheduleLeague: string, team: string): [StandingRow, string] | null {
  for (const id of ids) {
    const lg = leagues.find((l) => l.id === id);
    for (const row of lg?.teams ?? []) {
      if (!row.teamName) continue;
      if (sameTeam(scheduleLeague, team, row.teamName)) return [row, id];
    }
  }
  return null;
}

/**
 * 히어로 경기의 사실 한 조각. `first` 팀(후킹 팀)을 먼저 보고, 없으면 상대 팀.
 * 순위표가 없거나(WKBL 등) 두 팀 다 해당 없으면 null.
 */
export function teamFactFor(hero: Schedule, first: string, file: string = DEFAULT_FILE): TeamFact | null {
  const data = loadStandings(file);
  if (!data) return null;
  const leagues = [...(data.soccer ?? []), ...(data.baseball ?? []), ...(data.basketball ?? []), ...(data.volleyball ?? [])];
  const ids = categoriesForLeague(hero.league);
  if (ids.length === 0) return null;
  const other = first === hero.homeTeam ? hero.awayTeam : hero.homeTeam;
  for (const team of [first, other]) {
    if (!team || team === "미정") continue;
    const hit = findRow(leagues, ids, hero.league, team);
    if (!hit) continue;
    const fact = factForTeam(hit[0], hit[1]);
    if (fact) return { team, fact };
  }
  return null;
}
