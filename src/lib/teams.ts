/**
 * 팀 페이지 데이터 조립.
 *
 * 왜 팀 단위인가: 매치 페이지 1,330개는 경기가 끝나면 수요가 사라지고, 사이트맵에만 있고,
 * 네이버 스포츠와 같은 자리를 놓고 정면으로 싸운다(2026-07-20 GSC 확인 결과 노출 0).
 * 팀은 시즌 내내 검색되고, 우리 데이터로 "다음 경기 어디서 보나"를 답할 수 있다.
 *
 * 규칙 하나가 제일 중요하다: **데이터가 비어 있는 팀은 페이지를 만들지 않는다.**
 * 지금 유럽 리그는 개막 전이라 순위표가 전부 0승 0패다. 그대로 뽑으면
 * "아스날는 시즌 0승 0패 상태입니다" 같은 빈 페이지를 138개 만들게 된다.
 */

import { NAVER_TO_SCHEDULE_TEAM_NAME } from "@/lib/team-records/team-name-aliases";
import type { Schedule } from "@/types/schedule";
import { withJosa } from "@/lib/josa";

export type StandingTeam = {
  rank: number;
  teamName: string;
  teamLogo?: string;
  /** 야구 */
  gameCount?: number;
  win?: number;
  draw?: number;
  lose?: number;
  winRate?: number;
  gameBehind?: number;
  /** 축구 */
  matchesPlayed?: number | null;
  wins?: number;
  draws?: number;
  losses?: number;
  goals?: number | null;
  goalsConceded?: number | null;
  goalsDifference?: number | null;
  points?: number;
  lastFive?: string;
  streak?: { type: string; count: number };
  /** MLB: 소속 리그·지구(순위가 지구 단위다) */
  league?: string;
  division?: string;
};

export type StandingLeague = { id?: string; name: string; season?: string; teams: StandingTeam[] };
export type StandingsData = {
  soccer?: StandingLeague[];
  baseball?: StandingLeague[];
  basketball?: StandingLeague[];
};

export type TeamRecord = {
  last5?: string;
  win: number;
  lose: number;
  draw: number;
  wra?: number;
  streak?: { count: number; type: string };
};

export type TeamEntry = {
  slug: string;
  leagueSlug: string;
  leagueName: string;
  /**
   * 순위가 리그 전체가 아니라 그 안의 묶음 기준일 때의 이름(MLB 「NL 동부」).
   * 🔴 MLB 순위는 지구별이라 1위가 여섯 팀이다. 이걸 빼면 휴스턴(81승 81패)이 「MLB 1위」로 나왔다.
   */
  rankScope?: string;
  /**
   * 편성 데이터(`Schedule.sport`)와 같은 표기: "축구" | "야구" | "농구".
   *
   * 🔴 경기 매칭을 종목으로 스코프하려고 둔다. `isSameTeam` 은 접두 매칭이라
   * `isSameTeam("토론토 블루제이스", "토론토")` 가 참이 된다 — 순위표의 MLS
   * `토론토`(=토론토 FC)가 MLB 토론토 경기를 자기 경기로 끌어왔다(2026-08-19
   * 라이브 실측: 토론토 FC 팀 페이지의 다음 경기가 "뉴욕 양키스전"). 도시명을
   * 공유하는 MLS↔MLB 조합에서 통째로 일어난다(뉴욕·LA·시카고…).
   *
   * 리그로 자르지 않고 종목으로 자르는 이유: 컵대회(코리아컵·DFB-포칼·UCL)는
   * 리그명이 달라서, 리그로 자르면 그 경기들이 팀 페이지에서 사라진다.
   */
  sport: string;
  name: string;
  logo?: string;
  rank: number;
  played: number;
  win: number;
  draw: number;
  lose: number;
  /** 승률 (야구) 또는 승점 (축구) */
  winRate?: number;
  points?: number;
  gameBehind?: number;
  lastFive?: string;
  streak?: { type: string; count: number };
  /** 축구 득점/실점 */
  goals?: number;
  goalsConceded?: number;
  goalsDifference?: number;
};

