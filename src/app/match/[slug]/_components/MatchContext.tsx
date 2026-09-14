import Link from "next/link";
import type { MatchNarrative } from "@/lib/match-content/build";
import { formatDateHeader } from "@/lib/schedule-utils";

type Props = {
  narrative: MatchNarrative;
  homeTeam: string;
  awayTeam: string;
  league: string;
  platform: string;
  /** 인사이트(LLM 생성 미리보기)가 위에 이미 렌더링되었으면 자동 paragraph 단락은 숨김 — H2 "경기 미리보기" 중복 방지. */
  hasInsight?: boolean;
};

function Last5Pips({ last5 }: { last5?: string }) {
  if (!last5) return null;
  const chars = last5.slice(0, 5).split("");
  return (
    <div className="flex items-center gap-1">
      {chars.map((c, i) => {
        const cls =
          c === "W"
            ? "bg-brand-subtle text-fg-strong"
            : c === "L"
            ? "bg-[oklch(0.298_0.10_22_/_0.32)] text-fg-strong"
            : "bg-muted text-fg";
        return (
          <span
            key={i}
            className={`inline-flex h-4 w-4 items-center justify-center rounded-sm text-caption2 font-bold ${cls}`}
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
    <div className="flex-1 rounded-lg border border-line-subtle bg-surface p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="truncate text-label1 font-semibold text-fg-strong">{name}</span>
        {summary.rank ? (
          <span className="shrink-0 text-caption1 font-medium text-fg-brand-bright">
            {summary.rank}위
          </span>
        ) : null}
      </div>
      <dl className="space-y-1 text-caption1 text-fg-secondary">
        {summary.recordLine && (
          <div className="flex justify-between">
            <dt>시즌 성적</dt>
            <dd className="text-fg-strong">{summary.recordLine}</dd>
          </div>
        )}
        {typeof summary.winRate === "number" && (
          <div className="flex justify-between">
            <dt>승률</dt>
            <dd className="text-fg-strong">
              {(summary.winRate * 100).toFixed(1)}%
            </dd>
          </div>
        )}
        {typeof summary.goalDiff === "number" && (
          <div className="flex justify-between">
            <dt>득실차</dt>
            <dd className="text-fg-strong">
              {summary.goalDiff >= 0 ? "+" : ""}
              {summary.goalDiff}
            </dd>
          </div>
        )}
        {typeof summary.gameBehind === "number" && summary.gameBehind > 0 && (
          <div className="flex justify-between">
            <dt>승차</dt>
            <dd className="text-fg-strong">{summary.gameBehind}</dd>
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
                  ? "text-fg-brand-bright"
                  : summary.streak.type === "L"
                  ? "text-fg-danger"
                  : "text-fg"
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
  hasInsight,
}: Props) {
  const { paragraph, homeSummary, awaySummary, headToHead, leagueGuide, platformGuide } =
    narrative;

  // 인사이트(LLM)가 있으면 자동 paragraph는 숨김 — 같은 의도의 두 단락이 중복되어 노출되지 않도록.
  const showParagraph = !hasInsight && !!paragraph;

  const hasAnySection =
    showParagraph ||
    homeSummary ||
    awaySummary ||
    headToHead.length > 0 ||
    leagueGuide ||
    platformGuide;
  if (!hasAnySection) return null;

  return (
    <section className="mt-6 space-y-4">
      {showParagraph && (
        <div className="rounded-xl border border-line-subtle bg-subtle p-4 sm:p-5">
          <h2 className="mb-2 text-label1 font-semibold text-fg-strong sm:text-headline1">
            경기 미리보기
          </h2>
          <p className="text-label1 leading-relaxed text-fg">{paragraph}</p>
        </div>
      )}

      {/* 🔴 없는 값을 "준비 중입니다" 로 채우지 않는다. 종전에는 한쪽 팀 성적이 없으면
          `뉴캐슬 시즌 성적 데이터를 준비 중입니다.` 라는 빈 카드를 그렸는데(2026-08-13
          라이브 실측), 그건 검색 사용자에게 아무것도 알려주지 않으면서 페이지만 길게 만든다.
          있는 쪽만 그리고, 둘 다 없으면 섹션째 뺀다. */}
      {(homeSummary || awaySummary) && (
        <div className="rounded-xl border border-line-subtle bg-subtle p-4 sm:p-5">
          <h2 className="mb-3 text-label1 font-semibold text-fg-strong sm:text-headline1">
            양 팀 시즌 성적
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            {homeSummary && <TeamSummaryCard name={homeTeam} summary={homeSummary} />}
            {awaySummary && <TeamSummaryCard name={awayTeam} summary={awaySummary} />}
          </div>
        </div>
      )}

      {headToHead.length > 0 && (
        <div className="rounded-xl border border-line-subtle bg-subtle p-4 sm:p-5">
          <h2 className="mb-3 text-label1 font-semibold text-fg-strong sm:text-headline1">
            최근 맞대결
          </h2>
          <ul className="space-y-1.5 text-label1">
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
                  className="flex flex-wrap items-baseline gap-x-2 text-fg"
                >
                  <span className="text-caption1 text-fg-tertiary">
                    {formatDateHeader(h.date)}
                  </span>
                  <span>
                    {h.homeTeam}{" "}
                    <span className="tabular-nums font-semibold text-fg-strong">
                      {h.homeScore}-{h.awayScore}
                    </span>{" "}
                    {h.awayTeam}
                  </span>
                  {winner && (
                    <span className="text-caption1 text-fg-brand-bright">
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
        <div className="rounded-xl border border-line-subtle bg-subtle p-4 sm:p-5">
          <h2 className="mb-2 text-label1 font-semibold text-fg-strong sm:text-headline1">
            {league} 시즌 정보
          </h2>
          <dl className="space-y-1.5 text-label1 text-fg">
            {leagueGuide.season && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-fg-tertiary">시즌</dt>
                <dd>{leagueGuide.season}</dd>
              </div>
            )}
            {leagueGuide.gameTime && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-fg-tertiary">경기 시간</dt>
                <dd>{leagueGuide.gameTime}</dd>
              </div>
            )}
            {leagueGuide.koreanCommentary && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-fg-tertiary">한국어 해설</dt>
                <dd>{leagueGuide.koreanCommentary}</dd>
              </div>
            )}
            {leagueGuide.broadcasters && leagueGuide.broadcasters.length > 0 && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-fg-tertiary">국내 중계</dt>
                <dd>{leagueGuide.broadcasters.join(", ")}</dd>
              </div>
            )}
          </dl>
          {leagueGuide.highlights && leagueGuide.highlights.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-label1 text-fg">
              {leagueGuide.highlights.slice(0, 3).map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-caption1 text-fg-tertiary">
            <Link
              href={`/league/${leagueGuide.slug}`}
              className="-my-2 inline-block py-2 hover:text-fg-brand-bright underline-offset-2 hover:underline"
            >
              {league} 전체 편성표 보기 →
            </Link>
          </p>
        </div>
      )}

      {platformGuide && (
        <div className="rounded-xl border border-line-subtle bg-subtle p-4 sm:p-5">
          <h2 className="mb-2 text-label1 font-semibold text-fg-strong sm:text-headline1">
            {platform}에서 시청하기
          </h2>
          {platformGuide.price && (
            <p className="text-caption1 text-fg-tertiary">요금: {platformGuide.price}</p>
          )}
          {platformGuide.freeOption && (
            <p className="text-caption1 text-fg-brand-bright">
              {platformGuide.freeOption}
            </p>
          )}
          {platformGuide.howToWatch && (
            <p className="mt-2 text-label1 leading-relaxed text-fg">
              {platformGuide.howToWatch}
            </p>
          )}
          {platformGuide.features && platformGuide.features.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-label1 text-fg">
              {platformGuide.features.slice(0, 4).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-caption1 text-fg-tertiary">
            <Link
              href={`/platform/${platformGuide.slug}`}
              className="-my-2 inline-block py-2 hover:text-fg-brand-bright underline-offset-2 hover:underline"
            >
              {platform} 전체 편성표 보기 →
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
