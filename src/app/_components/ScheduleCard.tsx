import React from "react";
import Link from "next/link";
import { Schedule } from "@/types/schedule";
import { TeamRecord } from "@/types/team-record";
import { GoalEvent, MatchResult } from "@/types/results";
import { isGameFinished } from "@/lib/schedule-utils";
import { matchToSlug } from "@/lib/match-slug";
import { proxyLogo } from "@/lib/emblem";
import { StatusBadge } from "./StatusBadge";
import { PlatformBadge } from "./PlatformBadge";
import { Highlight } from "./Highlight";
import { LastFiveBadges } from "./LastFiveBadges";

/** "이름 45+2'" 형태 라벨. 자책골은 (OG) 표기. */
function goalLabel(g: GoalEvent): string {
  const t = g.addedTime ? `${g.minute}+${g.addedTime}'` : `${g.minute}'`;
  return `${g.player} ${t}${g.ownGoal ? " (OG)" : ""}`;
}

/** 카드 하단 득점자 줄: 홈은 우측(센터 쪽)·원정은 좌측 정렬, ⚽는 센터 쪽에 둬 미러 배치. */
function ScorerLines({ goals }: { goals: GoalEvent[] }) {
  const home = goals.filter((g) => g.team === "home");
  const away = goals.filter((g) => g.team === "away");
  return (
    <div className="pointer-events-none relative z-10 mt-2 grid grid-cols-2 gap-x-3 sm:gap-x-4 text-[10px] sm:text-[11px] leading-snug text-zinc-400">
      <div className="min-w-0 space-y-0.5 text-right">
        {home.map((g, i) => (
          <div key={i} className="truncate">
            {goalLabel(g)} <span aria-hidden>⚽</span>
          </div>
        ))}
      </div>
      <div className="min-w-0 space-y-0.5 text-left">
        {away.map((g, i) => (
          <div key={i} className="truncate">
            <span aria-hidden>⚽</span> {goalLabel(g)}
          </div>
        ))}
      </div>
    </div>
  );
}

