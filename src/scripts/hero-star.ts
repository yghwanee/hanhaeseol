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
import {
  HERO_STAR_PATH,
  soccerStarFromSeason,
  starFromPreview,
  type HeroStar,
  type StarPick,
} from "@/lib/hero-star";

const norm = (s: string) => s.replace(/\s+/g, "");

function readResults(): ResultsData | null {
  try {
    return JSON.parse(fs.readFileSync(path.resolve("src/data/results.json"), "utf-8")) as ResultsData;
  } catch {
    return null;
  }
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
    if (!r?.gameId) return console.log(`ℹ️ ${tag} — 네이버 경기 ID 없음(결과 크롤 창 밖), 팀명 주어로`);
    // 네이버의 홈/원정이 편성과 반대인 리그가 있다(findResult 가 뒤집어 돌려준다).
    const flipped =
      !cats.some((c) => results?.byKey[resultKey(hero.date, c, hero.homeTeam, hero.awayTeam!)]) &&
      cats.some((c) => results?.byKey[resultKey(hero.date, c, hero.awayTeam!, hero.homeTeam)]);
    const naverSide = flipped ? (teamSide === "home" ? "away" : "home") : teamSide;
    const p = await naverGet<{ previewData?: unknown }>(`/schedule/games/${r.gameId}/preview`);
    pick = starFromPreview(hero.sport, p.previewData, naverSide);
    source = `naver preview ${r.gameId} ${naverSide}`;
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
