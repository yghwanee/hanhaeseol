"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  BaseballLeagueStandings,
  SoccerLeagueStandings,
  StandingsData,
} from "@/types/standings";
import { FilterButton } from "../../_components/FilterButton";
import { SoccerTable } from "./SoccerTable";
import { BaseballTable } from "./BaseballTable";
import { MlbStandingsTable } from "./MlbStandingsTable";

type SportKey = "soccer" | "baseball";

const SPORTS: { key: SportKey; label: string }[] = [
  { key: "soccer", label: "축구" },
  { key: "baseball", label: "야구" },
];

/** 리그 동그라미 안에 표시할 짧은 약자. 한국 시청자가 즉시 알아보는 표기. */
const LEAGUE_SHORT: Record<string, string> = {
  epl: "EPL",
  primera: "라리가",
  bundesliga: "분데스",
  seria: "세리에",
  ligue1: "리그앙",
  champs: "챔스",
  europa: "유로파",
  mls: "MLS",
  kleague: "K리그",
  kleague2: "K리그2",
  eredivisie: "에레디",
  kbo: "KBO",
  mlb: "MLB",
};

export function StandingsView({ data }: { data: StandingsData }) {
  const [sport, setSport] = useState<SportKey>("soccer");

  const leagues = useMemo<
    Array<SoccerLeagueStandings | BaseballLeagueStandings>
  >(() => {
    return sport === "soccer" ? data.soccer : data.baseball;
  }, [sport, data]);

  const [leagueId, setLeagueId] = useState<string>(() => leagues[0]?.id ?? "");

  const onSportClick = (s: SportKey) => {
    setSport(s);
    const first = s === "soccer" ? data.soccer[0]?.id : data.baseball[0]?.id;
    if (first) setLeagueId(first);
  };

  const current = leagues.find((l) => l.id === leagueId) ?? leagues[0];

  // 메인 페이지 PLATFORM 필터와 동일한 가로 스크롤 + indicator + 드래그
  const scrollerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    isDown: false,
    isDragging: false,
    startX: 0,
    scrollLeft: 0,
  });

  useEffect(() => {
    const el = scrollerRef.current;
    const bar = indicatorRef.current;
    if (!el || !bar) return;
    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const maxScroll = el.scrollWidth - el.clientWidth;
        const ratio = maxScroll > 0 ? el.scrollLeft / maxScroll : 0;
        bar.style.transform = `translateX(${ratio * 186}%)`;
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
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mouseup", stopDrag, true);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("mouseup", stopDrag, true);
    };
  }, []);

  return (
    <div>
      {/* 페이지 제목 + 종목 탭 (한 줄) */}
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mb-8">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">팀 순위</h1>
        <div className="flex gap-1 sm:gap-1.5">
          {SPORTS.map((s) => (
            <FilterButton
              key={s.key}
              label={s.label}
              active={sport === s.key}
              onClick={() => onSportClick(s.key)}
            />
          ))}
        </div>
      </div>

      {/* 리그 가로 스크롤 (메인 PLATFORM 필터와 동일) */}
      <div className="pt-2">
        <div
          ref={scrollerRef}
          className="flex overflow-x-auto overflow-y-hidden scrollbar-hide pb-1 pt-1 -mt-1"
        >
          {leagues.map((lg) => {
            const active = lg.id === current?.id;
            const short = LEAGUE_SHORT[lg.id] ?? lg.name.slice(0, 3);
            return (
              <button
                key={lg.id}
                onClick={() => setLeagueId(lg.id)}
                className="flex shrink-0 flex-col items-center gap-1.5 group"
                style={{ width: 75 }}
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 ${
                    active
                      ? "bg-zinc-200 ring-2 ring-zinc-400 scale-105"
                      : "bg-zinc-800/80 group-hover:bg-zinc-700/80 group-hover:scale-105"
                  }`}
                >
                  <span
                    className={`font-bold tracking-tight ${
                      short.length >= 4 ? "text-[10px]" : "text-[12px]"
                    } ${active ? "text-zinc-900" : "text-zinc-200"}`}
                  >
                    {short}
                  </span>
                </div>
                <span
                  className={`text-[10px] sm:text-[11px] font-medium transition-colors whitespace-nowrap ${
                    active ? "text-zinc-100" : "text-zinc-500 group-hover:text-zinc-300"
                  }`}
                >
                  {lg.name}
                </span>
              </button>
            );
          })}
          <div className="shrink-0 w-4" />
        </div>
        {/* Scroll indicator bar */}
        <div className="mt-3 mx-auto w-28 sm:w-32 h-[3px] rounded-full bg-zinc-800/60">
          <div
            ref={indicatorRef}
            className="h-full rounded-full bg-zinc-500/80"
            style={{ width: "35%", transform: "translateX(0%)", willChange: "transform" }}
          />
        </div>
      </div>

      {/* 선택 리그 헤더 + 편성표 진입 */}
      {current && (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                {current.name} 순위
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {current.teams.length}개 팀
              </p>
            </div>
            {current.scheduleSlug && (
              <Link
                href={`/league/${current.scheduleSlug}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/10 sm:text-sm"
              >
                {current.name} 한국어 해설 편성표 →
              </Link>
            )}
          </div>

          <div className="mt-4">
            {sport === "soccer" ? (
              <SoccerTable teams={(current as SoccerLeagueStandings).teams} />
            ) : current.id === "mlb" ? (
              <MlbStandingsTable teams={(current as BaseballLeagueStandings).teams} />
            ) : (
              <BaseballTable teams={(current as BaseballLeagueStandings).teams} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
