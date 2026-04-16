import React from "react";

function StatusBadgeInner({
  status,
  finished,
}: {
  status: boolean | "unknown";
  finished: boolean;
}) {
  if (finished) {
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
