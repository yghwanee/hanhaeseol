import React from "react";
import { Schedule } from "@/types/schedule";
import { TeamRecord } from "@/types/team-record";
import { isGameFinished } from "@/lib/schedule-utils";
import { StatusBadge } from "./StatusBadge";
import { PlatformBadge } from "./PlatformBadge";
import { Highlight } from "./Highlight";
import { LastFiveBadges } from "./LastFiveBadges";

function ScheduleCardInner({
  schedule,
  query,
  homeRecord,
  awayRecord,
}: {
  schedule: Schedule;
  query: string;
  homeRecord?: TeamRecord;
  awayRecord?: TeamRecord;
}) {
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
        <div className="mt-2.5 sm:mt-3 flex items-start justify-center gap-2 sm:gap-3 text-sm sm:text-base">
          <div className="flex-1 min-w-0 flex flex-col items-end gap-1">
            <span className="w-full text-right font-semibold text-zinc-100 truncate">
              <Highlight text={schedule.homeTeam} query={query} />
            </span>
            {homeRecord?.last5 && <LastFiveBadges form={homeRecord.last5} mirror />}
          </div>
          <span className="shrink-0 mt-1 text-[10px] sm:text-xs font-bold text-zinc-500">VS</span>
          <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
            <span className="w-full text-left font-semibold text-zinc-100 truncate">
              <Highlight text={schedule.awayTeam} query={query} />
            </span>
            {awayRecord?.last5 && <LastFiveBadges form={awayRecord.last5} />}
          </div>
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

export const ScheduleCard = React.memo(ScheduleCardInner);