/** 순위표 리그명 → 우리 리그 슬러그. 여기 없는 리그는 팀 페이지를 만들지 않는다. */
export const LEAGUE_SLUG_BY_NAME: Record<string, string> = {
  KBO: "kbo",
  MLB: "mlb",
  MLS: "mls",
  K리그: "k-league-1",
  K리그2: "k-league-2",
  프리미어리그: "epl",
  라리가: "laliga",
  분데스리가: "bundesliga",
  세리에A: "seriea",
  리그앙: "ligue1",
  에레디비시: "eredivisie",
};

function num(...vals: (number | null | undefined)[]): number {
  for (const v of vals) if (typeof v === "number") return v;
  return 0;
}

/**
 * 경기를 한 판도 안 치른 팀은 쓸 내용이 없다.
 * 시즌 개막 전 순위표가 통째로 0인 걸 여기서 걸러낸다.
 */
export function hasMeaningfulData(t: StandingTeam): boolean {
  const played = num(t.gameCount, t.matchesPlayed);
  if (played > 0) return true;
  return num(t.win, t.wins) + num(t.lose, t.losses) + num(t.draw, t.draws) > 0;
}

/** URL에 쓸 팀 슬러그. 리그를 앞에 붙여 동명 팀 충돌을 막는다(KBO 삼성 vs 다른 종목). */
export function teamSlug(leagueSlug: string, name: string): string {
  const cleaned = name.trim().replace(/\s+/g, "-");
  return `${leagueSlug}-${cleaned}`;
}

const MLB_DIVISION: Record<string, string> = { EAST: "동부", CENTRAL: "중부", WEST: "서부" };

/** MLB 지구 표기 「NL 동부」. 지구 정보가 없으면 undefined. */
export function mlbDivisionLabel(t: Pick<StandingTeam, "league" | "division">): string | undefined {
  if (!t.league || !t.division) return undefined;
  return `${t.league} ${MLB_DIVISION[t.division] ?? t.division}`;
}

/** 「NL 동부 1위」·「KBO 2위」. 지구 단위 순위면 지구를 붙인다. */
export function rankLabel(team: Pick<TeamEntry, "leagueName" | "rankScope" | "rank">): string {
  return team.rankScope ? `${team.leagueName} ${team.rankScope} ${team.rank}위` : `${team.leagueName} ${team.rank}위`;
}

export function buildTeamIndex(standings: StandingsData): TeamEntry[] {
  const out: TeamEntry[] = [];
  // 편성 데이터의 `sport` 표기와 맞춘다.
  const leagues = [
    ...(standings.baseball ?? []).map((l) => ({ league: l, sport: "야구" })),
    ...(standings.soccer ?? []).map((l) => ({ league: l, sport: "축구" })),
    ...(standings.basketball ?? []).map((l) => ({ league: l, sport: "농구" })),
  ];

  for (const { league, sport } of leagues) {
    const leagueSlug = LEAGUE_SLUG_BY_NAME[league.name];
    if (!leagueSlug) continue;

    for (const t of league.teams ?? []) {
      if (!hasMeaningfulData(t)) continue;
      const scope = mlbDivisionLabel(t);
      out.push({
        slug: teamSlug(leagueSlug, t.teamName),
        leagueSlug,
        leagueName: league.name,
        ...(scope ? { rankScope: scope } : {}),
        sport,
        name: t.teamName,
        logo: t.teamLogo,
        rank: t.rank,
        played: num(t.gameCount, t.matchesPlayed),
        win: num(t.win, t.wins),
        draw: num(t.draw, t.draws),
        lose: num(t.lose, t.losses),
        winRate: t.winRate,
        points: t.points,
        gameBehind: t.gameBehind,
        lastFive: t.lastFive || undefined,
        streak: t.streak && t.streak.count > 0 ? t.streak : undefined,
        goals: typeof t.goals === "number" ? t.goals : undefined,
        goalsConceded: typeof t.goalsConceded === "number" ? t.goalsConceded : undefined,
        goalsDifference:
          typeof t.goalsDifference === "number" ? t.goalsDifference : undefined,
      });
    }
  }
  return out;
}

