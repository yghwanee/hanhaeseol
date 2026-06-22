import Link from "next/link";
import { Schedule } from "@/types/schedule";
import { TeamRecordsMap } from "@/types/team-record";
import { MatchResult, ResultsData } from "@/types/results";
import { lookupTeamRecord } from "@/lib/team-records/lookup";
import { findResult } from "@/lib/results/lookup";
import { LEAGUE_SEO, PLATFORM_SEO, SeoMeta } from "@/lib/slugs";
import { isGameFinished, formatDateHeader } from "@/lib/schedule-utils";
import { CoupangTopBannerOnly } from "@/app/_components/CoupangBanners";
import { SiteHeader } from "@/app/_components/SiteHeader";
import { LastFiveBadges } from "@/app/_components/LastFiveBadges";

function StatusPill({ kc, finished, result }: { kc: boolean | "unknown"; finished: boolean; result?: MatchResult }) {
  if (result?.status === "live") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-400 ring-1 ring-rose-500/30"><span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />LIVE</span>;
  }
  if (result?.status === "canceled") {
    return <span className="inline-flex items-center rounded-full bg-zinc-500/20 px-2 py-0.5 text-[11px] font-semibold text-zinc-400 ring-1 ring-zinc-500/30">취소</span>;
  }
  if (result?.status === "postponed") {
    return <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-400 ring-1 ring-amber-500/30">연기</span>;
  }
  if (result?.status === "finished" || finished) {
    return <span className="inline-flex items-center rounded-full bg-zinc-500/20 px-2 py-0.5 text-[11px] font-semibold text-zinc-400 ring-1 ring-zinc-500/30">경기 종료</span>;
  }
  if (kc === true) {
    return <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">한국어해설</span>;
  }
  if (kc === false) {
    return <span className="inline-flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-400 ring-1 ring-rose-500/30">현지해설</span>;
  }
  return <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-[11px] font-semibold text-yellow-400 ring-1 ring-yellow-500/30">확인중</span>;
}

function hasScores(r?: MatchResult): r is MatchResult & { homeScore: number; awayScore: number } {
  if (!r) return false;
  if (typeof r.homeScore !== "number" || typeof r.awayScore !== "number") return false;
  // 네이버는 시작 전·진행 중 매치도 0-0 / 진행 중 스코어로 응답.
  // 진행 중 스코어는 크롤 타이밍에 따라 실제 현황과 어긋날 수 있어 종료된 경기만 표시.
  return r.status === "finished";
}

type Props = {
  meta: SeoMeta;
  kind: "league" | "platform";
  schedules: Schedule[];
  teamRecords?: TeamRecordsMap;
  results?: ResultsData | null;
  guideSlot?: React.ReactNode;
  highlightsSlot?: React.ReactNode;
  faqSlot?: React.ReactNode;
};

