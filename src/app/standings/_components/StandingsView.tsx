"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  BaseballLeagueStandings,
  SoccerLeagueStandings,
  StandingsData,
} from "@/types/standings";
import { SmoothTabs, SmoothCircleTabs } from "../../_components/SmoothTabs";
import { SoccerTable } from "./SoccerTable";
import { BaseballTable } from "./BaseballTable";
import { MlbStandingsTable } from "./MlbStandingsTable";
import { MlsStandingsTable } from "./MlsStandingsTable";
import { useScrollbarDrag } from "@/lib/hooks/useScrollbarDrag";
import { AdfitBanner } from "../../_components/AdfitBanner";

type SportKey = "soccer" | "baseball";

const SPORTS: { key: SportKey; label: string }[] = [
  { key: "soccer", label: "축구" },
  { key: "baseball", label: "야구" },
];

/** 리그 동그라미 안에 표시할 짧은 약자. 한국 시청자가 즉시 알아보는 표기. */
const LEAGUE_SHORT: Record<string, string> = {
  epl: "EPL",
  primera: "라리가",
  bundesliga: "분데스",
  seria: "세리에",
  ligue1: "리그앙",
  champs: "챔스",
  europa: "유로파",
  mls: "MLS",
  kleague: "K리그",
  kleague2: "K리그2",
  eredivisie: "에레디",
  kbo: "KBO",
  mlb: "MLB",
};

