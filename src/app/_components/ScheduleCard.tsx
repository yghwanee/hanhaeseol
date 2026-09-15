import React from "react";
import Link from "next/link";
import { Schedule } from "@/types/schedule";
import { TeamRecord } from "@/types/team-record";
import { GoalEvent, MatchResult } from "@/types/results";
import { isGameFinished } from "@/lib/schedule-utils";
import { matchToSlug } from "@/lib/match-slug";
import { isFlagEmblem, proxyLogo } from "@/lib/emblem";
import { StatusBadge } from "./StatusBadge";
import { PlatformBadge } from "./PlatformBadge";
import { FollowStar } from "./FollowStar";
import { Highlight } from "./Highlight";
import { LastFiveBadges } from "./LastFiveBadges";

/**
 * 앰블럼 한 칸의 클래스. 국기와 클럽 엠블럼은 **비율이 달라 같은 박스에 못 담는다.**
 *
 * - 국기(3:2): 20×14 를 `cover` 로 꽉 채운다. 여백이 없어 깔끔하고, 잘려도 티가 안 난다.
 * - 클럽 엠블럼(정사각): 18×18 을 `contain` 으로 담는다. 🔴 `cover` 로 두면 위아래가
 *   21% 잘려 둥근 로고가 뭉개진다(2026-09-03 사용자 지적). 자르지 않는 게 유일한 답이다.
 */
function emblemClass(url: string): string {
  const base = "shrink-0 self-center rounded-[2px]";
  return isFlagEmblem(url)
    ? `${base} h-3.5 w-5 object-cover`
    : `${base} h-[18px] w-[18px] object-contain`;
}

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
    <div className="pointer-events-none relative z-10 mt-2 grid grid-cols-2 gap-x-3 sm:gap-x-4 text-caption2 leading-snug text-fg-secondary">
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

/**
 * [플랫폼] [해설 종류] 묶음.
 *
 * 🔴 **자리가 화면 폭마다 다르다**(화니 지시, 2026-09-15).
 *   · PC(sm↑) = 카드 **상단 우측** — 시간·리그 줄 오른쪽에 여유가 있다.
 *   · 모바일 = 카드 **맨 아래 가운데** — 폰에서는 이 묶음이 상단 줄의 절반을 먹어 리그명이
 *     `K..` 로 잘리고(실측 캡처) 시간·종목까지 눌렸다. 아래로 내리면 한 줄을 통째로 쓴다.
 * 모바일 자리는 최근전적 **아래**, 하이라이트 **위**다 — 하이라이트는 누르는 것이라
 * 카드 맨 끝에 둔다.
 *
 * 🔴 **상태(LIVE·종료·취소·연기)는 여기 없다** — 폭과 무관하게 **상단 우측에 남는다**
 * (화니 지시, 2026-09-15). 지금 보고 있는 화면에서 "이 경기가 지금 열려 있는지"가
 * 가장 먼저 읽혀야 하는 정보라, 스코어 아래로 내리면 늦다.
 */
