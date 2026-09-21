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
  AG_SPORTS,
  agSportsFile,
  type AgGame,
  type AgSportsData,
  crawlDates,
  rankMedals,
  toAgGame,
  type AsianGamesData,
} from "@/lib/asian-games/data";

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
  // 종목별 페이지(`/asian-games/[sport]`)용 — 그 종목 전 경기. 한국 경기만이 아니다.
  const sportGames: Record<string, AgGame[]> = Object.fromEntries(AG_SPORTS.map((s) => [s.slug, []]));
  for (const d of crawlDates()) {
    // 🔴 하루 경기가 500건을 넘는 날이 있다(10/02 532건). `pageSize` 상한이 500 이라
    // 한 번에 다 안 온다 → `page` 를 넘기며 `totalCount` 만큼 받는다.
    // 처음엔 pageSize=300 한 번이라 300건 넘는 9일치의 뒤쪽 경기가 잘렸다.
    const all: Record<string, unknown>[] = [];
    for (let page = 1; page <= 10; page++) {
      const { games, totalCount } = await get<{ games: Record<string, unknown>[]; totalCount: number }>(
        `/games?fromDate=${d}&toDate=${d}&sort=dateAsc&fields=all&pageSize=500&page=${page}`,
      );
      all.push(...(games ?? []));
      if (!games?.length || all.length >= (totalCount ?? 0)) break;
    }
    // 🔴 `isKorean=Y` 는 무시된다(주든 안 주든 9/21 255건 동일, 2026-09-14 실측).
    // 경기마다 붙는 `koreaPlayer` 로 거른다. 전 기간 대조에서 KOR 팀·한국 선수가 있는데
    // koreaPlayer 가 false 인 경기는 0건이었다.
    // 🔴 `koreanPlayers`(한국 선수 이름)가 붙은 경기도 한국 경기다 — 개인 종목은 `koreaPlayer`
    // 플래그보다 이름이 먼저 채워지는 경우가 있다.
    koreaGames.push(
      ...all
        .filter((g) => g.koreaPlayer === true || (Array.isArray(g.koreanPlayers) && g.koreanPlayers.length > 0))
        .map(toAgGame),
    );
    for (const sp of AG_SPORTS) {
      sportGames[sp.slug].push(
        ...all.filter((g) => sp.disciplines.includes(g.disciplineName as string)).map(toAgGame),
      );
    }
  }

  const data: AsianGamesData = {
    lastUpdated: new Date().toISOString(),
    medals,
    korea,
    koreaGames,
  };

  // 🔴 한 종목이라도 0건이면 그 종목 파일은 덮어쓰지 않는다 — 네이버가 한 날짜를 빈 응답으로
  // 주면 그 종목 페이지가 「일정 없음」으로 커밋된다. 종목마다 따로 판정한다.
  const stamp = new Date().toISOString();
  const wrote: string[] = [];
  for (const sp of AG_SPORTS) {
    const games = sportGames[sp.slug];
    if (games.length === 0) {
      console.error(`종목 ${sp.name} 경기가 0건 — 기존 파일을 유지한다.`);
      continue;
    }
    const file = path.join(process.cwd(), "public", agSportsFile(sp.slug));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const data: AgSportsData = { lastUpdated: stamp, games };
    fs.writeFileSync(file, JSON.stringify(data));
    wrote.push(`${sp.name} ${games.length}(${(fs.statSync(file).size / 1024).toFixed(0)}KB)`);
  }
  console.log(`종목별: ${wrote.join(" · ")}`);

  const out = path.join(process.cwd(), "public", "asian-games.json");
  fs.writeFileSync(out, JSON.stringify(data));
  console.log(
    `아시안게임: 국가 ${medals.length} · 메달 합계 ${medals.reduce((a, m) => a + m.total, 0)} · ` +
      `한국 ${korea ? `${korea.rank}위 금${korea.gold} 은${korea.silver} 동${korea.bronze}` : "없음"} · ` +
      `한국 경기 ${koreaGames.length}건(${crawlDates().length}일) · ${(fs.statSync(out).size / 1024).toFixed(1)}KB`,
  );
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
});
