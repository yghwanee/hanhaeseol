import React from "react";

function LastFiveBadgesInner({ form, mirror = false }: { form: string; mirror?: boolean }) {
  if (!form) return null;
  // API 응답은 오래된→최근 순.
  // mirror=false (원정/기본): 네이버 기본처럼 왼쪽=최근으로 뒤집어 표시.
  // mirror=true (홈팀): VS 쪽으로 최근이 가도록 오른쪽=최근으로 표시 (뒤집지 않음).
  const sliced = form.slice(0, 5).split("");
  const chars = mirror ? sliced : sliced.reverse();
  const latestIdx = mirror ? chars.length - 1 : 0;
  return (
    <div
      className="flex items-end gap-1"
      aria-label={`최근 ${chars.length}경기 (${mirror ? "오른쪽" : "왼쪽"}이 최근) ${chars.join("")}`}
    >
      {chars.map((c, i) => {
        const isWin = c === "W";
        const isLose = c === "L";
        const isLatest = i === latestIdx;
        const cls = isWin
          ? "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30"
          : isLose
          ? "bg-rose-500/20 text-rose-400 ring-rose-500/30"
          : "bg-zinc-700/40 text-zinc-400 ring-zinc-600/40";
        // 최근 경기 강조 바: 결과 색을 따라 W=초록, L=빨강, 그 외=중립.
        const barCls = !isLatest
          ? "bg-transparent"
          : isWin
          ? "bg-emerald-400"
          : isLose
          ? "bg-rose-400"
          : "bg-zinc-400";
        const label = isWin ? "승" : isLose ? "패" : "무";
        return (
          <span
            key={i}
            title={`${isLatest ? "가장 최근" : `${i + 1}경기 전`}: ${label}`}
            className="flex flex-col items-center gap-1.5"
          >
            <span
              className={`inline-flex h-3 w-3 sm:h-3.5 sm:w-3.5 items-center justify-center rounded-[3px] text-[8px] sm:text-[9px] font-bold ring-1 ${cls}`}
            >
              {c}
            </span>
            <span
              className={`h-[2px] w-2.5 sm:w-3 rounded-full ${barCls}`}
              aria-hidden
            />
          </span>
        );
      })}
    </div>
  );
}

export const LastFiveBadges = React.memo(LastFiveBadgesInner);
