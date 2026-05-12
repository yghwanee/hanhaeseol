"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { KboStanding } from "@/types/standings";
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
}

const COLS: Col[] = [
  { key: "gameCount", label: "경기" },
  { key: "win", label: "승" },
  { key: "draw", label: "무" },
  { key: "lose", label: "패" },
  { key: "winRate", label: "승률" },
  { key: "gameBehind", label: "게임차" },
];

export function KboTable({ teams }: { teams: KboStanding[] }) {
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
      // 순위·게임차는 작을수록 좋음 → asc 기본. 그 외는 desc.
      setSortDir(key === "rank" || key === "gameBehind" ? "asc" : "desc");
    }
  };

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
                  className="w-16 text-center"
                />
              ))}
              <th className="hidden w-28 px-3 py-3 text-center font-semibold text-zinc-400 sm:table-cell">
                최근 5
              </th>
              <th className="w-20 px-3 py-3 text-center font-semibold text-zinc-400">연속</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr
                key={t.teamName}
                className="border-b border-zinc-800/60 transition-colors duration-150 last:border-b-0 hover:bg-zinc-900/60"
              >
                <td className="w-12 px-2 py-3 text-center">
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
                  {t.gameCount}
                </td>
                <td className="px-2 py-3 text-center tabular-nums text-zinc-300">{t.win}</td>
                <td className="px-2 py-3 text-center tabular-nums text-zinc-300">{t.draw}</td>
                <td className="px-2 py-3 text-center tabular-nums text-zinc-300">{t.lose}</td>
                <td className="px-2 py-3 text-center font-bold tabular-nums text-white">
                  {t.winRate.toFixed(3)}
                </td>
                <td className="px-2 py-3 text-center tabular-nums text-zinc-300">
                  {t.gameBehind === 0 ? "—" : t.gameBehind.toFixed(1)}
                </td>
                <td className="hidden px-3 py-3 text-center sm:table-cell">
                  <Last5Dots lastFive={t.lastFive} />
                </td>
                <td className="px-2 py-3 text-center">
                  <StreakChip streak={t.streak} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-zinc-800/80 px-4 py-3 text-xs text-zinc-500 sm:hidden">
        ← 가로 스크롤로 더 보기
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
            active ? "opacity-100" : "opacity-30"
          }`}
          aria-hidden
        >
          {dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}
