import Link from "next/link";
import type { MatchNarrative } from "@/lib/match-content/build";
import { formatDateHeader } from "@/lib/schedule-utils";

type Props = {
  narrative: MatchNarrative;
  homeTeam: string;
  awayTeam: string;
  league: string;
  platform: string;
};

function Last5Pips({ last5 }: { last5?: string }) {
  if (!last5) return null;
  const chars = last5.slice(0, 5).split("");
  return (
    <div className="flex items-center gap-1">
      {chars.map((c, i) => {
        const cls =
          c === "W"
            ? "bg-emerald-500/80 text-white"
            : c === "L"
            ? "bg-rose-500/80 text-white"
            : "bg-zinc-600/80 text-white";
        return (
          <span
            key={i}
            className={`inline-flex h-4 w-4 items-center justify-center rounded-sm text-[10px] font-bold ${cls}`}
          >
            {c === "D" || c === "T" ? "D" : c}
          </span>
        );
      })}
    </div>
  );
}

function TeamSummaryCard({
  name,
  summary,
}: {
  name: string;
  summary: NonNullable<MatchNarrative["homeSummary"]>;
}) {
  return (
    <div className="flex-1 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold text-zinc-100">{name}</span>
        {summary.rank ? (
          <span className="shrink-0 text-xs font-medium text-emerald-400">
            {summary.rank}위
          </span>
        ) : null}
      </div>
      <dl className="space-y-1 text-xs text-zinc-400">
        {summary.recordLine && (
          <div className="flex justify-between">
            <dt>시즌 성적</dt>
            <dd className="text-zinc-200">{summary.recordLine}</dd>
          </div>
        )}
        {typeof summary.winRate === "number" && (
          <div className="flex justify-between">
            <dt>승률</dt>
            <dd className="text-zinc-200">
              {(summary.winRate * 100).toFixed(1)}%
            </dd>
          </div>
        )}
        {typeof summary.goalDiff === "number" && (
          <div className="flex justify-between">
            <dt>득실차</dt>
            <dd className="text-zinc-200">
              {summary.goalDiff >= 0 ? "+" : ""}
              {summary.goalDiff}
            </dd>
          </div>
        )}
        {typeof summary.gameBehind === "number" && summary.gameBehind > 0 && (
          <div className="flex justify-between">
            <dt>승차</dt>
            <dd className="text-zinc-200">{summary.gameBehind}</dd>
          </div>
        )}
        {summary.last5 && (
          <div className="flex items-center justify-between">
            <dt>최근 5경기</dt>
            <dd>
              <Last5Pips last5={summary.last5} />
            </dd>
          </div>
        )}
        {summary.streak && summary.streak.count >= 2 && (
          <div className="flex justify-between">
            <dt>연속</dt>
            <dd
              className={
                summary.streak.type === "W"
                  ? "text-emerald-400"
                  : summary.streak.type === "L"
                  ? "text-rose-400"
                  : "text-zinc-300"
              }
            >
              {summary.streak.count}
              {summary.streak.type === "W"
                ? "연승"
                : summary.streak.type === "L"
                ? "연패"
                : "연속 무"}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export function MatchContextSection({
  narrative,
  homeTeam,
  awayTeam,
  league,
  platform,
}: Props) {
  const { paragraph, homeSummary, awaySummary, headToHead, leagueGuide, platformGuide } =
    narrative;

  const hasAnySection =
    paragraph ||
    homeSummary ||
    awaySummary ||
    headToHead.length > 0 ||
    leagueGuide ||
    platformGuide;
  if (!hasAnySection) return null;

  return (
    <section className="mt-6 space-y-4">
      {paragraph && (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
          <h2 className="mb-2 text-sm font-semibold text-white sm:text-base">
            경기 미리보기
          </h2>
          <p className="text-sm leading-relaxed text-zinc-300">{paragraph}</p>
        </div>
      )}

      {(homeSummary || awaySummary) && (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-white sm:text-base">
            양 팀 시즌 성적
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            {homeSummary ? (
              <TeamSummaryCard name={homeTeam} summary={homeSummary} />
            ) : (
              <div className="flex-1 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3 text-xs text-zinc-500">
                {homeTeam} 시즌 성적 데이터를 준비 중입니다.
              </div>
            )}
            {awaySummary ? (
              <TeamSummaryCard name={awayTeam} summary={awaySummary} />
            ) : (
              <div className="flex-1 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3 text-xs text-zinc-500">
                {awayTeam} 시즌 성적 데이터를 준비 중입니다.
              </div>
            )}
          </div>
        </div>
      )}

      {headToHead.length > 0 && (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-white sm:text-base">
            최근 맞대결
          </h2>
          <ul className="space-y-1.5 text-sm">
            {headToHead.map((h, i) => {
              const winner =
                h.homeScore > h.awayScore
                  ? h.homeTeam
                  : h.awayScore > h.homeScore
                  ? h.awayTeam
                  : null;
              return (
                <li
                  key={`${h.date}-${i}`}
                  className="flex flex-wrap items-baseline gap-x-2 text-zinc-300"
                >
                  <span className="text-xs text-zinc-500">
                    {formatDateHeader(h.date)}
                  </span>
                  <span>
                    {h.homeTeam}{" "}
                    <span className="font-mono font-semibold text-zinc-100">
                      {h.homeScore}-{h.awayScore}
                    </span>{" "}
                    {h.awayTeam}
                  </span>
                  {winner && (
                    <span className="text-xs text-emerald-400">
                      ({winner} 승)
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {leagueGuide && (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
          <h2 className="mb-2 text-sm font-semibold text-white sm:text-base">
            {league} 시즌 정보
          </h2>
          <dl className="space-y-1.5 text-sm text-zinc-300">
            {leagueGuide.season && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-zinc-500">시즌</dt>
                <dd>{leagueGuide.season}</dd>
              </div>
            )}
            {leagueGuide.gameTime && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-zinc-500">경기 시간</dt>
                <dd>{leagueGuide.gameTime}</dd>
              </div>
            )}
            {leagueGuide.koreanCommentary && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-zinc-500">한국어 해설</dt>
                <dd>{leagueGuide.koreanCommentary}</dd>
              </div>
            )}
            {leagueGuide.broadcasters && leagueGuide.broadcasters.length > 0 && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-zinc-500">국내 중계</dt>
                <dd>{leagueGuide.broadcasters.join(", ")}</dd>
              </div>
            )}
          </dl>
          {leagueGuide.highlights && leagueGuide.highlights.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-300">
              {leagueGuide.highlights.slice(0, 3).map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-zinc-500">
            <Link
              href={`/league/${leagueGuide.slug}`}
              className="hover:text-emerald-400 underline-offset-2 hover:underline"
            >
              {league} 전체 편성표 보기 →
            </Link>
          </p>
        </div>
      )}

      {platformGuide && (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
          <h2 className="mb-2 text-sm font-semibold text-white sm:text-base">
            {platform}에서 시청하기
          </h2>
          {platformGuide.price && (
            <p className="text-xs text-zinc-500">요금: {platformGuide.price}</p>
          )}
          {platformGuide.freeOption && (
            <p className="text-xs text-emerald-400">
              {platformGuide.freeOption}
            </p>
          )}
          {platformGuide.howToWatch && (
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {platformGuide.howToWatch}
            </p>
          )}
          {platformGuide.features && platformGuide.features.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-300">
              {platformGuide.features.slice(0, 4).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-zinc-500">
            <Link
              href={`/platform/${platformGuide.slug}`}
              className="hover:text-emerald-400 underline-offset-2 hover:underline"
            >
              {platform} 전체 편성표 보기 →
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