export function StandingsView({
  data,
  initialSport = "soccer",
  initialLeague = "",
  teamLinks,
}: {
  data: StandingsData;
  initialSport?: SportKey;
  initialLeague?: string;
  /** 순위표 리그 id → (팀명 → 팀 페이지 href). 서버에서 계산해 내려준다. */
  teamLinks?: Record<string, Record<string, string>>;
}) {
  const [sport, setSport] = useState<SportKey>(initialSport);

  const leagues = useMemo<
    Array<SoccerLeagueStandings | BaseballLeagueStandings>
  >(() => {
    return sport === "soccer" ? data.soccer : data.baseball;
  }, [sport, data]);

  const [leagueId, setLeagueId] = useState<string>(
    () => initialLeague || leagues[0]?.id || "",
  );

  // 상태 변경 시 URL ↔ 동기화 (history.replaceState로 라우터 재요청 없이).
  // 첫 인자에 null 을 넘기면 Next.js App Router 의 router state 가 entry 에서 사라져
  // 뒤로가기 시 page swap 이 깨진다. 기존 state 를 보존.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (sport !== "soccer") params.set("sport", sport);
    else params.delete("sport");
    const firstId = (sport === "soccer" ? data.soccer[0]?.id : data.baseball[0]?.id) ?? "";
    if (leagueId && leagueId !== firstId) params.set("league", leagueId);
    else params.delete("league");
    const qs = params.toString();
    const next = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", next);
  }, [sport, leagueId, data]);

  const onSportClick = (s: SportKey) => {
    setSport(s);
    const first = s === "soccer" ? data.soccer[0]?.id : data.baseball[0]?.id;
    if (first) setLeagueId(first);
  };

  const current = leagues.find((l) => l.id === leagueId) ?? leagues[0];

  // 메인 페이지 PLATFORM 필터와 동일한 가로 스크롤 + indicator + 드래그
  const scrollerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const { trackRef: scrollbarTrackRef, handlers: scrollbarHandlers } = useScrollbarDrag(scrollerRef);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const dragState = useRef({
    isDown: false,
    isDragging: false,
    startX: 0,
    scrollLeft: 0,
  });

  useEffect(() => {
    const el = scrollerRef.current;
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
  }, [sport, leagues.length]);

  return (
    <div>
      {/* 페이지 제목 + 종목 탭 (한 줄) */}
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mb-8">
        <h1 className="text-title3 font-bold text-fg-strong sm:text-title2">팀 순위</h1>
        <SmoothTabs<SportKey>
          ariaLabel="종목 선택"
          options={SPORTS.map((s) => ({ value: s.key, label: s.label }))}
          value={sport}
          onChange={onSportClick}
        />
      </div>

      {/* 리그 가로 스크롤 (메인 PLATFORM 필터와 동일) */}
      <div className="pt-2">
        <div className="relative">
        <div
          ref={scrollerRef}
          className={`overflow-x-auto overflow-y-hidden scrollbar-hide pb-1 pt-1 -mt-1 ${
            sport === "baseball" ? "flex justify-center" : ""
          }`}
        >
          <SmoothCircleTabs
            ariaLabel="리그 선택"
            options={leagues.map((lg) => lg.id)}
            value={current?.id ?? ""}
            onChange={setLeagueId}
            itemWidth={75}
            ringSize={56}
            renderItem={(id, active) => {
              const lg = leagues.find((l) => l.id === id);
              if (!lg) return null;
              const short = LEAGUE_SHORT[lg.id] ?? lg.name.slice(0, 3);
              return (
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    data-circle
                    className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 ${
                      active ? "scale-105 bg-fg-strong" : "scale-100 bg-muted ring-1 ring-line-subtle"
                    }`}
                  >
                    <span
                      className={`font-bold tracking-tight ${
                        short.length >= 4 ? "text-caption2" : "text-[12px]"
                      } ${active ? "text-canvas" : "text-fg-secondary"}`}
                    >
                      {short}
                    </span>
                  </div>
                  <span
                    className={`text-caption2 sm:text-caption2 font-medium transition-colors whitespace-nowrap ${
                      active ? "text-fg-strong" : "text-fg-tertiary"
                    }`}
                  >
                    {lg.name}
                  </span>
                </div>
              );
            }}
          />
        </div>
        <div
          className={`pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-subtle via-subtle to-transparent transition-opacity duration-200 ${
            showLeftFade ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <div
          className={`pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-subtle via-subtle to-transparent transition-opacity duration-200 ${
            showRightFade ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        </div>
        {/* Scroll indicator bar — 야구는 리그가 2개라 스크롤 자체가 안 생겨서 숨김 */}
        <div className={`mt-3 mx-auto w-28 sm:w-32 ${sport === "baseball" ? "hidden" : ""}`}>
          <div
            aria-hidden
            {...scrollbarHandlers}
            className="-my-2 py-2 cursor-pointer touch-none select-none"
          >
            <div ref={scrollbarTrackRef} className="h-[3px] rounded-full bg-muted">
              <div
                ref={indicatorRef}
                className="h-full rounded-full bg-fg-tertiary"
                style={{ width: "35%", transform: "translateX(0%)", willChange: "transform" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 광고 — 리그 탭 아래(2026-09-14 화니 지시, 종전엔 페이지 맨 위).
          🔴 아래 `key` 걸린 리그 블록 **밖**에 둔다. 안에 두면 탭을 바꿀 때마다 `<ins>` 가
          다시 마운트되는데 애드핏 SDK 스캔은 페이지당 한 번이라 두 번째부터 빈칸이 된다. */}
      <AdfitBanner className="mt-6" />
      {current && (
        <div key={`${sport}|${current.id}`} className="tab-content-anim">
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-heading1 font-bold text-fg-strong sm:text-title3">
                {current.name} 순위
              </h2>
              <p className="mt-1 text-caption1 text-fg-tertiary">
                {current.teams.length}개 팀
              </p>
            </div>
            {current.scheduleSlug && (
              <Link
                href={`/league/${current.scheduleSlug}`}
                className="-my-2 inline-block py-2 inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand-subtle px-3 py-2 text-caption1 font-semibold text-fg-brand-bright transition-colors hover:border-brand/40 hover:bg-brand-subtle sm:text-label1"
              >
                {current.name} 한국어 해설 편성표 →
              </Link>
            )}
          </div>

          <div className="mt-4">
            {sport === "soccer" ? (
              current.id === "mls" ? (
                <MlsStandingsTable teams={(current as SoccerLeagueStandings).teams} teamLinks={teamLinks?.[current.id]} />
              ) : (
                <SoccerTable teams={(current as SoccerLeagueStandings).teams} teamLinks={teamLinks?.[current.id]} />
              )
            ) : current.id === "mlb" ? (
              <MlbStandingsTable teams={(current as BaseballLeagueStandings).teams} teamLinks={teamLinks?.[current.id]} />
            ) : (
              <BaseballTable teams={(current as BaseballLeagueStandings).teams} teamLinks={teamLinks?.[current.id]} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
