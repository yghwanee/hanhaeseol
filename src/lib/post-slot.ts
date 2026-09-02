// src/lib/post-slot.ts
//
// 하루 두 번 게시(아침/저녁)를 구분하는 단일 기준.
//
// 왜 필요한가(2026-08-05):
// 저녁 워크플로는 "내일 경기", 다음날 아침 워크플로는 "오늘 경기"를 올린다.
// 즉 두 게시물의 대상 날짜가 같아서, 날짜만 보고 만들던 제목·커버·첫 프레임이
// 글자 단위로 동일해졌다(예: 8/4 저녁과 8/5 아침이 둘 다 "… 8/5(수) #Shorts").
// 유튜브가 8/4 저녁분부터 Shorts 피드 배포를 끊었고(피드 조회 3, 정상은 400+),
// 채널 위반은 없었다 → 중복 업로드 신호로 판단해 슬롯별로 문구·이미지를 가른다.
//
// 🔴 슬롯 판정은 워크플로 정체성(KST_OFFSET_DAYS)을 우선한다 (2026-08-28).
//
// 종전에는 "대상 날짜가 KST 오늘이면 아침"이라는 데이터 비교만 썼다. 그런데
// getKstToday 에 사이클 보정이 들어가면서(저녁분이 자정을 넘겨 돌면 기준일 -1)
// **저녁 실행인데 대상 날짜가 KST 오늘과 같아지는 경우**가 생긴다.
// 그때 날짜만 보면 morning 으로 오판하고, 몇 시간 뒤 진짜 아침 게시가
// 같은 풀·같은 날짜로 뽑아 문구가 글자까지 같아진다 — 작업82 에서 유튜브
// Shorts 피드 배포가 끊겼던 바로 그 조건이다.
//
// env 가 없으면(로컬·테스트) 종전 날짜 비교로 폴백한다.

import { getKstToday, inferDayLabel } from "./instagram";

export type PostSlot = "morning" | "evening";

export function getPostSlot(today: string): PostSlot {
  const raw = process.env.KST_OFFSET_DAYS;
  if (raw !== undefined && raw !== "") {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n)) return n === 0 ? "morning" : "evening";
  }
  return inferDayLabel(today) === "오늘" ? "morning" : "evening";
}

/** 날짜 기반 결정적 인덱스 — 같은 날 재실행하면 같은 문구가 나온다. */
export function rotateIndex(today: string, slot: PostSlot, poolSize: number): number {
  const day = Number(today.slice(8, 10)) || 1;
  const month = Number(today.slice(5, 7)) || 1;
  // 저녁은 두 칸 밀어 둔다. 한 칸만 밀면 문장 풀에서 나란히 붙은,
  // 형태가 비슷한 문장이 아침·저녁에 같이 뽑히는 날이 생긴다(실측으로 확인).
  const base = day + month * 3 + (slot === "morning" ? 0 : 2);
  return base % poolSize;
}

/**
 * 지금 실행이 다루는 사이클(대상 날짜 + 슬롯).
 *
 * `getKstToday()` 와 `getPostSlot()` 을 따로 부르는 곳이 다섯 군데였다. 둘은 항상
 * 같이 쓰이고 **순서가 있다**(슬롯은 대상 날짜에서 나온다). 한 곳으로 모아 두면
 * 한쪽만 고쳐서 어긋나는 일이 없다 — 게시 게이트·채널 계획·보고·감시견이 전부
 * 같은 값을 봐야 중복 방지가 성립한다.
 */
export function currentCycle(now: Date = new Date()): { today: string; slot: PostSlot } {
  const { today } = getKstToday(undefined, now);
  return { today, slot: getPostSlot(today) };
}
