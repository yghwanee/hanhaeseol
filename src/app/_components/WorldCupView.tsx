"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { Schedule } from "@/types/schedule";
import { TeamRecordsMap } from "@/types/team-record";
import { ResultsData } from "@/types/results";
import { lookupTeamRecord } from "@/lib/team-records/lookup";
import { findResult } from "@/lib/results/lookup";
import { ScheduleCard } from "./ScheduleCard";
import { AdfitBanner } from "./AdfitBanner";
import { WorldCupBanner } from "./WorldCupBanner";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
// 토너먼트 라운드 표시 순서 (league 접미사 기준)
const ROUND_ORDER = ["32강", "16강", "8강", "4강", "3·4위전", "결승"];

function dateLabel(d: string): { md: string; dow: string; weekend: 0 | 6 | null } {
  const [y, m, day] = d.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return {
    md: `${m}월 ${day}일`,
    dow: DOW[wd],
    weekend: wd === 0 ? 0 : wd === 6 ? 6 : null,
  };
}

/** date-only 문자열 간 일수 차 (b - a). KST 무관, 날짜 카운트용. */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function WorldCupView({
  schedules,
  teamRecords = {},
  results = null,
  today,
}: {
  schedules: Schedule[];
  teamRecords?: TeamRecordsMap;
  results?: ResultsData | null;
  today: string;
}) {
  const { group, rounds, dday, focusDate } = useMemo(() => {
    const sorted = [...schedules].sort((a, b) =>
      a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
    );

    // 조별리그(league === "북중미 월드컵")는 날짜별로 묶는다.
    const groupStage = sorted.filter((s) => s.league === "북중미 월드컵");
    const byDate = new Map<string, Schedule[]>();
    for (const s of groupStage) {
      const arr = byDate.get(s.date) ?? [];
      arr.push(s);
      byDate.set(s.date, arr);
    }
    const group = [...byDate.entries()];

    // 토너먼트는 라운드별로 묶는다. league = "북중미 월드컵 32강" 등.
    const byRound = new Map<string, Schedule[]>();
    for (const s of sorted) {
      if (s.league === "북중미 월드컵") continue;
      const label = s.league.replace(/^북중미 월드컵\s*/, "");
      const arr = byRound.get(label) ?? [];
      arr.push(s);
      byRound.set(label, arr);
    }
    const rounds = ROUND_ORDER.filter((r) => byRound.has(r)).map((r) => [r, byRound.get(r)!] as const);

    const firstDate = sorted[0]?.date;
    const dday = firstDate ? daysBetween(today, firstDate) : null;

    // 진입 시 포커싱할 조별리그 날짜: 오늘 ⊃ 없으면 오늘 이후 가장 가까운 날 ⊃ 없으면 마지막(가장 최근).
    const groupDates = group.map(([d]) => d);
    const focusDate =
      groupDates.find((d) => d === today) ??
      groupDates.find((d) => d > today) ??
      groupDates[groupDates.length - 1] ??
      null;

    return { group, rounds, dday, focusDate };
  }, [schedules, today]);

  // 마운트(또는 포커스 날짜 변경) 시 해당 날짜 섹션으로 1회 스크롤. 스티키 헤더만큼 scroll-mt로 보정.
  const focusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!focusDate) return;
    const id = requestAnimationFrame(() => {
      focusRef.current?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [focusDate]);

  const renderCard = (s: Schedule) => (
    <ScheduleCard
      key={s.id}
      schedule={s}
      query=""
      homeRecord={lookupTeamRecord(teamRecords, s.league, s.homeTeam)}
      awayRecord={lookupTeamRecord(teamRecords, s.league, s.awayTeam)}
      result={findResult(results, s)}
    />
  );

  return (
    <div className="tab-content-anim">
      {/* 배너 클릭 → 조별 순위·기록 페이지 */}
      <WorldCupBanner dday={dday} href="/worldcup" />

      {/* 쿠팡 파트너스 고지 + 애드핏 배너 (메인 페이지와 동일) */}
      <div className="mb-3 sm:mb-4 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-center">
        <p className="text-[11px] sm:text-xs text-zinc-400">이 포스팅은 쿠팡 파트너스 활동의 일환으로,<br className="sm:hidden" /> 이에 따른 일정액의 수수료를 제공받습니다.</p>
      </div>
      <AdfitBanner className="mb-6" />

      {/* 조별리그 — 날짜별 */}
      {group.length > 0 && (
        <section className="mb-8">
          <h3 className="mb-3 text-sm sm:text-base font-bold text-zinc-200">조별리그</h3>
          <div className="space-y-5">
            {group.map(([date, games]) => {
              const { md, dow, weekend } = dateLabel(date);
              const dowColor = weekend === 0 ? "text-red-400" : weekend === 6 ? "text-blue-400" : "text-zinc-400";
              const isFocus = date === focusDate;
              return (
                <div key={date} ref={isFocus ? focusRef : undefined} className={isFocus ? "scroll-mt-24" : undefined}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-zinc-100">{md}</span>
                    <span className={`text-[11px] sm:text-xs font-medium ${dowColor}`}>({dow})</span>
                    <div className="h-px flex-1 bg-zinc-800" />
                    <span className="text-[11px] text-zinc-500">{games.length}경기</span>
                  </div>
                  <div className="space-y-2.5 sm:space-y-3">{games.map(renderCard)}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 토너먼트 — 라운드별 */}
      {rounds.length > 0 && (
        <section className="mb-4">
          <h3 className="mb-3 text-sm sm:text-base font-bold text-zinc-200">토너먼트</h3>
          <div className="space-y-5">
            {rounds.map(([label, games]) => (
              <div key={label}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] sm:text-xs font-bold text-zinc-100">{label}</span>
                  <div className="h-px flex-1 bg-zinc-800" />
                  <span className="text-[11px] text-zinc-500">{games.length}경기</span>
                </div>
                <div className="space-y-2.5 sm:space-y-3">{games.map(renderCard)}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
