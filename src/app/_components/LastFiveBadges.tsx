import React from "react";
import { TeamRecord } from "@/types/team-record";

type StreakInfo = { count: number; type: "W" | "L"; approx: boolean };

/**
 * streak 우선순위:
 * 1. record.streak (네이버 continuousGameResult — 정확)
 * 2. last5에서 추정. 단 form 전체가 같은 결과면 더 길 수도 있으므로 approx=true ("5+" 표시)
 */
function resolveStreak(form: string, exact?: TeamRecord["streak"]): StreakInfo | null {
  if (exact && (exact.type === "W" || exact.type === "L") && exact.count >= 2) {
    return { count: exact.count, type: exact.type, approx: false };
  }
  if (!form) return null;
  const first = form[0];
  if (first !== "W" && first !== "L") return null;
  let count = 0;
  for (const c of form) {
    if (c === first) count++;
    else break;
  }
  if (count < 2) return null;
  // 보이는 기록 전체가 같은 결과면 윈도우 밖에 더 있을 수 있음 → "5+"로 정직하게.
  const approx = count === form.length;
  return { count, type: first, approx };
}

function LastFiveBadgesInner({
  form,
  mirror = false,
  streak: streakProp,
}: {
  form: string;
  mirror?: boolean;
  streak?: TeamRecord["streak"];
}) {
  if (!form) return null;
  // 네이버 lastFiveGames는 최근→오래된 순(검증됨: ESPN 결과와 1:1 매칭).
  // mirror=false (원정/기본): 왼쪽=최근으로 그대로 표시.
  // mirror=true (홈팀): VS 쪽(오른쪽)으로 최근이 가도록 뒤집어 표시.
  const sliced = form.slice(0, 5).split("");
  const chars = mirror ? sliced.reverse() : sliced;
  const latestIdx = mirror ? chars.length - 1 : 0;

  const streak = resolveStreak(form, streakProp);
  const streakChip = streak ? (
    <span
      aria-label={`${streak.count}${streak.approx ? "경기 이상 " : ""}${streak.type === "W" ? "연승" : "연패"}`}
      title={streak.approx ? "최근 5경기 기준 추정값 (실제로는 더 길 수 있음)" : undefined}
      className={`inline-flex h-3 sm:h-3.5 items-center justify-center rounded-[3px] px-1 text-[8px] sm:text-[9px] font-bold leading-none ring-1 ${
        streak.type === "W"
          ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
          : "bg-rose-500/15 text-rose-300 ring-rose-500/30"
      }`}
    >
      {streak.count}
      {streak.approx ? "+" : ""}
      {streak.type === "W" ? "연승" : "연패"}
    </span>
  ) : null;

  return (
    <div
      className="flex items-start gap-1.5"
      aria-label={`최근 ${chars.length}경기 (${mirror ? "오른쪽" : "왼쪽"}이 최근) ${chars.join("")}`}
    >
      {/* 홈팀: 칩을 왼쪽(팀 이름 쪽 = 외곽)에 배치 */}
      {mirror && streakChip}

      <div className="flex items-end gap-1">
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

      {/* 원정팀: 칩을 오른쪽(팀 이름 쪽 = 외곽)에 배치 */}
      {!mirror && streakChip}
    </div>
  );
}

export const LastFiveBadges = React.memo(LastFiveBadgesInner);
