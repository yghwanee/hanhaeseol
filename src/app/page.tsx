"use client";

import { useEffect, useState, useMemo } from "react";
import { Schedule, ScheduleData } from "@/types/schedule";
import scheduleJson from "@/data/schedule.json";

const SPORTS = ["전체", "축구", "야구"] as const;
const PLATFORMS = ["전체", "SPOTV", "쿠팡플레이", "티빙"] as const;

function getWeekDates(): { label: string; value: string }[] {
  const dates: { label: string; value: string }[] = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const value = `${yyyy}-${mm}-${dd}`;

    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const isToday = d.toDateString() === today.toDateString();
    const label = `${Number(mm)}/${Number(dd)}(${dayNames[d.getDay()]})`;

    dates.push({ label: isToday ? `오늘` : label, value });
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

function CommentaryBadge({
  status,
}: {
  status: boolean | "unknown";
}) {
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
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/20 px-2.5 py-0.5 text-xs font-semibold text-zinc-400 ring-1 ring-zinc-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
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
    SPOTV: "bg-red-500/15 text-red-400 ring-red-500/30",
    쿠팡플레이: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
    티빙: "bg-purple-500/15 text-purple-400 ring-purple-500/30",
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
        <CommentaryBadge status={schedule.koreanCommentary} />
      </div>

      <div className="mt-3 flex items-center justify-center gap-3 text-base">
        <span className="flex-1 text-right font-semibold text-zinc-100 truncate">
          {schedule.homeTeam}
        </span>
        <span className="shrink-0 text-xs font-bold text-zinc-500">VS</span>
        <span className="flex-1 text-left font-semibold text-zinc-100 truncate">
          {schedule.awayTeam}
        </span>
      </div>

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
  const [data, setData] = useState<ScheduleData | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [sport, setSport] = useState("전체");
  const [platform, setPlatform] = useState("전체");
  const [koreanOnly, setKoreanOnly] = useState(false);

  const weekDates = useMemo(() => getWeekDates(), []);

  useEffect(() => {
    setData(scheduleJson as ScheduleData);
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.schedules
      .filter((s) => s.date === selectedDate)
      .filter((s) => sport === "전체" || s.sport === sport)
      .filter((s) => platform === "전체" || s.platform === platform)
      .filter((s) => !koreanOnly || s.koreanCommentary === true)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [data, selectedDate, sport, platform, koreanOnly]);

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
          <div className="flex gap-1.5 overflow-x-auto">
            {PLATFORMS.map((p) => (
              <FilterButton
                key={p}
                label={p}
                active={platform === p}
                onClick={() => setPlatform(p)}
              />
            ))}
          </div>
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
      {!data ? (
        <div className="flex items-center justify-center py-20 text-zinc-500">
          불러오는 중...
        </div>
      ) : filtered.length === 0 ? (
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
      {data && (
        <footer className="mt-8 text-center text-xs text-zinc-600">
          마지막 업데이트: {new Date(data.lastUpdated).toLocaleString("ko-KR")}
        </footer>
      )}
    </div>
  );
}
