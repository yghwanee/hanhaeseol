import React from "react";
import Link from "next/link";
import { Schedule } from "@/types/schedule";
import { TeamRecord } from "@/types/team-record";
import { MatchResult } from "@/types/results";
import { isGameFinished } from "@/lib/schedule-utils";
import { matchToSlug } from "@/lib/match-slug";
import { StatusBadge } from "./StatusBadge";
import { PlatformBadge } from "./PlatformBadge";
import { Highlight } from "./Highlight";
import { LastFiveBadges } from "./LastFiveBadges";

function hasScores(r?: MatchResult): r is MatchResult & { homeScore: number; awayScore: number } {
  return !!r && typeof r.homeScore === "number" && typeof r.awayScore === "number";
}

function ScheduleCardInner({
  schedule,
  query,
  homeRecord,
  awayRecord,
  result,
}: {
  schedule: Schedule;
  query: string;
  homeRecord?: TeamRecord;
  awayRecord?: TeamRecord;
  result?: MatchResult;
}) {
  const showScores = hasScores(result);
  const home = result?.homeScore;
  const away = result?.awayScore;
  const winnerSide: "home" | "away" | "draw" | null =
    showScores && result?.status === "finished"
      ? home! > away!
        ? "home"
        : away! > home!
          ? "away"
          : "draw"
      : null;

  return (
    <Link
      href={`/match/${matchToSlug(schedule)}`}
      className="block rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 sm:p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
      aria-label={`${schedule.homeTeam} ${schedule.awayTeam ? `vs ${schedule.awayTeam}` : ""} 경기 상세 보기`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-400">
          <span className="font-mono font-semibold text-zinc-200">
            {schedule.time}
          </span>
          <span className="text-zinc-600">|</span>
          <span className="truncate"><Highlight text={schedule.league} query={query} /></span>
          {result?.period && result.status === "live" && (
            <>
              <span className="text-zinc-600">|</span>
              <span className="text-rose-400 font-semibold">{result.period}</span>
            </>
          )}
        </div>
        <StatusBadge
          status={schedule.koreanCommentary}
          finished={isGameFinished(schedule.date, schedule.time, schedule.sport)}
          resultStatus={result?.status}
        />
      </div>

      {schedule.awayTeam ? (
        <div className="mt-2.5 sm:mt-3 flex items-start justify-center gap-2 sm:gap-3 text-sm sm:text-base">
          <div className="flex-1 min-w-0 flex flex-col items-end gap-1">
            <span className={`w-full text-right font-semibold truncate ${winnerSide === "away" ? "text-zinc-500" : "text-zinc-100"}`}>
              <Highlight text={schedule.homeTeam} query={query} />
            </span>
            {homeRecord?.last5 && (
              <LastFiveBadges form={homeRecord.last5} streak={homeRecord.streak} mirror />
            )}
          </div>
          {showScores ? (
            <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 font-mono font-bold text-base sm:text-lg leading-none mt-0.5">
              <span className={winnerSide === "away" ? "text-zinc-500" : "text-zinc-100"}>{home}</span>
              <span className="text-zinc-600">-</span>
              <span className={winnerSide === "home" ? "text-zinc-500" : "text-zinc-100"}>{away}</span>
            </div>
          ) : (
            <span className="shrink-0 mt-1 text-[10px] sm:text-xs font-bold text-zinc-500">VS</span>
          )}
          <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
            <span className={`w-full text-left font-semibold truncate ${winnerSide === "home" ? "text-zinc-500" : "text-zinc-100"}`}>
              <Highlight text={schedule.awayTeam} query={query} />
            </span>
            {awayRecord?.last5 && (
              <LastFiveBadges form={awayRecord.last5} streak={awayRecord.streak} />
            )}
          </div>
        </div>
      ) : (
        <div className="mt-2.5 sm:mt-3 text-center text-sm sm:text-base font-semibold text-zinc-100 truncate">
          <Highlight text={schedule.homeTeam} query={query} />
        </div>
      )}

      <div className="mt-2.5 sm:mt-3 flex items-center justify-between">
        <PlatformBadge platform={schedule.platform} asLink={false} />
        <span className="text-[11px] sm:text-xs text-zinc-500">{schedule.sport}</span>
      </div>
    </Link>
  );
}

export const ScheduleCard = React.memo(ScheduleCardInner);
