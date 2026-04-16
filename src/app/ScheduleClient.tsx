"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ScheduleData } from "@/types/schedule";
import { getUpcomingDates, getTodayString } from "@/lib/schedule-utils";
import { StickyHeader } from "./_components/StickyHeader";
import { SPORTS, PLATFORM_LIST } from "./_components/constants";
import { PlatformIcon } from "./_components/PlatformIcon";
import { FilterButton } from "./_components/FilterButton";
import { ScheduleCard } from "./_components/ScheduleCard";
import { AdSkeleton } from "./_components/AdSkeleton";

export default function ScheduleClient({ initialData }: { initialData: ScheduleData }) {
  const [data] = useState<ScheduleData>(initialData);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [sport, setSport] = useState("전체");
  const [platform, setPlatform] = useState("전체");
  const [commentaryFilter, setCommentaryFilter] = useState<"all" | "korean" | "foreign">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [showAds, setShowAds] = useState(false);

  const platformRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ isDown: false, isDragging: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    const el = platformRef.current;
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

  useEffect(() => {
    const timer = setTimeout(() => setShowAds(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const weekDates = useMemo(() => getUpcomingDates(), []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.schedules
      .filter((s) => s.date === selectedDate)
      .filter((s) => sport === "전체" || s.sport === sport)
      .filter((s) => platform === "전체" || s.platform === platform)
      .filter((s) => {
        if (commentaryFilter === "korean") return s.koreanCommentary === true;
        if (commentaryFilter === "foreign") return s.koreanCommentary === false;
        return true;
      })
      .filter((s) => {
        if (!q) return true;
        return (
          s.homeTeam.toLowerCase().includes(q) ||
          s.awayTeam.toLowerCase().includes(q) ||
          s.league.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [data, selectedDate, sport, platform, commentaryFilter, searchQuery]);

  const sportIcons = useMemo(() => {
    const sports = new Set(filtered.map((s) => s.sport));
    const icons: string[] = [];
    if (sports.has("축구")) icons.push("⚽");
    if (sports.has("농구")) icons.push("🏀");
    if (sports.has("야구")) icons.push("⚾");
    if (sports.has("배구")) icons.push("🏐");
    return icons.join(" ");
  }, [filtered]);

  const handleSelectSport = useCallback((s: string) => setSport(s), []);
  const handleSelectPlatform = useCallback((p: string) => setPlatform(p), []);

  return (
    <div className="relative mx-auto min-h-screen max-w-2xl px-3 sm:px-4 pb-8 sm:pb-12 xl:max-w-none xl:px-[200px]">
      <div className="mx-auto max-w-2xl">
      {/* Header */}
      <StickyHeader fullBleedXl>
        <header className="flex items-center justify-between">
          <h1 className="flex items-end">
            <Image src="/icon.png" alt="한해설 아이콘" width={32} height={32} className="h-6 w-6 sm:h-8 sm:w-8 self-center" />
            <span className="ml-1 sm:ml-2 text-xl sm:text-3xl font-bold text-white">한해설</span>
            <span className="ml-2 sm:ml-3 text-sm sm:text-lg font-normal text-zinc-500">한국어중계 편성표</span>
          </h1>
          <Link href="/analysis" className="border-glow text-[11px] sm:text-xs px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-zinc-200 font-medium hover:text-white transition-colors whitespace-nowrap">
            🎯 해외 픽스터 분석글
          </Link>
        </header>
      </StickyHeader>

      <div className="mt-4 sm:mt-6 mb-6 sm:mb-10 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-center">
        <p className="text-[11px] sm:text-xs text-zinc-400">이 포스팅은 쿠팡 파트너스 활동의 일환으로,<br className="sm:hidden" /> 이에 따른 일정액의 수수료를 제공받습니다.</p>
      </div>

      {/* Filters */}
      <div className="mb-6 sm:mb-10 space-y-2.5 sm:space-y-3">
        {/* Sport Filter */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="w-14 sm:w-12 shrink-0 text-[11px] sm:text-xs font-medium text-zinc-300">
            종목
          </span>
          <div className="flex gap-1 sm:gap-1.5 overflow-x-auto scrollbar-hide">
            {SPORTS.map((s) => (
              <FilterButton
                key={s}
                label={s}
                active={sport === s}
                onClick={() => handleSelectSport(s)}
              />
            ))}
          </div>
        </div>

        {/* Korean Commentary Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="w-14 sm:w-12 shrink-0 text-[11px] sm:text-xs font-medium text-zinc-300">
            해설
          </span>
          <FilterButton
            label="전체"
            active={commentaryFilter === "all"}
            onClick={() => setCommentaryFilter("all")}
          />
          <FilterButton
            label="한국어 해설"
            active={commentaryFilter === "korean"}
            onClick={() => setCommentaryFilter("korean")}
          />
          <FilterButton
            label="현지 해설"
            active={commentaryFilter === "foreign"}
            onClick={() => setCommentaryFilter("foreign")}
          />
        </div>

        {/* Platform Filter - Circle Icons */}
        <div className="pt-2 sm:-ml-[21px]">
          <div
            ref={platformRef}
            className="flex overflow-x-auto overflow-y-hidden scrollbar-hide pb-1 pt-1 -mt-1"
          >
            {PLATFORM_LIST.map(({ key, label }) => {
              const isActive = platform === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSelectPlatform(key)}
                  className="flex shrink-0 flex-col items-center gap-1.5 group"
                  style={{ width: 75 }}
                >
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 ${
                      key === "전체"
                        ? isActive
                          ? "bg-white text-zinc-900 ring-2 ring-zinc-400 scale-105"
                          : "bg-transparent text-zinc-400 ring-1 ring-zinc-600 group-hover:ring-zinc-400 group-hover:scale-105"
                        : isActive
                          ? "bg-zinc-200 ring-2 ring-zinc-400 scale-105"
                          : "bg-zinc-800/80 group-hover:bg-zinc-700/80 group-hover:scale-105"
                    }`}
                  >
                    <PlatformIcon platformKey={key} />
                  </div>
                  <span className={`text-[10px] sm:text-[11px] font-medium transition-colors whitespace-nowrap ${
                    isActive ? "text-zinc-100" : "text-zinc-500 group-hover:text-zinc-300"
                  }`}>
                    {label}
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
      </div>

      {/* 모바일 광고 */}
      <div className="sm:hidden flex justify-center mb-4">
        <div className="rounded-xl overflow-hidden w-full" style={{ aspectRatio: "728/90" }}>
          {showAds ? (
            <iframe title="쿠팡 파트너스 광고 (모바일 상단)" src="https://ads-partners.coupang.com/widgets.html?id=979107&template=banner&trackingCode=AF2259406&subId=mobile-top&width=728&height=90" className="w-full h-full border-0 rounded-xl" scrolling="no" referrerPolicy="unsafe-url" loading="lazy" />
          ) : (
            <AdSkeleton className="w-full h-full rounded-xl" />
          )}
        </div>
      </div>
      {/* PC 광고 */}
      <div className="hidden sm:flex justify-center mb-6">
        <div className="rounded-xl overflow-hidden w-full max-w-2xl">
          {showAds ? (
            <iframe title="쿠팡 파트너스 광고 (PC 상단)" src="https://ads-partners.coupang.com/widgets.html?id=979107&template=banner&trackingCode=AF2259406&subId=pc-top&width=728&height=90" className="w-full h-[90px] border-0 rounded-xl" scrolling="no" referrerPolicy="unsafe-url" loading="lazy" />
          ) : (
            <AdSkeleton className="w-full h-[90px] rounded-xl" />
          )}
        </div>
      </div>

      {/* Date Tabs */}
      <div className="mb-6 sm:mb-10">
        {/* Mobile: scrollable row */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide sm:hidden">
          {weekDates.map((d) => {
            const day = new Date(d.value + "T00:00:00").getDay();
            return (
              <div key={d.value} className="flex shrink-0 flex-col items-center gap-1.5">
                {day === 6 ? <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> : day === 0 ? <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> : <span className="h-1.5 w-1.5" />}
                <button
                  onClick={() => setSelectedDate(d.value)}
                  className={`rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedDate === d.value
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {d.label}
                </button>
              </div>
            );
          })}
        </div>
        {/* Desktop: grid */}
        <div className="hidden sm:grid grid-cols-7 gap-2">
          {weekDates.map((d) => {
            const day = new Date(d.value + "T00:00:00").getDay();
            return (
              <div key={d.value} className="flex flex-col items-center gap-2">
                {day === 6 ? <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> : day === 0 ? <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> : <span className="h-1.5 w-1.5" />}
                <button
                  onClick={() => setSelectedDate(d.value)}
                  className={`w-full rounded-lg border border-zinc-700 py-2 text-sm font-medium transition-colors ${
                    selectedDate === d.value
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {d.label}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="mb-6 sm:mb-8 relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" strokeWidth="2" />
          <path strokeLinecap="round" strokeWidth="2" d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="팀, 리그 검색"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 pl-9 pr-3 sm:pl-10 sm:pr-4 py-2 sm:py-2.5 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            &times;
          </button>
        )}
      </div>

      {/* Schedule List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-zinc-500">
          <span className="text-2xl sm:text-3xl">📭</span>
          <p className="mt-3 text-xs sm:text-sm">해당 조건의 편성이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-300">
            <button
              onClick={() => setShowInfo(true)}
              className="rounded-full border border-zinc-700 w-5 h-5 flex items-center justify-center text-[11px] font-bold text-zinc-400 hover:text-zinc-200 hover:border-zinc-500"
              aria-label="안내"
            >
              i
            </button>
            <div className="ml-auto flex items-center gap-2">
              <span>{sportIcons}</span>
              <span className="font-medium">{filtered.length}개 경기</span>
            </div>
          </div>
          {filtered.map((schedule, idx) => {
            const prev = idx > 0 ? filtered[idx - 1] : null;
            const prevHour = prev ? parseInt(prev.time.split(":")[0], 10) : -1;
            const currHour = parseInt(schedule.time.split(":")[0], 10);
            const showMidBanner = prev && prevHour < 12 && currHour >= 12;
            return (
              <React.Fragment key={schedule.id}>
                {showMidBanner && (
                  <>
                    <div className="flex items-center gap-3 py-1">
                      <div className="h-px flex-1 bg-zinc-700/60" />
                      <span className="text-[11px] sm:text-xs font-medium text-zinc-500">오후 경기</span>
                      <div className="h-px flex-1 bg-zinc-700/60" />
                    </div>
                    <div className="sm:hidden w-full">
                      <div className="rounded-lg overflow-hidden" style={{ aspectRatio: "320/100" }}>
                        {showAds ? (
                          <iframe title="쿠팡 파트너스 광고 (모바일 인라인)" src="https://ads-partners.coupang.com/widgets.html?id=979232&template=carousel&trackingCode=AF2259406&subId=mobile-inline&width=320&height=100&tsource=" className="w-full h-full border-0" scrolling="no" referrerPolicy="unsafe-url" loading="lazy" />
                        ) : (
                          <AdSkeleton className="w-full h-full" />
                        )}
                      </div>
                    </div>
                    <div className="hidden sm:flex justify-center">
                      <div className="rounded-lg overflow-hidden w-full max-w-2xl">
                        {showAds ? (
                          <iframe title="쿠팡 파트너스 광고 (PC 인라인)" src="https://ads-partners.coupang.com/widgets.html?id=979239&template=carousel&trackingCode=AF2259406&subId=pc-inline&width=680&height=140&tsource=" width="680" height="140" frameBorder="0" scrolling="no" referrerPolicy="unsafe-url" loading="lazy" className="w-full h-[140px] border-0" />
                        ) : (
                          <AdSkeleton className="w-full h-[140px]" />
                        )}
                      </div>
                    </div>
                  </>
                )}
                <ScheduleCard schedule={schedule} query={searchQuery} />
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowInfo(false)}>
          <div className="mx-4 max-w-md rounded-xl border border-zinc-700 bg-zinc-900 px-5 sm:px-6 pt-5 sm:pt-6 pb-8 sm:pb-9" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end">
              <button onClick={() => setShowInfo(false)} className="text-zinc-500 hover:text-zinc-300 text-3xl leading-none">&times;</button>
            </div>
            <div className="mt-3 text-xs sm:text-sm leading-relaxed text-zinc-400 space-y-3">
              <p>● 본 서비스에서 제공하는 중계 일정 및 한국어해설 정보는 쿠팡플레이, 티빙, SPOTV NOW, Apple TV+, SPOTV, SPOTV2, tvN SPORTS, KBS N SPORTS, MBC SPORTS+, SBS Sports의 공식 편성표를 바탕으로 재구성되었습니다.</p>
              <p>● 실시간 중계 사정에 따라 실제 편성 현황과 일부 차이가 있을 수 있으므로 정확한 내용은 각 중계 플랫폼의 공지사항을 확인해 주시기 바랍니다.</p>
            </div>
          </div>
        </div>
      )}

      {/* SEO Content */}
      <section className="mt-8 sm:mt-10 border-t border-zinc-800 pt-6 sm:pt-8">
        <h2 className="text-xs sm:text-sm font-semibold text-zinc-500 mb-2">스포츠 한국어중계 편성표</h2>
        <div className="text-[11px] sm:text-xs leading-relaxed text-zinc-600">
          <p>
            한해설은 축구, 야구, 농구, 배구 한국어 해설 중계를 쉽게 찾을 수 있는 스포츠 편성표입니다.
          </p>
          <p className="mt-2 sm:mt-1.5">
            SPOTV NOW, 쿠팡플레이, 티빙, Apple TV+, SPOTV, SPOTV2, tvN SPORTS, KBS N SPORTS, MBC SPORTS+, SBS Sports
            <br className="hidden sm:inline" />{" "}등 10개 플랫폼의 한국어 해설 중계 일정을 한눈에 확인하세요.
          </p>
          <p className="mt-2 sm:mt-1.5">
            프리미어리그, 라리가, 세리에A, 분데스리가, 챔피언스리그 한국어중계부터
            <br className="hidden sm:inline" />{" "}KBO, K리그, NBA, MLB 등 주요 리그의 한국어중계 여부를 실시간으로 확인할 수 있습니다.
          </p>
          <p className="mt-2 sm:mt-1.5">
            오늘 한국어중계가 있는 경기를 한눈에 찾아보세요.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-6 sm:mt-8 text-center text-[11px] sm:text-xs text-zinc-600" suppressHydrationWarning>
        마지막 업데이트: {data ? new Date(data.lastUpdated).toLocaleString("ko-KR") : "로딩 중..."}
      </footer>
      </div>{/* max-w-2xl wrapper end */}
    </div>
  );
}
