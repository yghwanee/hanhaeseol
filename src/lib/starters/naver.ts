import type { StarterStat } from "@/types/starter";
import { formatInnings } from "./format";

const BASE = "https://api-gw.sports.naver.com";
const HEADERS = {
  Referer: "https://m.sports.naver.com/",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
};

async function naverGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Naver HTTP ${res.status}: ${path}`);
  const json = (await res.json()) as { result?: T };
  if (!json.result) throw new Error(`Naver empty result: ${path}`);
  return json.result;
}

export interface NaverGame {
  gameId: string;
  gameDate: string;
  homeTeamName: string;
  awayTeamName: string;
}

/**
 * 🔴 `size` 를 안 붙이면 네이버는 **10건만** 준다(응답의 `gameTotalCount` 는 전체 수를 알려준다).
 * MLB 는 하루 15경기라 매일 5경기가 조용히 잘려 나갔고, 그 경기들은 선발이 preview 에
 * 멀쩡히 있는데도 `starters.json` 에 안 들어가 화면에 "선발 미발표" 로 떴다.
 * (2026-09-03 실측: mlb 2026-09-03 → games 10 / gameTotalCount 15. 잘린 5건 중 3건이
 *  우리 편성에 있던 컵스·에인절스·다저스 경기다.)
 *
 * `results/naver.ts` 의 `fetchLeagueGames` 는 처음부터 `size=500` 을 붙여 이 문제가 없었다.
 * 같은 상한을 쓴다. 하루치 조회라 500 이면 어떤 리그도 넘지 않는다.
 */
const LIST_SIZE = 500;

export async function fetchGameList(
  categoryId: string,
  fromDate: string,
  toDate: string,
): Promise<NaverGame[]> {
  const r = await naverGet<{ games?: NaverGame[]; gameTotalCount?: number }>(
    `/schedule/games?categoryId=${categoryId}&fromDate=${fromDate}&toDate=${toDate}&size=${LIST_SIZE}`,
  );
  const games = r.games ?? [];
  // 상한을 올려도 잘렸다면 조용히 넘어가지 않는다 — 다시 선발이 통째로 비는 사고가 된다.
  if (typeof r.gameTotalCount === "number" && games.length < r.gameTotalCount) {
    console.warn(
      `[starters] ${categoryId} ${fromDate}: ${games.length}/${r.gameTotalCount} 건만 받았다 (size=${LIST_SIZE})`,
    );
  }
  return games.map((g) => ({
    gameId: g.gameId,
    gameDate: g.gameDate,
    homeTeamName: g.homeTeamName,
    awayTeamName: g.awayTeamName,
  }));
}

interface RawStarter {
  playerInfo?: { name?: string };
  currentSeasonStats?: {
    era?: string;
    inn?: string;
    w?: number;
    l?: number;
    kk?: number;
    whip?: string;
  };
}

// preview의 한 선발 객체 -> StarterStat. 이름 또는 era 없으면 null.
export function parseStarter(raw: RawStarter | null | undefined): StarterStat | null {
  if (!raw) return null;
  const name = raw.playerInfo?.name?.trim();
  const st = raw.currentSeasonStats;
  if (!name || !st || !st.era) return null;
  const out: StarterStat = {
    name,
    era: st.era,
    ip: st.inn ? formatInnings(st.inn) : "",
    w: typeof st.w === "number" ? st.w : 0,
    l: typeof st.l === "number" ? st.l : 0,
    so: typeof st.kk === "number" ? st.kk : 0,
  };
  if (st.whip) out.whip = st.whip;
  return out;
}

export interface GameStarters {
  home: StarterStat | null;
  away: StarterStat | null;
}

export async function fetchStarters(gameId: string): Promise<GameStarters> {
  const r = await naverGet<{
    previewData?: { homeStarter?: RawStarter; awayStarter?: RawStarter };
  }>(`/schedule/games/${gameId}/preview`);
  return {
    home: parseStarter(r.previewData?.homeStarter),
    away: parseStarter(r.previewData?.awayStarter),
  };
}
