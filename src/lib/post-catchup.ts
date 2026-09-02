// src/lib/post-catchup.ts
//
// "지금 이 순간, 놓친 게시가 있으면 대신 걸어준다" 의 판정부. 순수 함수라 테스트가 된다.
// 실제 API 호출·발동은 src/scripts/post-catchup.ts 가 한다.
//
// 🔴 왜 필요한가 (2026-09-01)
//
// GitHub Actions 가 이 레포의 schedule 이벤트를 대량으로 **버리고 있다.**
// uptime.yml(cron '7,37 * * * *' = 하루 48회 기대) 실측 발화 수:
//
//   8/18~8/26  24~34회/일      8/27  3회   8/28  2회
//   8/29  5회   8/30  6회       8/31  4회
//
// 실패·취소가 아니다 — 최근 40건이 40/40 success 이고, 워크플로는 전부 active 이며,
// concurrency 는 cancel-in-progress:false 다. **실행 자체가 생성되지 않는다.**
// 하루 1회 cron 은 대체로 살아남지만 5~12시간씩 밀린다(2026-08-31 저녁분 +7h51m).
// 같은 계정의 fadeby(private, 하루 1 cron)는 매일 정상이라 계정 차단도 아니다.
// 이 레포가 하루 약 110회의 예약 실행을 요구하는 게 유일하게 다른 점이다.
//
// 그래서 **cron 이 제 시각에 온다는 전제를 버린다.** 그날 살아남아 실제로 도는
// 아무 워크플로나(deploy·crawl-results·uptime) 이 판정을 돌려서, 자기 사이클 창이
// 열려 있는데 아직 안 올라간 게시가 있으면 그 워크플로를 대신 발동한다.
//
// 🔴 판정 조건은 check-post-cycle 과 **완전히 같은 함수**를 쓴다. 여기서 조건이
// 갈리면, 따라잡기가 발동시킨 실행이 정작 게이트에 걸려 죽는다(발동만 하고 게시는
// 안 되는 최악의 조합). post-watchdog.yml 이 같은 로직을 bash 로 따로 갖고 있다가
// 2026-08-30 에 실제로 어긋났다 — 그 실수를 반복하지 않는다.

import { getKstToday, kstNow } from "./instagram";
import type { PostSlot } from "./post-slot";
import {
  findSameSlotDuplicate,
  findTooCloseRun,
  isInCycleWindow,
  type OtherRun,
} from "./post-duplicate";

export interface CatchupCandidate {
  slot: PostSlot;
  workflow: string;
  /** KST_OFFSET_DAYS. 아침=0, 저녁=1. */
  offsetDays: number;
  /** 이 슬롯이 지금 올려야 할 경기 날짜. */
  target: string;
}

export interface CatchupContext {
  /**
   * 그 사이클이 이미 다 올라갔는가 (post-log 기준).
   *
   * 🔴 GH 실행 이력보다 이게 먼저다. 이력은 **완료된 실행만** 보이므로, 따라잡기
   *    호출처 셋이 몇십 초 안에 같이 깨어나면 셋 다 "기록 없음" 으로 통과해
   *    같은 콘텐츠를 세 번 올린다(2026-09-01 실측). post-log 는 채널이 올라간
   *    그 순간 기록되므로 그 창이 없다.
   */
  isCycleComplete?: (slot: PostSlot, target: string) => boolean;
  /** 그 워크플로가 지금 돌고 있는가(queued/in_progress). 돌고 있으면 또 걸지 않는다. */
  isRunning?: (workflow: string) => boolean;
}

export interface CatchupDecision {
  /** 발동할 사이클. 없으면 null. */
  pick: CatchupCandidate | null;
  /** 사람이 읽을 판정 근거(슬롯마다 한 줄). */
  lines: string[];
}

export const MORNING_WF = "instagram-morning.yml";
export const EVENING_WF = "instagram.yml";

