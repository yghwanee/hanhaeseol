"use client";

import { useEffect, useState } from "react";
import { findResult } from "@/lib/results/lookup";
import { GAME_DURATION_HOURS } from "@/lib/schedule-utils";
import type { MatchResult, ResultsData } from "@/types/results";
import type { Schedule } from "@/types/schedule";

/**
 * 매치 페이지 라이브 스코어. 빌드 시점 결과(archive)는 크롤 주기(매시)만큼 늦기 때문에,
 * 킥오프~종료 직후 구간은 이 아일랜드가 /api/live 를 45초 간격으로 받아 채운다.
 * 부모는 정적 "최종 결과" 박스가 없을 때만 렌더한다(두 박스가 겹치지 않게).
 *
 * 창(window)을 벗어나면 폴링을 아예 시작하지 않는다 — 과거 경기 페이지 1,600여 장이
 * 매 방문마다 라이브 엔드포인트를 때리면 캐시가 있어도 의미 없는 호출이다.
 */
export function MatchLiveScore({ schedule }: { schedule: Schedule }) {
  const [result, setResult] = useState<MatchResult | null>(null);

  useEffect(() => {
    const [hh, mm] = schedule.time.split(":").map(Number);
    const start = new Date(
      `${schedule.date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+09:00`,
    ).getTime();
    const duration = (GAME_DURATION_HOURS[schedule.sport] ?? 3) * 60 * 60 * 1000;
    // 종료 후에도 3시간은 본다: 빌드 데이터가 따라잡기 전 구간(매시 크롤 + 배포)을 메운다.
    const until = start + duration + 3 * 60 * 60 * 1000;
    if (Date.now() < start || Date.now() > until) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (stopped) return;
      if (Date.now() > until) return;
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        try {
          const r = await fetch("/api/live", { cache: "no-store" });
          if (r.ok) {
            const data = (await r.json()) as ResultsData;
            const found = findResult(data, schedule);
            if (!stopped && found) setResult(found);
          }
        } catch {
          /* 일시 오류는 다음 틱에 재시도 */
        }
      }
      if (!stopped) timer = setTimeout(tick, 45000);
    };
    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [schedule]);

  if (!result || typeof result.homeScore !== "number" || typeof result.awayScore !== "number") {
    return null;
  }

  const live = result.status === "live";
  const home = result.homeScore;
  const away = result.awayScore;
  // 진행 중에는 승패를 물들이지 않는다(뒤집히면 오해를 부른다).
  const tone = (side: "home" | "away") => {
    if (live) return "text-fg-strong";
    const mine = side === "home" ? home : away;
    const other = side === "home" ? away : home;
    if (result.winner) return result.winner === side ? "text-fg-strong" : "text-fg-tertiary";
    return mine > other ? "text-fg-strong" : mine < other ? "text-fg-tertiary" : "text-fg-strong";
  };

  return (
    <div
      className={`mt-4 rounded-lg border px-4 py-3 ${
        live ? "border-[oklch(0.715_0.220_27_/_0.35)] bg-[oklch(0.298_0.10_22_/_0.32)]" : "border-brand/40 bg-brand-subtle"
      }`}
    >
      <p
        className={`mb-2 flex items-center justify-center gap-1.5 text-caption2 font-medium sm:text-caption1 ${
          live ? "text-fg-danger" : "text-fg-brand-bright"
        }`}
      >
        {live ? (
          <>
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[oklch(0.546_0.220_27)]" />
            LIVE{result.period ? ` · ${result.period}` : ""}
          </>
        ) : (
          "최종 결과"
        )}
      </p>
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        <div className="flex-1 text-right">
          <p className="truncate text-caption1 text-fg sm:text-label1">{schedule.homeTeam}</p>
          <p className={`tabular-nums text-title2 font-bold sm:text-display3 ${tone("home")}`}>{home}</p>
        </div>
        <div className="text-title3 text-fg-tertiary sm:text-title2">:</div>
        <div className="flex-1 text-left">
          <p className="truncate text-caption1 text-fg sm:text-label1">{schedule.awayTeam}</p>
          <p className={`tabular-nums text-title2 font-bold sm:text-display3 ${tone("away")}`}>{away}</p>
        </div>
      </div>
      {typeof result.homePtScore === "number" && typeof result.awayPtScore === "number" && (
        <p className="mt-1 text-center text-caption1 font-semibold text-fg-secondary sm:text-label1">
          승부차기 {result.homePtScore}-{result.awayPtScore}
        </p>
      )}
      <p className="mt-2 text-center text-caption2 text-fg-secondary">
        출처: 네이버 스포츠 · {live ? "45초마다 자동 갱신" : "경기 종료"}
      </p>
    </div>
  );
}
