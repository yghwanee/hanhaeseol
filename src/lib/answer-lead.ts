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


/**
 * 선수 페이지 직답 리드(`/player/[slug]`).
 *
 * 리그·플랫폼 리드와 형태가 다르다 — 주어가 사람이고, 검색 질문이 "손흥민 오늘 경기",
 * "손흥민 경기 중계 어디서" 라서 **소속팀 · 다음 경기 일시 · 중계 채널 · 한국어 해설 여부**
 * 넷이 한 문장 안에 있어야 한다.
 *
 * 🔴 소속팀은 기준일을 달고 말한다. 로스터는 매일 크롤하지만 이적은 하루 사이에 난다.
 * 기준일 없는 소속 주장은 틀렸을 때 변명이 안 된다(작업97 오보 이력).
 * 🔴 조사는 전부 `josa()` — 선수명·팀명·플랫폼명이 그대로 꽂힌다.
 *
 * @param name      선수 이름
 * @param teamName  소속팀 정식 표기
 * @param leagueName 리그 표기
 * @param upcoming  이 팀의 다가오는 경기(경기 단위로 이미 접힌 목록, 날짜 오름차순)
 * @param today     KST 기준 오늘 (YYYY-MM-DD)
 */
export function buildPlayerLead(
  name: string,
  teamName: string,
  leagueName: string,
  upcoming: Array<{
    date: string;
    time: string;
    homeTeam: string;
    awayTeam: string;
    platforms: string[];
    koreanCommentary: boolean | "unknown";
  }>,
  today: string,
): string {
  const belong = `${name}${josa(name, "은/는")} ${today} 기준 ${leagueName} ${teamName} 소속입니다.`;

  const next = upcoming[0];
  if (!next) {
    return `${belong} ${today} 기준 앞으로 편성된 ${teamName} 중계는 없습니다.`;
  }

  const vs = `${next.homeTeam} vs ${next.awayTeam}`;
  const when = `${mdLabel(next.date)} ${next.time}`;
  const channel = next.platforms[0];

  // 🔴 "한국어 해설" 이라고 단정할 수 있는 건 `true` 뿐이다. `unknown` 은 확인 중이라고
  // 말한다 — 없는 사실을 지어내면 이 페이지의 존재 이유가 무너진다.
  const how =
    next.koreanCommentary === true
      ? `${channel}에서 한국어 해설로 볼 수 있습니다`
      : next.koreanCommentary === false
        ? `${channel}에서 현지 해설로 중계합니다`
        : `${channel} 중계가 예정돼 있고 해설 언어는 확인 중입니다`;

  const rest =
    upcoming.length > 1
      ? ` ${today} 기준 예정된 ${teamName} 경기는 ${upcoming.length}경기이고, 그중 ${upcoming.filter((g) => g.koreanCommentary === true).length}경기를 한국어 해설로 볼 수 있습니다.`
      : "";

  return `${belong} 다음 경기는 ${when} ${vs}이고, ${how}.${rest}`;
}
