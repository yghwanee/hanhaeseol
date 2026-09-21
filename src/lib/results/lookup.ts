import type { MatchResult, ResultsData } from "@/types/results";
import type { Schedule } from "@/types/schedule";

/**
 * schedule.json의 league 문자열 → 네이버 categoryId.
 * 네이버 API가 커버하는 리그만 매핑. 매핑 없으면 결과 표시 안 함.
 *
 * 값이 배열인 경우 후보 categoryId를 순서대로 모두 조회한다. 국가대표 친선경기는
 * 한국 경기(네이버 categoryId=amatch)와 그 외 국가 경기(amatchfriendly)가 서로 다른
 * 카테고리로 나뉘는데, schedule.league("친선 경기")만으로는 어느 쪽인지 알 수 없으므로 둘 다 시도한다.
 */
export const LEAGUE_TO_CATEGORY: Record<string, string | string[]> = {
  // 야구
  KBO: "kbo",
  MLB: "mlb",
  // 농구
  KBL: "kbl",
  NBA: "nba",
  프로농구: "kbl",
  // 축구 (해외)
  프리미어리그: "epl",
  "EFL 챔피언십": "england2",
  "잉글랜드 FA컵": "facup",
  라리가: "primera",
  세리에A: "seria",
  "코파 이탈리아": "coppaitalia",
  분데스리가: "bundesliga",
  "리그 1": "ligue1",
  MLS: "mls",
  챔피언스리그: "champs",
  유로파리그: "europa",
  에레디비시: "eredivisie",
  수페르리가: "denmark",
  ACL: "acl",
  // 축구 (국내)
  K리그: "kleague",
  K리그1: "kleague",
  K리그2: "kleague2",
  // 축구 (국가대표 / 친선) — 한국=amatch, 해외=amatchfriendly
  "남자축구 국가대표팀": "amatch",
  "친선 경기": ["amatch", "amatchfriendly"],
  "국가 친선경기": ["amatch", "amatchfriendly"],
  // 클럽 친선(프리시즌)·단판 슈퍼컵. 매핑이 없어 스코어가 아예 안 붙던 리그들
  // (2026-08-11 확인 — 네이버에 categoryId 는 있는데 우리 표만 비어 있었다).
  "클럽 친선경기": "clubfriendly",
  "FA 커뮤니티 실드": "communityshield",
  "UEFA 슈퍼컵": "uefasupercup",
  // 2026-09-21 실측: nationsleague·uefanationsleague·uefanl·nations 등은 0건, `unl` 만 52경기.
  // 9/25 편성 8경기 팀 표기(오스트리아·노르웨이·네덜란드…)가 네이버와 글자까지 같다.
  네이션스리그: "unl",
  // 코리아컵(구 FA컵 국내대회) — 2026-08-13 편성에 새로 들어와 league-coverage 가드가
  // 잡았다. 네이버 categoryId=koreacup 실측 8경기(8/19 울산시민 vs 광주 등).
  코리아컵: "koreacup",
  // 독일 컵·슈퍼컵 — 2026-08-23 편성(쿠팡플레이)에 새로 들어와 league-coverage 가드가 잡았다.
  // 실측: germansupercup 은 8/23 도르트문트 vs 바이에른 뮌헨 1건이 그대로 잡힌다.
  // dfbpokal 은 2026-27 1라운드 일정이 네이버에 아직 안 올라와 조회가 0건이지만,
  // 2025-26 시즌으로 조회하면 31경기가 나온다 = 대회 자체는 맞다(다른 대회 오매칭 아님).
  "DFB-포칼": "dfbpokal",
  "프란츠 베켄바워 슈퍼컵": "germansupercup",
  // 스코티시 프리미어십 — 2026-08-24 편성(SPOTV NOW)에 새로 들어와 league-coverage
  // 가드가 CI 를 빨갛게 만들고 있었다. 후보 8개(scottish/scottishpremiership/spl/
  // scotland/scottishpl/sco1/premiership/scottishleague) 중 **spl 만** 경기가 잡힌다
  // (실측 8/20~9/05 18경기, 8/30 애버딘 vs 레인저스 = 우리 편성과 같은 경기).
  "스코티시 프리미어십": "spl",
};

