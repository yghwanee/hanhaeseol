import type { Schedule } from "@/types/schedule";

/**
 * 플랫폼별 한국어 해설 비율 집계.
 *
 * 왜 이걸 내놓는가 — **10개 중계 플랫폼의 해설 언어를 매일 수집하는 곳은 우리뿐이다.**
 * 각 플랫폼은 자기 편성만 공개하고 해설 언어를 집계해 내놓지 않는다. 그래서 이건
 * 다른 데 없는 원본 데이터이고, "쿠팡플레이에서 라리가 보려는데 한국어 해설 되나"
 * 같은 구독 결정 질문에 수치로 답한다(실측 26%).
 *
 * 🔴 미확인(`koreanCommentary === "unknown"`)을 어떻게 세느냐로 숫자가 크게 달라진다.
 * SPOTV 는 편성의 26%, SPOTV2 는 19% 가 미확인이다. 분모에서 빼면 100% 가 되고
 * 넣으면 74% 가 된다. **둘 다 틀린 수는 아니지만 하나만 보여주면 오독된다.**
 * 그래서 `ratio` 는 확인된 건(한국어+현지)만 분모로 쓰고, `unknown`·`total` 을
 * 항상 함께 돌려준다. 화면에서 표본 수와 미확인 수를 반드시 같이 적을 것.
 */

export type CommentaryStat = {
  /** 플랫폼명 또는 리그명 */
  name: string;
  /** 편성 행 기준 전체 건수 */
  total: number;
  korean: number;
  local: number;
  unknown: number;
  /** 확인된 건(korean + local) */
  known: number;
  /** 확인된 건 대비 한국어 해설 비율(0~100). known 이 0이면 null. */
  ratio: number | null;
};

export type PlatformCommentaryStat = CommentaryStat & {
  /** 그 플랫폼 안에서 리그별로 다시 나눈 값. 표본이 적은 리그는 빠진다. */
  leagues: CommentaryStat[];
};

/**
 * 리그별 수치를 공개할 최소 표본.
 *
 * 표본이 한 자릿수면 "0% / 100%" 같은 극단값이 쉽게 나오고, 그건 정보가 아니라
 * 잡음이다. 플랫폼 전체 수치는 표본이 충분하므로 이 게이트를 적용하지 않는다.
 */
export const MIN_LEAGUE_SAMPLE = 10;

function empty(name: string): CommentaryStat {
  return { name, total: 0, korean: 0, local: 0, unknown: 0, known: 0, ratio: null };
}

function add(stat: CommentaryStat, s: Schedule): void {
  stat.total += 1;
  if (s.koreanCommentary === true) stat.korean += 1;
  else if (s.koreanCommentary === false) stat.local += 1;
  else stat.unknown += 1;
}

function finish(stat: CommentaryStat): CommentaryStat {
  stat.known = stat.korean + stat.local;
  stat.ratio = stat.known > 0 ? (100 * stat.korean) / stat.known : null;
  return stat;
}

/**
 * 플랫폼별 집계. 표본이 큰 순으로 정렬한다.
 *
 * `schedules` 는 아카이브(과거 누적)를 넘긴다 — 앞으로의 편성은 해설 여부가
 * 확정 전인 경우가 많아 미확인이 부풀고, 그러면 비율이 실제와 어긋난다.
 */
export function buildPlatformCommentaryStats(schedules: Schedule[]): PlatformCommentaryStat[] {
  const byPlatform = new Map<string, { stat: CommentaryStat; leagues: Map<string, CommentaryStat> }>();

  for (const s of schedules) {
    if (!byPlatform.has(s.platform)) {
      byPlatform.set(s.platform, { stat: empty(s.platform), leagues: new Map() });
    }
    const bucket = byPlatform.get(s.platform)!;
    add(bucket.stat, s);

    if (!bucket.leagues.has(s.league)) bucket.leagues.set(s.league, empty(s.league));
    add(bucket.leagues.get(s.league)!, s);
  }

  return [...byPlatform.values()]
    .map(({ stat, leagues }) => ({
      ...finish(stat),
      leagues: [...leagues.values()]
        .map(finish)
        .filter((l) => l.total >= MIN_LEAGUE_SAMPLE)
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);
}

/** 집계 대상 기간. 화면에 "언제부터 언제까지" 를 적으려면 필요하다. */
export function statsPeriod(schedules: Schedule[]): { from: string; to: string } | null {
  if (schedules.length === 0) return null;
  let from = schedules[0].date;
  let to = schedules[0].date;
  for (const s of schedules) {
    if (s.date < from) from = s.date;
    if (s.date > to) to = s.date;
  }
  return { from, to };
}

/** 한 플랫폼의 수치를 한 문장으로. 플랫폼 페이지에 얹는 용도. */
export function summarySentence(stat: PlatformCommentaryStat, period: { from: string; to: string } | null): string {
  const range = period ? `${period.from.replace(/-/g, ".")}~${period.to.replace(/-/g, ".")}` : "최근";
  if (stat.ratio === null) {
    return `${range} 한해설이 수집한 ${stat.name} 편성 ${stat.total}건 중 해설 언어가 확인된 경기가 없습니다.`;
  }
  const pct = stat.ratio.toFixed(1).replace(/\.0$/, "");
  const unknownNote = stat.unknown > 0 ? ` (해설 언어 미확인 ${stat.unknown}건은 분모에서 제외)` : "";
  return `${range} 한해설이 수집한 ${stat.name} 편성 ${stat.total}건 가운데 해설 언어가 확인된 ${stat.known}건 중 ${stat.korean}건이 한국어 해설이었습니다 — ${pct}%${unknownNote}.`;
}
