import React from "react";
import type { GameStatus } from "@/types/results";

/**
 * 경기 상태 뱃지 — 원티드(몽타주) badge 규격.
 *
 * 🔴 종전에는 코너 브래킷 + 빗금(`btn-caps-stripe`)에 에메랄드·로즈·옐로 **네온 글자**를
 * 얹었다. 검정 배경 위 네온은 이 사이트가 "AI가 만든 화면"으로 읽히던 가장 큰 이유였다.
 * 원티드 규칙은 **washed 배경 + 짙은 글자**다 — 6px 라운드, padding 5/8, 12px/600.
 *
 * 🔴 색은 **파랑·빨강 둘뿐**이다(키 컬러 정책, globals.css 참조).
 *   파랑 = 한국어 해설 / 빨강 = LIVE / 나머지는 전부 무채색.
 *   초록·주황을 다시 넣지 말 것 — 색이 늘면 정작 "한국어 해설"이 안 보인다.
 */
const BASE = "w-badge";

function StatusBadgeInner({
  status,
  finished,
  resultStatus,
  stateOnly = false,
}: {
  status: boolean | "unknown";
  finished: boolean;
  /** 네이버 결과로 확인된 경기 상태. live면 finished/status보다 우선. */
  resultStatus?: GameStatus;
  /**
   * true 면 **경기 상태만** 그린다(LIVE·취소·연기·종료). 해설 여부는 카드 하단
   * 시그너처 줄이 맡는다 — 같은 정보를 카드 두 곳에 그리면 위계가 무너진다.
   */
  stateOnly?: boolean;
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
    return <span className={`${BASE} w-badge--outline`}>연기</span>;
  }
  // resultStatus === "finished"면 어떤 경우든 경기 종료. 그 외에는 시간 기반 finished를 신뢰.
  if (resultStatus === "finished" || finished) {
    return <span className={`${BASE} w-badge--outline`}>경기 종료</span>;
  }
  if (stateOnly) return null;
  if (status === true) {
    // 이 서비스의 존재 이유가 이 한 줄이다. **파랑**이 그 뜻을 전담한다(키 컬러 정책).
    return <span className={`${BASE} w-badge--brand`}>한국어 해설</span>;
  }
  if (status === false) {
    return <span className={`${BASE} w-badge--neutral`}>현지 해설</span>;
  }
  return <span className={`${BASE} w-badge--outline`}>확인 중</span>;
}

export const StatusBadge = React.memo(StatusBadgeInner);
