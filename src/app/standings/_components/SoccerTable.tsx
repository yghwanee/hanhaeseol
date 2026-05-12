"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { SoccerStanding } from "@/types/standings";
import { Last5Dots } from "./Last5Dots";
import { StreakChip } from "./StreakChip";
import { rankStatusStyle, uniqueRankStatuses } from "./rankStatus";

type SortKey =
  | "rank"
  | "points"
  | "matchesPlayed"
  | "wins"
  | "draws"
  | "losses"
  | "goals"
  | "goalsConceded"
  | "goalsDifference";

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
    <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/50">
      <table className="w-full table-fixed text-[11px] sm:text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/60">
            <Th
              label="#"
              active={sortKey === "rank"}
              dir={sortDir}
              onClick={() => onHeaderClick("rank")}
              className="w-[8%]"
            />
            <th className="px-1.5 py-2.5 text-left text-[11px] font-semibold text-zinc-400 sm:px-2 sm:text-xs">
              팀
            </th>
            <Th
              label="승점"
              active={sortKey === "points"}
              dir={sortDir}
              onClick={() => onHeaderClick("points")}
              className="w-[11%]"
              highlight
            />
            <Th
              label="경기"
              active={sortKey === "matchesPlayed"}
              dir={sortDir}
              onClick={() => onHeaderClick("matchesPlayed")}
              className="w-[10%]"
            />
            <Th
              label="승"
              active={sortKey === "wins"}
              dir={sortDir}
              onClick={() => onHeaderClick("wins")}
              className="w-[8%]"
            />
            <Th
              label="무"
              active={sortKey === "draws"}
              dir={sortDir}
              onClick={() => onHeaderClick("draws")}
              className="w-[8%]"
            />
            <Th
              label="패"
              active={sortKey === "losses"}
              dir={sortDir}
              onClick={() => onHeaderClick("losses")}
              className="w-[8%]"
            />
            <Th
              label="득"
              active={sortKey === "goals"}
              dir={sortDir}
              onClick={() => onHeaderClick("goals")}
              className="hidden sm:table-cell sm:w-[7%]"
            />
            <Th
              label="실"
              active={sortKey === "goalsConceded"}
              dir={sortDir}
              onClick={() => onHeaderClick("goalsConceded")}
              className="hidden sm:table-cell sm:w-[7%]"
            />
            <Th
              label="득실"
              active={sortKey === "goalsDifference"}
              dir={sortDir}
              onClick={() => onHeaderClick("goalsDifference")}
              className="hidden sm:table-cell sm:w-[8%]"
            />
            <th className="hidden px-2 py-2.5 text-center text-[11px] font-semibold text-zinc-400 sm:table-cell sm:w-[12%] sm:text-xs">
              최근 5
            </th>
            <th className="hidden px-1 py-2.5 text-center text-[11px] font-semibold text-zinc-400 sm:table-cell sm:w-[10%] sm:text-xs">
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
                className="border-b border-zinc-800/60 transition-colors duration-150 last:border-b-0 hover:bg-zinc-900/50"
              >
                <td className="relative px-1 py-2 text-center">
                  {st && (
                    <span
                      className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full ${st.bar}`}
                      aria-hidden
                    />
                  )}
                  <span className="font-bold tabular-nums text-zinc-100">{t.rank}</span>
                </td>
                <td className="px-1.5 py-2 sm:px-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {t.teamLogo && (
                      <Image
                        src={t.teamLogo}
                        alt={t.teamName}
                        width={20}
                        height={20}
                        className="h-4 w-4 shrink-0 object-contain sm:h-5 sm:w-5"
                        unoptimized
                      />
                    )}
                    <span className="truncate font-medium text-zinc-100">{t.teamName}</span>
                  </div>
                </td>
                <td className="px-1 py-2 text-center font-bold tabular-nums text-white">
                  {t.points}
                </td>
                <td className="px-1 py-2 text-center tabular-nums text-zinc-300">
                  {t.matchesPlayed}
                </td>
                <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.wins}</td>
                <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.draws}</td>
                <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.losses}</td>
                <td className="hidden px-1 py-2 text-center tabular-nums text-zinc-300 sm:table-cell">
                  {t.goals}
                </td>
                <td className="hidden px-1 py-2 text-center tabular-nums text-zinc-300 sm:table-cell">
                  {t.goalsConceded}
                </td>
                <td
                  className={`hidden px-1 py-2 text-center font-semibold tabular-nums sm:table-cell ${
                    t.goalsDifference > 0
                      ? "text-emerald-400"
                      : t.goalsDifference < 0
                      ? "text-rose-400"
                      : "text-zinc-300"
                  }`}
                >
                  {t.goalsDifference > 0 ? `+${t.goalsDifference}` : t.goalsDifference}
                </td>
                <td className="hidden px-2 py-2 text-center sm:table-cell">
                  <Last5Dots lastFive={t.lastFive} />
                </td>
                <td className="hidden px-1 py-2 text-center sm:table-cell">
                  <StreakChip streak={t.streak} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {legend.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-zinc-800/80 px-3 py-2.5 text-[10px] text-zinc-400 sm:px-4 sm:text-[11px]">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1">
              <span className={`inline-block h-3 w-[3px] rounded-sm ${l.bar}`} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Th({
  label,
  active,
  dir,
  onClick,
  className,
  highlight = false,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <th className={`px-1 py-2.5 text-center text-[11px] font-semibold sm:text-xs ${className ?? ""}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-0.5 transition-colors ${
          active
            ? "text-white"
            : highlight
            ? "text-zinc-300 hover:text-white"
            : "text-zinc-400 hover:text-zinc-200"
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
