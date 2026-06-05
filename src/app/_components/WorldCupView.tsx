"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { Schedule } from "@/types/schedule";
import { TeamRecordsMap } from "@/types/team-record";
import { ResultsData } from "@/types/results";
import { lookupTeamRecord } from "@/lib/team-records/lookup";
import { findResult } from "@/lib/results/lookup";
import { ScheduleCard } from "./ScheduleCard";
import { CoupangTopBannerOnly } from "./CoupangBanners";

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
  const { group, rounds, dday } = useMemo(() => {
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

    return { group, rounds, dday };
  }, [schedules, today]);

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
      {/* 헤더 — 컴팩트 배너. 좌측: D-day + 대회명 / 우측: 국가대표 히어로 이미지(16:9) */}
      <div className="relative mb-6 sm:mb-8 h-[100px] sm:h-[128px] overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-[#0a0f3d] via-[#141c63] to-[#0a0f3d] ring-1 ring-inset ring-amber-300/10">
        {/* 우측 히어로 이미지 */}
        <div className="absolute right-0 top-0 h-full w-[150px] sm:w-[228px]">
          <Image
            src="/worldcup-hero.jpg"
            alt="대한민국 축구 국가대표팀 — 한계를 넘어 하나된 Reds"
            fill
            priority
            sizes="228px"
            className="object-cover object-center"
          />
        </div>
        {/* 좌측 네이비 페이드 — 글자 가독성 */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f3d] via-[#0a0f3d]/85 to-transparent" />

        <div className="relative flex h-full items-center px-4 sm:px-6">
          {dday !== null && dday > 0 && (
            <div className="shrink-0 rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-2.5 sm:px-3.5 py-1.5 text-center shadow-lg shadow-amber-900/30 ring-1 ring-amber-200/50">
              <div className="text-[8px] sm:text-[10px] font-bold leading-none tracking-wider text-amber-900">개막까지</div>
              <div className="mt-0.5 text-lg sm:text-2xl font-extrabold leading-none text-amber-950">D-{dday}</div>
            </div>
          )}
          {dday !== null && dday <= 0 && (
            <div className="shrink-0 rounded-lg bg-rose-500 px-3 py-1.5 text-center text-white shadow-lg">
              <div className="text-sm sm:text-base font-extrabold leading-none">진행 중</div>
            </div>
          )}
          {/* 대회명 — 배지와 우측 이미지 사이 가운데 정렬 */}
          <div className="min-w-0 flex-1 px-1 text-center">
            <p className="whitespace-nowrap text-[9px] sm:text-[11px] font-bold tracking-[0.16em] text-amber-300 drop-shadow">FIFA WORLD CUP 2026</p>
            <h2 className="mt-0.5 text-base sm:text-2xl font-extrabold tracking-tight text-white drop-shadow">북중미 월드컵</h2>
          </div>
          {/* 우측 이미지 폭만큼 자리 확보 → 제목이 이미지와 안 겹치고 가운데로 */}
          <div className="w-[150px] sm:w-[228px] shrink-0" aria-hidden />
        </div>
      </div>

      {/* 쿠팡 파트너스 고지 + 상단 배너 (메인 페이지와 동일) */}
      <div className="mb-3 sm:mb-4 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-center">
        <p className="text-[11px] sm:text-xs text-zinc-400">이 포스팅은 쿠팡 파트너스 활동의 일환으로,<br className="sm:hidden" /> 이에 따른 일정액의 수수료를 제공받습니다.</p>
      </div>
      <CoupangTopBannerOnly />

      {/* 조별리그 — 날짜별 */}
      {group.length > 0 && (
        <section className="mb-8">
          <h3 className="mb-3 text-sm sm:text-base font-bold text-zinc-200">조별리그</h3>
          <div className="space-y-5">
            {group.map(([date, games]) => {
              const { md, dow, weekend } = dateLabel(date);
              const dowColor = weekend === 0 ? "text-red-400" : weekend === 6 ? "text-blue-400" : "text-zinc-400";
              return (
                <div key={date}>
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