export default function FilteredScheduleView({ meta, kind, schedules, teamRecords = {}, results = null, guideSlot, highlightsSlot, faqSlot }: Props) {
  const filtered = schedules
    .filter((s) => meta.match.includes(kind === "league" ? s.league : s.platform))
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));

  const grouped = filtered.reduce<Record<string, Schedule[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort();

  const related = kind === "league" ? LEAGUE_SEO : PLATFORM_SEO;

  return (
    <main className="relative mx-auto min-h-screen max-w-2xl px-3 sm:px-4 pb-8 sm:pb-12">
      <SiteHeader />

      <div className="mt-4 sm:mt-6 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          {meta.display} {kind === "league" ? "중계 편성표" : "편성표"}
        </h1>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{meta.intro}</p>
      </div>

      {guideSlot}

      {highlightsSlot}

      <div className="mt-4 mb-3 sm:mb-4 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-center">
        <p className="text-[11px] sm:text-xs text-zinc-400">이 포스팅은 쿠팡 파트너스 활동의 일환으로,<br className="sm:hidden" /> 이에 따른 일정액의 수수료를 제공받습니다.</p>
      </div>

      <CoupangTopBannerOnly />

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base sm:text-lg font-semibold text-zinc-200">
            예정 경기 ({filtered.length}건)
          </h2>
        </div>

        {dates.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-center text-sm text-zinc-400">
            이번 주 예정된 경기가 없습니다.
            <br />
            <Link href="/" className="mt-2 inline-block text-zinc-300 underline underline-offset-2">
              전체 편성표 확인하기
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {dates.map((date) => (
              <div key={date}>
                <h3 className="mb-2 text-sm font-semibold text-zinc-300">{formatDateHeader(date)}</h3>
                <div className="space-y-2">
                  {grouped[date].map((s) => {
                    const homeRec = lookupTeamRecord(teamRecords, s.league, s.homeTeam);
                    const awayRec = lookupTeamRecord(teamRecords, s.league, s.awayTeam);
                    const result = findResult(results, s);
                    const showScores = hasScores(result);
                    const home = result?.homeScore;
                    const away = result?.awayScore;
                    const winnerSide: "home" | "away" | "draw" | null =
                      showScores && result?.status === "finished"
                        ? home! > away! ? "home" : away! > home! ? "away" : "draw"
                        : null;
                    return (
                    <article
                      key={s.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 sm:p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-zinc-400">
                          <span className="font-mono font-semibold text-zinc-200">{s.time}</span>
                          <span className="text-zinc-600">|</span>
                          <span className="truncate">{s.league}</span>
                          {result?.period && result.status === "live" && (
                            <>
                              <span className="text-zinc-600">|</span>
                              <span className="text-rose-400 font-semibold">{result.period}</span>
                            </>
                          )}
                        </div>
                        <StatusPill kc={s.koreanCommentary} finished={isGameFinished(s.date, s.time, s.sport)} result={result} />
                      </div>
                        {s.awayTeam ? (
                          <div className="mt-2.5 flex items-baseline justify-center gap-2 text-sm sm:text-base">
                            <div className="flex-1 min-w-0 flex flex-col items-end gap-1">
                              <span className={`w-full text-right font-semibold truncate ${winnerSide === "away" ? "text-zinc-500" : "text-zinc-100"}`}>{s.homeTeam}</span>
                              {homeRec?.last5 && (
                                <LastFiveBadges form={homeRec.last5} streak={homeRec.streak} mirror />
                              )}
                            </div>
                            {showScores ? (
                              <div className="shrink-0 flex items-baseline gap-1.5 font-mono font-bold text-base sm:text-lg leading-none">
                                <span className={winnerSide === "away" ? "text-zinc-500" : "text-zinc-100"}>{home}</span>
                                <span className="text-zinc-600">-</span>
                                <span className={winnerSide === "home" ? "text-zinc-500" : "text-zinc-100"}>{away}</span>
                              </div>
                            ) : (
                              <span className="shrink-0 mt-1 text-[10px] font-bold text-zinc-500">VS</span>
                            )}
                            <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
                              <span className={`w-full text-left font-semibold truncate ${winnerSide === "home" ? "text-zinc-500" : "text-zinc-100"}`}>{s.awayTeam}</span>
                              {awayRec?.last5 && (
                                <LastFiveBadges form={awayRec.last5} streak={awayRec.streak} />
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2.5 text-center text-sm sm:text-base font-semibold text-zinc-100 truncate">{s.homeTeam}</div>
                        )}
                        <div className="mt-2.5 flex items-center justify-between text-[11px] sm:text-xs">
                          <span className="text-zinc-400">{s.platform}</span>
                          <span className="text-zinc-500">{s.sport}</span>
                        </div>
                    </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {faqSlot}

      <section className="mb-8 space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-200">
            다른 {kind === "league" ? "리그" : "플랫폼"} 보기
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {related
              .filter((r) => r.slug !== meta.slug)
              .map((r) => (
                <Link
                  key={r.slug}
                  href={`/${kind}/${r.slug}`}
                  className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700/60 hover:text-white"
                >
                  {r.display}
                </Link>
              ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-200">
            {kind === "league" ? "플랫폼별" : "리그별"} 편성표 보기
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {(kind === "league" ? PLATFORM_SEO : LEAGUE_SEO).map((r) => (
              <Link
                key={r.slug}
                href={`/${kind === "league" ? "platform" : "league"}/${r.slug}`}
                className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700/60 hover:text-white"
              >
                {r.display}
              </Link>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}
