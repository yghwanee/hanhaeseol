// src/scripts/hero-star.ts
//
// 이번 게시의 히어로 경기에서 "팀 대표 선수"를 네이버 시즌 기록으로 받아
// generated/instagram/hero-star.json 에 쓴다. 제목·캡션·커버 후킹의 주어가 된다.
// 규칙과 근거는 src/lib/hero-star.ts.
//
// 실행: NODE_OPTIONS=--import=./tools/naver-browser-preload.mjs npm run hero:star
// 실패해도 게시는 막지 않는다(워크플로 continue-on-error) — 파일이 없으면 팀명 주어로 돌아간다.

import fs from "node:fs";
import path from "node:path";
import type { ResultsData } from "@/types/results";
import { findKoreanPlayerOnMatch, getKstToday, pickHeroForDate } from "@/lib/instagram";
import { nationalEventFor } from "@/lib/national-event";
import { pickHeadliner } from "@/lib/cover-hook";
import { categoriesForLeague, findResult, resultKey } from "@/lib/results/lookup";
import { naverGet } from "@/lib/naver-fetch";
import { resolveTeamNames } from "@/lib/korean-players/crawl";
import { sameTeam } from "@/lib/team-fact";
import {
  HERO_STAR_PATH,
  soccerStarFromSeason,
  starFromPreview,
  starFromRecord,
  type HeroStar,
  type StarPick,
} from "@/lib/hero-star";

const norm = (s: string) => s.replace(/\s+/g, "");

function readResults(file = "src/data/results.json"): ResultsData | null {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(file), "utf-8")) as ResultsData;
  } catch {
    return null;
  }
}

/**
 * 그 팀의 직전 종료 경기(히어로 날짜보다 앞). 결과 창(어제~내일) + 아카이브를 같이 본다.
 * 반환 side 는 네이버 기준(결과 키의 홈/원정 순서가 네이버 순서다).
 */
function lastFinishedGame(
  cats: string[],
  league: string,
  team: string,
  before: string,
): { gameId: string; side: "home" | "away"; date: string } | null {
  let best: { gameId: string; side: "home" | "away"; date: string } | null = null;
  for (const data of [readResults(), readResults("src/data/results-archive.json")]) {
    for (const [key, r] of Object.entries(data?.byKey ?? {})) {
      const [date, cat, home, away] = key.split("|");
      if (!cats.includes(cat) || date >= before || r.status !== "finished" || !r.gameId) continue;
      const side = sameTeam(league, team, home) ? "home" : sameTeam(league, team, away) ? "away" : null;
      if (!side) continue;
      if (!best || date > best.date) best = { gameId: r.gameId, side, date };
    }
  }
  return best;
}

interface NaverGameLite {
  gameId?: string;
  gameDate?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  statusCode?: string;
}

const shiftDate = (d: string, days: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
};

async function naverGames(cat: string, from: string, to: string): Promise<NaverGameLite[]> {
  const r = await naverGet<{ games?: NaverGameLite[] }>(
    `/schedule/games?categoryId=${cat}&fromDate=${from}&toDate=${to}&size=500`,
  );
  return r.games ?? [];
}

/**
 * 🔴 결과 크롤이 죽어 results.json 에 경기 ID 가 없을 때 네이버 일정에서 직접 찾는다(2026-11-20).
 * 11/16~11/20 결과 크롤이 나흘 죽었을 때 KBL·NBA 가 조용히 팀명 주어로 떨어졌다.
 * 두 팀이 같은 경기만, 그런 경기가 딱 하나일 때만 쓴다. 홈/원정이 뒤집혀 있으면 flipped.
 */
async function naverGameFor(
  cats: string[],
  league: string,
  date: string,
  home: string,
  away: string,
): Promise<{ gameId: string; flipped: boolean } | null> {
  for (const cat of cats) {
    const hits: { gameId: string; flipped: boolean }[] = [];
    for (const g of await naverGames(cat, date, date)) {
      if (!g.gameId || !g.homeTeamName || !g.awayTeamName) continue;
      if (sameTeam(league, home, g.homeTeamName) && sameTeam(league, away, g.awayTeamName)) hits.push({ gameId: g.gameId, flipped: false });
      else if (sameTeam(league, home, g.awayTeamName) && sameTeam(league, away, g.homeTeamName)) hits.push({ gameId: g.gameId, flipped: true });
    }
    if (hits.length === 1) return hits[0];
  }
  return null;
}

/** 결과 데이터에 직전 경기가 없을 때 네이버 일정에서 최근 14일을 직접 본다. */
async function naverLastFinished(
  cats: string[],
  league: string,
  team: string,
  before: string,
): Promise<{ gameId: string; side: "home" | "away"; date: string } | null> {
  let best: { gameId: string; side: "home" | "away"; date: string } | null = null;
  for (const cat of cats) {
    for (const g of await naverGames(cat, shiftDate(before, -14), shiftDate(before, -1))) {
      if (!g.gameId || g.statusCode !== "RESULT" || !g.gameDate) continue;
      const side = g.homeTeamName && sameTeam(league, team, g.homeTeamName) ? "home"
        : g.awayTeamName && sameTeam(league, team, g.awayTeamName) ? "away" : null;
      if (!side) continue;
      const date = g.gameDate.length === 8 ? `${g.gameDate.slice(0, 4)}-${g.gameDate.slice(4, 6)}-${g.gameDate.slice(6)}` : g.gameDate;
      if (!best || date > best.date) best = { gameId: g.gameId, side, date };
    }
  }
  return best;
}