function MetaBadges({
  schedule,
  className,
}: {
  schedule: Schedule;
  className: string;
}) {
  return (
    <div className={className}>
      <PlatformBadge platform={schedule.platform} />
      {schedule.koreanCommentary === true ? (
        <span className="w-badge w-badge--ko">한국어</span>
      ) : schedule.koreanCommentary === false ? (
        <span className="w-badge w-badge--local">현지</span>
      ) : (
        <span className="w-badge w-badge--outline">확인 중</span>
      )}
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
  homeFollowed,
  awayFollowed,
  onToggleTeam,
}: {
  schedule: Schedule;
  query: string;
  homeRecord?: TeamRecord;
  awayRecord?: TeamRecord;
  result?: MatchResult;
  /** ⭐찜한 팀 여부. `onToggleTeam` 을 안 넘기면 별 자체를 안 그린다(서버 렌더 화면). */
  homeFollowed?: boolean;
  awayFollowed?: boolean;
  onToggleTeam?: (sport: Schedule["sport"], teamName: string) => void;
}) {
  // 종료·진행 중 모두 스코어를 표시한다. 진행 중 값은 종료 스코어와 같은 네이버 필드
  // (homeTeamScore/awayTeamScore)에서 오고, /api/live 와 원본을 대조해 일치를 확인했다
  // (2026-08-11). 종전에는 축구만 진행 중 표시였는데 그 게이트가 득점자 기능 커밋에
  // 딸려 들어간 것이라, 야구가 대부분인 이 사이트에서는 라이브 스코어가 사실상
  // 한 건도 안 보이고 있었다. 득점자(goals)는 축구에만 있으므로 그쪽만 축구 한정.
  const isSoccer = schedule.sport === "축구";
  const numeric = hasNumericScores(result);
  const showScores =
    numeric && (result.status === "finished" || result.status === "live");
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
    /* 🔴 `data-game-start` — 첫 방문 안내 모달이 「알림 받기」 뒤에 **가장 임박한 경기**로
       화면을 옮기는 데 쓴다(화니 결정, 2026-09-15). 별이 어디 있는지 말로 설명하는 것보다
       그 자리로 데려가는 게 확실하다. KST 오프셋을 박아 둔다 — 브라우저 타임존이 달라도
       같은 경기를 고른다. */
    <div
      data-game-start={`${schedule.date}T${schedule.time}:00+09:00`}
      className="w-card w-card-hover relative cursor-pointer p-3.5 sm:p-4"
    >
      <Link
        href={`/match/${matchToSlug(schedule)}`}
        className="absolute inset-0 z-0 rounded-[12px]"
        aria-label={`${schedule.homeTeam} ${schedule.awayTeam ? `vs ${schedule.awayTeam}` : ""} 경기 상세 보기`}
      />
      {/* items-center: 왼쪽 글자 줄(20px)과 오른쪽 뱃지 묶음(26px)의 세로 중심을 맞춘다.
          items-start 로 두면 글자가 위로 떠 보인다(2026-09-14 화니 지적). */}
      <div className="pointer-events-none relative z-10 flex items-center justify-between gap-2">
        {/* 🔴 좁은 폰에서 줄어드는 건 **리그명 하나뿐**이다(…처리). 시간·종목과 오른쪽
            묶음(플랫폼·해설·상태)은 shrink-0 이라 안 잘린다. 2026-09-14 화니 지시. */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2 text-caption1 sm:text-label2 text-fg-secondary">
          <span className="shrink-0 font-semibold tabular-nums text-fg-strong">
            {schedule.time}
          </span>
          <span className="shrink-0 text-fg-tertiary">·</span>
          <span className="min-w-0 truncate"><Highlight text={schedule.league} query={query} /></span>
          <span className="shrink-0 text-fg-tertiary">·</span>
          <span className="shrink-0 text-fg-secondary">{schedule.sport}</span>
          {result?.period && result.status === "live" && (
            <>
              <span className="text-fg-tertiary">·</span>
              <span className="font-semibold text-fg-danger">{result.period}</span>
            </>
          )}
        </div>
        {/* 상단 우측. 플랫폼·해설은 **PC 에서만**이고(모바일은 카드 맨 아래로 내렸다),
            상태(LIVE·종료·취소·연기)는 **폭과 무관하게 여기 남는다**(화니 지시). */}
        <div className="flex shrink-0 items-center gap-1.5">
          <MetaBadges
            schedule={schedule}
            className="hidden items-center gap-1.5 sm:flex"
          />
          <StatusBadge
            status={schedule.koreanCommentary}
            finished={isGameFinished(schedule.date, schedule.time, schedule.sport)}
            resultStatus={result?.status}
            stateOnly
          />
        </div>
      </div>

      {schedule.awayTeam ? (
        <div className="pointer-events-none relative z-10 mt-4 sm:mt-5 flex items-baseline justify-center gap-2 sm:gap-3 text-body2 sm:text-headline2">
          <div className="flex-1 min-w-0 flex flex-col items-end gap-2 sm:gap-2.5">
            <span className={`flex w-full items-baseline justify-end gap-1.5 font-semibold ${winnerSide === "away" ? "text-fg-tertiary" : "text-fg-strong"}`}>
              {onToggleTeam && (
                <FollowStar
                  followed={!!homeFollowed}
                  onToggle={() => onToggleTeam(schedule.sport, schedule.homeTeam)}
                  label={schedule.homeTeam}
                  className="self-center"
                />
              )}
              {schedule.homeEmblem && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={proxyLogo(schedule.homeEmblem)} alt="" referrerPolicy="no-referrer" loading="lazy" className={emblemClass(schedule.homeEmblem)} />
              )}
              <span className="min-w-0 truncate"><Highlight text={schedule.homeTeam} query={query} /></span>
            </span>
            {homeRecord?.last5 && (
              <LastFiveBadges form={homeRecord.last5} streak={homeRecord.streak} mirror />
            )}
          </div>
          {showScores ? (
            <div className="shrink-0 flex items-baseline gap-1.5 sm:gap-2 font-bold tabular-nums text-headline1 sm:text-heading2 leading-none">
              <span className={winnerSide === "away" ? "text-fg-tertiary" : "text-fg-strong"}>{home}</span>
              <span className="text-fg-tertiary">-</span>
              <span className={winnerSide === "home" ? "text-fg-tertiary" : "text-fg-strong"}>{away}</span>
            </div>
          ) : (
            <span className="shrink-0 mt-1 text-caption2 font-bold text-fg-tertiary">VS</span>
          )}
          <div className="flex-1 min-w-0 flex flex-col items-start gap-2 sm:gap-2.5">
            <span className={`flex w-full items-baseline justify-start gap-1.5 font-semibold ${winnerSide === "home" ? "text-fg-tertiary" : "text-fg-strong"}`}>
              <span className="min-w-0 truncate"><Highlight text={schedule.awayTeam} query={query} /></span>
              {schedule.awayEmblem && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={proxyLogo(schedule.awayEmblem)} alt="" referrerPolicy="no-referrer" loading="lazy" className={emblemClass(schedule.awayEmblem)} />
              )}
              {onToggleTeam && (
                <FollowStar
                  followed={!!awayFollowed}
                  onToggle={() => onToggleTeam(schedule.sport, schedule.awayTeam)}
                  label={schedule.awayTeam}
                  className="self-center"
                />
              )}
            </span>
            {awayRecord?.last5 && (
              <LastFiveBadges form={awayRecord.last5} streak={awayRecord.streak} />
            )}
          </div>
        </div>
      ) : (
        <div className="pointer-events-none relative z-10 mt-4 sm:mt-5 flex items-center justify-center gap-1.5 text-body2 sm:text-headline2 font-semibold text-fg-strong">
          {onToggleTeam && (
            <FollowStar
              followed={!!homeFollowed}
              onToggle={() => onToggleTeam(schedule.sport, schedule.homeTeam)}
              label={schedule.homeTeam}
            />
          )}
          <span className="min-w-0 truncate">
            <Highlight text={schedule.homeTeam} query={query} />
          </span>
        </div>
      )}

      {showPk && (
        <div className="pointer-events-none relative z-10 mt-1 text-center text-caption2 font-semibold text-fg-secondary">
          승부차기 {result!.homePtScore}-{result!.awayPtScore}
        </div>
      )}

      {showGoals && <ScorerLines goals={result!.goals!} />}

      {/* 🔴 모바일 전용 자리 — 최근전적 **아래**, 하이라이트 **위**(화니 지시, 2026-09-15).
          상단 줄에서 내려온 묶음이라 PC(sm↑)에서는 그리지 않는다: 양쪽에 다 그리면 같은
          정보가 카드에 두 번 나온다. 하이라이트가 맨 아래인 건 그게 **누르는 것**이라
          카드의 끝에 있어야 손이 가기 때문이다. */}
      <MetaBadges
        schedule={schedule}
        /* 간격은 `mt-6`(24px). 종전 12px 는 최근전적 뱃지 줄에 붙어 한 묶음처럼 보였다
           — 서로 다른 정보라 떼어 놔야 한다(화니 지시, 2026-09-15: "지금의 2배"). */
        className="pointer-events-none relative z-10 mt-6 flex items-center justify-center gap-1.5 sm:hidden"
      />

      {/* 하단 줄 = 하이라이트가 있을 때만(플랫폼·해설은 PC 에서 상단 우측, 모바일은 바로 위). */}
      {showHighlight && (
        <div className="pointer-events-none relative z-10 mt-3 flex justify-center border-t border-line-subtle pt-2.5">
          <a
            href={`https://www.youtube.com/watch?v=${result!.highlightVideoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-btn w-btn--sm w-btn--solid pointer-events-auto relative z-20 min-w-[11rem]"
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
