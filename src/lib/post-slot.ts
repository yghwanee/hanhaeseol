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
// 슬롯 판정은 env 가 아니라 데이터로 한다. 대상 날짜가 실행 시점의 KST 오늘이면
// 아침(=오늘 경기), 아니면 저녁(=내일 경기). 워크플로의 KST_OFFSET_DAYS(0/1)와
// 결과가 같지만, 로컬 재현·테스트가 쉬운 쪽을 택했다.

import { inferDayLabel } from "./instagram";

export type PostSlot = "morning" | "evening";

export function getPostSlot(today: string): PostSlot {
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