/**
 * 순위표(네이버 표기)와 편성표 표기가 아예 다른 축구 팀을 같은 팀으로 묶는다.
 *
 * 🔴 왜 (2026-10-22 실측): 순위표 「맨체스터 시티」·「아스널」·「애스턴 빌라」·「인테르나치오날레」와
 * 편성표 「맨시티」·「아스날」·「아스톤 빌라」·「인터 밀란」은 접두 일치가 안 돼서, 맨시티 팀 페이지에
 * EPL 경기가 하나도 안 잡혀 「SPOTV NOW에서 중계」(챔스만 셌다)라고 안내했고 매치 페이지
 * 「팀 상세정보」 링크도 빠졌다. 표는 스코어 매칭에 쓰는 alias 표(감사로 확인된 것만) 그대로다.
 * 축구 리그만 쓴다 — 야구·농구 표의 짧은 이름(「LG」 등)을 전역으로 묶으면 종목을 넘는다.
 */
const SOCCER_ALIAS_LEAGUES = [
  "프리미어리그", "라리가", "세리에A", "분데스리가", "MLS", "챔피언스리그", "유로파리그", "에레디비시", "코리아컵", "ACL",
];
const ALIAS_GROUP: Map<string, number> = (() => {
  const parent: number[] = [];
  const idOf = new Map<string, number>();
  const id = (name: string) => {
    const k = name.replace(/\s+/g, "");
    let v = idOf.get(k);
    if (v === undefined) {
      v = parent.length;
      parent.push(v);
      idOf.set(k, v);
    }
    return v;
  };
  const find = (v: number): number => (parent[v] === v ? v : (parent[v] = find(parent[v])));
  for (const league of SOCCER_ALIAS_LEAGUES) {
    for (const [naver, sched] of Object.entries(NAVER_TO_SCHEDULE_TEAM_NAME[league] ?? {})) {
      for (const n of Array.isArray(sched) ? sched : [sched]) parent[find(id(n))] = find(id(naver));
    }
  }
  const out = new Map<string, number>();
  for (const [k, v] of idOf) out.set(k, find(v));
  return out;
})();

/**
 * 팀명 표기가 소스마다 다르다. 순위표는 "삼성", 편성표는 "삼성 라이온즈",
 * SPOTV TV 편성은 "미네소타"처럼 더 짧게 쓰기도 한다.
 * 한쪽이 다른 쪽으로 시작하면 같은 팀으로 본다. 공백은 무시한다.
 *
 * 정확 일치만 요구하면 KBO 절반이 일정을 못 찾고, 반대로 부분 포함까지 허용하면
 * "LA 다저스"와 "LA 에인절스"가 엮인다. 접두 일치가 실측상 균형점이다.
 */
export function isSameTeam(a: string, b: string): boolean {
  const x = a.replace(/\s+/g, "");
  const y = b.replace(/\s+/g, "");
  if (x === y) return true;
  const gx = ALIAS_GROUP.get(x);
  if (gx !== undefined && gx === ALIAS_GROUP.get(y)) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length < 2) return false;
  if (!long.startsWith(short)) return false;
  // 🔴 유스·여자·2군은 다른 팀이다. 「맨체스터 시티」 팀 페이지에 「맨체스터 시티 U19」(UEFA
  // 유스리그) 경기가 섞여 들어갔다(2026-10-22 실측).
  if (/^(U\d{2}|유스|여자|W|B|II|2군)$/i.test(long.slice(short.length))) return false;
  // 🔴 접두는 단어 경계에서만 인정한다. 「포르투」(FC 포르투)가 「포르투나 시타르트」로 잡혔다
  // (2026-10-22). 원문에서 짧은 쪽이 끝나는 자리가 공백·끝이어야 한다. 공백 없는 원문끼리
  // (「LA다저스」·「LA 다저스」)는 위의 공백 제거 일치에서 이미 걸린다.
  const [shortRaw, longRaw] = x.length <= y.length ? [a, b] : [b, a];
  const longNorm = longRaw.trim().replace(/\s+/g, " ");
  const shortNorm = shortRaw.trim().replace(/\s+/g, " ");
  if (!longNorm.startsWith(shortNorm)) return true;
  const next = longNorm.charAt(shortNorm.length);
  return next === "" || next === " ";
}

