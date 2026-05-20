import type { Schedule } from "@/types/schedule";
import type { TeamRecordsMap } from "@/types/team-record";
import type { StandingsData } from "@/types/standings";
import type { MatchResult } from "@/types/results";

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
  homeRecentForm?: string; // e.g. "WWLDW"
  awayRecentForm?: string;
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
    headToHead: h2h,
  };
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