/**
 * 따라잡기는 이 시각(KST) 전에는 걸지 않는다.
 *
 * 🔴 왜 필요한가 (2026-09-02 실측). 종전에는 사이클 창이 열리자마자(아침 00시,
 * 저녁 12시) 따라잡기가 발동할 수 있었다. 그래서 2026-09-02 저녁분(내일 경기)이
 * **KST 09-01 13:59** 에 나갔다 — 예약 cron 은 16:18 이고 목표 게시 창은 18~19시다
 * (instagram.yml 머리말: 그 시간대 조회수가 높다는 운영자 관측).
 * 따라잡기가 정상 예약을 앞질러 버리면 매일 그 시간대를 잃는다.
 *
 * 값은 "예약 발화 + 통상 지연" 이 지난 시각이다. 아침 cron 04:53(실측 지연 23~36분),
 * 저녁 cron 16:18(실측 지연 중위 2.0h). 그 뒤에도 안 나갔으면 그때 대신 건다.
 */
export const CATCHUP_EARLIEST_HOUR: Record<PostSlot, number> = {
  morning: 6,
  evening: 17,
};

const SLOTS: CatchupCandidate[] = [
  { slot: "morning", workflow: MORNING_WF, offsetDays: 0, target: "" },
  { slot: "evening", workflow: EVENING_WF, offsetDays: 1, target: "" },
];

/**
 * 지금 대신 걸어야 할 사이클을 고른다. 없으면 null.
 *
 * 아침을 먼저 본다 — 두 창은 KST 12~18시에 겹치는데, 그 구간에서 아침(오늘 경기)이
 * 아직 안 나갔다면 그게 더 급하다(경기가 이미 시작하고 있다).
 *
 * 🔴 **한 번에 하나만** 고른다. 둘 다 비어 있다고 둘 다 걸면, 나중 것이 상대 슬롯과
 * MIN_GAP_HOURS 안에 붙어 게이트에 걸려 죽는다. 남은 하나는 다음 따라잡기가 잡는다.
 */
export function pickCatchupCycle(
  now: Date,
  runsByWorkflow: Record<string, OtherRun[]>,
  ctx: CatchupContext = {},
): CatchupDecision {
  const lines: string[] = [];

  for (const base of SLOTS) {
    const target = getKstToday(base.offsetDays, now).today;
    const cand: CatchupCandidate = { ...base, target };
    const other = SLOTS.find((s) => s.slot !== base.slot)!;
    const mine = runsByWorkflow[base.workflow] ?? [];
    const theirs = runsByWorkflow[other.workflow] ?? [];

    if (!isInCycleWindow(base.slot, now)) {
      lines.push(`${base.slot}: 사이클 창 밖 — 건너뜀`);
      continue;
    }
    // 🔴 예약 발화를 앞지르지 않는다. 이걸 안 걸면 저녁분이 낮에 나간다.
    const hour = kstNow(now).getHours();
    if (hour < CATCHUP_EARLIEST_HOUR[base.slot]) {
      lines.push(
        `${base.slot}: KST ${hour}시 — 예약(${CATCHUP_EARLIEST_HOUR[base.slot]}시 전)을 기다린다`,
      );
      continue;
    }
    // 🔴 실행 이력보다 먼저 본다. 이유는 CatchupContext 주석 참조.
    if (ctx.isCycleComplete?.(base.slot, target)) {
      lines.push(`${base.slot}: ${target} 채널이 전부 올라가 있다(post-log) — 정상`);
      continue;
    }
    if (ctx.isRunning?.(base.workflow)) {
      lines.push(`${base.slot}: ${base.workflow} 가 지금 돌고 있다 — 또 걸지 않는다`);
      continue;
    }
    const dup = findSameSlotDuplicate(target, base.offsetDays, mine, now);
    if (dup) {
      lines.push(`${base.slot}: ${dup.run_started_at} 에 이미 ${target} 를 올렸다 — 정상`);
      continue;
    }
    const close = findTooCloseRun(target, other.offsetDays, theirs, now);
    if (close) {
      lines.push(
        `${base.slot}: 상대 슬롯이 ${close.run_started_at} 에 ${target} 를 올렸다 — 너무 붙어 건너뜀`,
      );
      continue;
    }
    lines.push(`${base.slot}: 창 안인데 ${target} 게시 기록이 없다 — 따라잡기 발동`);
    return { pick: cand, lines };
  }

  return { pick: null, lines };
}
