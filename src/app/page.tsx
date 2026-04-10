"use client";

import React, { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { Schedule, ScheduleData } from "@/types/schedule";

const SPORTS = ["전체", "축구", "야구", "농구", "배구"] as const;
function getUpcomingDates(): { label: string; value: string }[] {
  const dates: { label: string; value: string }[] = [];
  const today = new Date();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const value = `${yyyy}-${mm}-${dd}`;
    const label = i === 0 ? "오늘" : `${Number(mm)}/${Number(dd)}(${dayNames[d.getDay()]})`;
    dates.push({ label, value });
  }
  return dates;
}

function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const GAME_DURATION_HOURS: Record<string, number> = {
  "축구": 2.5,
  "야구": 4.5,
  "농구": 3,
  "배구": 3,
};

function isGameFinished(date: string, time: string, sport: string): boolean {
  const [hh, mm] = time.split(":").map(Number);
  const gameStart = new Date(`${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+09:00`);
  const duration = (GAME_DURATION_HOURS[sport] ?? 3) * 60 * 60 * 1000;
  return Date.now() > gameStart.getTime() + duration;
}

function StatusBadge({
  status,
  finished,
}: {
  status: boolean | "unknown";
  finished: boolean;
}) {
  if (finished) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/20 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-zinc-400 ring-1 ring-zinc-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        경기 종료
      </span>
    );
  }
  if (status === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        한국어해설
      </span>
    );
  }
  if (status === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-rose-400 ring-1 ring-rose-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        현지해설
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-yellow-400 ring-1 ring-yellow-500/30">
      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
      확인중
    </span>
  );
}

