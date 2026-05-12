"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { BaseballStanding } from "@/types/standings";
import { Last5Dots } from "./Last5Dots";
import { StreakChip } from "./StreakChip";

type SortKey =
  | "rank"
  | "gameCount"
  | "win"
  | "draw"
  | "lose"
  | "winRate"
  | "gameBehind";

interface Col {
  key: SortKey;
  label: string;
  width: string;
  hideOnMobile?: boolean;
}

const COLS: Col[] = [
  { key: "gameCount", label: "경기", width: "w-10" },
  { key: "win", label: "승", width: "w-9" },
  { key: "draw", label: "무", width: "w-9", hideOnMobile: true },
  { key: "lose", label: "패", width: "w-9" },
  { key: "winRate", label: "승률", width: "w-14" },
  { key: "gameBehind", label: "게임차", width: "w-14" },
];

const STICKY_BG = "bg-zinc-950";
const STICKY_BG_HOVER = "group-hover:bg-zinc-900";

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
            {sorted.map((t) => (
              <tr
                key={t.teamName}
                className="group border-b border-zinc-800/60 transition-colors duration-150 last:border-b-0 hover:bg-zinc-900/60"
              >
                <td
                  className={`sticky left-0 z-10 w-9 px-1 py-2 text-center ${STICKY_BG} ${STICKY_BG_HOVER}`}
                >
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
                  {t.gameCount}
                </td>
                <td className="w-9 px-1 py-2 text-center tabular-nums text-zinc-300">{t.win}</td>
                <td className="hidden w-9 px-1 py-2 text-center tabular-nums text-zinc-300 sm:table-cell">
                  {t.draw}
                </td>
                <td className="w-9 px-1 py-2 text-center tabular-nums text-zinc-300">{t.lose}</td>
                <td className="w-14 px-1 py-2 text-center font-bold tabular-nums text-white">
                  {t.winRate.toFixed(3)}
                </td>
                <td className="w-14 px-1 py-2 text-center tabular-nums text-zinc-300">
                  {t.gameBehind === 0 ? "—" : t.gameBehind.toFixed(1)}
                </td>
                <td className="hidden w-24 px-2 py-2 text-center sm:table-cell">
                  <Last5Dots lastFive={t.lastFive} />
                </td>
                <td className="w-[68px] px-1 py-2 text-center sm:w-20">
                  <StreakChip streak={t.streak} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
