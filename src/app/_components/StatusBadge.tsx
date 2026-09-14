import React from "react";
import type { GameStatus } from "@/types/results";

/**
 * 경기 상태 뱃지 — 원티드(몽타주) badge 규격.
 *
 * 🔴 종전에는 코너 브래킷 + 빗금(`btn-caps-stripe`)에 에메랄드·로즈·옐로 **네온 글자**를
 * 얹었다. 검정 배경 위 네온은 이 사이트가 "AI가 만든 화면"으로 읽히던 가장 큰 이유였다.
 * 원티드 규칙은 **washed 배경 + 짙은 글자**다 — 6px 라운드, padding 5/8, 12px/600.
 *
 * 색 배정 원칙: 정보의 성질에 따라 시맨틱 색을 쓰되, **한 카드에서 색이 두 개를 넘지 않게**
 * 한다. 그래서 플랫폼 뱃지는 무채색(neutral)으로 두고 여기만 색을 갖는다.
 */
const BASE = "w-badge";

function StatusBadgeInner({
  status,
  finished,
  resultStatus,
}: {
  status: boolean | "unknown";
  finished: boolean;
  /** 네이버 결과로 확인된 경기 상태. live면 finished/status보다 우선. */
  resultStatus?: GameStatus;
}) {
  // 결과 크롤로 확인된 라이브는 어떤 경우에도 LIVE 배지. 이 사이트에서 danger 색을 쓰는
  // 유일한 자리다 — 다른 곳에 빨강을 풀면 LIVE 가 눈에 안 들어온다.
  if (resultStatus === "live") {
    return (
      <span className={`${BASE} w-badge--danger`}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        LIVE
      </span>
    );
  }
  if (resultStatus === "canceled") {
    return <span className={`${BASE} w-badge--outline`}>취소</span>;
  }
  if (resultStatus === "postponed") {
    return <span className={`${BASE} w-badge--warning`}>연기</span>;
  }
  // resultStatus === "finished"면 어떤 경우든 경기 종료. 그 외에는 시간 기반 finished를 신뢰.
  if (resultStatus === "finished" || finished) {
    return <span className={`${BASE} w-badge--outline`}>경기 종료</span>;
  }
  if (status === true) {
    // 이 서비스의 존재 이유가 이 한 줄이다. 초록 washed 로 가장 눈에 띄게 둔다.
    return <span className={`${BASE} w-badge--success`}>한국어 해설</span>;
  }
  if (status === false) {
    return <span className={`${BASE} w-badge--neutral`}>현지 해설</span>;
  }
  return <span className={`${BASE} w-badge--warning`}>확인 중</span>;
}

export const StatusBadge = React.memo(StatusBadgeInner);
