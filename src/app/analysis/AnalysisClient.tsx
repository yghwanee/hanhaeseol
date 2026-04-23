"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnalysisArticle } from "@/types/analysis";
import { LEAGUE_FLAG, FlagIcon } from "./_flags";

type MatchGroup = {
  homeTeam: string;
  awayTeam: string;
  sport: string;
  league: string;
  time: string;
  articles: AnalysisArticle[];
};

function groupByDate(articles: AnalysisArticle[]): Record<string, MatchGroup[]> {
  const byDate: Record<string, MatchGroup[]> = {};

  for (const a of articles) {
    if (!byDate[a.date]) byDate[a.date] = [];
    const matchKey = [a.homeTeam, a.awayTeam].sort().join("-");
    const existing = byDate[a.date].find(
      (g) => [g.homeTeam, g.awayTeam].sort().join("-") === matchKey
    );
    if (existing) {
      existing.articles.push(a);
    } else {
      byDate[a.date].push({
        homeTeam: a.homeTeam,
        awayTeam: a.awayTeam,
        sport: a.sport || "축구",
        league: a.league,
        time: a.time || "99:99",
        articles: [a],
      });
    }
  }

  for (const date of Object.keys(byDate)) {
    byDate[date].sort((a, b) => a.time.localeCompare(b.time));
  }

  return byDate;
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const cells: Array<{ date: string; day: number; dow: number } | null> = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date: dateStr, day: d, dow: new Date(year, month, d).getDay() });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function AnalysisClient({ articles, lastUpdated }: { articles: AnalysisArticle[]; lastUpdated: string }) {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const byDate = groupByDate(articles);
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
  const today = getToday();
  const initialDate = dateParam && byDate[dateParam]
    ? dateParam
    : today && byDate[today]
    ? today
    : sortedDates[0] || "";
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const popoverRef = useRef<HTMLDivElement>(null);

  const { minYM, maxYM } = useMemo(() => {
    if (sortedDates.length === 0) return { minYM: null, maxYM: null };
    const oldest = sortedDates[sortedDates.length - 1];
    const newest = sortedDates[0];
    return {
      minYM: { year: Number(oldest.slice(0, 4)), month: Number(oldest.slice(5, 7)) - 1 },
      maxYM: { year: Number(newest.slice(0, 4)), month: Number(newest.slice(5, 7)) - 1 },
    };
  }, [sortedDates]);

  useEffect(() => {
    if (!showCalendar) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowCalendar(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showCalendar]);

  if (articles.length === 0) {
    return <p className="text-zinc-500 text-sm">아직 등록된 분석글이 없습니다.</p>;
  }

  const currentGroups = byDate[selectedDate] || [];
  const selObj = selectedDate ? new Date(selectedDate + "T00:00:00") : null;
  const selLabel = selObj
    ? `${selObj.getMonth() + 1}월 ${selObj.getDate()}일 (${["일", "월", "화", "수", "목", "금", "토"][selObj.getDay()]})`
    : "날짜 선택";
  const selCount = byDate[selectedDate]?.length || 0;

  const cells = buildMonthGrid(viewMonth.year, viewMonth.month);
  const canGoPrev = minYM
    ? viewMonth.year > minYM.year || (viewMonth.year === minYM.year && viewMonth.month > minYM.month)
    : false;
  const canGoNext = maxYM
    ? viewMonth.year < maxYM.year || (viewMonth.year === maxYM.year && viewMonth.month < maxYM.month)
    : false;

  const goPrev = () => {
    if (!canGoPrev) return;
    setViewMonth((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }));
  };
  const goNext = () => {
    if (!canGoNext) return;
    setViewMonth((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }));
  };

  const currentIdx = sortedDates.indexOf(selectedDate);
  const canPrevDate = currentIdx >= 0 && currentIdx < sortedDates.length - 1;
  const canNextDate = currentIdx > 0;
  const goPrevDate = () => {
    if (!canPrevDate) return;
    const target = sortedDates[currentIdx + 1];
    setSelectedDate(target);
    const d = new Date(target + "T00:00:00");
    setViewMonth({ year: d.getFullYear(), month: d.getMonth() });
  };
  const goNextDate = () => {
    if (!canNextDate) return;
    const target = sortedDates[currentIdx - 1];
    setSelectedDate(target);
    const d = new Date(target + "T00:00:00");
    setViewMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <>
      {/* 날짜 선택 */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900/60 shadow-sm overflow-visible">
          <button
            type="button"
            onClick={goPrevDate}
            disabled={!canPrevDate}
            aria-label="이전 날짜"
            className="h-10 w-10 flex items-center justify-center rounded-l-full text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="h-5 w-px bg-zinc-800" />

          <div ref={popoverRef} className="relative">
            <button
              type="button"
              onClick={() => setShowCalendar((s) => !s)}
              className={`h-10 w-[220px] px-4 flex items-center justify-center gap-2.5 text-zinc-100 hover:bg-zinc-800/60 transition-colors ${showCalendar ? "bg-zinc-800/60" : ""}`}
            >
              <span className="text-sm font-semibold">{selLabel}</span>
              {selCount > 0 && <span className="text-xs text-zinc-400 font-normal">· {selCount}경기</span>}
              <svg className={`w-4 h-4 transition-colors ${showCalendar ? "text-white" : "text-zinc-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

          {showCalendar && (
            <div className="absolute left-1/2 -translate-x-1/2 z-20 mt-2 w-[300px] bg-zinc-950/95 backdrop-blur-sm border border-zinc-700 rounded-xl shadow-2xl p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <button
                type="button"
                onClick={goPrev}
                disabled={!canGoPrev}
                className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition-colors"
                aria-label="이전 달"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-white">
                {viewMonth.year}년 {viewMonth.month + 1}월
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={!canGoNext}
                className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition-colors"
                aria-label="다음 달"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
                <div
                  key={d}
                  className={`text-center text-[10px] font-semibold py-1.5 ${
                    i === 0 ? "text-red-400/80" : i === 6 ? "text-blue-400/80" : "text-zinc-500"
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((cell, i) => {
                if (!cell) return <div key={`empty-${i}`} className="h-9" />;
                const hasData = !!byDate[cell.date];
                const isSelected = cell.date === selectedDate;
                const isToday = cell.date === today;
                const count = byDate[cell.date]?.length || 0;
                const dowColor =
                  cell.dow === 0 ? "text-red-400" : cell.dow === 6 ? "text-blue-400" : "text-zinc-200";

                return (
                  <button
                    key={cell.date}
                    type="button"
                    disabled={!hasData}
                    onClick={() => {
                      setSelectedDate(cell.date);
                      setShowCalendar(false);
                    }}
                    className={`relative h-9 rounded-md text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-white text-zinc-900 shadow"
                        : hasData
                        ? `${dowColor} hover:bg-zinc-800 ${isToday ? "ring-1 ring-blue-500" : ""}`
                        : "text-zinc-700 cursor-default"
                    }`}
                    aria-label={`${cell.date}${hasData ? ` ${count}경기` : ""}`}
                  >
                    <span className={isSelected ? "" : "relative"}>{cell.day}</span>
                    {hasData && !isSelected && (
                      <span
                        className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                          isToday ? "bg-blue-400" : "bg-emerald-400"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500 px-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-400" />
                  분석글
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full border border-blue-500" />
                  오늘
                </span>
              </div>
              {sortedDates.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const target = today && byDate[today] ? today : sortedDates[0];
                    if (target) {
                      setSelectedDate(target);
                      const d = new Date(target + "T00:00:00");
                      setViewMonth({ year: d.getFullYear(), month: d.getMonth() });
                      setShowCalendar(false);
                    }
                  }}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  {today && byDate[today] ? "오늘로" : "최신으로"}
                </button>
              )}
            </div>
            </div>
          )}
          </div>

          <div className="h-5 w-px bg-zinc-800" />

          <button
            type="button"
            onClick={goNextDate}
            disabled={!canNextDate}
            aria-label="다음 날짜"
            className="h-10 w-10 flex items-center justify-center rounded-r-full text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 경기 카드 목록 */}
      <div className="space-y-3">
        {currentGroups.map((group) => (
          <div
            key={`${group.homeTeam}-${group.awayTeam}`}
            className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">
                  {LEAGUE_FLAG[group.league] && (
                    <span className="mr-1.5 align-middle"><FlagIcon code={LEAGUE_FLAG[group.league]} /></span>
                  )}
                  {group.league}
                </span>
                {group.time !== "99:99" && (
                  <span className="text-[10px] text-zinc-600">{group.time}</span>
                )}
              </div>
            </div>
            <p className="text-sm sm:text-base font-medium text-zinc-100 mb-3">
              {group.homeTeam} vs {group.awayTeam}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.articles.map((article) => {
                const source = article.id.includes("tipstrike") ? "TipStrike" : article.id.includes("sporty") ? "SportyTrader" : article.id.includes("-fpnet-") ? "FPredictions.net" : article.id.includes("dimers") ? "Dimers" : article.id.includes("-7m-") ? "7M" : article.id.includes("-liveman-") ? "라이브맨" : article.id.includes("-scores24-") ? "Scores24" : article.id.includes("-covers-") ? "Covers" : article.id.includes("-pickdawgz-") ? "PickDawgz" : article.id.includes("-tonyspicks-") ? "TonysPicks" : article.id.includes("-fp-") ? "FPredictions" : "FreeSuperTips";
                return (
                  <Link
                    key={article.id}
                    href={`/analysis/${article.id}`}
                    className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs px-2 py-1 rounded-full border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                    {source}
                    <svg className="w-3 h-3 text-zinc-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {lastUpdated && (
        <p className="text-[10px] text-zinc-600 mt-8 text-center" suppressHydrationWarning>
          마지막 업데이트: {new Date(lastUpdated).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
        </p>
      )}
    </>
  );
}
