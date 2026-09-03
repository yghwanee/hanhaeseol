import type { Schedule } from "@/types/schedule";
import type { MatchResult, ResultsData } from "@/types/results";
import { findResult } from "@/lib/results/lookup";
import { formatDateHeader } from "@/lib/schedule-utils";
import { teamKeysOf } from "@/lib/follows";

/**
 * ⭐찜한 팀 경기 알림 — **무엇을 보낼지 정하는 순수 로직**.
 *
 * 발송(web-push)·저장(Blob)·기록(레포 커밋)은 전부 밖에 있다. 여기는 입력(편성·결과·시각·
 * 이미 보낸 기록)만 보고 알림 목록을 돌려준다. 시각 분기가 들어가는 코드는 그 시각에 실제로
 * 돌려 봐야 한다는 걸 감시견 버그에서 배웠으므로(작업108), 판정을 전부 인자로 뺐다.
 */

export type NoticeKind = "dayBefore" | "kickoff" | "goal" | "final";

export interface Notice {
  kind: NoticeKind;
  /** 🔴 중복 방지 키. 이미 보낸 기록에 있으면 다시 안 보낸다. */
  dedupKey: string;
  /** 이 알림이 붙은 경기. 기록 갱신에 쓴다(문구를 되파싱하지 않기 위해). */
  gameKey: string;
  /** 득점 알림일 때 그 시점 스코어("2-1"). 다음 실행의 기준선이 된다. */
  score?: string;
  /** 이 알림을 받을 팀 키. 구독자의 찜 목록과 하나라도 겹치면 발송한다. */
  teamKeys: string[];
  title: string;
  body: string;
  url: string;
  /** 같은 경기의 알림은 같은 tag 로 묶어 알림창이 쌓이지 않게 한다. */
  tag: string;
}

/** 킥오프 알림을 보낼 시점(분). 워크플로가 이보다 짧은 주기로 돌아야 놓치지 않는다. */
export const KICKOFF_LEAD_MINUTES = 60;

/**
 * 하루 전 예고를 보낼 구간(분). 24시간 전후 한 시간 폭.
 * 🔴 폭이 워크플로 주기보다 넓어야 한다 — 좁으면 실행이 한 번 밀릴 때 통째로 건너뛴다.
 */
export const DAY_BEFORE_FROM_MINUTES = 24 * 60;
export const DAY_BEFORE_TO_MINUTES = 25 * 60;

/** 레퍼런스 표기(`6월 12일 (금) 11:00`)를 맞춘다. */
export function whenLabel(s: Schedule): string {
  return `${formatDateHeader(s.date)} ${s.time}`;
}

/** 경기 식별 키. 🔴 채널·시각을 넣지 않는다 — 사전방송 때문에 시각이 갈린다. */
export function gameKey(s: Schedule): string {
  return `${s.date}|${s.homeTeam}|${s.awayTeam}`;
}

/** 채널마다 한 행씩 들어온 편성을 경기 단위로 접는다. 채널명은 모아 둔다. */
export function collapseByGame(
  schedules: Schedule[],
): { s: Schedule; platforms: string[] }[] {
  const byGame = new Map<string, { s: Schedule; platforms: string[] }>();
  for (const s of schedules) {
    const k = gameKey(s);
    const prev = byGame.get(k);
    if (prev) {
      if (!prev.platforms.includes(s.platform)) prev.platforms.push(s.platform);
      if (s.koreanCommentary === true && prev.s.koreanCommentary !== true) prev.s = s;
      continue;
    }
    byGame.set(k, { s, platforms: [s.platform] });
  }
  return [...byGame.values()];
}

/** KST 기준 경기 시작 시각(에폭 ms). */
export function kickoffAt(s: Schedule): number {
  return Date.parse(`${s.date}T${s.time}:00+09:00`);
}

function scoreOf(r: MatchResult | undefined): string | null {
  if (!r || typeof r.homeScore !== "number" || typeof r.awayScore !== "number") {
    return null;
  }
  return `${r.homeScore}-${r.awayScore}`;
}

function totalGoals(score: string | null): number {
  if (!score) return -1;
  const [h, a] = score.split("-").map((v) => Number.parseInt(v, 10));
  return Number.isFinite(h) && Number.isFinite(a) ? h + a : -1;
}

function commentaryLabel(s: Schedule): string {
  if (s.koreanCommentary === true) return "한국어해설";
  if (s.koreanCommentary === false) return "현지해설";
  return "해설 확인중";
}

/** 대진 문구. 레퍼런스 표기를 따라 `VS` 는 대문자다(`대한민국 VS 체코`). */
function versus(s: Schedule): string {
  return s.awayTeam ? `${s.homeTeam} VS ${s.awayTeam}` : s.homeTeam;
}

export interface BuildInput {
  schedules: Schedule[];
  results: ResultsData | null;
  /** 판정 기준 시각(에폭 ms). 테스트에서 고정할 수 있게 인자로 받는다. */
  now: number;
  /** 이미 보낸 dedupKey 집합. */
  sent: Set<string>;
  /** 경기별 마지막으로 알린 스코어("2-1"). 득점 감지의 기준선. */
  lastScores: Record<string, string>;
  /** 매치 페이지 URL 을 만들 때 쓴다. */
  matchUrl: (s: Schedule) => string;
}

