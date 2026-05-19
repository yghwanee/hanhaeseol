"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { BaseballStanding } from "@/types/standings";
import { Last5Dots } from "./Last5Dots";
import { StreakChip } from "./StreakChip";

/** MLB 지구 순서: 네이버 m.sports와 동일. */
const DIVISIONS: { league: string; division: string; label: string }[] = [
  { league: "AL", division: "EAST", label: "아메리칸리그 동부" },
  { league: "AL", division: "CENT", label: "아메리칸리그 중부" },
  { league: "AL", division: "WEST", label: "아메리칸리그 서부" },
  { league: "NL", division: "EAST", label: "내셔널리그 동부" },
  { league: "NL", division: "CENT", label: "내셔널리그 중부" },
  { league: "NL", division: "WEST", label: "내셔널리그 서부" },
];

export function MlbStandingsTable({ teams }: { teams: BaseballStanding[] }) {
  const groups = useMemo(() => {
    return DIVISIONS.map((d) => ({
      ...d,
      teams: teams
        .filter((t) => t.league === d.league && t.division === d.division)
        .sort((a, b) => a.rank - b.rank),
    })).filter((g) => g.teams.length > 0);
  }, [teams]);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <DivisionTable key={`${g.league}-${g.division}`} label={g.label} teams={g.teams} />
      ))}
    </div>
  );
}

function DivisionTable({
  label,
  teams,
}: {
  label: string;
  teams: BaseballStanding[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const dragState = useRef({ isDown: false, isDragging: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    const el = scrollerRef.current;
    const bar = indicatorRef.current;
    if (!el || !bar) return;
    let rafId = 0;
    const update = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      const ratio = maxScroll > 0 ? el.scrollLeft / maxScroll : 0;
      bar.style.transform = `translateX(${ratio * 186}%)`;
      setShowLeftFade(maxScroll > 2 && el.scrollLeft > 2);
      setShowRightFade(maxScroll > 2 && el.scrollLeft < maxScroll - 2);
    };
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        update();
      });
    };
    const stopDrag = () => {
      dragState.current.isDown = false;
      dragState.current.isDragging = false;
      el.style.cursor = "";
      el.style.userSelect = "";
    };
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      dragState.current.isDown = true;
      dragState.current.isDragging = false;
      dragState.current.startX = e.clientX;
      dragState.current.scrollLeft = el.scrollLeft;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragState.current.isDown) return;
      const dx = e.clientX - dragState.current.startX;
      if (!dragState.current.isDragging && Math.abs(dx) < 5) return;
      dragState.current.isDragging = true;
      el.style.cursor = "grabbing";
      el.scrollLeft = dragState.current.scrollLeft - dx;
    };
    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mouseup", stopDrag, true);
    const onResize = () => update();
    window.addEventListener("resize", onResize);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("mouseup", stopDrag, true);
      window.removeEventListener("resize", onResize);
    };
  }, [teams]);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/50">
      <div className="border-b border-zinc-800/80 px-3 py-2 sm:px-4">
        <h3 className="text-sm font-semibold text-white sm:text-base">{label}</h3>
      </div>
      <div className="relative">
        <div ref={scrollerRef} className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[520px] table-fixed text-[12px] sm:text-sm">
          <colgroup>
            <col className="w-10 sm:w-12" />
            <col className="w-[110px] sm:w-[160px]" />
            <col className="w-14 sm:w-16" />
            <col className="w-12 sm:w-14" />
            <col className="w-10 sm:w-12" />
            <col className="w-10 sm:w-12" />
            <col className="w-12 sm:w-14" />
            <col className="w-24 sm:w-28" />
            <col className="w-16 sm:w-20" />
          </colgroup>
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60">
              <Th label="순위" className="sticky left-0 z-20 bg-zinc-900" />
              <th className="sticky left-10 z-20 whitespace-nowrap bg-zinc-900 px-1.5 py-2 text-left text-[11px] font-semibold text-zinc-400 sm:left-12 sm:px-2 sm:text-xs">
                팀
              </th>
              <Th label="승률" highlight />
              <Th label="경기" />
              <Th label="승" />
              <Th label="패" />
              <Th label="게임차" />
              <th className="whitespace-nowrap px-2 py-2 text-center text-[11px] font-semibold text-zinc-400 sm:text-xs">
                최근 5
              </th>
              <th className="whitespace-nowrap px-1 py-2 text-center text-[11px] font-semibold text-zinc-400 sm:text-xs">
                연속
              </th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr
                key={t.teamName}
                className="group border-b border-zinc-800/60 transition-colors duration-150 last:border-b-0 hover:bg-zinc-900/50"
              >
                <td className="sticky left-0 z-10 bg-zinc-950 px-1 py-2 text-center transition-colors group-hover:bg-[#1a1a1d]">
                  <span className="font-bold tabular-nums text-zinc-100">{t.rank}</span>
                </td>
                <td className="sticky left-10 z-10 bg-zinc-950 px-1.5 py-2 transition-colors group-hover:bg-[#1a1a1d] sm:left-12 sm:px-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {t.teamLogo ? (
                      <Image
                        src={t.teamLogo}
                        alt={t.teamName}
                        width={22}
                        height={22}
                        className="h-[18px] w-[18px] shrink-0 object-contain sm:h-[22px] sm:w-[22px]"
                        unoptimized
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="inline-block h-[18px] w-[18px] shrink-0 rounded-full bg-zinc-800 sm:h-[22px] sm:w-[22px]" />
                    )}
                    <span className="truncate font-medium text-zinc-100">{t.teamName}</span>
                  </div>
                </td>
                <td className="px-1 py-2 text-center font-bold tabular-nums text-emerald-400">
                  {t.winRate.toFixed(3)}
                </td>
                <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.gameCount}</td>
                <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.win}</td>
                <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.lose}</td>
                <td className="px-1 py-2 text-center tabular-nums text-zinc-300">
                  {t.gameBehind === 0 ? "—" : t.gameBehind.toFixed(1)}
                </td>
                <td className="px-2 py-2 text-center">
                  <Last5Dots lastFive={t.lastFive} />
                </td>
                <td className="px-1 py-2 text-center">
                  <StreakChip streak={t.streak} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div
          className={`pointer-events-none absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-zinc-950 via-zinc-950/70 to-transparent transition-opacity duration-200 ${
            showLeftFade ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <div
          className={`pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-zinc-950 via-zinc-950/70 to-transparent transition-opacity duration-200 ${
            showRightFade ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
      </div>
      <div className="mx-auto mt-2 mb-2 h-[3px] w-24 rounded-full bg-zinc-800/60 sm:w-28">
        <div
          ref={indicatorRef}
          className="h-full rounded-full bg-zinc-500/80"
          style={{ width: "35%", transform: "translateX(0%)", willChange: "transform" }}
        />
      </div>
    </div>
  );
}

function Th({
  label,
  highlight = false,
  className = "",
}: {
  label: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap px-1 py-2 text-center align-middle text-[11px] font-semibold sm:text-xs ${
        highlight ? "text-emerald-300" : "text-zinc-400"
      } ${className}`}
    >
      {label}
    </th>
  );
}
