import type {
  BaseballLeagueId,
  BaseballLeagueStandings,
  BaseballStanding,
  SoccerLeagueId,
  SoccerLeagueStandings,
  SoccerStanding,
  StreakInfo,
} from "@/types/standings";
import { MLS_CONFERENCE } from "./mls-conferences";

const BASE = "https://api-gw.sports.naver.com";
const HEADERS = {
  Referer: "https://m.sports.naver.com/",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
};

interface NaverApiResponse<T> {
  code: number;
  success: boolean;
  result?: T;
}

interface NaverSeason {
  seasonCode: string;
  isSeason: "Y" | "N";
}

async function naverGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Naver HTTP ${res.status}: ${path}`);
  const json = (await res.json()) as NaverApiResponse<T>;
  if (!json.success || !json.result) throw new Error(`Naver API failed: ${path}`);
  return json.result;
}

async function fetchCurrentSeasonCode(categoryId: string): Promise<string | null> {
  const r = await naverGet<{ seasons?: NaverSeason[] }>(
    `/statistics/categories/${categoryId}/seasons`,
  );
  const seasons = r.seasons ?? [];
  if (!seasons.length) return null;
  const current = seasons.find((s) => s.isSeason === "Y");
  return current?.seasonCode ?? seasons[seasons.length - 1].seasonCode;
}

function parseStreak(raw?: string | null): StreakInfo | null {
  if (!raw) return null;
  const m = raw.match(/^(\d+)(승|패|무)$/);
  if (!m) return null;
  const type = m[2] === "승" ? "W" : m[2] === "패" ? "L" : "D";
  return { type, count: parseInt(m[1], 10) };
}

function streakFromLastFive(lastFive?: string | null): StreakInfo {
  if (!lastFive || lastFive.length === 0) return { type: "W", count: 0 };
  const first = lastFive[0];
  let count = 1;
  for (let i = 1; i < lastFive.length; i++) {
    if (lastFive[i] === first) count++;
    else break;
  }
  const type: StreakInfo["type"] = first === "W" ? "W" : first === "L" ? "L" : "D";
  return { type, count };
}

// ── 축구 ─────────────────────────────────────────────────────────────

interface NaverSoccerTeam {
  teamName: string;
  teamEmblemUrl?: string | null;
  rank: number;
  rankStatus?: string | null;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  goalsConceded: number;
  goalsDifference: number;
  points: number;
  lastFiveGames?: string | null;
  /** MLS만: "EAST" | "WEST" */
  league?: string | null;
}

export interface SoccerLeagueMeta {
  id: SoccerLeagueId;
  /** 네이버 categoryId */
  categoryId: string;
  /** 사이트 내 표시 이름 */
  name: string;
  /** 사이트 내 편성표 슬러그(/league/{slug}) — 있으면 "편성표로 가기" 버튼에서 사용 */
  scheduleSlug?: string;
}

/** 사용자에게 보여줄 순서. 시청자 풀 큰 순. */
export const SOCCER_LEAGUES: SoccerLeagueMeta[] = [
  { id: "epl", categoryId: "epl", name: "프리미어리그", scheduleSlug: "epl" },
  { id: "primera", categoryId: "primera", name: "라리가", scheduleSlug: "laliga" },
  { id: "bundesliga", categoryId: "bundesliga", name: "분데스리가", scheduleSlug: "bundesliga" },
  { id: "seria", categoryId: "seria", name: "세리에A", scheduleSlug: "serie-a" },
  { id: "ligue1", categoryId: "ligue1", name: "리그앙", scheduleSlug: "ligue-1" },
  { id: "champs", categoryId: "champs", name: "챔피언스리그", scheduleSlug: "ucl" },
  { id: "europa", categoryId: "europa", name: "유로파리그", scheduleSlug: "uel" },
  { id: "mls", categoryId: "mls", name: "MLS", scheduleSlug: "mls" },
  { id: "kleague", categoryId: "kleague", name: "K리그", scheduleSlug: "k-league-1" },
  { id: "kleague2", categoryId: "kleague2", name: "K리그2", scheduleSlug: "k-league-2" },
  { id: "eredivisie", categoryId: "eredivisie", name: "에레디비시" },
];

export async function fetchSoccerLeague(
  meta: SoccerLeagueMeta,
): Promise<SoccerLeagueStandings | null> {
  const seasonCode = await fetchCurrentSeasonCode(meta.categoryId);
  if (!seasonCode) return null;

  const r = await naverGet<{ seasonTeamStats?: NaverSoccerTeam[] }>(
    `/statistics/categories/${meta.categoryId}/seasons/${seasonCode}/teams`,
  );
  const stats = r.seasonTeamStats ?? [];
  if (stats.length === 0) return null;

  const teams: SoccerStanding[] = stats
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((t) => {
      // MLS는 컨퍼런스(EAST/WEST)별 분리 표시. 네이버 league 필드 우선, 없으면 팀명 매핑.
      const conference =
        meta.id === "mls"
          ? t.league ?? MLS_CONFERENCE[t.teamName] ?? undefined
          : undefined;
      return {
        rank: t.rank,
        teamName: t.teamName,
        teamLogo: t.teamEmblemUrl ?? null,
        matchesPlayed: t.matchesPlayed,
        wins: t.wins,
        draws: t.draws,
        losses: t.losses,
        goals: t.goals,
        goalsConceded: t.goalsConceded,
        goalsDifference: t.goalsDifference,
        points: t.points,
        lastFive: t.lastFiveGames ?? "",
        streak: streakFromLastFive(t.lastFiveGames),
        rankStatus: t.rankStatus ?? null,
        ...(conference ? { conference } : {}),
      };
    });

  return {
    id: meta.id,
    name: meta.name,
    scheduleSlug: meta.scheduleSlug,
    season: seasonCode,
    teams,
  };
}

// ── 야구 ─────────────────────────────────────────────────────────────

interface NaverKboTeam {
  teamName: string;
  teamImageUrl?: string | null;
  ranking: number;
  gameCount: number;
  winGameCount: number;
  drawnGameCount: number;
  loseGameCount: number;
  wra: number;
  gameBehind: number;
  continuousGameResult?: string | null;
  lastFiveGames?: string | null;
  /** MLB만: "AL" | "NL" */
  league?: string | null;
  /** MLB만: "EAST" | "CENTRAL" | "WEST" */
  division?: string | null;
}

export interface BaseballLeagueMeta {
  id: BaseballLeagueId;
  categoryId: string;
  name: string;
  scheduleSlug?: string;
}

export const BASEBALL_LEAGUES: BaseballLeagueMeta[] = [
  { id: "kbo", categoryId: "kbo", name: "KBO" },
  { id: "mlb", categoryId: "mlb", name: "MLB", scheduleSlug: "mlb" },
];

export async function fetchBaseballLeague(
  meta: BaseballLeagueMeta,
): Promise<BaseballLeagueStandings | null> {
  const seasonCode = await fetchCurrentSeasonCode(meta.categoryId);
  if (!seasonCode) return null;

  const r = await naverGet<{ seasonTeamStats?: NaverKboTeam[] }>(
    `/statistics/categories/${meta.categoryId}/seasons/${seasonCode}/teams`,
  );
  const stats = r.seasonTeamStats ?? [];
  if (stats.length === 0) return null;

  // KBO/MLB 모두 네이버 lastFive는 [오래된→최근] 순서이므로 reverse하여 [최근→오래된]으로 통일.
  // MLB는 league(AL/NL) + division(EAST/CENTRAL/WEST) 정보가 같이 옴 → 그대로 보존하여 UI에서 지구별로 표시.
  const teams: BaseballStanding[] = stats
    .slice()
    .sort((a, b) => a.ranking - b.ranking)
    .map((t) => {
      const last5Raw = t.lastFiveGames ?? "";
      const lastFive = last5Raw.split("").reverse().join("");
      return {
        rank: t.ranking,
        teamName: t.teamName,
        teamLogo: t.teamImageUrl ?? null,
        gameCount: t.gameCount,
        win: t.winGameCount,
        draw: t.drawnGameCount,
        lose: t.loseGameCount,
        winRate: t.wra,
        gameBehind: t.gameBehind,
        lastFive,
        streak: parseStreak(t.continuousGameResult) ?? streakFromLastFive(lastFive),
        ...(t.league ? { league: t.league } : {}),
        ...(t.division ? { division: t.division } : {}),
      };
    });

  return {
    id: meta.id,
    name: meta.name,
    scheduleSlug: meta.scheduleSlug,
    season: seasonCode,
    teams,
  };
}
