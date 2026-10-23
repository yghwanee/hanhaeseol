/**
 * 순위 페이지의 직답 문단.
 *
 * "KBO 1위 어디" · "라리가 순위 2025" 류 질문의 답이 표 셀 안에만 있고 문장으로는 없었다.
 * 답변엔진은 표도 파싱하지만 네이버 AI 브리핑·Perplexity 는 **문단 단위**로 잘라 출처 칩을
 * 단다(실측). 그래서 [주어 + 수치 + 기준일] 을 갖춘 한 문단을 표 위에 둔다.
 *
 * 🔴 순위 원천이 팀명을 축약해 준다(`두산`, `시카고W`). 문장에는 정식명을 쓴다.
 * 🔴 조사 고정 금지 — 팀명이 그대로 꽂히므로 `josa()` 를 쓴다.
 */
import type {
  SoccerLeagueStandings,
  BaseballLeagueStandings,
} from "@/types/standings";
import type { StandingsSeoMeta } from "@/lib/standings-seo";
import { fullTeamName } from "@/lib/team-full-names";
import { josa } from "@/lib/josa";

type AnyLeague = SoccerLeagueStandings | BaseballLeagueStandings | undefined;

/** UTC ISO → KST 날짜(YYYY-MM-DD). 데이터 JSON 의 lastUpdated 는 Z 표기다. */
function kstDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 승률 .612 표기. 소수 셋째 자리까지, 앞의 0 은 뗀다(야구 관례). */
function winRateLabel(r: number): string {
  return r.toFixed(3).replace(/^0/, "");
}

export function buildStandingsLead(
  meta: StandingsSeoMeta,
  league: AnyLeague,
  lastUpdated: string,
): string | null {
  if (!league || league.teams.length === 0) return null;
  const asOf = kstDate(lastUpdated);
  if (!asOf) return null;

  if (meta.sport === "soccer") {
    const teams = [...(league as SoccerLeagueStandings).teams].sort((a, b) => a.rank - b.rank);
    const first = teams[0];
    if (!first) return null;
    const name = fullTeamName(meta.slug, first.teamName);
    const head = `${asOf} 기준 ${meta.display} 선두는 ${name}(승점 ${first.points}, ${first.matchesPlayed}경기 ${first.wins}승 ${first.draws}무 ${first.losses}패)입니다.`;
    const second = teams[1];
    if (!second) return head;
    const gap = first.points - second.points;
    const secondName = fullTeamName(meta.slug, second.teamName);
    const tail =
      gap === 0
        ? `2위 ${secondName}${josa(secondName, "과/와")} 승점이 같습니다(득실차 ${first.goalsDifference} 대 ${second.goalsDifference}).`
        : `2위 ${secondName}${josa(secondName, "과/와")}의 승점 차는 ${gap}입니다.`;
    return `${head} ${tail}`;
  }

  const raw = (league as BaseballLeagueStandings).teams;
  // 🔴 MLB 순위는 지구별이라 rank 1 이 여섯 팀이다. rank 로 고르면 첫 지구 1위(애틀랜타 .580)가
  // 「MLB 선두」, 다른 지구 1위(클리블랜드 .525)가 「2위」로 나왔다(2026-10-22). 지구가 여럿이면
  // 전체 승률 순으로 줄 세운다.
  const divided = raw.filter((t) => t.rank === 1).length > 1;
  const teams = [...raw].sort((a, b) => (divided ? b.winRate - a.winRate : a.rank - b.rank));
  const first = teams[0];
  if (!first) return null;
  const name = fullTeamName(meta.slug, first.teamName);
  const record = first.draw > 0 ? `${first.win}승 ${first.draw}무 ${first.lose}패` : `${first.win}승 ${first.lose}패`;
  if (divided) {
    const second = teams[1];
    const head = `${asOf} 기준 ${meta.display} 전체 승률 선두는 ${name}(승률 ${winRateLabel(first.winRate)}, ${first.gameCount}경기 ${record})입니다.`;
    if (!second) return head;
    const secondName = fullTeamName(meta.slug, second.teamName);
    // NBA 는 지구가 아니라 동·서부 컨퍼런스 단위로 순위를 매긴다.
    const unit = meta.sport === "basketball" ? "컨퍼런스별" : "지구별";
    return `${head} 다음은 ${secondName}(승률 ${winRateLabel(second.winRate)})입니다. 순위는 ${unit}로 나뉩니다.`;
  }
  const head = `${asOf} 기준 ${meta.display} 선두는 ${name}(승률 ${winRateLabel(first.winRate)}, ${first.gameCount}경기 ${record})입니다.`;
  const second = teams[1];
  if (!second) return head;
  const secondName = fullTeamName(meta.slug, second.teamName);
  const gb = second.gameBehind;
  const tail =
    gb > 0
      ? `2위 ${secondName}${josa(secondName, "과/와")}의 게임 차는 ${gb}입니다.`
      : `2위는 ${secondName}입니다.`;
  return `${head} ${tail}`;
}