/** league 문자열 → 후보 categoryId 목록 (단일 값/배열 모두 배열로 정규화). 매핑 없으면 빈 배열. */
export function categoriesForLeague(league: string): string[] {
  // 북중미 월드컵은 라운드 접미사("북중미 월드컵 32강" 등)가 붙으므로 prefix로 매칭.
  // 편성(worldcup.json)·결과 모두 네이버 categoryId=worldcup에서 와 팀명이 정확히 일치한다.
  if (league.startsWith("북중미 월드컵")) return ["worldcup"];
  const c = LEAGUE_TO_CATEGORY[league];
  if (!c) return [];
  return Array.isArray(c) ? c : [c];
}

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
  { fuzzy = true }: { fuzzy?: boolean } = {},
): MatchResult | undefined {
  if (!results) return undefined;
  const categoryIds = categoriesForLeague(schedule.league);
  if (categoryIds.length === 0) return undefined;

  const exact = findExact(results, schedule, categoryIds);
  if (exact || !fuzzy) return exact;
  return findOneSideMatch(results, schedule, categoryIds);
}

/**
 * 한쪽 팀명만 맞는 결과로 짝짓는 안전망.
 *
 * 🔴 배경(2026-09-15): 네이버가 "인테르 밀라노" 를 "인테르" 로 바꿔 인터-우디네세 5-3 이
 * 경기가 끝나고도 카드에 안 붙었다. 같은 날 ACL 5건도 같은 이유였다. alias 표는 사람이
 * 감사를 돌려야만 채워지고, 표기는 네이버·편성사가 예고 없이 바꾼다 — 표만으로는 매번 한 발 늦다.
 *
 * 조건은 좁다: 같은 날·같은 대회에서 **홈이 정확히 같거나 원정이 정확히 같고**, 그런 경기가
 * **딱 하나**일 때만. 클럽은 하루에 한 경기라 한쪽이 같은 자리에서 일치하면 같은 경기다.
 * 후보가 둘 이상이면(표기가 흔한 이름 등) 추측하지 않고 버린다.
 * alias 표는 그대로 필요하다 — 팀 전적·로고는 이 룩업을 안 탄다. `audit:aliases` 는
 * `fuzzy:false` 로 돌려 표에 빠진 표기를 계속 드러낸다.
 */
function findOneSideMatch(
  results: ResultsData,
  schedule: Schedule,
  categoryIds: string[],
): MatchResult | undefined {
  for (const categoryId of categoryIds) {
    const games = new Map<string, MatchResult>();
    for (const [key, r] of indexByDay(results).get(`${schedule.date}|${categoryId}`) ?? []) {
      const [, , home, away] = key.split("|");
      const homeSame = home === schedule.homeTeam;
      const awaySame = away === schedule.awayTeam;
      if (homeSame === awaySame) continue; // 둘 다 같으면 정확 매칭 몫, 둘 다 다르면 남의 경기
      games.set(r.gameId ?? `${r.homeTeam}|${r.awayTeam}`, r);
    }
    if (games.size === 1) {
      const [r] = games.values();
      return { ...r, homeTeam: schedule.homeTeam, awayTeam: schedule.awayTeam };
    }
  }
  return undefined;
}

/** `date|categoryId` → 그 날 그 대회의 [키, 결과]. 결과 객체마다 한 번만 만든다(아카이브는 수천 건). */
const dayIndexCache = new WeakMap<ResultsData["byKey"], Map<string, [string, MatchResult][]>>();
function indexByDay(results: ResultsData): Map<string, [string, MatchResult][]> {
  let idx = dayIndexCache.get(results.byKey);
  if (!idx) {
    idx = new Map();
    for (const [key, r] of Object.entries(results.byKey)) {
      const parts = key.split("|");
      if (parts.length !== 4) continue;
      const day = `${parts[0]}|${parts[1]}`;
      const list = idx.get(day);
      if (list) list.push([key, r]);
      else idx.set(day, [[key, r]]);
    }
    dayIndexCache.set(results.byKey, idx);
  }
  return idx;
}

function findExact(
  results: ResultsData,
  schedule: Schedule,
  categoryIds: string[],
): MatchResult | undefined {
  for (const categoryId of categoryIds) {
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
        ...(typeof reversed.homePtScore === "number"
          ? { homePtScore: reversed.awayPtScore, awayPtScore: reversed.homePtScore }
          : {}),
        ...(reversed.winner
          ? { winner: reversed.winner === "home" ? "away" : ("home" as const) }
          : {}),
        ...(reversed.goals
          ? { goals: reversed.goals.map((gl) => ({ ...gl, team: gl.team === "home" ? "away" : "home" as const })) }
          : {}),
      };
    }
  }
  return undefined;
}
