"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { BaseballStanding } from "@/types/standings";
import { Last5Dots } from "./Last5Dots";
import { StreakChip } from "./StreakChip";

type SortKey =
  | "rank"
  | "winRate"
  | "gameCount"
  | "win"
  | "draw"
  | "lose"
  | "gameBehind";

export function BaseballTable({ teams }: { teams: BaseballStanding[] }) {
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
      setSortDir(key === "rank" || key === "gameBehind" ? "asc" : "desc");
    }
  };

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
              label="승률"
              active={sortKey === "winRate"}
              dir={sortDir}
              onClick={() => onHeaderClick("winRate")}
              className="w-[14%]"
              highlight
            />
            <Th
              label="경기"
              active={sortKey === "gameCount"}
              dir={sortDir}
              onClick={() => onHeaderClick("gameCount")}
              className="w-[10%]"
            />
            <Th
              label="승"
              active={sortKey === "win"}
              dir={sortDir}
              onClick={() => onHeaderClick("win")}
              className="w-[8%]"
            />
            <Th
              label="무"
              active={sortKey === "draw"}
              dir={sortDir}
              onClick={() => onHeaderClick("draw")}
              className="hidden sm:table-cell sm:w-[7%]"
            />
            <Th
              label="패"
              active={sortKey === "lose"}
              dir={sortDir}
              onClick={() => onHeaderClick("lose")}
              className="w-[8%]"
            />
            <Th
              label="게임차"
              active={sortKey === "gameBehind"}
              dir={sortDir}
              onClick={() => onHeaderClick("gameBehind")}
              className="w-[14%]"
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
          {sorted.map((t) => (
            <tr
              key={t.teamName}
              className="border-b border-zinc-800/60 transition-colors duration-150 last:border-b-0 hover:bg-zinc-900/50"
            >
              <td className="px-1 py-2 text-center">
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
                {t.winRate.toFixed(3)}
              </td>
              <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.gameCount}</td>
              <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.win}</td>
              <td className="hidden px-1 py-2 text-center tabular-nums text-zinc-300 sm:table-cell">
                {t.draw}
              </td>
              <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.lose}</td>
              <td className="px-1 py-2 text-center tabular-nums text-zinc-300">
                {t.gameBehind === 0 ? "—" : t.gameBehind.toFixed(1)}
              </td>
              <td className="hidden px-2 py-2 text-center sm:table-cell">
                <Last5Dots lastFive={t.lastFive} />
              </td>
              <td className="hidden px-1 py-2 text-center sm:table-cell">
                <StreakChip streak={t.streak} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