function hasNumericScores(r?: MatchResult): r is MatchResult & { homeScore: number; awayScore: number } {
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
  // 종료 경기는 항상 스코어 표시. 축구는 진행 중에도 스코어+득점자를 보여준다
  // (타 종목은 진행 중 스코어가 어긋날 수 있어 종전대로 종료만 표시).
  const isSoccer = schedule.sport === "축구";
  const numeric = hasNumericScores(result);
  const showScores =
    numeric && (result.status === "finished" || (isSoccer && result.status === "live"));
  const home = result?.homeScore;
  const away = result?.awayScore;
  // 승부차기로 갈린 경기는 스코어가 같아도(1-1) result.winner로 승패를 가른다.
  const winnerSide: "home" | "away" | "draw" | null =
    showScores && result?.status === "finished"
      ? (result.winner ??
        (home! > away! ? "home" : away! > home! ? "away" : "draw"))
      : null;
  const showGoals = isSoccer && showScores && !!result?.goals && result.goals.length > 0;
  const showPk =
    showScores &&
    result?.status === "finished" &&
    typeof result?.homePtScore === "number" &&
    typeof result?.awayPtScore === "number";
  const showHighlight = result?.status === "finished" && !!result?.highlightVideoId;

  // 카드 전체는 매치 페이지로, 플랫폼 뱃지는 플랫폼 페이지로 — nested anchor 회피를
  // 위해 카드 본체를 div로 두고 absolute Link를 inset-0으로 깐다. PlatformBadge Link는
  // z-index를 더 올려서 위에 떠 있게 두면 클릭 우선순위가 잡힌다.
  return (
    <div className="relative cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 pb-6 sm:p-4 sm:pb-8 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
      <Link
        href={`/match/${matchToSlug(schedule)}`}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`${schedule.homeTeam} ${schedule.awayTeam ? `vs ${schedule.awayTeam}` : ""} 경기 상세 보기`}
      />
      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-400">
          <span className="font-mono font-semibold text-zinc-200">
            {schedule.time}
          </span>
          <span className="text-zinc-600">|</span>
          <span className="truncate"><Highlight text={schedule.league} query={query} /></span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400">{schedule.sport}</span>
          {result?.period && result.status === "live" && (
            <>
              <span className="text-zinc-600">|</span>
              <span className="text-rose-400 font-semibold">{result.period}</span>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <PlatformBadge platform={schedule.platform} />
          <StatusBadge
            status={schedule.koreanCommentary}
            finished={isGameFinished(schedule.date, schedule.time, schedule.sport)}
            resultStatus={result?.status}
          />
        </div>
      </div>

      {schedule.awayTeam ? (
        <div className="pointer-events-none relative z-10 mt-5 sm:mt-6 flex items-baseline justify-center gap-2 sm:gap-3 text-sm sm:text-base">
          <div className="flex-1 min-w-0 flex flex-col items-end gap-1">
            <span className={`flex w-full items-baseline justify-end gap-1.5 font-semibold ${winnerSide === "away" ? "text-zinc-500" : "text-zinc-100"}`}>
              {schedule.homeEmblem && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={proxyLogo(schedule.homeEmblem)} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-3.5 w-5 shrink-0 self-center rounded-[2px] object-cover" />
              )}
              <span className="min-w-0 truncate"><Highlight text={schedule.homeTeam} query={query} /></span>
            </span>
            {homeRecord?.last5 && (
              <LastFiveBadges form={homeRecord.last5} streak={homeRecord.streak} mirror />
            )}
          </div>
          {showScores ? (
            <div className="shrink-0 flex items-baseline gap-1.5 sm:gap-2 font-mono font-bold text-base sm:text-lg leading-none">
              <span className={winnerSide === "away" ? "text-zinc-500" : "text-zinc-100"}>{home}</span>
              <span className="text-zinc-600">-</span>
              <span className={winnerSide === "home" ? "text-zinc-500" : "text-zinc-100"}>{away}</span>
            </div>
          ) : (
            <span className="shrink-0 mt-1 text-[10px] sm:text-xs font-bold text-zinc-500">VS</span>
          )}
          <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
            <span className={`flex w-full items-baseline justify-start gap-1.5 font-semibold ${winnerSide === "home" ? "text-zinc-500" : "text-zinc-100"}`}>
              <span className="min-w-0 truncate"><Highlight text={schedule.awayTeam} query={query} /></span>
              {schedule.awayEmblem && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={proxyLogo(schedule.awayEmblem)} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-3.5 w-5 shrink-0 self-center rounded-[2px] object-cover" />
              )}
            </span>
            {awayRecord?.last5 && (
              <LastFiveBadges form={awayRecord.last5} streak={awayRecord.streak} />
            )}
          </div>
        </div>
      ) : (
        <div className="pointer-events-none relative z-10 mt-5 sm:mt-6 text-center text-sm sm:text-base font-semibold text-zinc-100 truncate">
          <Highlight text={schedule.homeTeam} query={query} />
        </div>
      )}

      {showPk && (
        <div className="pointer-events-none relative z-10 mt-1 text-center text-[10px] sm:text-[11px] font-semibold text-amber-300/90">
          승부차기 {result!.homePtScore}-{result!.awayPtScore}
        </div>
      )}

      {showGoals && <ScorerLines goals={result!.goals!} />}

      {showHighlight && (
        <div className="pointer-events-none relative z-10 mt-2.5 sm:mt-3 flex justify-center">
          <a
            href={`https://www.youtube.com/watch?v=${result!.highlightVideoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto relative z-20 inline-flex min-w-[11rem] items-center justify-center gap-2 rounded-md bg-white px-4 py-1.5 text-[11px] sm:text-xs font-bold text-zinc-900 transition-colors hover:bg-zinc-200"
            aria-label={`${schedule.homeTeam} vs ${schedule.awayTeam} 하이라이트 영상 보기`}
          >
            {/* 유튜브 로고 (붉은 라운드 사각 + 흰 삼각형) */}
            <svg viewBox="0 0 28 20" className="h-3.5 w-5 shrink-0" aria-hidden>
              <rect width="28" height="20" rx="4.5" fill="#FF0000" />
              <path d="M11.5 5.8v8.4L19 10l-7.5-4.2z" fill="#fff" />
            </svg>
            하이라이트
          </a>
        </div>
      )}
    </div>
  );
}

export const ScheduleCard = React.memo(ScheduleCardInner);
