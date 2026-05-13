import type { MatchResult, ResultsData } from "@/types/results";
import type { Schedule } from "@/types/schedule";

/**
 * schedule.json의 league 문자열 → 네이버 categoryId.
 * 네이버 API가 커버하는 리그만 매핑. 매핑 없으면 결과 표시 안 함.
 */
export const LEAGUE_TO_CATEGORY: Record<string, string> = {
  // 야구
  KBO: "kbo",
  MLB: "mlb",
  // 농구
  KBL: "kbl",
  NBA: "nba",
  프로농구: "kbl",
  // 축구 (해외)
  프리미어리그: "epl",
  라리가: "primera",
  세리에A: "seria",
  분데스리가: "bundesliga",
  "리그 1": "ligue1",
  MLS: "mls",
  챔피언스리그: "champs",
  유로파리그: "europa",
  에레디비시: "eredivisie",
  // 축구 (국내)
  K리그: "kleague",
  K리그1: "kleague",
  K리그2: "kleague2",
};

/** 룩업 키 빌드. 크롤러 쪽과 동일해야 함. */
export function resultKey(
  date: string,
  categoryId: string,
  home: string,
  away: string,
): string {
  return `${date}|${categoryId}|${home}|${away}`;
}

/**
 * 편성표 한 건에 매칭되는 결과를 찾는다.
 * schedule.league → categoryId 매핑 + (date, home, away) 정확 일치로 찾음.
 * results.byKey에는 모든 alias 변형이 채워져 있어 schedule의 다양한 표기를 처리할 수 있다.
 *
 * 일부 리그(특히 MLB)는 schedule.json과 네이버의 home/away 표기가 반대로 들어온다.
 * 정방향이 미스면 home/away를 뒤집어 한 번 더 시도하고, 그 경우 score도 함께 스왑해서
 * schedule 기준(좌=home)으로 일관되게 반환한다.
 */
export function findResult(
  results: ResultsData | null,
  schedule: Schedule,
): MatchResult | undefined {
  if (!results) return undefined;
  const categoryId = LEAGUE_TO_CATEGORY[schedule.league];
  if (!categoryId) return undefined;

  const direct = results.byKey[
    resultKey(schedule.date, categoryId, schedule.homeTeam, schedule.awayTeam)
  ];
  if (direct) return direct;

  const reversed = results.byKey[
    resultKey(schedule.date, categoryId, schedule.awayTeam, schedule.homeTeam)
  ];
  if (reversed) {
    return {
      ...reversed,
      homeTeam: schedule.homeTeam,
      awayTeam: schedule.awayTeam,
      homeScore: reversed.awayScore,
      awayScore: reversed.homeScore,
    };
  }
  return undefined;
}
