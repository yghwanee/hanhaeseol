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
// 이 세트가 성립하려면 "무슨 날짜를 올리는가" 뿐 아니라 "언제 올리는가"도 맞아야 한다.
// GH Actions cron 은 발화 시각을 보장하지 않고, 이 레포 실측 지연은 최대 **12시간**이다
// (저녁 cron KST 16:18 → 실제 KST 04:27 발화, 2026-08-28). 그렇게 밀린 저녁분은
// 날짜를 보정해도 새벽 4시에 나가고, 30분 뒤 아침분이 **같은 날짜**를 또 올린다.
// 세트가 통째로 무너지는 것이다.
//
// 그래서 두 겹으로 막는다.
//   ① 사이클 창 — 밀려서 남의 시간대로 넘어간 예약 실행은 아예 게시하지 않는다.
//   ② 날짜 중복 — 상대 워크플로가 이미 올린 날짜면 올리지 않는다.

import { getKstToday, kstNow, EVENING_CYCLE_START_HOUR } from "./instagram";
import type { PostSlot } from "./post-slot";

export interface OtherRun {
  /** GH Actions run.conclusion */
  conclusion: string | null;
  /** GH Actions run.run_started_at (ISO) */
  run_started_at: string;
  html_url?: string;
}

/** 이 시간보다 오래된 실행은 보지 않는다 — 어제 같은 날짜를 올렸을 리 없다. */
export const LOOKBACK_HOURS = 20;

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
 * 상대 워크플로 실행 중, 내 대상 날짜와 **같은 날짜**를 이미 올린 것을 찾는다.
 *
 * 🔴 워크플로 이름("저녁이 돌았으니 아침은 스킵")으로 판정하면 정상 운영까지 막힌다.
 * 정상 저녁(KST 16:18)은 내일치를 올리므로 그날 아침분과 날짜가 다르다.
 * 그래서 상대 실행의 **시작 시각에 같은 getKstToday 를 다시 먹여** 대상 날짜를
 * 복원해 비교한다. 게시 로직과 한 함수를 쓰므로 규칙이 갈릴 수 없다.
 */
export function findDuplicateRun(
  myTarget: string,
  otherOffsetDays: number,
  runs: OtherRun[],
  now: Date = new Date(),
): OtherRun | null {
  const cutoff = now.getTime() - LOOKBACK_HOURS * 3600_000;
  for (const r of runs) {
    if (r.conclusion !== "success") continue;
    const started = new Date(r.run_started_at);
    if (!Number.isFinite(started.getTime())) continue;
    if (started.getTime() < cutoff || started.getTime() > now.getTime()) continue;
    if (getKstToday(otherOffsetDays, started).today === myTarget) return r;
  }
  return null;
}
