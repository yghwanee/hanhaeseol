/**
 * 매치 페이지 콘텐츠 자동 증강 — 인사이트(LLM 생성)와는 별개로,
 * 이미 보유한 데이터(standings/results-archive/team-records/리그 가이드)를
 * 결합해 자연어 단락과 구조화된 섹션을 생성한다.
 *
 * 목적: 매치 페이지가 보일러플레이트 ~485자 thin content에서 벗어나,
 *      데이터 기반의 unique한 콘텐츠를 항상 보유하도록 한다 (AdSense 정책 대응).
 */
import type { Schedule } from "@/types/schedule";
import type { ResultsData } from "@/types/results";
import type { StandingsData } from "@/types/standings";
import type { TeamRecord, TeamRecordsMap } from "@/types/team-record";
import { categoriesForLeague } from "@/lib/results/lookup";
import { lookupTeamRecord } from "@/lib/team-records/lookup";
import { LEAGUE_GUIDES } from "@/lib/league-guides";
import { PLATFORM_GUIDES } from "@/lib/platform-guides";
import { findLeagueBySlug, findPlatformSlugByName, LEAGUE_SEO } from "@/lib/slugs";
import { withJosa } from "../josa";

export interface H2HEntry {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

export interface RecentGame {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  /** 카드 주인 팀(teamName) 관점의 결과 */
  result: "W" | "L" | "D";
}

export interface TeamSummary {
  /** 시즌 표기에 그대로 사용. "1위·승점 78" 같이. */
  rank?: number;
  /** 표시용 W-D-L (또는 W-L) */
  recordLine?: string;
  /** 0~1 (야구/농구), null 가능 */
  winRate?: number | null;
  /** "WWDWL" 형태, 인덱스 0이 가장 최근 */
  last5?: string;
  /** standings 또는 team-records에서 채울 수 있는 직전 연속 결과 */
  streak?: { type: "W" | "L" | "D"; count: number };
  /** 축구만: 득실 차 */
  goalDiff?: number;
  /** 야구만: 승차 (게임차) */
  gameBehind?: number;
}

export interface MatchNarrative {
  /** 모든 데이터 결합된 자연어 미리보기 단락 (300~600자 사이) */
  paragraph: string;
  homeSummary?: TeamSummary;
  awaySummary?: TeamSummary;
  /** 최근 head-to-head (최대 5건) */
  headToHead: H2HEntry[];
  /** 홈팀의 최근 경기 (최대 5건, 모든 상대 포함) */
  homeRecent: RecentGame[];
  /** 원정팀의 최근 경기 (최대 5건, 모든 상대 포함) */
  awayRecent: RecentGame[];
  /** 리그 가이드(있으면) */
  leagueGuide?: ReturnType<typeof getLeagueGuide>;
  /** 플랫폼 가이드(있으면) */
  platformGuide?: ReturnType<typeof getPlatformGuide>;
}

function getLeagueGuide(leagueName: string) {
  // LEAGUE_GUIDES key는 slug(epl/laliga). schedule.league는 한글("프리미어리그") → slug 매핑 필요.
  // LEAGUE_SEO에 match[]가 있어 그걸 통해 slug 역추적.
  const slug = leagueSlugByName(leagueName);
  if (!slug) return undefined;
  const g = LEAGUE_GUIDES[slug];
  if (!g) return undefined;
  return { slug, ...g };
}

function leagueSlugByName(leagueName: string): string | undefined {
  // LEAGUE_SEO.match[]가 schedule.league 값을 정확히 담고 있으므로 역참조.
  // 별도 매핑을 유지하면 새 리그 추가 시 두 곳을 손봐야 해서 LEAGUE_SEO를 단일 소스로 사용.
  return LEAGUE_SEO.find((l) => l.match.includes(leagueName))?.slug;
}

function getPlatformGuide(platformName: string) {
  const slug = findPlatformSlugByName(platformName);
  if (!slug) return undefined;
  const g = PLATFORM_GUIDES[slug];
  if (!g) return undefined;
  return { slug, ...g };
}

/**
 * results-archive에서 두 팀 과거 대전 결과 추출. status=finished만, 매치 날짜 이전,
 * 양방향 매칭, 가장 최근 순으로 최대 5건.
 */
export function buildHeadToHead(
  results: ResultsData | null,
  match: Schedule,
): H2HEntry[] {
  if (!results) return [];
  const categoryIds = categoriesForLeague(match.league);
  if (categoryIds.length === 0) return [];

  const out: H2HEntry[] = [];
  for (const r of results.results) {
    if (!categoryIds.includes(r.categoryId)) continue;
    if (r.status !== "finished") continue;
    if (r.date >= match.date) continue;
    if (typeof r.homeScore !== "number" || typeof r.awayScore !== "number") continue;

    const same = r.homeTeam === match.homeTeam && r.awayTeam === match.awayTeam;
    const reversed = r.homeTeam === match.awayTeam && r.awayTeam === match.homeTeam;
    if (!same && !reversed) continue;

    out.push({
      date: r.date,
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
    });
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  return out.slice(0, 5);
}

/**
 * results-archive에서 특정 팀의 최근 완료 경기(모든 상대) 추출. status=finished만,
 * 매치 날짜 이전, 홈/원정 양쪽 매칭, 가장 최근 순으로 최대 5건.
 * 점수는 실제 경기 그대로(홈-원정) 보존하고, result만 teamName 관점으로 계산한다.
 */
export function buildRecentGames(
  results: ResultsData | null,
  match: Schedule,
  teamName: string,
): RecentGame[] {
  if (!results) return [];
  const categoryIds = categoriesForLeague(match.league);
  if (categoryIds.length === 0) return [];

  const out: RecentGame[] = [];
  for (const r of results.results) {
    if (!categoryIds.includes(r.categoryId)) continue;
    if (r.status !== "finished") continue;
    if (r.date >= match.date) continue;
    if (typeof r.homeScore !== "number" || typeof r.awayScore !== "number") continue;

    const isHome = r.homeTeam === teamName;
    const isAway = r.awayTeam === teamName;
    if (!isHome && !isAway) continue;

    const teamScore = isHome ? r.homeScore : r.awayScore;
    const oppScore = isHome ? r.awayScore : r.homeScore;
    const result: RecentGame["result"] =
      teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "D";

    out.push({
      date: r.date,
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      result,
    });
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  return out.slice(0, 5);
}

/**
 * standings.json에서 팀 시즌 성적 + team-records의 최근 5경기 결합.
 * standings에 없는 팀(예: 비주류 리그)은 team-records만으로라도 채운다.
 */
export function buildTeamSummary(
  match: Schedule,
  teamName: string,
  standings: StandingsData,
  teamRecords: TeamRecordsMap,
): TeamSummary | undefined {
  const sport = match.sport;
  let summary: TeamSummary | undefined;

  // 축구
  if (sport === "축구") {
    const league = standings.soccer.find((l) =>
      l.teams.some((t) => normalizeTeamName(t.teamName) === normalizeTeamName(teamName)),
    );
    const team = league?.teams.find(
      (t) => normalizeTeamName(t.teamName) === normalizeTeamName(teamName),
    );
    if (team) {
      summary = {
        rank: team.rank,
        recordLine: `${team.wins}승 ${team.draws}무 ${team.losses}패`,
        last5: team.lastFive,
        streak: team.streak,
        goalDiff: team.goalsDifference,
      };
    }
  }
  // 야구
  if (sport === "야구") {
    const league = standings.baseball.find((l) =>
      l.teams.some((t) => normalizeTeamName(t.teamName) === normalizeTeamName(teamName)),
    );
    const team = league?.teams.find(
      (t) => normalizeTeamName(t.teamName) === normalizeTeamName(teamName),
    );
    if (team) {
      summary = {
        rank: team.rank,
        recordLine:
          team.draw > 0
            ? `${team.win}승 ${team.draw}무 ${team.lose}패`
            : `${team.win}승 ${team.lose}패`,
        winRate: team.winRate,
        last5: team.lastFive,
        streak: team.streak,
        gameBehind: team.gameBehind,
      };
    }
  }
  // 농구
  if (sport === "농구") {
    const league = standings.basketball.find((l) =>
      l.teams.some((t) => normalizeTeamName(t.teamName) === normalizeTeamName(teamName)),
    );
    const team = league?.teams.find(
      (t) => normalizeTeamName(t.teamName) === normalizeTeamName(teamName),
    );
    if (team) {
      summary = {
        rank: team.rank,
        recordLine: `${team.win}승 ${team.lose}패`,
        winRate: team.winRate,
        last5: team.lastFive,
        streak: team.streak,
        gameBehind: team.gameBehind,
      };
    }
  }

  // standings 미스 → team-records로 fallback (최소한 last5라도)
  if (!summary) {
    const rec: TeamRecord | undefined = lookupTeamRecord(teamRecords, match.league, teamName);
    if (rec) {
      const drawStr = rec.draw && rec.draw > 0 ? ` ${rec.draw}무` : "";
      summary = {
        recordLine: `${rec.win}승${drawStr} ${rec.lose}패`,
        winRate: rec.wra ?? null,
        last5: rec.last5,
        streak: rec.streak,
      };
    }
  }

  return summary;
}

function normalizeTeamName(s: string): string {
  // standings 표기(네이버) vs schedule 표기 차이를 좁히기 위해 공백/구분자 제거 후 lowercase.
  return s.replace(/[\s.()/]+/g, "").toLowerCase();
}

function lastNonDraw(streakType?: "W" | "L" | "D"): string {
  if (streakType === "W") return "상승세";
  if (streakType === "L") return "부진";
  return "혼조세";
}

function rankPhrase(rank?: number): string {
  if (!rank) return "";
  return `${rank}위`;
}

function summaryToSentence(name: string, s?: TeamSummary): string {
  if (!s) return "";
  const parts: string[] = [];
  if (s.rank) parts.push(`리그 ${rankPhrase(s.rank)}`);
  if (s.recordLine) parts.push(`시즌 ${s.recordLine}`);
  if (typeof s.winRate === "number") {
    parts.push(`승률 ${(s.winRate * 100).toFixed(1)}%`);
  }
  if (typeof s.goalDiff === "number") {
    parts.push(`득실차 ${s.goalDiff >= 0 ? "+" : ""}${s.goalDiff}`);
  }
  if (s.last5) parts.push(`최근 5경기 ${s.last5}`);
  if (s.streak && s.streak.count >= 2) {
    parts.push(`${s.streak.count}${s.streak.type === "W" ? "연승" : s.streak.type === "L" ? "연패" : "연속 무"} ${lastNonDraw(s.streak.type)}`);
  }
  if (parts.length === 0) return "";
  // 조사를 고정하면 "아스날는 시즌 0승 0패"처럼 틀린 문장이 매치 페이지 수백 개에 박힌다.
  return `${withJosa(name, "은/는")} ${parts.join(", ")} 상태입니다.`;
}

function h2hSentence(h2h: H2HEntry[], home: string, away: string): string {
  if (h2h.length === 0) return "";
  const last = h2h[0];
  const winner =
    last.homeScore > last.awayScore
      ? last.homeTeam
      : last.awayScore > last.homeScore
      ? last.awayTeam
      : null;
  if (h2h.length === 1) {
    if (!winner) return `직전 ${home} vs ${away} 맞대결은 ${last.homeScore}-${last.awayScore} 무승부였습니다.`;
    return `직전 맞대결에서는 ${winner}가 ${Math.max(last.homeScore, last.awayScore)}-${Math.min(last.homeScore, last.awayScore)}로 승리했습니다.`;
  }
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  for (const e of h2h) {
    if (e.homeScore === e.awayScore) {
      draws++;
      continue;
    }
    const w =
      e.homeScore > e.awayScore ? e.homeTeam : e.awayTeam;
    if (normalizeTeamName(w) === normalizeTeamName(home)) homeWins++;
    else if (normalizeTeamName(w) === normalizeTeamName(away)) awayWins++;
  }
  const drawStr = draws > 0 ? ` ${draws}무` : "";
  return `최근 ${h2h.length}번의 맞대결에서 ${home}가 ${homeWins}승,${drawStr} ${away}가 ${awayWins}승을 기록했습니다.`;
}

/**
 * 자연어 미리보기 단락 — 양팀 성적 + H2H + 리그/플랫폼 한 줄 결합.
 * 데이터가 부족해도 짧은 단락(보일러보다는 길게)을 출력.
 */
export function buildPreviewParagraph(
  match: Schedule,
  homeSummary: TeamSummary | undefined,
  awaySummary: TeamSummary | undefined,
  h2h: H2HEntry[],
  leagueGuide: ReturnType<typeof getLeagueGuide>,
  platformGuide: ReturnType<typeof getPlatformGuide>,
): string {
  const ko = match.koreanCommentary === true ? "한국어 해설" : match.koreanCommentary === false ? "현지 해설" : "해설 정보 미확인";
  const opening = `${match.league} ${match.homeTeam} vs ${match.awayTeam} 경기가 ${match.date} ${match.time} (KST)에 ${match.platform}에서 ${ko}로 중계됩니다.`;

  const homeSentence = summaryToSentence(match.homeTeam, homeSummary);
  const awaySentence = summaryToSentence(match.awayTeam, awaySummary);
  const h2h0 = h2hSentence(h2h, match.homeTeam, match.awayTeam);

  let leagueLine = "";
  if (leagueGuide?.season || leagueGuide?.gameTime) {
    const tags: string[] = [];
    if (leagueGuide.season) tags.push(leagueGuide.season);
    if (leagueGuide.gameTime) tags.push(leagueGuide.gameTime);
    leagueLine = `${match.league}는 ${tags.join(", ")} 일정으로 진행됩니다.`;
  }

  let platformLine = "";
  if (platformGuide?.howToWatch) {
    platformLine = platformGuide.howToWatch;
  }

  return [opening, homeSentence, awaySentence, h2h0, leagueLine, platformLine]
    .filter(Boolean)
    .join(" ");
}

export function buildMatchNarrative(
  match: Schedule,
  results: ResultsData | null,
  standings: StandingsData,
  teamRecords: TeamRecordsMap,
): MatchNarrative {
  const homeSummary = buildTeamSummary(match, match.homeTeam, standings, teamRecords);
  const awaySummary = buildTeamSummary(match, match.awayTeam, standings, teamRecords);
  const h2h = buildHeadToHead(results, match);
  const homeRecent = buildRecentGames(results, match, match.homeTeam);
  const awayRecent = buildRecentGames(results, match, match.awayTeam);
  const leagueGuide = getLeagueGuide(match.league);
  const platformGuide = getPlatformGuide(match.platform);
  const paragraph = buildPreviewParagraph(
    match,
    homeSummary,
    awaySummary,
    h2h,
    leagueGuide,
    platformGuide,
  );
  return {
    paragraph,
    homeSummary,
    awaySummary,
    headToHead: h2h,
    homeRecent,
    awayRecent,
    leagueGuide,
    platformGuide,
  };
}

// findLeagueBySlug는 컴포넌트에서 leagueGuide.slug → display name 역참조 시 사용.
export { findLeagueBySlug };
