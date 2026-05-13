import React from "react";
import type { GameStatus } from "@/types/results";

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
  // 결과 크롤로 확인된 라이브는 어떤 경우에도 LIVE 배지로 표시.
  if (resultStatus === "live") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-rose-400 ring-1 ring-rose-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
        LIVE
      </span>
    );
  }
  if (resultStatus === "canceled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/20 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-zinc-400 ring-1 ring-zinc-500/30">
        취소
      </span>
    );
  }
  if (resultStatus === "postponed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-amber-400 ring-1 ring-amber-500/30">
        연기
      </span>
    );
  }
  // resultStatus === "finished"면 어떤 경우든 경기 종료. 그 외에는 기존 시간 기반 finished를 신뢰.
  if (resultStatus === "finished" || finished) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/20 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-zinc-400 ring-1 ring-zinc-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        경기 종료
      </span>
    );
  }
  if (status === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        한국어해설
      </span>
    );
  }
  if (status === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-rose-400 ring-1 ring-rose-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        현지해설
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-yellow-400 ring-1 ring-yellow-500/30">
      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
      확인중
    </span>
  );
}

export const StatusBadge = React.memo(StatusBadgeInner);