export function findTeamSchedules(
  schedules: Schedule[],
  team: TeamEntry,
): Schedule[] {
  return schedules.filter(
    (s) =>
      // 🔴 종목 스코프가 없으면 도시명을 공유하는 다른 종목 팀의 경기가 섞인다.
      // `isSameTeam` 이 접두 매칭이라 `토론토 블루제이스`(MLB)가 순위표의
      // `토론토`(MLS)와 같은 팀으로 잡혔다. 실측 15개 팀이 영향받았다.
      // `sport` 가 비어 있으면(옛 데이터) 거르지 않는다 — 경기를 통째로 잃는 것보다 낫다.
      (!team.sport || !s.sport || s.sport === team.sport) &&
      (isSameTeam(s.homeTeam, team.name) || isSameTeam(s.awayTeam, team.name)),
  );
}

export type TeamGame = {
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  /** 같은 경기를 중계하는 모든 플랫폼 */
  platforms: string[];
  koreanCommentary: boolean | "unknown";
  id: string;
  /** 카드 렌더에 쓸 대표 편성 행. 메인 경기 카드를 그대로 재사용하기 위한 것. */
  source: Schedule;
};

/**
 * 한 경기가 여러 플랫폼에 걸리면 편성 데이터에는 행이 여러 개 있다.
 * 그대로 늘어놓으면 "7월 21일 KIA vs 한화"가 네 줄 반복된다(실제로 그렇게 나왔다).
 * 경기 단위로 묶고 플랫폼을 합친다.
 */
export function groupGames(schedules: Schedule[]): TeamGame[] {
  const byKey = new Map<string, TeamGame>();
  const times = new Map<string, Map<string, number>>();

  for (const s of schedules) {
    // 시각을 키에 넣으면 안 된다. 같은 경기라도 플랫폼마다 편성 시각이 다르다
    // (SPOTV는 사전방송 때문에 18:15, 티빙은 18:30으로 잡힌다).
    const key = `${s.date}|${s.homeTeam}|${s.awayTeam}`;
    const tally = times.get(key) ?? new Map<string, number>();
    tally.set(s.time, (tally.get(s.time) ?? 0) + 1);
    times.set(key, tally);

    const prev = byKey.get(key);
    if (prev) {
      if (!prev.platforms.includes(s.platform)) prev.platforms.push(s.platform);
      // 한 곳이라도 한국어 해설이면 한국어로 볼 수 있다는 뜻이다
      if (s.koreanCommentary === true) {
        // 대표 행도 한국어 해설 쪽으로 바꾼다. 카드 뱃지가 실제로 볼 수 있는 조건을 보여야 한다.
        if (prev.koreanCommentary !== true) prev.source = s;
        prev.koreanCommentary = true;
      }
      continue;
    }
    byKey.set(key, {
      date: s.date,
      time: s.time,
      homeTeam: s.homeTeam,
      awayTeam: s.awayTeam,
      league: s.league,
      platforms: [s.platform],
      koreanCommentary: s.koreanCommentary ?? "unknown",
      id: s.id,
      source: s,
    });
  }

  // 표시 시각은 가장 많이 잡힌 편성 시각으로. 같으면 이른 쪽.
  for (const [key, game] of byKey) {
    const tally = times.get(key);
    if (!tally) continue;
    game.time = [...tally.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0][0];
  }

  return [...byKey.values()];
}

/** 다가오는 경기부터, 오늘 이전 것은 뺀다. */
export function upcomingFor(
  schedules: Schedule[],
  team: TeamEntry,
  todayISO: string,
  limit = 5,
): TeamGame[] {
  return groupGames(findTeamSchedules(schedules, team))
    .filter((g) => g.date >= todayISO)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, limit);
}

/** 최근 경기부터. 지난 경기 기록용. */
export function recentFor(
  schedules: Schedule[],
  team: TeamEntry,
  todayISO: string,
  limit = 5,
): TeamGame[] {
  return groupGames(findTeamSchedules(schedules, team))
    .filter((g) => g.date < todayISO)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
    .slice(0, limit);
}

