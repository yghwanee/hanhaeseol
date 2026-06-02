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

export async function fetchGameList(
  categoryId: string,
  fromDate: string,
  toDate: string,
): Promise<NaverGame[]> {
  const r = await naverGet<{ games?: NaverGame[] }>(
    `/schedule/games?categoryId=${categoryId}&fromDate=${fromDate}&toDate=${toDate}`,
  );
  return (r.games ?? []).map((g) => ({
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