/**
 * 보낼 알림 목록. 이미 보낸 것·조건에 안 맞는 것은 빠진다.
 *
 * 순서는 kickoff → goal → final 이 아니라 **경기 순서**다. 한 실행에서 여러 경기가 걸리면
 * 시간이 이른 경기부터 나간다.
 */
export function buildNotices(input: BuildInput): Notice[] {
  const { results, now, sent, lastScores, matchUrl } = input;
  const out: Notice[] = [];

  for (const { s, platforms } of collapseByGame(input.schedules).sort(
    (a, b) => kickoffAt(a.s) - kickoffAt(b.s),
  )) {
    const gk = gameKey(s);
    const tag = `game:${gk}`;
    const url = matchUrl(s);
    const teamKeys = teamKeysOf(s);
    const result = findResult(results, s);
    const score = scoreOf(result);

    // 🔴 "시작 전"만 본다. 이미 시작한 경기에 예고를 보내면 안 된다.
    const startsInMin = (kickoffAt(s) - now) / 60000;
    const where = `${platforms.join(", ")} · ${commentaryLabel(s)}`;

    // ── 5-a. 하루 전 예고 ─────────────────────────────────────────────────
    if (
      startsInMin >= DAY_BEFORE_FROM_MINUTES &&
      startsInMin < DAY_BEFORE_TO_MINUTES
    ) {
      const key = `${gk}|dayBefore`;
      if (!sent.has(key)) {
        out.push({
          kind: "dayBefore",
          dedupKey: key,
          gameKey: gk,
          teamKeys,
          title: `내일 ${versus(s)}`,
          body: `${whenLabel(s)} · ${where}`,
          url,
          tag,
        });
      }
    }

    // ── 5-b. 킥오프 임박 ──────────────────────────────────────────────────
    if (startsInMin > 0 && startsInMin <= KICKOFF_LEAD_MINUTES) {
      const key = `${gk}|kickoff`;
      if (!sent.has(key)) {
        out.push({
          kind: "kickoff",
          dedupKey: key,
          gameKey: gk,
          teamKeys,
          title: versus(s),
          body: `${s.time} 시작 · ${where}`,
          url,
          tag,
        });
      }
    }

    // ── 6. 득점 ──────────────────────────────────────────────────────────
    // 진행 중이고, 직전에 알린 스코어보다 **골 합계가 늘었을 때만**. 스코어가 줄거나
    // 그대로면 크롤 흔들림이지 득점이 아니다.
    // 🔴 `0-0` 은 어떤 경우에도 득점이 아니다. 기준선이 비어 있으면(그 경기를 처음 보는
    // 실행) `totalGoals("0-0") = 0 > -1` 이 성립해 **0-0 짜리 득점 알림**이 나간다.
    // 2026-09-03 실전 dry-run 에서 "키움 0-0 SSG · 1회초" 로 실제로 잡혔다.
    if (result?.status === "live" && score) {
      const prev = lastScores[gk] ?? null;
      if (totalGoals(score) > 0 && totalGoals(score) > totalGoals(prev)) {
        const key = `${gk}|goal|${score}`;
        if (!sent.has(key)) {
          out.push({
            kind: "goal",
            dedupKey: key,
            gameKey: gk,
            score,
            teamKeys,
            title: `${s.homeTeam} ${score} ${s.awayTeam}`,
            body: latestScorer(result) ?? `${result.period ?? "경기 진행 중"}`,
            url,
            tag,
          });
        }
      }
    }

    // ── 7. 종료 ──────────────────────────────────────────────────────────
    if (result?.status === "finished" && score) {
      const key = `${gk}|final`;
      if (!sent.has(key)) {
        out.push({
          kind: "final",
          dedupKey: key,
          gameKey: gk,
          score,
          teamKeys,
          title: `경기 종료 · ${s.homeTeam} ${score} ${s.awayTeam}`,
          body: finalBody(s, result),
          url,
          tag,
        });
      }
    }
  }

  return out;
}

/** 가장 늦은 시각의 득점자. 축구에만 있다. */
function latestScorer(r: MatchResult): string | null {
  const goals = r.goals ?? [];
  if (goals.length === 0) return null;
  const last = [...goals].sort((a, b) => a.minute - b.minute).at(-1);
  if (!last) return null;
  const t = last.addedTime ? `${last.minute}+${last.addedTime}'` : `${last.minute}'`;
  return `${last.player} ${t}${last.ownGoal ? " (OG)" : ""}`;
}

function finalBody(s: Schedule, r: MatchResult): string {
  if (typeof r.homePtScore === "number" && typeof r.awayPtScore === "number") {
    return `승부차기 ${r.homePtScore}-${r.awayPtScore}`;
  }
  return `${s.league} · ${s.date}`;
}

/** 구독자의 찜 목록과 알림 대상 팀이 겹치는가. */
export function shouldReceive(notice: Notice, follows: string[]): boolean {
  if (follows.length === 0) return false;
  const set = new Set(follows);
  return notice.teamKeys.some((k) => set.has(k));
}
