// src/lib/post-duplicate.ts
//
// "이 실행이 지금 게시해도 되는가" 판정. 순수 함수라 테스트가 된다.
// 실제 API 호출·출력은 src/scripts/check-post-cycle.ts 가 한다.
//
// 🔴 지켜야 할 세트 정의 (운영자 정의, 2026-08-29)
//
//   아침 게시 = **오늘** 경기      (KST 이른 아침)
//   저녁 게시 = **내일** 경기      (KST 저녁)
//
// 🔴🔴 여기서 한 번 크게 틀렸다 (2026-08-30). 반드시 읽을 것.
//
// 종전 코드는 "상대 워크플로가 최근 20시간 안에 같은 날짜를 올렸으면 게시 중단"
// 이었다. 그런데 위 세트 정의를 보면 **저녁(D) 과 다음날 아침(D+1) 은 대상 날짜가
// 항상 같다** — 저녁이 D+1 경기를 예고하고, 다음날 아침이 그 D+1 경기를 다시
// 오늘로 안내하는 게 설계다. 두 게시물은 12시간쯤 떨어져 있고 슬롯별로 문구·커버·
// 캡션이 이미 갈려 있다(작업82·83·84).
//
// 그래서 그 검사는 **정상 운영을 매일 죽였다.** 2026-08-30 아침이 그렇게 스킵됐다:
//   저녁 08-29 22:10 KST → 대상 08-30  /  아침 08-30 07:01 KST → 대상 08-30 → 중단.
// cron 이 제시간에 돌아도(저녁 16:18 / 아침 04:53, 간격 12h35m) 20시간 창 안이라
// 똑같이 막힌다. 즉 아침 게시는 구조적으로 영영 안 나가는 상태였다.
//
// 종전 테스트에도 이 조합이 "반드시 확인해야 한다"고 적혀 있었는데,
// 대상 날짜만 계산해 보고 **findDuplicateRun 을 호출하지 않은 채 끝났다.**
// 검사에서 빠진 한 줄이 그대로 사고가 됐다.
//
// ── 그래서 지금은 이렇게 막는다 ──────────────────────────────────────────────
//
//  ① 사이클 창 — 밀려서 남의 시간대로 넘어간 예약 발화는 아예 게시하지 않는다.
//     2026-08-28 사고(저녁분이 KST 04:27 발화)를 실제로 막는 건 이 검사다.
//  ② 같은 슬롯 중복 — 내 워크플로가 이미 같은 날짜를 올렸으면 다시 올리지 않는다.
//     (밀린 어제 cron 이 오늘 cron 과 같은 날짜를 잡는 경우)
//  ③ 근접 중복 — 상대 워크플로가 같은 날짜를 **MIN_GAP_HOURS 안에** 올렸으면 중단.
//     날짜가 같은 건 정상이고, 문제는 "너무 붙어서" 나가는 것이다.
//
// 그리고 세 검사 모두 **실제로 게시한 실행만** 센다. 스킵된 실행도 conclusion 은
// success 라, 그걸 "이미 올렸다"고 세면 스킵이 다음 스킵을 부른다.

import { getKstToday, kstNow, EVENING_CYCLE_START_HOUR } from "./instagram";
import type { PostSlot } from "./post-slot";

export interface OtherRun {
  /** GH Actions run.conclusion */
  conclusion: string | null;
  /** GH Actions run.run_started_at (ISO) */
  run_started_at: string;
  html_url?: string;
  /**
   * 이 실행이 실제로 게시했는가(스텝 결과로 판정).
   * `false` 면 세지 않는다. 판정을 못 했으면(`undefined`) 게시한 것으로 본다 —
   * 중복 위험 쪽을 보수적으로 잡는다.
   */
  posted?: boolean;
}

/** 이 시간보다 오래된 실행은 보지 않는다 — 어제 같은 날짜를 올렸을 리 없다. */
export const LOOKBACK_HOURS = 20;

