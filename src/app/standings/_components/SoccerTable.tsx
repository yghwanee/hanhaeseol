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
  /** PC 전용으로 모바일에서 숨길 컬럼 */
  hideOnMobile?: boolean;
  width: string;
}

const COLS: Col[] = [
  { key: "matchesPlayed", label: "경기", width: "w-10" },
  { key: "wins", label: "승", width: "w-9" },
  { key: "draws", label: "무", width: "w-9" },
  { key: "losses", label: "패", width: "w-9" },
  { key: "goals", label: "득", hideOnMobile: true, width: "w-10" },
  { key: "goalsConceded", label: "실", hideOnMobile: true, width: "w-10" },
  { key: "goalsDifference", label: "득실", width: "w-12" },
  { key: "points", label: "승점", width: "w-11" },
];

const STICKY_BG = "bg-zinc-950";
const STICKY_BG_HOVER = "group-hover:bg-zinc-900";

export function SoccerTable({ teams }: { teams: SoccerStanding[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    const arr = [...teams];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const diff = (av as number) - (bv as number);
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
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  };

  const legend = uniqueRankStatuses(teams.map((t) => t.rankStatus));

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60">
              <SortableTh
                label="#"
                active={sortKey === "rank"}
                dir={sortDir}
                onClick={() => onHeaderClick("rank")}
                className={`sticky left-0 z-20 w-9 ${STICKY_BG}`}
              />
              <th
                className={`sticky left-9 z-20 w-[120px] px-2 py-2.5 text-left text-[11px] font-semibold text-zinc-400 sm:w-[140px] sm:text-xs ${STICKY_BG}`}
              >
                팀
              </th>
              {COLS.map((c) => (
                <SortableTh
                  key={c.key}
                  label={c.label}
                  active={sortKey === c.key}
                  dir={sortDir}
                  onClick={() => onHeaderClick(c.key)}
                  className={`${c.width} ${c.hideOnMobile ? "hidden sm:table-cell" : ""}`}
                />
              ))}
              <th className="hidden w-24 px-2 py-2.5 text-center text-[11px] font-semibold text-zinc-400 sm:table-cell sm:text-xs">
                최근 5
              </th>
              <th className="w-[68px] px-2 py-2.5 text-center text-[11px] font-semibold text-zinc-400 sm:w-20 sm:text-xs">
                연속
              </th>
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
                  <td
                    className={`sticky left-0 z-10 w-9 px-1 py-2 text-center ${STICKY_BG} ${STICKY_BG_HOVER}`}
                  >
                    {st && (
                      <span
                        className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full ${st.bar}`}
                        aria-hidden
                      />
                    )}
                    <span className="font-bold tabular-nums text-zinc-100">{t.rank}</span>
                  </td>
                  <td
                    className={`sticky left-9 z-10 w-[120px] px-2 py-2 sm:w-[140px] ${STICKY_BG} ${STICKY_BG_HOVER}`}
                  >
                    <div className="flex items-center gap-2">
                      {t.teamLogo && (
                        <Image
                          src={t.teamLogo}
                          alt={t.teamName}
                          width={20}
                          height={20}
                          className="h-5 w-5 shrink-0 object-contain"
                          unoptimized
                        />
                      )}
                      <span className="truncate font-medium text-zinc-100">{t.teamName}</span>
                    </div>
                  </td>
                  <td className="w-10 px-1 py-2 text-center tabular-nums text-zinc-300">
                    {t.matchesPlayed}
                  </td>
                  <td className="w-9 px-1 py-2 text-center tabular-nums text-zinc-300">{t.wins}</td>
                  <td className="w-9 px-1 py-2 text-center tabular-nums text-zinc-300">{t.draws}</td>
                  <td className="w-9 px-1 py-2 text-center tabular-nums text-zinc-300">{t.losses}</td>
                  <td className="hidden w-10 px-1 py-2 text-center tabular-nums text-zinc-300 sm:table-cell">
                    {t.goals}
                  </td>
                  <td className="hidden w-10 px-1 py-2 text-center tabular-nums text-zinc-300 sm:table-cell">
                    {t.goalsConceded}
                  </td>
                  <td
                    className={`w-12 px-1 py-2 text-center font-semibold tabular-nums ${
                      t.goalsDifference > 0
                        ? "text-emerald-400"
                        : t.goalsDifference < 0
                        ? "text-rose-400"
                        : "text-zinc-300"
                    }`}
                  >
                    {t.goalsDifference > 0 ? `+${t.goalsDifference}` : t.goalsDifference}
                  </td>
                  <td className="w-11 px-1 py-2 text-center font-bold tabular-nums text-white">
                    {t.points}
                  </td>
                  <td className="hidden w-24 px-2 py-2 text-center sm:table-cell">
                    <Last5Dots lastFive={t.lastFive} />
                  </td>
                  <td className="w-[68px] px-1 py-2 text-center sm:w-20">
                    <StreakChip streak={t.streak} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {legend.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-800/80 px-3 py-2.5 text-[11px] text-zinc-400 sm:px-4 sm:py-3 sm:text-xs">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-3 w-[3px] rounded-sm ${l.bar}`} />
              {l.label}
            </span>
          ))}
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
    <th className={`px-1 py-2.5 text-center text-[11px] font-semibold sm:text-xs ${className ?? ""}`}>
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
            active ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        >
          {dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}