/** 그 팀 경기를 실제로 중계한 플랫폼들. "어디서 보나"의 답이다. */
export function platformsFor(schedules: Schedule[], team: TeamEntry): string[] {
  const seen = new Map<string, number>();
  for (const s of findTeamSchedules(schedules, team)) {
    seen.set(s.platform, (seen.get(s.platform) ?? 0) + 1);
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
}

/** 한국어 해설로 볼 수 있는 경기가 있는지. 우리 사이트의 존재 이유다. */
export function koreanCommentaryRatio(
  schedules: Schedule[],
  team: TeamEntry,
): { total: number; korean: number } {
  // 플랫폼 행이 아니라 경기 단위로 센다. 안 그러면 KBO 한 팀이 128경기로 부풀려진다.
  const games = groupGames(findTeamSchedules(schedules, team));
  return {
    total: games.length,
    korean: games.filter((g) => g.koreanCommentary === true).length,
  };
}

/**
 * 페이지를 낼 팀만 남긴다.
 *
 * 순위표에 있어도 국내 중계가 한 번도 안 잡힌 팀이 있다. MLS 14개 팀이 그렇다
 * (SPOTV가 손흥민 경기 위주로 일부만 가져온다). 그런 팀 페이지는 "중계 없음"만
 * 적힌 빈 페이지가 되고, 그게 1,330개 매치 페이지가 저지른 실수다.
 */
export function eligibleTeams(
  index: TeamEntry[],
  schedules: Schedule[],
  minGames = 1,
): TeamEntry[] {
  return index.filter((t) => findTeamSchedules(schedules, t).length >= minGames);
}

export function findTeamBySlug(index: TeamEntry[], slug: string): TeamEntry | undefined {
  return index.find((t) => t.slug === slug);
}

/** 같은 리그의 다른 팀들. 내부 링크로 쓴다(매치 페이지가 고아가 된 원인이 링크 부재였다). */
export function leagueSiblings(
  index: TeamEntry[],
  team: TeamEntry,
  limit = 12,
): TeamEntry[] {
  return index
    .filter((t) => t.leagueSlug === team.leagueSlug && t.slug !== team.slug)
    .sort((a, b) => (a.rankScope ?? "").localeCompare(b.rankScope ?? "") || a.rank - b.rank)
    .slice(0, limit);
}

/** 경기에서 이 팀의 상대. 홈/원정 어느 쪽이든 반대편을 돌려준다. */
export function opponentOf(game: TeamGame, team: TeamEntry): { name: string; home: boolean } {
  const isHome = isSameTeam(game.homeTeam, team.name);
  return { name: isHome ? game.awayTeam : game.homeTeam, home: isHome };
}

/**
 * 순위표에서 상대 팀을 찾는다.
 * 편성표 표기("한화 이글스")와 순위표 표기("한화")가 달라 isSameTeam으로 맞춘다.
 */
export function findOpponentEntry(
  index: TeamEntry[],
  team: TeamEntry,
  opponentName: string,
): TeamEntry | undefined {
  return index.find(
    (t) => t.leagueSlug === team.leagueSlug && isSameTeam(t.name, opponentName),
  );
}

/**
 * 순위 맥락 한 줄. 숫자만 나열하면 읽는 사람이 의미를 못 잡는다.
 * 야구는 선두와의 게임차, 축구는 승점을 쓴다.
 */
export function standingContext(team: TeamEntry, leader?: TeamEntry): string | null {
  const where = team.rankScope ? `${team.leagueName} ${team.rankScope}` : team.leagueName;
  if (team.rank === 1) {
    return typeof team.gameBehind === "number" ? `${where} 선두` : `${where} 1위`;
  }
  if (typeof team.gameBehind === "number" && team.gameBehind > 0) {
    return `${team.rankScope ? "지구 " : ""}선두와 ${team.gameBehind}경기 차`;
  }
  if (leader && typeof team.points === "number" && typeof leader.points === "number") {
    const gap = leader.points - team.points;
    if (gap > 0) return `선두 ${withJosa(leader.name, "와/과")} 승점 ${gap} 차`;
  }
  return null;
}

/** 최근 성적 요약. lastFive 문자열(WWLDW)을 사람 말로 바꾼다. */
export function recentFormText(lastFive?: string): string | null {
  if (!lastFive) return null;
  const w = (lastFive.match(/W/g) ?? []).length;
  const d = (lastFive.match(/D/g) ?? []).length;
  const l = (lastFive.match(/L/g) ?? []).length;
  const parts = [`${w}승`];
  if (d > 0) parts.push(`${d}무`);
  parts.push(`${l}패`);
  return `최근 ${lastFive.length}경기 ${parts.join(" ")}`;
}

/**
 * 편성 데이터의 팀명으로 팀 페이지를 찾는다.
 *
 * 편성표 리그명("K리그1")과 순위표 리그명("K리그")이 어긋날 수 있어, 리그를 먼저 맞춰보고
 * 못 찾으면 이름만으로 찾되 **후보가 하나일 때만** 인정한다. 여러 리그에 같은 이름이 있으면
 * (예: 여러 나라의 "유나이티드") 링크를 걸지 않는 쪽이 낫다.
 */
export function findTeamForSchedule(
  index: TeamEntry[],
  leagueName: string,
  teamName: string,
  sport?: string,
): TeamEntry | undefined {
  const leagueSlug = LEAGUE_SLUG_BY_NAME[leagueName];
  if (leagueSlug) {
    const inLeague = index.find(
      (t) => t.leagueSlug === leagueSlug && isSameTeam(t.name, teamName),
    );
    if (inLeague) return inLeague;
  }
  // 🔴 이름만으로 찾을 때는 종목을 잘라야 한다(2026-10-22 실측). 안 자르면 배구 삼성화재가
  // KBO 삼성으로, 농구 울산 현대모비스가 K리그 울산으로, WNBA 애틀랜타가 MLB 애틀랜타로 갔다.
  const candidates = index.filter(
    (t) => (!sport || !t.sport || t.sport === sport) && isSameTeam(t.name, teamName),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

export type WinLoss = { win: number; draw: number; lose: number };

/**
 * 홈·원정 성적을 나눈다. 순위표는 합계만 주므로 우리 결과 데이터로 직접 센다.
 * "이 팀 홈에서 강한가"는 순위표에 없는 정보라 페이지 고유값이 된다.
 */
export function splitHomeAway(
  games: TeamGame[],
  team: TeamEntry,
  scoreOf: (
    g: TeamGame,
  ) => { homeScore?: number; awayScore?: number; status?: string } | undefined,
): { home: WinLoss; away: WinLoss } {
  const home: WinLoss = { win: 0, draw: 0, lose: 0 };
  const away: WinLoss = { win: 0, draw: 0, lose: 0 };

  for (const g of games) {
    const r = scoreOf(g);
    if (!r || typeof r.homeScore !== "number" || typeof r.awayScore !== "number") continue;
    // 🔴 끝난 경기만 센다. 취소·연기·예정 경기는 0:0 으로 와서 무승부로 잡혔다
    // (2026-10-22 실측: 삼성 홈 31승 10무 20패 — 실제 시즌 무승부는 3).
    if (r.status && r.status !== "finished") continue;

    const isHome = isSameTeam(g.homeTeam, team.name);
    const bucket = isHome ? home : away;
    const mine = isHome ? r.homeScore : r.awayScore;
    const theirs = isHome ? r.awayScore : r.homeScore;

    if (mine > theirs) bucket.win += 1;
    else if (mine < theirs) bucket.lose += 1;
    else bucket.draw += 1;
  }
  return { home, away };
}

/** 플랫폼별 중계 경기 수. "어디서 보나"에 숫자로 답한다. */
export function platformBreakdown(
  schedules: Schedule[],
  team: TeamEntry,
): { platform: string; count: number }[] {
  const seen = new Map<string, Set<string>>();
  for (const s of findTeamSchedules(schedules, team)) {
    const key = `${s.date}|${s.homeTeam}|${s.awayTeam}`;
    const set = seen.get(s.platform) ?? new Set<string>();
    set.add(key);
    seen.set(s.platform, set);
  }
  return [...seen.entries()]
    .map(([platform, games]) => ({ platform, count: games.size }))
    .sort((a, b) => b.count - a.count);
}

/** 순위표에서 이 팀 주변만 잘라낸다. 전체 표를 옮기지 않고 맥락만 준다. */
export function standingsWindow(
  index: TeamEntry[],
  team: TeamEntry,
  span = 2,
): TeamEntry[] {
  const league = index
    .filter((t) => t.leagueSlug === team.leagueSlug && t.rankScope === team.rankScope)
    .sort((a, b) => a.rank - b.rank);
  const i = league.findIndex((t) => t.slug === team.slug);
  if (i === -1) return [];
  return league.slice(Math.max(0, i - span), i + span + 1);
}
