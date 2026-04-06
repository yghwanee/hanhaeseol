"use client";

import { useState, useMemo, useRef } from "react";
import { Schedule, ScheduleData } from "@/types/schedule";
import scheduleJson from "@/data/schedule.json";

const data = scheduleJson as ScheduleData;

const SPORTS = ["전체", "축구", "야구", "농구", "배구"] as const;
const PLATFORMS = [
  "전체", "SPOTV NOW", "SPOTV", "SPOTV2",
  "쿠팡플레이", "티빙", "tvN SPORTS",
  "KBS N SPORTS", "MBC SPORTS+", "SBS Sports", "Apple TV+",
] as const;

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
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/20 px-2.5 py-0.5 text-xs font-semibold text-zinc-400 ring-1 ring-zinc-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        경기 종료
      </span>
    );
  }
  if (status === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        한국어해설
      </span>
    );
  }
  if (status === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-400 ring-1 ring-rose-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        현지해설
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2.5 py-0.5 text-xs font-semibold text-yellow-400 ring-1 ring-yellow-500/30">
      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
      확인중
    </span>
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
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${styles[platform] ?? "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30"}`}
    >
      {platform}
    </span>
  );
}

function ScheduleCard({ schedule }: { schedule: Schedule }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span className="font-mono font-semibold text-zinc-200">
            {schedule.time}
          </span>
          <span className="text-zinc-600">|</span>
          <span>{schedule.league}</span>
        </div>
        <StatusBadge
          status={schedule.koreanCommentary}
          finished={isGameFinished(schedule.date, schedule.time, schedule.sport)}
        />
      </div>

      {schedule.awayTeam ? (
        <div className="mt-3 flex items-center justify-center gap-3 text-base">
          <span className="flex-1 text-right font-semibold text-zinc-100 truncate">
            {schedule.homeTeam}
          </span>
          <span className="shrink-0 text-xs font-bold text-zinc-500">VS</span>
          <span className="flex-1 text-left font-semibold text-zinc-100 truncate">
            {schedule.awayTeam}
          </span>
        </div>
      ) : (
        <div className="mt-3 text-center text-base font-semibold text-zinc-100 truncate">
          {schedule.homeTeam}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <PlatformBadge platform={schedule.platform} />
        <span className="text-xs text-zinc-500">{schedule.sport}</span>
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
      className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
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
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [sport, setSport] = useState("전체");
  const [platform, setPlatform] = useState("전체");
  const [koreanOnly, setKoreanOnly] = useState(false);
  const platformScrollRef = useRef<HTMLDivElement>(null);

  const weekDates = useMemo(() => getUpcomingDates(), []);

  const filtered = useMemo(() => {
    return data.schedules
      .filter((s) => s.date === selectedDate)
      .filter((s) => sport === "전체" || s.sport === sport)
      .filter((s) => platform === "전체" || s.platform === platform)
      .filter((s) => !koreanOnly || s.koreanCommentary === true)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedDate, sport, platform, koreanOnly]);

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 pb-12 pt-6">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">
          한해설
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          한국어 해설 편성표
        </p>
      </header>

      {/* Date Tabs */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
        {weekDates.map((d) => (
          <button
            key={d.value}
            onClick={() => setSelectedDate(d.value)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              selectedDate === d.value
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-3">
        {/* Sport Filter */}
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs font-medium text-zinc-500">
            종목
          </span>
          <div className="flex gap-1.5 overflow-x-auto">
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

        {/* Platform Filter */}
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs font-medium text-zinc-500">
            플랫폼
          </span>
          <FilterButton
            label="전체"
            active={platform === "전체"}
            onClick={() => setPlatform("전체")}
          />
          <button
            onClick={() => {
              platformScrollRef.current?.scrollBy({ left: -150, behavior: "smooth" });
            }}
            className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="이전"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
            </svg>
          </button>
          <div
            ref={platformScrollRef}
            className="flex min-w-0 gap-1.5 overflow-x-auto scrollbar-hide"
          >
            {PLATFORMS.filter((p) => p !== "전체").map((p) => (
              <FilterButton
                key={p}
                label={p}
                active={platform === p}
                onClick={() => setPlatform(p)}
              />
            ))}
          </div>
          <button
            onClick={() => {
              platformScrollRef.current?.scrollBy({ left: 150, behavior: "smooth" });
            }}
            className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="다음"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Korean Commentary Toggle */}
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs font-medium text-zinc-500">
            해설
          </span>
          <FilterButton
            label="전체"
            active={!koreanOnly}
            onClick={() => setKoreanOnly(false)}
          />
          <FilterButton
            label="한국어해설만"
            active={koreanOnly}
            onClick={() => setKoreanOnly(true)}
          />
        </div>
      </div>

      {/* Schedule List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <span className="text-3xl">📭</span>
          <p className="mt-3 text-sm">해당 조건의 편성이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            {filtered.length}개 경기
          </p>
          {filtered.map((schedule) => (
            <ScheduleCard key={schedule.id} schedule={schedule} />
          ))}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-zinc-600" suppressHydrationWarning>
        마지막 업데이트: {new Date(data.lastUpdated).toLocaleString("ko-KR")}
      </footer>
    </div>
  );
}
