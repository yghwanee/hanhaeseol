"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
      // sticky freeze 컬럼(순위/팀) 위에서 시작한 드래그는 스크롤 트리거 X.
      if ((e.target as HTMLElement | null)?.closest(".sticky")) return;
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
      <div className="relative">
        <div ref={scrollerRef} className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[560px] table-fixed text-[12px] sm:text-sm">
            <colgroup>
              <col className="w-10 sm:w-12" />
              <col className="w-[110px] sm:w-[170px]" />
              <col className="w-14 sm:w-16" />
              <col className="w-12 sm:w-14" />
              <col className="w-10 sm:w-12" />
              <col className="w-10 sm:w-12" />
              <col className="w-10 sm:w-12" />
              <col className="w-14 sm:w-16" />
              <col className="w-24 sm:w-28" />
              <col className="w-16 sm:w-20" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur">
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <Th
                  label="순위"
                  active={sortKey === "rank"}
                  dir={sortDir}
                  onClick={() => onHeaderClick("rank")}
                  className="sticky left-0 z-20 bg-zinc-900"
                />
                <th className="sticky left-10 z-20 whitespace-nowrap bg-zinc-900 px-1.5 py-2.5 text-left text-[11px] font-semibold text-zinc-400 sm:left-12 sm:px-2 sm:text-xs">
                  팀
                </th>
                <Th label="승률" active={sortKey === "winRate"} dir={sortDir} onClick={() => onHeaderClick("winRate")} highlight />
                <Th label="경기" active={sortKey === "gameCount"} dir={sortDir} onClick={() => onHeaderClick("gameCount")} />
                <Th label="승" active={sortKey === "win"} dir={sortDir} onClick={() => onHeaderClick("win")} />
                <Th label="무" active={sortKey === "draw"} dir={sortDir} onClick={() => onHeaderClick("draw")} />
                <Th label="패" active={sortKey === "lose"} dir={sortDir} onClick={() => onHeaderClick("lose")} />
                <Th label="게임차" active={sortKey === "gameBehind"} dir={sortDir} onClick={() => onHeaderClick("gameBehind")} />
                <th className="whitespace-nowrap px-2 py-2.5 text-center text-[11px] font-semibold text-zinc-400 sm:text-xs">
                  최근 5
                </th>
                <th className="whitespace-nowrap px-1 py-2.5 text-center text-[11px] font-semibold text-zinc-400 sm:text-xs">
                  연속
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
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
                  <td className="px-1 py-2 text-center tabular-nums text-zinc-300">{t.draw}</td>
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
          className={`pointer-events-none absolute left-[150px] top-0 bottom-0 w-10 bg-gradient-to-r from-zinc-950 via-zinc-950/70 to-transparent transition-opacity duration-200 sm:left-[218px] ${
            showLeftFade ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <div
          className={`pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-zinc-950 via-zinc-950/70 to-transparent transition-opacity duration-200 ${
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
  active,
  dir,
  onClick,
  highlight = false,
  className = "",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <th className={`whitespace-nowrap text-center align-middle text-[11px] font-semibold sm:text-xs ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center justify-center gap-0.5 whitespace-nowrap px-1 py-2.5 transition-colors ${
          active
            ? "text-white"
            : highlight
            ? "text-emerald-300 hover:text-emerald-200"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        {/* 좌측 invisible spacer: 우측 화살표와 같은 폭을 확보해 라벨을 셀 정중앙으로 */}
        <span className="text-[10px] leading-none opacity-0" aria-hidden>
          ▲
        </span>
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