function AdSkeleton({ className }: { className?: string }) {
  return (
    <div className={`skeleton-shimmer rounded-xl ${className ?? ""}`} />
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const styles: Record<string, string> = {
    "SPOTV NOW": "bg-red-500/15 text-red-400 ring-red-500/30",
    SPOTV: "bg-red-500/15 text-red-400 ring-red-500/30",
    SPOTV2: "bg-orange-500/15 text-orange-400 ring-orange-500/30",
    쿠팡플레이: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
    티빙: "bg-purple-500/15 text-purple-400 ring-purple-500/30",
    "tvN SPORTS": "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
    "KBS N SPORTS": "bg-sky-500/15 text-sky-400 ring-sky-500/30",
    "MBC SPORTS+": "bg-amber-500/15 text-amber-400 ring-amber-500/30",
    "SBS Sports": "bg-indigo-500/15 text-indigo-400 ring-indigo-500/30",
    "Apple TV+": "bg-gray-500/15 text-gray-300 ring-gray-500/30",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold ring-1 ${styles[platform] ?? "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30"}`}
    >
      {platform}
    </span>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="text-white underline underline-offset-2 decoration-blue-400">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function ScheduleCard({ schedule, query }: { schedule: Schedule; query: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 sm:p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-400">
          <span className="font-mono font-semibold text-zinc-200">
            {schedule.time}
          </span>
          <span className="text-zinc-600">|</span>
          <span className="truncate"><Highlight text={schedule.league} query={query} /></span>
        </div>
        <StatusBadge
          status={schedule.koreanCommentary}
          finished={isGameFinished(schedule.date, schedule.time, schedule.sport)}
        />
      </div>

      {schedule.awayTeam ? (
        <div className="mt-2.5 sm:mt-3 flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base">
          <span className="flex-1 text-right font-semibold text-zinc-100 truncate">
            <Highlight text={schedule.homeTeam} query={query} />
          </span>
          <span className="shrink-0 text-[10px] sm:text-xs font-bold text-zinc-500">VS</span>
          <span className="flex-1 text-left font-semibold text-zinc-100 truncate">
            <Highlight text={schedule.awayTeam} query={query} />
          </span>
        </div>
      ) : (
        <div className="mt-2.5 sm:mt-3 text-center text-sm sm:text-base font-semibold text-zinc-100 truncate">
          <Highlight text={schedule.homeTeam} query={query} />
        </div>
      )}

      <div className="mt-2.5 sm:mt-3 flex items-center justify-between">
        <PlatformBadge platform={schedule.platform} />
        <span className="text-[11px] sm:text-xs text-zinc-500">{schedule.sport}</span>
      </div>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-colors ${
        active
          ? "bg-zinc-100 text-zinc-900"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

export default function Home() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [sport, setSport] = useState("전체");
  const [platform, setPlatform] = useState("전체");
  const [commentaryFilter, setCommentaryFilter] = useState<"all" | "korean" | "foreign">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [platformExpanded, setPlatformExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showAds, setShowAds] = useState(false);

  useEffect(() => {
    fetch("/schedule.json")
      .then((res) => res.json())
      .then((json) => setData(json as ScheduleData));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowAds(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const weekDates = useMemo(() => getUpcomingDates(), []);

  const filtered = useMemo(() => {
    if (!data) return [];
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
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
          s.homeTeam.toLowerCase().includes(q) ||
          s.awayTeam.toLowerCase().includes(q) ||
          s.league.toLowerCase().includes(q)
        );
      })
      .filter((s) => !isGameFinished(s.date, s.time, s.sport))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [data, selectedDate, sport, platform, commentaryFilter, searchQuery]);

  return (
    <div className="relative mx-auto min-h-screen max-w-2xl px-3 sm:px-4 pb-8 sm:pb-12 pt-6 sm:pt-10 xl:max-w-none xl:px-[200px]">
      {/* PC 왼쪽 광고 */}
      <div className="hidden xl:block fixed left-4 top-1/2 -translate-y-1/2 z-10 rounded-xl overflow-hidden shadow-lg shadow-black/20">
        {showAds ? (
          <iframe src="https://ads-partners.coupang.com/widgets.html?id=979121&template=carousel&trackingCode=AF2259406&subId=&width=160&height=600&tsource=" width="160" height="600" frameBorder="0" scrolling="no" referrerPolicy="unsafe-url" loading="lazy" />
        ) : (
          <AdSkeleton className="w-[160px] h-[600px]" />
        )}
      </div>

      {/* PC 오른쪽 광고 */}
      <div className="hidden xl:block fixed right-4 top-1/2 -translate-y-1/2 z-10 rounded-xl overflow-hidden shadow-lg shadow-black/20">
        {showAds ? (
          <iframe src="https://ads-partners.coupang.com/widgets.html?id=979133&template=carousel&trackingCode=AF2259406&subId=&width=160&height=600&tsource=" width="160" height="600" frameBorder="0" scrolling="no" referrerPolicy="unsafe-url" loading="lazy" />
        ) : (
          <AdSkeleton className="w-[160px] h-[600px]" />
        )}
      </div>

      <div className="mx-auto max-w-2xl">
      {/* Header */}
      <header className="mb-6 sm:mb-10">
        <h1 className="flex items-end">
          <Image src="/icon.png" alt="한해설 아이콘" width={32} height={32} className="h-6 w-6 sm:h-8 sm:w-8 self-center" />
          <span className="ml-1 sm:ml-2 text-xl sm:text-3xl font-bold text-white">한해설</span>
          <span className="ml-2 sm:ml-3 text-sm sm:text-lg font-normal text-zinc-500">한국어중계 편성표</span>
        </h1>
      </header>

      <div className="mb-6 sm:mb-10 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-center">
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
                onClick={() => setSport(s)}
              />
            ))}
          </div>
        </div>

        {/* Platform Filter - Mobile */}
        <div className="sm:hidden relative flex items-start gap-1.5 pr-8">
          <span className="w-14 shrink-0 pt-1 text-[11px] font-medium text-zinc-300">
            플랫폼
          </span>
          <div className={`flex flex-wrap gap-1 ${platformExpanded ? "" : "max-h-[30px] overflow-hidden"}`}>
            <FilterButton
              label="전체"
              active={platform === "전체"}
              onClick={() => setPlatform("전체")}
            />
            {["쿠팡플레이", "티빙", "Apple", "SPOTV", "SPOTV2", "SPOTV NOW", "tvN SPORTS", "KBS N SPORTS", "MBC SPORTS+", "SBS Sports"].map((p) => {
              const platformKey = p === "Apple" ? "Apple TV+" : p;
              return (
              <FilterButton
                key={platformKey}
                label={p}
                active={platform === platformKey}
                onClick={() => setPlatform(platformKey)}
              />
            );
            })}
          </div>
          <button
            onClick={() => setPlatformExpanded(!platformExpanded)}
            className="absolute right-0 top-1 rounded-md border border-zinc-700 bg-zinc-800 p-1 text-zinc-300"
            aria-label={platformExpanded ? "접기" : "펼치기"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 transition-transform ${platformExpanded ? "rotate-180" : ""}`}>
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Platform Filter - Desktop */}
        <div className="hidden sm:block">
          <div className="relative flex items-start gap-2 pr-8">
            <span className="w-12 shrink-0 pt-1.5 text-xs font-medium text-zinc-300">
              플랫폼
            </span>
            <FilterButton
              label="전체"
              active={platform === "전체"}
              onClick={() => setPlatform("전체")}
            />
            <div className="flex flex-wrap gap-1.5">
              {["쿠팡플레이", "티빙", "Apple TV+", "SPOTV", "SPOTV2", "SPOTV NOW"].map((p) => {
                const displayLabel = p === "Apple TV+" ? "Apple" : p;
                return (
                <FilterButton
                  key={p}
                  label={displayLabel}
                  active={platform === p}
                  onClick={() => setPlatform(p)}
                />
              );
              })}
              {platformExpanded && ["tvN SPORTS", "KBS N SPORTS", "MBC SPORTS+", "SBS Sports"].map((p) => (
                <FilterButton
                  key={p}
                  label={p}
                  active={platform === p}
                  onClick={() => setPlatform(p)}
                />
              ))}
            </div>
            <button
              onClick={() => setPlatformExpanded(!platformExpanded)}
              className="absolute right-0 top-1 rounded-md border border-zinc-700 bg-zinc-800 p-1 text-zinc-300"
              aria-label={platformExpanded ? "접기" : "펼치기"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 transition-transform ${platformExpanded ? "rotate-180" : ""}`}>
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
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
      </div>

      {/* 모바일 광고 */}
      <div className="sm:hidden flex justify-center mb-4">
        {showAds ? (
          <a href="https://link.coupang.com/a/ekC6YT" target="_blank" referrerPolicy="unsafe-url" className="w-full">
            <img src="https://ads-partners.coupang.com/banners/979237?subId=&traceId=V0-301-371ae01f4226dec2-I979237&w=320&h=50" alt="" className="w-full h-auto" loading="lazy" />
          </a>
        ) : (
          <AdSkeleton className="w-full h-[50px]" />
        )}
      </div>
      {/* PC 광고 */}
      <div className="hidden sm:flex justify-center mb-6">
        <div className="rounded-xl overflow-hidden w-full max-w-2xl">
          {showAds ? (
            <iframe src="https://ads-partners.coupang.com/widgets.html?id=979114&template=banner&trackingCode=AF2259406&subId=&width=728&height=90" className="w-full h-[90px] border-0 rounded-xl" scrolling="no" referrerPolicy="unsafe-url" loading="lazy" />
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
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="팀, 리그 검색"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
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
              <span>
                {(() => {
                  const sports = new Set(filtered.map(s => s.sport));
                  const icons: string[] = [];
                  if (sports.has("축구")) icons.push("⚽");
                  if (sports.has("농구")) icons.push("🏀");
                  if (sports.has("야구")) icons.push("⚾");
                  if (sports.has("배구")) icons.push("🏐");
                  return icons.join(" ");
                })()}
              </span>
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
                      <div className="rounded-lg overflow-hidden">
                        {showAds ? (
                          <iframe src="https://ads-partners.coupang.com/widgets.html?id=979232&template=carousel&trackingCode=AF2259406&subId=&width=320&height=100&tsource=" className="w-full h-[100px] border-0" scrolling="no" referrerPolicy="unsafe-url" loading="lazy" />
                        ) : (
                          <AdSkeleton className="w-full h-[100px]" />
                        )}
                      </div>
                    </div>
                    <div className="hidden sm:flex justify-center">
                      <div className="rounded-lg overflow-hidden w-full max-w-2xl">
                        {showAds ? (
                          <iframe src="https://ads-partners.coupang.com/widgets.html?id=979239&template=carousel&trackingCode=AF2259406&subId=&width=680&height=140&tsource=" width="680" height="140" frameBorder="0" scrolling="no" referrerPolicy="unsafe-url" loading="lazy" className="w-full h-[140px] border-0" />
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
        <p className="text-[11px] sm:text-xs leading-relaxed text-zinc-600">
          한해설은 축구, 야구, 농구, 배구 한국어중계 편성표를 제공합니다. SPOTV NOW, 쿠팡플레이, 티빙, Apple TV+, SPOTV, SPOTV2, tvN SPORTS, KBS N SPORTS, MBC SPORTS+, SBS Sports 등 10개 플랫폼의 한국어 해설 중계 일정을 한눈에 확인하세요. 프리미어리그, 라리가, 세리에A, 분데스리가, 챔피언스리그 한국어중계부터 KBO, K리그, NBA, MLB 등 주요 리그의 한국어중계 여부를 실시간으로 확인할 수 있습니다. 오늘 한국어중계가 있는 경기를 한눈에 찾아보세요.
        </p>
      </section>

      {/* Footer */}
      <footer className="mt-6 sm:mt-8 text-center text-[11px] sm:text-xs text-zinc-600" suppressHydrationWarning>
        마지막 업데이트: {data ? new Date(data.lastUpdated).toLocaleString("ko-KR") : "로딩 중..."}
      </footer>
      </div>{/* max-w-2xl wrapper end */}
    </div>
  );
}
