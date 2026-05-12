"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { SoccerStanding } from "@/types/standings";
import { Last5Dots } from "./Last5Dots";
import { StreakChip } from "./StreakChip";
import { rankStatusStyle, uniqueRankStatuses } from "./rankStatus";

type SortKey =
  | "rank"
  | "matchesPlayed"
  | "wins"
  | "draws"
  | "losses"
  | "goals"
  | "goalsConceded"
  | "goalsDifference"
  | "points";

interface Col {
  key: SortKey;
  label: string;
  /** PC 전용으로 모바일에선 숨길 컬럼 */
  hideOnMobile?: boolean;
}

const COLS: Col[] = [
  { key: "matchesPlayed", label: "경기" },
  { key: "wins", label: "승" },
  { key: "draws", label: "무" },
  { key: "losses", label: "패" },
  { key: "goals", label: "득", hideOnMobile: true },
  { key: "goalsConceded", label: "실", hideOnMobile: true },
  { key: "goalsDifference", label: "득실" },
  { key: "points", label: "승점" },
];

export function SoccerTable({ teams }: { teams: SoccerStanding[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    const arr = [...teams];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const diff = (av as number) - (bv as number);
      // 같은 값일 땐 rank 오름차순으로 안정 정렬
      if (diff === 0) return a.rank - b.rank;
      return sortDir === "asc" ? diff : -diff;
    });
    return arr;
  }, [teams, sortKey, sortDir]);

  const onHeaderClick = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // 순위는 작을수록 좋음 → asc 기본. 그 외 통계는 큰 게 좋으니 desc 기본.
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  };

  const legend = uniqueRankStatuses(teams.map((t) => t.rankStatus));

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50">
      <div className="-mx-px overflow-x-auto">
        <table className="min-w-full text-sm text-zinc-200">
          <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur">
            <tr className="border-b border-zinc-800">
              <SortableTh
                label="#"
                active={sortKey === "rank"}
                dir={sortDir}
                onClick={() => onHeaderClick("rank")}
                className="w-12 text-center"
              />
              <th className="px-3 py-3 text-left font-semibold text-zinc-400">팀</th>
              {COLS.map((c) => (
                <SortableTh
                  key={c.key}
                  label={c.label}
                  active={sortKey === c.key}
                  dir={sortDir}
                  onClick={() => onHeaderClick(c.key)}
                  className={`w-14 text-center ${c.hideOnMobile ? "hidden sm:table-cell" : ""}`}
                />
              ))}
              <th className="hidden w-28 px-3 py-3 text-center font-semibold text-zinc-400 sm:table-cell">
                최근 5
              </th>
              <th className="w-20 px-3 py-3 text-center font-semibold text-zinc-400">연속</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const st = rankStatusStyle(t.rankStatus);
              return (
                <tr
                  key={t.teamName}
                  className="group border-b border-zinc-800/60 transition-colors duration-150 last:border-b-0 hover:bg-zinc-900/60"
                >
                  <td className="relative w-12 px-2 py-3 text-center">
                    {st && (
                      <span
                        className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full ${st.bar}`}
                        aria-hidden
                      />
                    )}
                    <span className="font-bold tabular-nums text-zinc-100">{t.rank}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      {t.teamLogo && (
                        <Image
                          src={t.teamLogo}
                          alt={t.teamName}
                          width={22}
                          height={22}
                          className="h-[22px] w-[22px] object-contain"
                          unoptimized
                        />
                      )}
                      <span className="font-medium text-zinc-100">{t.teamName}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center tabular-nums text-zinc-300">
                    {t.matchesPlayed}
                  </td>
                  <td className="px-2 py-3 text-center tabular-nums text-zinc-300">{t.wins}</td>
                  <td className="px-2 py-3 text-center tabular-nums text-zinc-300">{t.draws}</td>
                  <td className="px-2 py-3 text-center tabular-nums text-zinc-300">{t.losses}</td>
                  <td className="hidden px-2 py-3 text-center tabular-nums text-zinc-300 sm:table-cell">
                    {t.goals}
                  </td>
                  <td className="hidden px-2 py-3 text-center tabular-nums text-zinc-300 sm:table-cell">
                    {t.goalsConceded}
                  </td>
                  <td
                    className={`px-2 py-3 text-center font-semibold tabular-nums ${
                      t.goalsDifference > 0
                        ? "text-emerald-400"
                        : t.goalsDifference < 0
                        ? "text-rose-400"
                        : "text-zinc-300"
                    }`}
                  >
                    {t.goalsDifference > 0 ? `+${t.goalsDifference}` : t.goalsDifference}
                  </td>
                  <td className="px-2 py-3 text-center font-bold tabular-nums text-white">
                    {t.points}
                  </td>
                  <td className="hidden px-3 py-3 text-center sm:table-cell">
                    <Last5Dots lastFive={t.lastFive} />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <StreakChip streak={t.streak} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {legend.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-800/80 px-4 py-3 text-xs text-zinc-400">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-3 w-[3px] rounded-sm ${l.bar}`} />
              {l.label}
            </span>
          ))}
          <span className="ml-auto text-zinc-500 sm:hidden">
            ← 가로 스크롤
          </span>
        </div>
      )}
    </div>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`px-2 py-3 font-semibold ${className ?? ""}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-0.5 transition-colors ${
          active ? "text-white" : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        {label}
        <span
          className={`text-[10px] leading-none transition-opacity ${
            active ? "opacity-100" : "opacity-0 group-hover:opacity-40"
          }`}
          aria-hidden
        >
          {dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}