/**
 * 상대 슬롯 게시물과 이만큼은 떨어져 있어야 한다.
 * 정상 세트 간격은 12시간 이상(저녁 16:18 → 아침 04:53)이라 여유가 크다.
 * 2026-08-28 사고는 33분 간격이었다.
 */
export const MIN_GAP_HOURS = 6;

/**
 * 아침 사이클이 이 시각을 넘겨서 발화하면 게시하지 않는다.
 * 그 시각이면 "오늘 경기" 상당수가 이미 시작했고, 곧 저녁분(내일치)이 나간다.
 * 정오(=EVENING_CYCLE_START_HOUR)로 잡지 않은 이유는, 낮에 밀린 실행까지 버리면
 * 그날 아침 세트가 통째로 없어지기 때문이다 — 2026-08-28 이 KST 12:51 이었다.
 */
export const MORNING_LATEST_HOUR = 18;

/**
 * 예약 발화가 자기 사이클 창 안에 있는가.
 * 창 밖이면 그 게시물은 "제 시간의 콘텐츠"가 아니다.
 *
 *   아침(오늘치)  : KST 00:00 ~ 18:00
 *   저녁(내일치)  : KST 12:00 ~ 24:00
 */
export function isInCycleWindow(slot: PostSlot, now: Date = new Date()): boolean {
  const h = kstNow(now).getHours();
  return slot === "morning" ? h < MORNING_LATEST_HOUR : h >= EVENING_CYCLE_START_HOUR;
}

/**
 * 실제 게시 스텝. 이 다섯 개 중 하나라도 success 면 그 실행은 게시한 것이다.
 *
 * 🔴 `게시` 라는 단어만 보면 안 된다 — `게시 대상 채널 결정` 스텝은 스킵된
 * 실행에서도 항상 success 라, 스킵을 "게시함"으로 오판한다.
 * 채널 이름을 반드시 함께 요구한다.
 */
export const PUBLISH_STEP_RE = /(캐러셀|릴스|스토리|유튜브|틱톡).*(게시|업로드)/;

export function runDidPost(
  steps: { name?: string | null; conclusion?: string | null }[],
): boolean {
  return steps.some(
    (s) => typeof s?.name === "string" && PUBLISH_STEP_RE.test(s.name) && s.conclusion === "success",
  );
}

/** 셀 가치가 있는 실행인가 — 성공했고, 실제로 게시했고, 조회 창 안이다. */
function usable(r: OtherRun, now: Date, windowHours: number): Date | null {
  if (r.conclusion !== "success") return null;
  if (r.posted === false) return null;
  const started = new Date(r.run_started_at);
  if (!Number.isFinite(started.getTime())) return null;
  if (started.getTime() > now.getTime()) return null;
  if (started.getTime() < now.getTime() - windowHours * 3600_000) return null;
  return started;
}

/**
 * 내 워크플로가 같은 대상 날짜를 이미 올렸는가(진짜 중복 재실행).
 * `runs` 에는 지금 실행 자신이 들어 있으면 안 된다.
 */
export function findSameSlotDuplicate(
  myTarget: string,
  myOffsetDays: number,
  runs: OtherRun[],
  now: Date = new Date(),
): OtherRun | null {
  for (const r of runs) {
    const started = usable(r, now, LOOKBACK_HOURS);
    if (!started) continue;
    if (getKstToday(myOffsetDays, started).today === myTarget) return r;
  }
  return null;
}

/**
 * 상대 워크플로가 같은 날짜를 **너무 가까이** 올렸는가.
 *
 * 🔴 날짜가 같은 것 자체는 정상이다(저녁 D → 다음날 아침 D). 간격만 본다.
 */
export function findTooCloseRun(
  myTarget: string,
  otherOffsetDays: number,
  runs: OtherRun[],
  now: Date = new Date(),
): OtherRun | null {
  for (const r of runs) {
    const started = usable(r, now, MIN_GAP_HOURS);
    if (!started) continue;
    if (getKstToday(otherOffsetDays, started).today === myTarget) return r;
  }
  return null;
}
