/**
 * 직답 리드 문장 — 답변엔진·네이버 AI 브리핑이 문단째로 잘라 가는 단위.
 *
 * 리그·플랫폼·종목 페이지의 첫 문단이 "…중계 편성표입니다" 라는 자기소개라 검색 질문
 * ("오늘 KBO 중계 어디서 하나")의 답이 페이지 어디에도 문장 형태로 없었다. 카드 목록은
 * 사람은 읽지만 추출 엔진은 문장을 찾는다.
 *
 * 🔴 이 문장은 [주어 + 수치 + 기준일] 을 자체 보유해야 한다. "위 표에서 보듯" 같은 맥락
 * 의존 문장은 추출되는 순간 무의미해진다.
 * 🔴 조사를 템플릿에 고정하지 말 것 — 리그·플랫폼·팀명이 그대로 꽂힌다. `josa()` 를 쓴다.
 */
import type { Schedule } from "@/types/schedule";
import { josa } from "@/lib/josa";

export type LeadKind = "league" | "platform" | "sport";

/** 같은 경기가 채널마다 행으로 있으므로 경기 단위로 접는다(카드 목록과 같은 규칙). */
function foldGames(list: Schedule[]) {
  const byGame = new Map<string, Schedule[]>();
  for (const s of list) {
    const key = `${s.date}|${s.homeTeam}|${s.awayTeam}`;
    const prev = byGame.get(key);
    if (prev) prev.push(s);
    else byGame.set(key, [s]);
  }
  return [...byGame.values()];
}

/** 상위 n개 항목을 "A·B·C" 로. 동률이면 이름순으로 고정해 배포마다 문장이 흔들리지 않게 한다. */
function topLabels(list: Schedule[], pick: (s: Schedule) => string, n: number): string[] {
  const count = new Map<string, number>();
  for (const s of list) {
    const k = pick(s);
    if (!k) continue;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return [...count.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], "ko"))
    .slice(0, n)
    .map(([k]) => k);
}

function mdLabel(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

/**
 * @param display 페이지 주체 이름 (리그명·플랫폼명·종목명)
 * @param matched 이 페이지에 해당하는 편성 행 전체 (7일치)
 * @param today   KST 기준 오늘 (YYYY-MM-DD)
 */
export function buildAnswerLead(
  kind: LeadKind,
  display: string,
  matched: Schedule[],
  today: string,
): string {
  const upcoming = matched.filter((s) => s.date >= today);
  const weekGames = foldGames(upcoming);
  const todayRows = upcoming.filter((s) => s.date === today);
  const todayGames = foldGames(todayRows);

  // 편성이 아예 없는 페이지는 없는 사실을 지어내지 않는다.
  if (weekGames.length === 0) {
    return `${today} 기준 앞으로 7일간 편성된 ${display} 중계는 없습니다.`;
  }

  // 한국어 해설은 경기 단위 판정 — 한 채널이라도 한국어면 그 경기는 한국어로 볼 수 있다.
  const korean = (games: Schedule[][]) =>
    games.filter((rows) => rows.some((s) => s.koreanCommentary === true)).length;

  const parts: string[] = [];

  if (todayGames.length > 0) {
    const k = korean(todayGames);
    parts.push(
      `오늘(${mdLabel(today)}) ${display} 중계는 ${todayGames.length}경기이고, 그중 ${k}경기를 한국어 해설로 볼 수 있습니다.`,
    );
    // 플랫폼 페이지는 채널이 하나뿐이라 채널을 세는 게 의미 없다 — 리그를 센다.
    const labels =
      kind === "platform"
        ? topLabels(todayRows, (s) => s.league, 3)
        : topLabels(todayRows, (s) => s.platform, 3);
    if (labels.length > 0) {
      const head = kind === "platform" ? "리그" : "중계 채널";
      parts.push(`오늘 ${head}${josa(head, "은/는")} ${labels.join("·")}입니다.`);
    }
  } else {
    const next = weekGames[0][0];
    parts.push(
      `오늘(${mdLabel(today)})은 편성된 ${display} 중계가 없습니다. 다음 경기는 ${mdLabel(next.date)} ${next.time} ${next.homeTeam} vs ${next.awayTeam}입니다.`,
    );
  }

  const weekKorean = korean(weekGames);
  parts.push(
    `${today} 기준 앞으로 7일간 ${display} 편성은 ${weekGames.length}경기, 한국어 해설은 ${weekKorean}경기입니다.`,
  );

  return parts.join(" ");
}
