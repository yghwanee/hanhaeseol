/**
 * 2026 아이치·나고야 아시안게임 메달 순위 + 한국 경기 일정 크롤.
 *
 *   npm run crawl:asian-games
 *
 * 결과 = `public/asian-games.json`. `crawl-results.yml` 이 매시 돌리고 커밋한다.
 * 페이지는 이 파일을 배포 시점에 서버 렌더하고, 브라우저는 GitHub raw 에서 최신본을 받는다.
 *
 * 🔴 메달 목록이 비면 파일을 **덮어쓰지 않고** 실패한다. 네이버가 잠깐 빈 응답을 주면
 * 순위표가 통째로 사라진 채 커밋되기 때문이다.
 */
import fs from "fs";
import path from "path";
import {
  AG_EVENT,
  crawlDates,
  rankMedals,
  toAgGame,
  type AsianGamesData,
} from "@/lib/asian-games/data";
import { getTodayString } from "@/lib/schedule-utils";

const API = `https://api-gw.sports.naver.com/olympic/${AG_EVENT}`;
const HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Referer: "https://m.sports.naver.com/",
  Accept: "application/json",
};

async function get<T>(pathname: string): Promise<T> {
  const res = await fetch(`${API}${pathname}`, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${pathname} → HTTP ${res.status}`);
  const json = (await res.json()) as { success?: boolean; result?: T };
  if (!json.success || !json.result) throw new Error(`${pathname} → success=false`);
  return json.result;
}

type RawCountry = {
  countryId: string;
  countryName: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  discipline?: { disciplineName: string; gold: number; silver: number; bronze: number; total: number }[];
};

async function main(): Promise<void> {
  const today = getTodayString();

  const { countries } = await get<{ countries: RawCountry[] }>(
    "/countries?disciplineMedal=true&sort=goldMedal",
  );
  if (!Array.isArray(countries) || countries.length === 0) {
    throw new Error("메달 국가 목록이 비었다 — 기존 파일을 유지하고 실패한다.");
  }
  const medals = rankMedals(
    countries.map((c) => ({
      countryId: c.countryId,
      countryName: c.countryName,
      gold: c.gold ?? 0,
      silver: c.silver ?? 0,
      bronze: c.bronze ?? 0,
      total: c.total ?? 0,
    })),
  );

  const kor = medals.find((m) => m.countryId === "KOR");
  const korRaw = countries.find((c) => c.countryId === "KOR");
  const korea = kor
    ? {
        rank: kor.rank,
        gold: kor.gold,
        silver: kor.silver,
        bronze: kor.bronze,
        total: kor.total,
        disciplines: (korRaw?.discipline ?? [])
          .map((d) => ({ name: d.disciplineName, gold: d.gold, silver: d.silver, bronze: d.bronze, total: d.total }))
          .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze),
      }
    : null;

  const koreaGames = [];
  for (const d of crawlDates(today)) {
    const { games } = await get<{ games: Record<string, unknown>[] }>(
      `/games?fromDate=${d}&toDate=${d}&isKorean=Y&sort=dateAsc&fields=all&pageSize=300`,
    );
    // 🔴 `isKorean=Y` 만으로는 안 좁혀진다 — 하루 60경기씩 한국과 무관한 경기까지 온다
    // (2026-09-14 첫 실행 502건 · 122KB). 경기마다 붙는 `koreaPlayer` 로 한 번 더 거른다.
    koreaGames.push(...(games ?? []).filter((g) => g.koreaPlayer === true).map(toAgGame));
  }

  const data: AsianGamesData = {
    lastUpdated: new Date().toISOString(),
    medals,
    korea,
    koreaGames,
  };

  const out = path.join(process.cwd(), "public", "asian-games.json");
  fs.writeFileSync(out, JSON.stringify(data));
  console.log(
    `아시안게임: 국가 ${medals.length} · 메달 합계 ${medals.reduce((a, m) => a + m.total, 0)} · ` +
      `한국 ${korea ? `${korea.rank}위 금${korea.gold} 은${korea.silver} 동${korea.bronze}` : "없음"} · ` +
      `한국 경기 ${koreaGames.length}건(${crawlDates(today).join(",")}) · ${(fs.statSync(out).size / 1024).toFixed(1)}KB`,
  );
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
});
