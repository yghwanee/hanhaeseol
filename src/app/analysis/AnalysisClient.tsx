"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
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

export default function AnalysisClient({ articles, lastUpdated }: { articles: AnalysisArticle[]; lastUpdated: string }) {
  const byDate = groupByDate(articles);
  // 오래된 날짜 → 최신 날짜 (왼쪽 → 오른쪽)
  const sortedDates = Object.keys(byDate).sort((a, b) => a.localeCompare(b));
  const today = getToday();
  const [selectedDate, setSelectedDate] = useState(today && byDate[today] ? today : sortedDates[sortedDates.length - 1] || "");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 초기 로드 시 스크롤을 맨 오른쪽으로 (최신 날짜가 오른쪽 끝에 보이도록)
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      }
    });
  }, []);

  if (articles.length === 0) {
    return <p className="text-zinc-500 text-sm">아직 등록된 분석글이 없습니다.</p>;
  }

  const currentGroups = byDate[selectedDate] || [];

  return (
    <>
      {/* 날짜 탭 */}
      <div ref={scrollRef} className="flex gap-1.5 mb-6 overflow-x-auto scrollbar-hide pb-1">
        <div className="flex-shrink-0 flex-grow pointer-events-none" />
        {sortedDates.map((date) => {
          const dateObj = new Date(date + "T00:00:00");
          const month = dateObj.getMonth() + 1;
          const day = dateObj.getDate();
          const dayName = ["일", "월", "화", "수", "목", "금", "토"][dateObj.getDay()];
          const isSelected = date === selectedDate;
          const isToday = date === today;

          return (
            <div key={date} className="flex-shrink-0 flex flex-col items-center">
              <span className={`text-[9px] font-bold mb-1 ${isToday ? "text-blue-400" : "invisible"}`}>TODAY</span>
              <button
                onClick={() => setSelectedDate(date)}
                className={`flex items-center justify-between min-w-[100px] px-3 py-2 rounded-lg border transition-colors ${
                  isSelected
                    ? "border-zinc-500 bg-zinc-800 text-white"
                    : "border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                <span className="text-xs font-medium">
                  {month}/{day}({dayName})
                </span>
                <span className="text-[10px] text-zinc-600 ml-2">{byDate[date].length}경기</span>
              </button>
            </div>
          );
        })}
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
