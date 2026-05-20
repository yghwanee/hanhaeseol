import React from "react";
import type { GameStatus } from "@/types/results";

// "순위" 버튼과 동일 톤 — 코너 브래킷 + 미세 빗금 (40% 톤). 색은 텍스트로만 구분.
const BASE =
  "btn-caps-stripe caps-stripe-muted inline-flex items-center gap-1 whitespace-nowrap px-2 py-1 text-[11px] sm:text-xs";

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
  // 결과 크롤로 확인된 라이브는 어떤 경우에도 LIVE 배지로 표시. 펄스 도트로 라이브감 유지.
  if (resultStatus === "live") {
    return (
      <span className={`${BASE} text-rose-400`}>
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
        LIVE
      </span>
    );
  }
  if (resultStatus === "canceled") {
    return <span className={`${BASE} text-zinc-400`}>취소</span>;
  }
  if (resultStatus === "postponed") {
    return <span className={`${BASE} text-amber-400`}>연기</span>;
  }
  // resultStatus === "finished"면 어떤 경우든 경기 종료. 그 외에는 기존 시간 기반 finished를 신뢰.
  if (resultStatus === "finished" || finished) {
    return <span className={`${BASE} text-zinc-400`}>경기 종료</span>;
  }
  if (status === true) {
    // 박스는 caps-stripe-soft, 텍스트 스타일은 다른 뱃지(경기 종료 등)와 동일하게 일반 폰트.
    return (
      <span className="btn-caps-stripe caps-stripe-soft inline-flex items-center whitespace-nowrap px-2 py-1 text-[11px] sm:text-xs">
        한국어해설
      </span>
    );
  }
  if (status === false) {
    // 한국어해설(caps-stripe-soft)의 색 반전 — 어두운 박스 + 밝은 텍스트.
    return (
      <span className="btn-caps-stripe caps-stripe-soft-inverse inline-flex items-center whitespace-nowrap px-2 py-1 text-[11px] sm:text-xs">
        현지해설
      </span>
    );
  }
  return <span className={`${BASE} text-yellow-400`}>확인중</span>;
}

export const StatusBadge = React.memo(StatusBadgeInner);
