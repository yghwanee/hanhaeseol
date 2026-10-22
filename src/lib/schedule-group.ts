import type { Schedule } from "@/types/schedule";
import { isSameTeam } from "@/lib/teams";

/** 같은 경기로 묶는 시각 차 상한(분). TV 는 사전 방송을 15분쯤 먼저 편성한다(SPOTV2 18:15 · 티빙 18:30). */
export const SAME_GAME_MINUTES = 90;

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const sameTeams = (a: Schedule, b: Schedule) =>
  (isSameTeam(a.homeTeam, b.homeTeam) && isSameTeam(a.awayTeam, b.awayTeam)) ||
  (isSameTeam(a.homeTeam, b.awayTeam) && isSameTeam(a.awayTeam, b.homeTeam));

/** 한국어 → 확인 중 → 현지 순. 사람이 먼저 찾는 게 한국어 해설이다. */
const commentaryRank = (c: Schedule["koreanCommentary"]) => (c === true ? 0 : c === "unknown" ? 1 : 2);

/**
 * 같은 경기를 채널마다 한 장씩 내던 홈 카드를 한 장으로 접는다(2026-10-22 화니 결정).
 *
 * 같은 경기 = 같은 날·같은 종목·같은 두 팀(홈/원정 순서 무관, 표기 차이는 `isSameTeam`)이고
 * 시작 시각 차가 90분 이내. 더블헤더는 몇 시간 떨어져 따로 남는다.
 * 대표 행 = **가장 늦은 시각** 행(= 실제 경기 시작, 이른 쪽은 사전 방송). 카드 시각·매치 링크가 이 행을 쓴다.
 * `coverage` 에는 채널별 해설을 그대로 담는다 — 같은 경기라도 SPOTV NOW 현지 · 쿠팡 한국어처럼 갈린다.
 * 한 채널뿐인 경기도 `coverage` 를 단다(필터가 한 경로로 돈다).
 */
export function groupSameGame(rows: Schedule[]): Schedule[] {
  const groups: Schedule[][] = [];
  for (const s of [...rows].sort((a, b) => minutes(a.time) - minutes(b.time))) {
    const g = groups.find(
      (grp) =>
        grp[0].date === s.date &&
        grp[0].sport === s.sport &&
        sameTeams(grp[0], s) &&
        Math.abs(minutes(grp[grp.length - 1].time) - minutes(s.time)) <= SAME_GAME_MINUTES,
    );
    if (g) g.push(s);
    else groups.push([s]);
  }
  return groups.map((grp) => {
    const rep = grp[grp.length - 1];
    const seen = new Set<string>();
    const coverage = grp
      .filter((s) => (seen.has(s.platform) ? false : (seen.add(s.platform), true)))
      .map((s) => ({ platform: s.platform, koreanCommentary: s.koreanCommentary }))
      .sort((a, b) => commentaryRank(a.koreanCommentary) - commentaryRank(b.koreanCommentary));
    return { ...rep, coverage };
  });
}
