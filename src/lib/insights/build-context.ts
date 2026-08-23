import type { Schedule } from "@/types/schedule";
import type { TeamRecordsMap } from "@/types/team-record";
import type { StandingsData } from "@/types/standings";
import type { MatchResult } from "@/types/results";
import { deriveFlow, streakFromLast5, type Flow } from "./form-claim";

export interface InsightContext {
  matchId: string;
  league: string;
  sport: string;
  date: string;
  time: string;
  platform: string;
  homeTeam: string;
  awayTeam: string;
  homeRank?: number;
  awayRank?: number;
  homeRecentForm?: string; // e.g. "WWLDW" — 첫 글자=가장 최근.
  awayRecentForm?: string;
  homeStreak?: string; // e.g. "현재 2연패", "현재 3연승"
  awayStreak?: string;
  /** 생성문 검사에 쓰는 방향. 프롬프트에도 사람 말로 같이 넣는다. */
  homeFlow: Flow;
  awayFlow: Flow;
  headToHead?: string; // e.g. "최근 5번 맞대결: 홈 3승 2패"
}

export interface ContextInputs {
  schedule: Schedule;
  /** league → teamName → record  (TeamRecordsData.records) */
  teamRecords: TeamRecordsMap;
  /** full StandingsData object */
  standingsData: StandingsData;
  /** flat results list  (ResultsData.results) */
  resultsArchive: MatchResult[];
}

export function buildInsightContext({
  schedule,
  teamRecords,
  standingsData,
  resultsArchive,
}: ContextInputs): InsightContext {
  // TeamRecordsMap is: league → teamName → TeamRecord
  const leagueRecords = teamRecords[schedule.league] ?? {};
  const home = leagueRecords[schedule.homeTeam];
  const away = leagueRecords[schedule.awayTeam];

  const { homeRank, awayRank } = resolveRanks(
    schedule,
    standingsData,
  );

  // 🔴 네이버는 continuousGameResult 를 KBO/MLB/K리그에만 준다. 축구 상위리그는 비어 있어서
  // streak 이 통째로 없었고, 모델이 "WWLDW" 만 보고 흐름을 지어내던 자리가 여기다.
  const homeStreak = home?.streak ?? streakFromLast5(home?.last5);
  const awayStreak = away?.streak ?? streakFromLast5(away?.last5);

  const h2h = buildHeadToHead(
    resultsArchive,
    schedule.homeTeam,
    schedule.awayTeam,
  );

  return {
    matchId: schedule.id,
    league: schedule.league,
    sport: schedule.sport,
    date: schedule.date,
    time: schedule.time,
    platform: schedule.platform,
    homeTeam: schedule.homeTeam,
    awayTeam: schedule.awayTeam,
    homeRank,
    awayRank,
    homeRecentForm: home?.last5,
    awayRecentForm: away?.last5,
    homeStreak: formatStreak(homeStreak),
    awayStreak: formatStreak(awayStreak),
    homeFlow: deriveFlow(home?.last5, homeStreak),
    awayFlow: deriveFlow(away?.last5, awayStreak),
    headToHead: h2h,
  };
}

function formatStreak(
  streak: { count: number; type: "W" | "L" | "D" } | undefined,
): string | undefined {
  if (!streak || streak.count <= 0) return undefined;
  const label = streak.type === "W" ? "연승" : streak.type === "L" ? "연패" : "무승부";
  return `현재 ${streak.count}${label}`;
}

/** Finds rank for both teams across all sport-specific standings arrays. */
function resolveRanks(
  schedule: Schedule,
  standingsData: StandingsData,
): { homeRank?: number; awayRank?: number } {
  // Collect all league standings regardless of sport type.
  // Each entry has .teams[] where each team has .teamName and .rank.
  const allLeagues: Array<{
    name: string;
    teams: Array<{ teamName: string; rank: number }>;
  }> = [
    ...standingsData.soccer,
    ...standingsData.baseball,
    ...standingsData.basketball,
  ];

  // Try to find the correct league by name match (case-insensitive substring).
  const leagueEntry = allLeagues.find(
    (l) =>
      l.name.toLowerCase().includes(schedule.league.toLowerCase()) ||
      schedule.league.toLowerCase().includes(l.name.toLowerCase()),
  );

  if (!leagueEntry) {
    return {};
  }

  const findRank = (teamName: string): number | undefined =>
    leagueEntry.teams.find((t) => t.teamName === teamName)?.rank;

  return {
    homeRank: findRank(schedule.homeTeam),
    awayRank: findRank(schedule.awayTeam),
  };
}

function buildHeadToHead(
  results: MatchResult[],
  home: string,
  away: string,
): string | undefined {
  const matchups = results.filter(
    (r) =>
      (r.homeTeam === home && r.awayTeam === away) ||
      (r.homeTeam === away && r.awayTeam === home),
  );
  if (matchups.length === 0) return undefined;

  const recent = matchups.slice(-5);
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  for (const m of recent) {
    if (typeof m.homeScore !== "number" || typeof m.awayScore !== "number")
      continue;
    const homeScored = m.homeTeam === home ? m.homeScore : m.awayScore;
    const awayScored = m.homeTeam === home ? m.awayScore : m.homeScore;
    if (homeScored > awayScored) homeWins++;
    else if (homeScored < awayScored) awayWins++;
    else draws++;
  }
  return `최근 ${recent.length}번 맞대결: ${home} ${homeWins}승 ${draws}무 ${awayWins}패`;
}
