"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue } from "react";
import Image from "next/image";
import Link from "next/link";
import { ScheduleData } from "@/types/schedule";
import { TeamRecordsMap } from "@/types/team-record";
import { ResultsData } from "@/types/results";
import { lookupTeamRecord } from "@/lib/team-records/lookup";
import { findResult } from "@/lib/results/lookup";
import { getUpcomingDates, getTodayString } from "@/lib/schedule-utils";
import { StickyHeader } from "./_components/StickyHeader";
import { SPORTS, PLATFORM_LIST } from "./_components/constants";
import { PlatformIcon } from "./_components/PlatformIcon";
import { SmoothTabs, SmoothCircleTabs } from "./_components/SmoothTabs";
import { ScheduleCard } from "./_components/ScheduleCard";
import { CoupangTopBannerOnly, CoupangInlineBanner } from "./_components/CoupangBanners";
import { DatePickerSheet } from "./_components/DatePickerSheet";
import { WorldCupView } from "./_components/WorldCupView";
import { WorldCupBanner } from "./_components/WorldCupBanner";
import { useScrollbarDrag } from "@/lib/hooks/useScrollbarDrag";

export default function ScheduleClient({
  initialData,
  teamRecords = {},
  results = null,
  initialDate,
  initialSport,
  initialPlatform,
  initialCommentary = "all",
}: {
  initialData: ScheduleData;
  teamRecords?: TeamRecordsMap;
  results?: ResultsData | null;
  initialDate?: string;
  initialSport?: string;
  initialPlatform?: string;
  initialCommentary?: "all" | "korean" | "foreign";
}) {
  const [data] = useState<ScheduleData>(initialData);
  const [selectedDate, setSelectedDate] = useState(initialDate || getTodayString());
  const [sport, setSport] = useState(initialSport || "전체");
  const [platform, setPlatform] = useState(initialPlatform || "전체");
  const [commentaryFilter, setCommentaryFilter] = useState<"all" | "korean" | "foreign">(initialCommentary);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInfo, setShowInfo] = useState(false);

  // archive 데이터 (과거 경기들). 사용자가 datepicker로 과거 날짜를 선택하면 그때 lazy fetch.
  // 영구 누적 데이터라 크기가 크므로 초기 로드에 포함하지 않음.
  const [archive, setArchive] = useState<ScheduleData | null>(null);
  const [archiveResults, setArchiveResults] = useState<ResultsData | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [datepickerOpen, setDatepickerOpen] = useState(false);
  const todayStr = useMemo(() => getTodayString(), []);
  const isArchiveDate = selectedDate < todayStr;

  useEffect(() => {
    if (!isArchiveDate || archive || archiveLoading) return;
    setArchiveLoading(true);
    Promise.all([
      fetch("/schedule-archive.json").then((r) => (r.ok ? r.json() : null)),
      fetch("/results-archive.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([sch, res]) => {
        if (sch) setArchive(sch);
        if (res) setArchiveResults(res);
      })
      .catch((e) => console.error("archive fetch failed", e))
      .finally(() => setArchiveLoading(false));
  }, [isArchiveDate, archive, archiveLoading]);

  // 상태 변경 시 URL 동기화 (history.replaceState로 라우터 재요청 없이).
  // 초기값은 서버에서 prop으로 받으므로 mount 시 query → state 동기화 단계 없음 (깜빡임 방지).
  // 첫 인자에 null을 넘기면 Next.js App Router 가 entry 에 박아둔 router state(__NA 등)가
  // 통째로 사라져, 매치 페이지에서 뒤로가기 시 page swap 이 깨지고 scroll restoration 만
  // 발동하는 현상이 생긴다. 현재 state 를 보존하여 URL 만 교체.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedDate !== getTodayString()) params.set("date", selectedDate);
    else params.delete("date");
    if (sport !== "전체") params.set("sport", sport);
    else params.delete("sport");
    if (platform !== "전체") params.set("platform", platform);
    else params.delete("platform");
    if (commentaryFilter !== "all") params.set("comm", commentaryFilter);
    else params.delete("comm");
    const qs = params.toString();
    const next = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", next);
  }, [selectedDate, sport, platform, commentaryFilter]);

  const platformRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const { trackRef: scrollbarTrackRef, handlers: scrollbarHandlers } = useScrollbarDrag(platformRef);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const dragState = useRef({ isDown: false, isDragging: false, startX: 0, scrollLeft: 0 });

  const dateRef = useRef<HTMLDivElement>(null);
  const [showDateLeftFade, setShowDateLeftFade] = useState(false);
  const [showDateRightFade, setShowDateRightFade] = useState(false);

  useEffect(() => {
    const el = dateRef.current;
    if (!el) return;
    let rafId = 0;
    const update = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      setShowDateLeftFade(maxScroll > 2 && el.scrollLeft > 2);
      setShowDateRightFade(maxScroll > 2 && el.scrollLeft < maxScroll - 2);
    };
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        update();
      });
    };
    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => update();
    window.addEventListener("resize", onResize);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const el = platformRef.current;
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
  }, []);

  const weekDates = useMemo(() => getUpcomingDates(), []);

  // 필터 탭 클릭 시 활성 표시는 즉시 갱신되고 카드 list 만 한 박자 늦게 갱신되도록
  // useDeferredValue 로 카드용 필터 값을 분리. selectedDate 는 사용자 의도가 즉시 반영
  // 되어야 자연스러우므로 그대로 둠.
  const deferredSport = useDeferredValue(sport);
  const deferredPlatform = useDeferredValue(platform);
  const deferredCommentary = useDeferredValue(commentaryFilter);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // "북중미 월드컵" 칩은 일반 날짜 필터 리스트가 아니라 전용 월드컵 뷰(전 경기+브래킷)로
  // 분기한다. 7일 날짜 탭 제약을 받지 않고 대회 전체를 한 화면에 보여준다.
  const isWorldCupView = sport === "북중미 월드컵";
  const worldcupSchedules = useMemo(
    () => data.schedules.filter((s) => s.league.startsWith("북중미 월드컵")),
    [data],
  );
  // 헤더 아래 상시 배너용 D-day(첫 경기까지). 월드컵 편성이 없으면 null → 배너 미노출.
  const worldcupDday = useMemo(() => {
    const dates = worldcupSchedules.map((s) => s.date).sort();
    if (dates.length === 0) return null;
    const ms =
      new Date(dates[0] + "T00:00:00+09:00").getTime() -
      new Date(todayStr + "T00:00:00+09:00").getTime();
    return Math.round(ms / 86400000);
  }, [worldcupSchedules, todayStr]);

  const filtered = useMemo(() => {
    // 과거 날짜는 archive에서, 오늘 이후는 schedule.json에서 데이터를 가져온다.
    const source = isArchiveDate ? archive : data;
    if (!source) return [];
    const q = deferredSearchQuery.trim().toLowerCase();
    // 월드컵은 worldcup.json으로 분리 관리돼 schedule-archive.json에 누적되지 않는다.
    // 과거 날짜(archive 모드)에서도 월드컵 경기가 보이도록, data에 병합돼 있는 대회 전체
    // 일정(worldcupSchedules)을 합친다. (worldcup id는 archive와 겹치지 않아 중복 없음)
    const sourceSchedules = isArchiveDate
      ? [...source.schedules, ...worldcupSchedules]
      : source.schedules;
    return sourceSchedules
      .filter((s) => s.date === selectedDate)
      .filter((s) => {
        if (deferredSport === "전체") return true;
        // "북중미 월드컵"은 5번째 종목이 아니라 파생 카테고리(축구 중 월드컵 대회).
        // 축구 칩에는 sport==="축구"라 자동 포함되고, 월드컵 칩에선 league로 골라낸다.
        if (deferredSport === "북중미 월드컵") return s.league.startsWith("북중미 월드컵");
        return s.sport === deferredSport;
      })
      .filter((s) => deferredPlatform === "전체" || s.platform === deferredPlatform)
      .filter((s) => {
        if (deferredCommentary === "korean") return s.koreanCommentary === true;
        if (deferredCommentary === "foreign") return s.koreanCommentary === false;
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
  }, [data, archive, worldcupSchedules, isArchiveDate, selectedDate, deferredSport, deferredPlatform, deferredCommentary, deferredSearchQuery]);

  // 카드 결과 표시: archive 모드는 archiveResults, 그 외는 현재 results.
  const effectiveResults = isArchiveDate ? archiveResults : results;

  // datepicker 버튼 라벨: archive 날짜면 그 날짜를 한국 포맷으로, 아니면 placeholder.
  const datepickerLabel = useMemo(() => {
    if (!isArchiveDate) return "지난 경기 결과";
    const d = new Date(selectedDate + "T00:00:00");
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    return `${d.getFullYear()}.${m}.${day} (${dow})`;
  }, [isArchiveDate, selectedDate]);

  const openDatepicker = useCallback(() => setDatepickerOpen(true), []);
  const closeDatepicker = useCallback(() => setDatepickerOpen(false), []);

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
            <span className="ml-2 sm:ml-3 text-sm sm:text-lg font-normal text-zinc-500">한국어 해설 중계 편성표</span>
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href="/guide"
              aria-label="한해설 Topic · 중계 가이드"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-amber-400/70 bg-amber-400/10 px-4 py-1.5 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-400/20 sm:px-5 sm:py-2 sm:text-xs"
            >
              한해설 Topic
            </Link>
            <Link
              href="/standings"
              aria-label="팀 순위"
              className="btn-caps-stripe inline-flex items-center justify-center whitespace-nowrap px-4 py-1.5 text-[11px] font-medium sm:px-5 sm:py-2 sm:text-xs"
            >
              순위 +
            </Link>
          </div>
        </header>
      </StickyHeader>

      {/* 월드컵 상시 배너 — 헤더 바로 아래. 초기 HTML에 /worldcup 정적 링크를 노출해
          홈의 링크 자산 전달 + 네이버 발견을 돕는다. 월드컵 뷰에선 자체 배너가 있어 중복 제거. */}
      {!isWorldCupView && worldcupSchedules.length > 0 && (
        <div className="mt-4 sm:mt-6">
          <WorldCupBanner dday={worldcupDday} href="/worldcup" />
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 sm:mt-10 mb-6 sm:mb-10 space-y-2.5 sm:space-y-3">
        {/* Sport Filter */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="w-14 sm:w-12 shrink-0 text-[11px] sm:text-xs font-medium text-zinc-300">
            종목
          </span>
          <div className="overflow-x-auto scrollbar-hide">
            <SmoothTabs
              ariaLabel="종목 필터"
              options={SPORTS.map((s) =>
                s === "북중미 월드컵"
                  ? {
                      value: s,
                      // 월드컵 시즌 강조 — 골드 테두리 + 트로피 아이콘
                      className: "!border-amber-400/80 bg-amber-400/5",
                      label: (
                        <span className="inline-flex items-center gap-1">
                          <span aria-hidden>🏆</span>
                          <span>{s}</span>
                        </span>
                      ),
                    }
                  : { value: s, label: s },
              )}
              value={sport as (typeof SPORTS)[number]}
              onChange={handleSelectSport}
            />
          </div>
        </div>

        {!isWorldCupView && (
        <>
        {/* Korean Commentary Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="w-14 sm:w-12 shrink-0 text-[11px] sm:text-xs font-medium text-zinc-300">
            해설
          </span>
          <SmoothTabs<"all" | "korean" | "foreign">
            ariaLabel="해설 필터"
            options={[
              { value: "all", label: "전체" },
              { value: "korean", label: "한국어 해설" },
              { value: "foreign", label: "현지 해설" },
            ]}
            value={commentaryFilter}
            onChange={setCommentaryFilter}
          />
        </div>

        {/* Platform Filter - Circle Icons */}
        <div className="pt-2 sm:-ml-[21px]">
          <div className="relative">
          <div
            ref={platformRef}
            className="overflow-x-auto overflow-y-hidden scrollbar-hide pb-1 pt-1 -mt-1"
          >
            <SmoothCircleTabs
              ariaLabel="플랫폼 필터"
              options={PLATFORM_LIST.map((p) => p.key)}
              value={platform as (typeof PLATFORM_LIST)[number]["key"]}
              onChange={handleSelectPlatform}
              itemWidth={75}
              ringSize={56}
              renderItem={(key, isActive) => {
                const label = PLATFORM_LIST.find((p) => p.key === key)?.label ?? key;
                return (
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      data-circle
                      className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 ${
                        isActive ? "scale-105" : "scale-100"
                      } ${
                        key === "전체"
                          ? isActive
                            ? "bg-white text-zinc-900"
                            : "bg-transparent text-zinc-400 ring-1 ring-zinc-600"
                          : isActive
                            ? "bg-zinc-200"
                            : "bg-zinc-800/80"
                      }`}
                    >
                      <PlatformIcon platformKey={key} />
                    </div>
                    <span
                      className={`text-[10px] sm:text-[11px] font-medium transition-colors whitespace-nowrap ${
                        isActive ? "text-zinc-100" : "text-zinc-500"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              }}
            />
          </div>
          <div
            className={`pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-zinc-950 via-zinc-950/70 to-transparent transition-opacity duration-200 ${
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
          {/* Scroll indicator bar — 시각 표시 겸 드래그 가능한 스크롤바.
              -my-2 py-2 로 시각은 3px 유지하면서 터치/클릭 영역만 16px 로 확장. */}
          <div className="mt-3 mx-auto w-28 sm:w-32">
            <div
              aria-hidden
              {...scrollbarHandlers}
              className="-my-2 py-2 cursor-pointer touch-none select-none"
            >
              <div ref={scrollbarTrackRef} className="h-[3px] rounded-full bg-zinc-800/60">
                <div
                  ref={indicatorRef}
                  className="h-full rounded-full bg-zinc-500/80"
                  style={{ width: "35%", transform: "translateX(0%)", willChange: "transform" }}
                />
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>

      {isWorldCupView ? (
        <WorldCupView
          schedules={worldcupSchedules}
          teamRecords={teamRecords}
          results={results}
          today={todayStr}
        />
      ) : (
      <>
      <div className="mt-4 sm:mt-6 mb-3 sm:mb-4 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-center">
        <p className="text-[11px] sm:text-xs text-zinc-400">이 포스팅은 쿠팡 파트너스 활동의 일환으로,<br className="sm:hidden" /> 이에 따른 일정액의 수수료를 제공받습니다.</p>
      </div>

      {/* 쿠팡 파트너스 상단 광고 — 페이지마다 랜덤 상품 5~6개 가로 캐러셀 */}
      <CoupangTopBannerOnly />

      {/* Date Tabs */}
      <div className="mb-6 sm:mb-10">
        {(() => {
          const KOR_DOW = ["일", "월", "화", "수", "목", "금", "토"];
          const dateOptions = weekDates.map((d) => {
            const dt = new Date(d.value + "T00:00:00");
            const dow = dt.getDay();
            const dayNum = dt.getDate();
            const active = d.value === selectedDate;
            // 활성 상태에서는 sweep 흰 배경 위 가독성을 위해 zinc-900으로 통일.
            // 비활성에서는 요일별 색상 유지 (평일 zinc-400).
            const dowColor = active
              ? "text-zinc-900"
              : dow === 0
              ? "text-red-400"
              : dow === 6
              ? "text-blue-400"
              : "text-zinc-400";
            return {
              value: d.value,
              label: (
                <div className="flex flex-col items-center leading-none">
                  <span className={`text-[10px] font-medium sm:text-xs ${dowColor}`}>
                    {KOR_DOW[dow]}
                  </span>
                  <span className="-mt-0.5 text-sm font-bold sm:-mt-1 sm:text-base">
                    {dayNum}
                  </span>
                </div>
              ),
            };
          });
          // 오늘만 "TODAY" 빨간 라벨, 나머지는 동일 텍스트를 transparent 로
          // 렌더해 자리만 차지하게 함 (레이아웃 위아래 흔들림 방지).
          const todayMarker = (value: string) => (
            <span
              aria-hidden
              className={`block text-[9px] font-bold leading-none tracking-wider ${
                value === todayStr ? "text-red-500" : "text-transparent"
              }`}
            >
              TODAY
            </span>
          );
          return (
            <>
              {/* Mobile: scrollable row */}
              <div className="relative sm:hidden">
                <div ref={dateRef} className="overflow-x-auto scrollbar-hide">
                  <SmoothTabs
                    ariaLabel="날짜 선택"
                    gapClass="gap-3"
                    options={dateOptions}
                    value={selectedDate}
                    onChange={setSelectedDate}
                    renderAbove={todayMarker}
                    useCapsStripe
                  />
                </div>
                <div
                  className={`pointer-events-none absolute left-0 top-0 bottom-0 z-20 w-10 bg-gradient-to-r from-zinc-950 via-zinc-950/70 to-transparent transition-opacity duration-200 ${
                    showDateLeftFade ? "opacity-100" : "opacity-0"
                  }`}
                  aria-hidden
                />
                <div
                  className={`pointer-events-none absolute right-0 top-0 bottom-0 z-20 w-10 bg-gradient-to-l from-zinc-950 via-zinc-950/70 to-transparent transition-opacity duration-200 ${
                    showDateRightFade ? "opacity-100" : "opacity-0"
                  }`}
                  aria-hidden
                />
              </div>
              {/* Desktop: full-width row */}
              <div className="hidden sm:block">
                <SmoothTabs
                  ariaLabel="날짜 선택"
                  fullWidth
                  gapClass="gap-2"
                  options={dateOptions}
                  value={selectedDate}
                  onChange={setSelectedDate}
                  renderAbove={todayMarker}
                  useCapsStripe
                />
              </div>
            </>
          );
        })()}
      </div>

      {/* Search + Datepicker */}
      {/* 검색 2/3 + datepicker 1/3 한 줄 (모바일/PC 동일). */}
      <div className="mb-6 sm:mb-8 grid grid-cols-3 gap-2 sm:gap-3">
        {/* Search */}
        <div className="relative col-span-2">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path strokeLinecap="round" strokeWidth="2" d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="팀, 리그 검색"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-3 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none sm:py-2.5 sm:pl-10 sm:pr-4 sm:text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="검색어 지우기"
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-base leading-none text-zinc-500 hover:text-zinc-300"
            >
              &times;
            </button>
          )}
        </div>

        {/* Datepicker 트리거: 과거 경기 조회용. 클릭 시 바텀시트 캘린더 오픈.
            X 버튼은 nested button 회피를 위해 절대 위치의 sibling 으로 둔다. */}
        <div className="relative col-span-1">
          <button
            type="button"
            onClick={openDatepicker}
            aria-label={isArchiveDate ? `선택된 날짜 ${datepickerLabel} - 다른 날짜 선택` : "지난 경기 결과 보기"}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border bg-zinc-900 py-2 text-xs transition-colors sm:py-2.5 sm:text-sm ${
              isArchiveDate ? "pl-3 pr-9 sm:pl-4 sm:pr-10" : "px-3 sm:px-4"
            } ${
              isArchiveDate
                ? "border-red-500/60 text-red-300 hover:border-red-400"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            }`}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
              <path strokeLinecap="round" strokeWidth="2" d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <span className="truncate">{datepickerLabel}</span>
          </button>
          {isArchiveDate && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              aria-label="오늘로 돌아가기"
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-base leading-none text-zinc-400 hover:text-zinc-200"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      <DatePickerSheet
        isOpen={datepickerOpen}
        onClose={closeDatepicker}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        maxDate={todayStr}
      />

      {/* archive 로딩 중 표시 */}
      {isArchiveDate && archiveLoading && (
        <div className="mb-4 text-center text-xs text-zinc-500 sm:text-sm">
          지난 경기 데이터를 불러오는 중...
        </div>
      )}

      {/* Schedule List */}
      {filtered.length === 0 ? (
        <div
          key={`empty:${selectedDate}|${sport}|${platform}|${commentaryFilter}`}
          className="tab-content-anim flex flex-col items-center justify-center py-16 sm:py-20 text-zinc-500"
        >
          <span className="text-2xl sm:text-3xl">📭</span>
          <p className="mt-3 text-xs sm:text-sm">해당 조건의 편성이 없습니다</p>
        </div>
      ) : (
        <div
          key={`list:${selectedDate}|${sport}|${platform}|${commentaryFilter}`}
          className="tab-content-anim space-y-2.5 sm:space-y-3"
        >
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
                    <CoupangInlineBanner />
                  </>
                )}
                <ScheduleCard
                  schedule={schedule}
                  query={searchQuery}
                  homeRecord={lookupTeamRecord(teamRecords, schedule.league, schedule.homeTeam)}
                  awayRecord={lookupTeamRecord(teamRecords, schedule.league, schedule.awayTeam)}
                  result={findResult(effectiveResults, schedule)}
                />
              </React.Fragment>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* SEO 안내 섹션 — 사용자 가독성을 해치지 않는 톤으로 핵심 키워드 자연 노출 */}
      <section className="mt-10 sm:mt-14 border-t border-zinc-800/60 pt-6 sm:pt-8 text-[12px] sm:text-sm leading-relaxed text-zinc-500">
        <h2 className="mb-3 text-sm sm:text-base font-medium text-zinc-300">한국어 해설 중계, 한곳에서 확인하세요</h2>
        <p className="mb-2.5">
          한해설은 EPL·라리가·세리에A·분데스리가·챔피언스리그·KBO·MLB·NBA·K리그 등 주요 스포츠의
          <strong className="font-medium text-zinc-300"> 한국어 해설 중계</strong>와
          <strong className="font-medium text-zinc-300"> 한국어 중계 편성표</strong>를
          SPOTV NOW, 쿠팡플레이, 티빙, Apple TV+, SPOTV, SPOTV2, tvN SPORTS, KBS N SPORTS, MBC SPORTS+, SBS Sports의
          공식 편성을 바탕으로 매일 업데이트합니다.
        </p>
        <p>
          각 경기마다 한국어해설 여부를 초록·빨강·노랑 뱃지로 표시해,
          한국어 중계가 있는 경기만 골라 보거나 종목·플랫폼별로 필터링할 수 있습니다.
          오늘부터 7일치 한국어해설 편성을 한 페이지에서 확인하세요.
        </p>
      </section>

      <p className="mt-6 sm:mt-8 text-center text-[11px] sm:text-xs text-zinc-600" suppressHydrationWarning>
        마지막 업데이트: {data ? new Date(data.lastUpdated).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "로딩 중..."}
      </p>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowInfo(false)}>
          <div className="mx-4 max-w-md rounded-xl border border-zinc-700 bg-zinc-900 px-5 sm:px-6 pt-5 sm:pt-6 pb-8 sm:pb-9" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                aria-label="안내 닫기"
                className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded text-3xl leading-none text-zinc-500 hover:text-zinc-300"
              >
                &times;
              </button>
            </div>
            <div className="mt-3 text-xs sm:text-sm leading-relaxed text-zinc-400 space-y-3">
              <p>● 본 서비스에서 제공하는 중계 일정 및 한국어해설 정보는 쿠팡플레이, 티빙, SPOTV NOW, Apple TV+, SPOTV, SPOTV2, tvN SPORTS, KBS N SPORTS, MBC SPORTS+, SBS Sports의 공식 편성표를 바탕으로 재구성되었습니다.</p>
              <p>● 실시간 중계 사정에 따라 실제 편성 현황과 일부 차이가 있을 수 있으므로 정확한 내용은 각 중계 플랫폼의 공지사항을 확인해 주시기 바랍니다.</p>
            </div>
          </div>
        </div>
      )}

      </div>{/* max-w-2xl wrapper end */}
    </div>
  );
}
