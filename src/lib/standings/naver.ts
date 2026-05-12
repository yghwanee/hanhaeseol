import type {
  EplStanding,
  KboStanding,
  StreakInfo,
} from "@/types/standings";

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

/** "1패"/"6승"/"3무" → { type, count }. 야구는 네이버가 채워줌. */
function parseStreak(raw?: string | null): StreakInfo | null {
  if (!raw) return null;
  const m = raw.match(/^(\d+)(승|패|무)$/);
  if (!m) return null;
  const type = m[2] === "승" ? "W" : m[2] === "패" ? "L" : "D";
  return { type, count: parseInt(m[1], 10) };
}

/** EPL은 continuousGameResult가 null이라 lastFive에서 직접 계산.
 *  네이버 EPL lastFive는 [최근 → 오래된] 순서. 첫 글자부터 연속 카운트. */
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

interface NaverEplTeam {
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
}

export async function fetchEplStandings(): Promise<{
  season: string;
  teams: EplStanding[];
} | null> {
  const seasonCode = await fetchCurrentSeasonCode("epl");
  if (!seasonCode) return null;

  const r = await naverGet<{ seasonTeamStats?: NaverEplTeam[] }>(
    `/statistics/categories/epl/seasons/${seasonCode}/teams`,
  );
  const stats = r.seasonTeamStats ?? [];
  if (stats.length === 0) return null;

  const teams: EplStanding[] = stats
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((t) => ({
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
    }));

  return { season: seasonCode, teams };
}

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
}

export async function fetchKboStandings(): Promise<{
  season: string;
  teams: KboStanding[];
} | null> {
  const seasonCode = await fetchCurrentSeasonCode("kbo");
  if (!seasonCode) return null;

  const r = await naverGet<{ seasonTeamStats?: NaverKboTeam[] }>(
    `/statistics/categories/kbo/seasons/${seasonCode}/teams`,
  );
  const stats = r.seasonTeamStats ?? [];
  if (stats.length === 0) return null;

  // 네이버 KBO lastFive는 [오래된 → 최근] 순. UI에서 "최근이 왼쪽"으로 표시하려면 reverse.
  const teams: KboStanding[] = stats
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
      };
    });

  return { season: seasonCode, teams };
}
