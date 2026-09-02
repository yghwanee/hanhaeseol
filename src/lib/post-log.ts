// src/lib/post-log.ts
//
// 소셜 게시 기록. **레포에 커밋되는** 단일 진실 원본이다.
//
// 🔴 왜 GH Actions 실행 이력으로는 안 되는가 (2026-09-02 사고)
//
// 종전 중복 게이트(post-duplicate)는 "내 워크플로가 같은 날짜를 이미 올렸는가"를
// **완료된 실행 목록**(`status=completed`)으로 판정했다. 그런데 따라잡기 호출처가
// 셋(deploy·crawl-results·uptime)이라, GH 크론 드리프트로 그 셋이 몇십 초 안에
// 같이 깨어나면 셋 다 워크플로를 dispatch 한다. 그 시점엔 아직 **아무도 완료되지
// 않았으므로** 세 실행 전부 게이트를 통과한다.
//
// 실측: 2026-09-01 아침분이 33543460694 / 33543539711 / 33543566592 세 실행에서
// 캐러셀·릴스·스토리·유튜브 **전부 성공** = 같은 콘텐츠가 3번 게시됐다.
// 같은 날 저녁분도 04:59Z 에 두 번(33471866337 / 33471889552).
// 유튜브가 중복 업로드를 피드 배포 중단으로 처벌한다는 걸 이미 겪었는데(작업82),
// 그 상태를 코드가 직접 만들고 있었다.
//
// 그래서 판정 기준을 **실행 이력이 아니라 게시 사실**로 옮긴다. 채널 하나가
// 올라간 그 순간 `data/post-log.json` 에 기록하고 커밋한다. 다음 실행은 그걸 보고
// 이미 올라간 채널을 건너뛴다.
//
// 부수 효과가 이 설계의 진짜 값어치다:
//   · 부분 실패(5개 중 1개만 실패) → 워크플로를 **통째로** 다시 돌려도 안전하다.
//     성공한 4개는 기록에 있어 건너뛰고 빠진 1개만 다시 시도한다.
//   · 전부 실패 → 통째 재실행이 전부를 다시 시도한다.
//   즉 재실행 방법이 하나로 줄어든다(`-f only=` 는 이제 선택 사항).
//
// 키는 `날짜|슬롯|채널` 이다. 슬롯이 반드시 들어가야 한다 — 저녁(D)과 다음날
// 아침(D+1)은 **대상 날짜가 같은 게 정상**이라(post-duplicate 머리말) 날짜만으로
// 묶으면 아침이 저녁 기록을 보고 통째로 건너뛴다.

import type { Channel } from "./post-report";
import type { PostSlot } from "./post-slot";

export const POST_LOG_PATH = "data/post-log.json";

/** 이보다 오래된 기록은 버린다. 파일이 무한히 커지는 걸 막는다. */
export const RETAIN_DAYS = 14;

export interface PostedEntry {
  /** 게시 완료 시각(ISO) */
  at: string;
  /** media id 등 식별자 */
  detail?: string;
  /** 게시한 GH Actions run id (사후 추적용) */
  run?: string;
}

export interface PostLog {
  /** `날짜|슬롯|채널` → 게시 기록 */
  posted: Record<string, PostedEntry>;
  /** `날짜|슬롯|용도` → 알림 보낸 시각(ISO). 하루 한 통 규칙의 근거. */
  notified: Record<string, string>;
}

export const EMPTY_LOG: PostLog = { posted: {}, notified: {} };

export function postKey(date: string, slot: PostSlot, channel: Channel): string {
  return `${date}|${slot}|${channel}`;
}

/**
 * 사이클당 한 번만 일어나야 하는 일들.
 *   report   = 게시 결과 보고 텔레그램
 *   recover  = 감시견이 건 복구 발동(한 사이클에 한 번만 건다)
 *   watchdog = 복구를 걸었는데도 여전히 빠져 있을 때의 마지막 경고
 */
export type NoticeKind = "report" | "watchdog" | "recover";

export function noticeKey(date: string, slot: PostSlot, kind: NoticeKind): string {
  return `${date}|${slot}|${kind}`;
}

/** 깨진 JSON·옛 스키마를 만나도 절대 throw 하지 않는다. 게시를 막으면 안 된다. */
export function normalizeLog(raw: unknown): PostLog {
  if (!raw || typeof raw !== "object") return { posted: {}, notified: {} };
  const o = raw as Partial<PostLog>;
  const posted =
    o.posted && typeof o.posted === "object" ? (o.posted as Record<string, PostedEntry>) : {};
  const notified =
    o.notified && typeof o.notified === "object" ? (o.notified as Record<string, string>) : {};
  return { posted: { ...posted }, notified: { ...notified } };
}

/** 키 앞부분(YYYY-MM-DD)이 보관 기간 안인가. 파싱 안 되는 키는 남긴다(지우는 쪽이 위험). */
function withinRetention(key: string, today: string): boolean {
  const date = key.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return true;
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - RETAIN_DAYS);
  return new Date(`${date}T00:00:00Z`).getTime() >= cutoff.getTime();
}

export function pruneLog(log: PostLog, today: string): PostLog {
  const keep = <T>(rec: Record<string, T>) =>
    Object.fromEntries(Object.entries(rec).filter(([k]) => withinRetention(k, today)));
  return { posted: keep(log.posted), notified: keep(log.notified) };
}

export function wasPosted(
  log: PostLog,
  date: string,
  slot: PostSlot,
  channel: Channel,
): boolean {
  return Boolean(log.posted[postKey(date, slot, channel)]);
}

/**
 * 아직 안 올라간 채널만 남긴다. 워크플로가 이걸로 게시 대상을 좁히므로,
 * **통째 재실행 = 빠진 것만 재시도** 가 자동으로 성립한다.
 */
export function missingChannels(
  log: PostLog,
  date: string,
  slot: PostSlot,
  expected: readonly Channel[],
): Channel[] {
  return expected.filter((c) => !wasPosted(log, date, slot, c));
}

export function markPosted(
  log: PostLog,
  date: string,
  slot: PostSlot,
  channel: Channel,
  entry: PostedEntry,
): PostLog {
  return {
    ...log,
    posted: { ...log.posted, [postKey(date, slot, channel)]: entry },
  };
}

export function wasNotified(
  log: PostLog,
  date: string,
  slot: PostSlot,
  kind: NoticeKind,
): boolean {
  return Boolean(log.notified[noticeKey(date, slot, kind)]);
}

export function markNotified(
  log: PostLog,
  date: string,
  slot: PostSlot,
  kind: NoticeKind,
  at = new Date().toISOString(),
): PostLog {
  return {
    ...log,
    notified: { ...log.notified, [noticeKey(date, slot, kind)]: at },
  };
}

/**
 * 두 기록을 합친다. 원격이 그 사이 바뀌었을 때(다른 실행이 먼저 커밋) 쓴다.
 * 🔴 **원격을 이기게 두면 안 된다** — 그쪽 기록도 실제 게시 사실이다.
 * 양쪽에 있는 키는 이른 시각(먼저 올라간 쪽)을 남긴다.
 */
export function mergeLogs(remote: PostLog, local: PostLog): PostLog {
  const posted = { ...remote.posted };
  for (const [k, v] of Object.entries(local.posted)) {
    const prev = posted[k];
    posted[k] = !prev || v.at < prev.at ? v : prev;
  }
  const notified = { ...remote.notified };
  for (const [k, v] of Object.entries(local.notified)) {
    const prev = notified[k];
    notified[k] = !prev || v < prev ? v : prev;
  }
  return { posted, notified };
}