async function currentSeasonCode(categoryId: string): Promise<string | null> {
  const r = await naverGet<{ seasons?: { seasonCode: string; isSeason: "Y" | "N" }[] }>(
    `/statistics/categories/${categoryId}/seasons`,
  );
  const seasons = r.seasons ?? [];
  if (!seasons.length) return null;
  return (seasons.find((s) => s.isSeason === "Y") ?? seasons[seasons.length - 1]).seasonCode;
}

async function main() {
  // 이전 실행의 파일은 먼저 지운다 — 실패했을 때 어제 선수가 남아 있으면 안 된다.
  fs.rmSync(HERO_STAR_PATH, { force: true });

  // --date=YYYY-MM-DD 는 점검용(게시 워크플로는 안 넘긴다 — 게시 대상 날짜와 같은 계산을 쓴다).
  const dateArg = process.argv.find((a) => a.startsWith("--date="))?.slice(7);
  const today = dateArg ?? getKstToday().today;
  const hero = pickHeroForDate(today);
  if (!hero || !hero.awayTeam) return console.log(`ℹ️ ${today} 히어로 없음 — 건너뜀`);
  const tag = `${today} ${hero.league} ${hero.homeTeam} vs ${hero.awayTeam}`;

  // 주어가 이미 정해진 경기는 받지 않는다(대표팀 = 대한민국, 코리안리거 = 그 선수).
  if (nationalEventFor(hero)) return console.log(`ℹ️ ${tag} — 대표팀 경기, 건너뜀`);
  if (findKoreanPlayerOnMatch(hero.homeTeam, hero.awayTeam)) return console.log(`ℹ️ ${tag} — 코리안리거 경기, 건너뜀`);

  const team = pickHeadliner(hero.homeTeam, hero.awayTeam);
  const teamSide: "home" | "away" = team === hero.homeTeam ? "home" : "away";
  const cats = categoriesForLeague(hero.league);
  if (cats.length === 0) return console.log(`ℹ️ ${tag} — 네이버 대회 매핑 없음, 팀명 주어로`);

  let pick: StarPick | null = null;
  let source = "";

  if (hero.sport === "축구") {
    const cat = cats[0];
    const season = await currentSeasonCode(cat);
    if (season) {
      const r = await naverGet<{ seasonPlayerStats?: unknown[] }>(
        `/statistics/categories/${cat}/seasons/${season}/players?pageSize=500`,
      );
      pick = soccerStarFromSeason(r.seasonPlayerStats ?? [], (naverTeam) =>
        resolveTeamNames(hero.league, naverTeam).some((n) => norm(n) === norm(team)),
      );
      source = `naver statistics ${cat}/${season}`;
    }
  } else {
    const results = readResults();
    const r = findResult(results, hero);
    let game: { gameId: string; flipped: boolean } | null = null;
    if (r?.gameId) {
      // 네이버의 홈/원정이 편성과 반대인 리그가 있다(findResult 가 뒤집어 돌려준다).
      const flipped =
        !cats.some((c) => results?.byKey[resultKey(hero.date, c, hero.homeTeam, hero.awayTeam!)]) &&
        cats.some((c) => results?.byKey[resultKey(hero.date, c, hero.awayTeam!, hero.homeTeam)]);
      game = { gameId: r.gameId, flipped };
    } else {
      game = await naverGameFor(cats, hero.league, hero.date, hero.homeTeam, hero.awayTeam);
      if (game) console.log(`ℹ️ 결과 데이터에 경기 ID 없음 → 네이버 일정에서 직접 찾음 ${game.gameId}`);
    }
    if (game) {
      const naverSide = game.flipped ? (teamSide === "home" ? "away" : "home") : teamSide;
      const p = await naverGet<{ previewData?: unknown }>(`/schedule/games/${game.gameId}/preview`);
      pick = starFromPreview(hero.sport, p.previewData, naverSide);
      source = `naver preview ${game.gameId} ${naverSide}`;
    }
    // 🔴 WKBL 은 프리뷰가 비어 있다(previewData: null, 2026-11-20 실측) → 그 팀 직전 경기 득점 1위.
    if (!pick && hero.sport === "농구") {
      const last =
        lastFinishedGame(cats, hero.league, team, hero.date) ??
        (await naverLastFinished(cats, hero.league, team, hero.date));
      if (last) {
        const rec = await naverGet<{ recordData?: unknown }>(`/schedule/games/${last.gameId}/record`);
        pick = starFromRecord(rec.recordData, last.side);
        source = `naver record ${last.gameId}(${last.date}) ${last.side}`;
      }
    }
  }

  if (!pick) return console.log(`ℹ️ ${tag} — ${team} 대표 선수 기록 없음(${source || "n/a"}), 팀명 주어로`);

  const star: HeroStar = {
    date: hero.date,
    home: hero.homeTeam,
    away: hero.awayTeam,
    name: pick.name,
    team,
    stat: pick.stat,
    source,
  };
  fs.mkdirSync(path.dirname(HERO_STAR_PATH), { recursive: true });
  fs.writeFileSync(HERO_STAR_PATH, JSON.stringify(star, null, 2));
  console.log(`⭐ ${tag} → ${star.name} (${star.team}, ${star.stat}) · ${source}`);
}

main().catch((e) => {
  // 게시를 막지 않는다. 파일이 없으면 팀명 주어로 돌아간다.
  console.error("⚠️ hero-star 실패 — 팀명 주어로 진행:", (e as Error).message);
  process.exit(0);
});
