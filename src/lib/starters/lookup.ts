import type { StartersData, MatchStarterView } from "@/types/starter";
import { normalizeTeamName } from "./teams";

// 방향 무관 키: 날짜 + 정규화된 두 팀명을 정렬해 결합.
export function buildStarterKey(date: string, teamA: string, teamB: string): string {
  const a = normalizeTeamName(teamA);
  const b = normalizeTeamName(teamB);
  return `${date}|${[a, b].sort().join("-")}`;
}

interface MatchLike {
  date: string;
  homeTeam: string;
  awayTeam: string;
  sport: string;
}

// 야구 경기면 항상 view 반환(데이터 없으면 home/away null). 야구 아니면 null.
export function getStartersForMatch(
  data: StartersData,
  match: MatchLike,
): MatchStarterView | null {
  if (match.sport !== "야구") return null;
  const entry = data.starters[buildStarterKey(match.date, match.homeTeam, match.awayTeam)];
  return {
    home: entry?.teams[normalizeTeamName(match.homeTeam)] ?? null,
    away: entry?.teams[normalizeTeamName(match.awayTeam)] ?? null,
  };
}
