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
  league?: string;
}

/**
 * 선발을 크롤하는 리그. `crawl-starters.ts` 의 `LEAGUES` 와 같은 목록이어야 한다.
 *
 * 야구라고 다 선발이 오는 게 아니다 — 퓨처스리그·마이너리그·고교야구는 네이버에 선발
 * 소스가 없다(`categoryId=futures` 는 응답은 주지만 경기가 0건. 2026-09-03 실측).
 * 그런데도 "야구면 무조건 view 반환"이라 이 158경기가 **영원히 채워지지 않을**
 * "선발 미발표" 섹션을 달고 있었다. 소스가 없는 리그는 섹션 자체를 안 띄운다.
 *
 * `league` 가 없는 호출은 예전처럼 동작시킨다(KBO/MLB 만 쓰던 테스트·구 호출부 보호).
 */
const STARTER_LEAGUES = new Set(["KBO", "MLB"]);

// 선발을 크롤하는 야구 리그면 항상 view 반환(데이터 없으면 home/away null). 그 외엔 null.
export function getStartersForMatch(
  data: StartersData,
  match: MatchLike,
): MatchStarterView | null {
  if (match.sport !== "야구") return null;
  if (match.league !== undefined && !STARTER_LEAGUES.has(match.league)) return null;
  const entry = data.starters[buildStarterKey(match.date, match.homeTeam, match.awayTeam)];
  return {
    home: entry?.teams[normalizeTeamName(match.homeTeam)] ?? null,
    away: entry?.teams[normalizeTeamName(match.awayTeam)] ?? null,
  };
}
