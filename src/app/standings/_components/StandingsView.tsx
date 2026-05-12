"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  BaseballLeagueStandings,
  SoccerLeagueStandings,
  StandingsData,
} from "@/types/standings";
import { FilterButton } from "../../_components/FilterButton";
import { SoccerTable } from "./SoccerTable";
import { BaseballTable } from "./BaseballTable";

type SportKey = "soccer" | "baseball" | "basketball";

const SPORT_LABELS: Record<SportKey, string> = {
  soccer: "축구",
  baseball: "야구",
  basketball: "농구",
};

/** 리그 동그라미 안에 표시할 짧은 약자. 한국 시청자가 즉시 알아보는 표기 우선. */
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
  nba: "NBA",
  kbl: "KBL",
};

export function StandingsView({ data }: { data: StandingsData }) {
  const [sport, setSport] = useState<SportKey>("soccer");

  const leagues = useMemo<
    Array<SoccerLeagueStandings | BaseballLeagueStandings>
  >(() => {
    if (sport === "soccer") return data.soccer;
    if (sport === "baseball") return data.baseball;
    return data.basketball as unknown as Array<
      SoccerLeagueStandings | BaseballLeagueStandings
    >;
  }, [sport, data]);

  const [leagueId, setLeagueId] = useState<string>(() => leagues[0]?.id ?? "");

  const onSportClick = (s: SportKey) => {
    setSport(s);
    const first =
      s === "soccer"
        ? data.soccer[0]?.id
        : s === "baseball"
        ? data.baseball[0]?.id
        : data.basketball[0]?.id;
    if (first) setLeagueId(first);
  };

  const current = leagues.find((l) => l.id === leagueId) ?? leagues[0];

  return (
    <div>
      {/* 종목 탭 (메인 페이지 SPORTS 필터와 동일 디자인) */}
      <div className="mb-3 flex items-center gap-1.5 sm:gap-2">
        <span className="w-12 shrink-0 text-[11px] font-medium text-zinc-300 sm:text-xs">
          종목
        </span>
        <div className="flex gap-1 overflow-x-auto scrollbar-hide sm:gap-1.5">
          {(Object.keys(SPORT_LABELS) as SportKey[]).map((s) => {
            const disabled =
              s === "basketball" && data.basketball.length === 0;
            const label = disabled ? `${SPORT_LABELS[s]} 곧` : SPORT_LABELS[s];
            return (
              <FilterButton
                key={s}
                label={label}
                active={sport === s}
                onClick={() => !disabled && onSportClick(s)}
              />
            );
          })}
        </div>
      </div>

      {/* 리그 가로 스크롤 */}
      <div className="-ml-[6px] pt-1">
        <div className="flex overflow-x-auto overflow-y-hidden scrollbar-hide pb-1 pt-1">
          {leagues.map((lg) => {
            const active = lg.id === current?.id;
            const short = LEAGUE_SHORT[lg.id] ?? lg.name.slice(0, 3);
            return (
              <button
                key={lg.id}
                onClick={() => setLeagueId(lg.id)}
                className="flex shrink-0 flex-col items-center gap-1.5 group"
                style={{ width: 75 }}
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 ${
                    active
                      ? "bg-zinc-100 text-zinc-900 ring-2 ring-zinc-400 scale-105"
                      : "bg-zinc-800/80 text-zinc-200 group-hover:bg-zinc-700/80 group-hover:scale-105"
                  }`}
                >
                  <span
                    className={`font-bold tracking-tight ${
                      short.length >= 4 ? "text-[10px]" : "text-[12px]"
                    }`}
                  >
                    {short}
                  </span>
                </div>
                <span
                  className={`text-[10px] sm:text-[11px] font-medium transition-colors whitespace-nowrap ${
                    active ? "text-zinc-100" : "text-zinc-500 group-hover:text-zinc-300"
                  }`}
                >
                  {lg.name}
                </span>
              </button>
            );
          })}
          <div className="shrink-0 w-4" />
        </div>
      </div>

      {/* 선택 리그 헤더 + 편성표 진입 */}
      {current && (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                {current.name} 순위
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {current.teams.length}개 팀 · 시즌 {current.season}
              </p>
            </div>
            {current.scheduleSlug && (
              <Link
                href={`/league/${current.scheduleSlug}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/10 sm:text-sm"
              >
                {current.name} 한국어 해설 편성표 →
              </Link>
            )}
          </div>

          <div className="mt-4">
            {sport === "soccer" ? (
              <SoccerTable teams={(current as SoccerLeagueStandings).teams} />
            ) : sport === "baseball" ? (
              <BaseballTable
                teams={(current as BaseballLeagueStandings).teams}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
