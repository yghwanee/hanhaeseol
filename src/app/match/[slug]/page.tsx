import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import scheduleData from "@/data/schedule.json";
import archiveData from "@/data/schedule-archive.json";
import resultsArchiveData from "@/data/results-archive.json";
import standingsData from "@/data/standings.json";
import type { Schedule, ScheduleData } from "@/types/schedule";
import type { ResultsData } from "@/types/results";
import type { StandingsData } from "@/types/standings";
import { LEAGUE_SEO } from "@/lib/slugs";
import { matchToSlug, findMatchBySlug } from "@/lib/match-slug";
import { findResult } from "@/lib/results/lookup";
import {
  formatDateHeader,
  GAME_DURATION_HOURS,
  isGameFinished,
} from "@/lib/schedule-utils";
import { StickyHeader } from "../../_components/StickyHeader";
import { readInsight } from "@/lib/insights/storage";
import { MatchInsightSection } from "./_components/MatchInsight";
import { TeamLogo } from "../../analysis/[id]/TeamLogo";
import { NAVER_TO_SCHEDULE_TEAM_NAME } from "@/lib/team-records/team-name-aliases";
import { getTeamLogo } from "@/data/team-logos";

const data = scheduleData as unknown as ScheduleData;
const archive = archiveData as unknown as ScheduleData;
const standings = standingsData as unknown as StandingsData;

/**
 * standings teamName → logo URL. 모듈 로드 시 1회 평탄화해서 O(1) 조회.
 * standings 표기는 네이버 원본(예: "맨체스터 시티").
 */
const STANDINGS_LOGOS: Map<string, string | null> = (() => {
  const m = new Map<string, string | null>();
  const all = [
    ...standings.soccer,
    ...standings.baseball,
    ...standings.basketball,
  ];
  for (const league of all) {
    for (const team of league.teams) {
      m.set(team.teamName, team.teamLogo ?? null);
    }
  }
  return m;
})();

/**
 * schedule 표기 → standings(네이버) 표기 reverse map.
 * 원본은 naver→schedule 매핑이라 여기서 뒤집어준다. 한 schedule 이름이
 * 여러 standings 이름과 매칭될 수 있는 충돌 케이스는 마지막 정의가 wins.
 */
const SCHEDULE_TO_STANDINGS_NAME: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const leagueAliases of Object.values(NAVER_TO_SCHEDULE_TEAM_NAME)) {
    for (const [naverName, scheduleNames] of Object.entries(leagueAliases)) {
      const names = Array.isArray(scheduleNames) ? scheduleNames : [scheduleNames];
      for (const sn of names) m.set(sn, naverName);
    }
  }
  return m;
})();

/**
 * schedule 표기로 팀 로고 찾기.
 * 1순위: team-logos.ts (schedule 표기 기준, 로컬/ESPN/SDB 등 안정적 소스).
 *   네이버 sports-phinf CDN은 외부 사이트 핫링크가 차단되는 경우가 있어 standings보다 우선.
 * 2순위: standings.json 직접 매칭 → alias 역매핑.
 */
function findTeamLogo(teamName: string): string | null {
  const mapped = getTeamLogo(teamName);
  if (mapped) return mapped;
  if (STANDINGS_LOGOS.has(teamName)) return STANDINGS_LOGOS.get(teamName) ?? null;
  const standingsName = SCHEDULE_TO_STANDINGS_NAME.get(teamName);
  if (standingsName && STANDINGS_LOGOS.has(standingsName)) {
    return STANDINGS_LOGOS.get(standingsName) ?? null;
  }
  return null;
}
const resultsArchive = resultsArchiveData as unknown as ResultsData;

/**
 * 매치 슬러그 조회: 현재 schedule(7일치) → archive(영구 누적) 순으로 찾는다.
 * archive에는 schedule.json에 한 번이라도 들어온 모든 경기가 누적되므로,
 * 7일이 지나 schedule.json에서 빠진 과거 경기도 archive에서 부활시켜 404를 막는다.
 */
function findMatchAnywhere(slug: string): Schedule | undefined {
  return findMatchBySlug(data.schedules, slug) ?? findMatchBySlug(archive.schedules, slug);
}

// 관련 경기 검색용 통합 목록 (schedule + archive, id 기준 dedupe).
// archive에 이미 schedule이 포함되어 있지만 초기 배포 시점에 archive가 비어 있을 수 있어 둘 다 merge.
const allSchedules: Schedule[] = (() => {
  const byId = new Map<string, Schedule>();
  for (const s of archive.schedules) byId.set(s.id, s);
  for (const s of data.schedules) byId.set(s.id, s); // schedule이 최신
  return [...byId.values()];
})();

type Params = { slug: string };

/**
 * 빌드 시점에 schedule.json(7일치)만 정적 생성. archive(영구 누적)는 런타임 SSR로 처리.
 * archive가 수천 건으로 커지면 빌드 폭발하므로, 정적 생성은 트래픽이 몰리는 현재 7일치에만.
 */
export function generateStaticParams(): Params[] {
  return data.schedules.map((s) => ({ slug: matchToSlug(s) }));
}

// dynamicParams=true: archive에 있는 과거 경기는 런타임에 SSR로 렌더링.
export const dynamicParams = true;

function matchKoreanLabel(s: Schedule): string {
  if (s.koreanCommentary === true) return "한국어 해설";
  if (s.koreanCommentary === false) return "현지 해설";
  return "해설 정보 미확인";
}

function leagueSlugFor(leagueName: string): string | undefined {
  return LEAGUE_SEO.find((l) => l.match.includes(leagueName))?.slug;
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const match = findMatchAnywhere(params.slug);
  if (!match) return { title: "경기 정보 - 한해설" };

  const insight =
    process.env.NEXT_PUBLIC_INSIGHTS_ENABLED === "true"
      ? readInsight(match.id)
      : null;

  const date = formatDateHeader(match.date);
  const ko = matchKoreanLabel(match);

  // 인사이트가 있으면 headline을 제목에 노출(SEO 강화).
  // 없으면 기존 패턴 유지.
  const title = insight
    ? `${insight.sections.headline} | ${match.homeTeam} vs ${match.awayTeam} 한해설`
    : `${match.homeTeam} vs ${match.awayTeam} ${ko} 중계 - ${match.platform} ${date} | 한해설`;

  const description = insight
    ? `${insight.sections.headline} · ${date} ${match.time} ${match.league} ${match.homeTeam} vs ${match.awayTeam} 경기. ${match.platform}에서 ${ko}로 시청 가능.`
    : `${date} ${match.time} ${match.league} ${match.homeTeam} vs ${match.awayTeam} 경기 중계. ${match.platform}에서 ${ko}${match.koreanCommentary === true ? "로" : "으로"} 시청 가능합니다.`;

  const url = `https://haeseol.com/match/${params.slug}`;

  return {
    title,
    description,
    keywords: [
      `${match.homeTeam} ${match.awayTeam} 중계`,
      `${match.homeTeam} vs ${match.awayTeam}`,
      `${match.homeTeam} 중계`,
      `${match.awayTeam} 중계`,
      `${match.league} 중계`,
      `${match.league} 한국어 중계`,
      `${match.platform} 편성표`,
      `${match.homeTeam} 한국어 해설`,
    ],
    alternates: { canonical: url },
    openGraph: {
      title: insight
        ? `${insight.sections.headline} - 한해설`
        : `${match.homeTeam} vs ${match.awayTeam} - ${match.platform} 중계`,
      description,
      url,
      siteName: "한해설",
      locale: "ko_KR",
      type: "website",
      images: [
        {
          url: "https://haeseol.com/og-default.png",
          width: 1200,
          height: 630,
          alt: `${match.homeTeam} vs ${match.awayTeam} - 한해설`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: insight
        ? `${insight.sections.headline}`
        : `${match.homeTeam} vs ${match.awayTeam} - ${ko}`,
      description,
      images: ["https://haeseol.com/og-default.png"],
    },
  };
}

export default function MatchPage({ params }: { params: Params }) {
  const match = findMatchAnywhere(params.slug);
  if (!match) notFound();

  const date = formatDateHeader(match.date);
  const finished = isGameFinished(match.date, match.time, match.sport);
  // 종료된 경기는 결과 archive에서 스코어를 찾아 표시한다. 영구 페이지로 색인 가치를 부여.
  const result = finished ? findResult(resultsArchive, match) : undefined;
  const hasScore =
    !!result && typeof result.homeScore === "number" && typeof result.awayScore === "number";

  const insight =
    process.env.NEXT_PUBLIC_INSIGHTS_ENABLED === "true"
      ? readInsight(match.id)
      : null;

  const ko = matchKoreanLabel(match);
  const leagueSlug = leagueSlugFor(match.league);

  // 동일 리그 / 동일 플랫폼의 직후 매치들. 같은 매치업이 여러 플랫폼에서 중계되면
  // 슬러그가 달라서 슬러그 비교만으론 자기 경기/중복 경기를 못 거른다. 매치업 키
  // (date|home|away) 단위로 dedupe + 자기 자신 제외.
  const selfMatchupKey = `${match.date}|${match.homeTeam}|${match.awayTeam}`;
  const dedupByMatchup = (list: Schedule[]): Schedule[] => {
    const seen = new Set<string>([selfMatchupKey]);
    return list.filter((s) => {
      const k = `${s.date}|${s.homeTeam}|${s.awayTeam}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const relatedByLeague = dedupByMatchup(
    allSchedules.filter((s) => s.league === match.league && s.date >= match.date),
  ).slice(0, 6);
  const relatedByPlatform = dedupByMatchup(
    allSchedules.filter((s) => s.platform === match.platform && s.date >= match.date),
  ).slice(0, 6);

  // SportsEvent JSON-LD
  const [hh, mm] = match.time.split(":");
  const start = new Date(`${match.date}T${hh}:${mm}:00+09:00`);
  const durationMs = (GAME_DURATION_HOURS[match.sport] ?? 3) * 60 * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);
  const inLang = match.koreanCommentary === true ? "ko" : "en";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SportsEvent",
        name: `${match.league} ${match.homeTeam} vs ${match.awayTeam}`,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        eventStatus: finished
          ? "https://schema.org/EventCompleted"
          : "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
        location: {
          "@type": "VirtualLocation",
          url: `https://haeseol.com/match/${params.slug}`,
        },
        description: `${match.league} ${match.homeTeam} vs ${match.awayTeam} ${match.platform} 중계 (${ko})`,
        sport: match.sport,
        inLanguage: inLang,
        competitor: [
          { "@type": "SportsTeam", name: match.homeTeam },
          { "@type": "SportsTeam", name: match.awayTeam },
        ],
        performer: [
          { "@type": "SportsTeam", name: match.homeTeam },
          { "@type": "SportsTeam", name: match.awayTeam },
        ],
        organizer: { "@type": "Organization", name: match.league },
        offers: {
          "@type": "Offer",
          url: "https://haeseol.com",
          availability: "https://schema.org/InStock",
          price: "0",
          priceCurrency: "KRW",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "한해설", item: "https://haeseol.com" },
          ...(leagueSlug
            ? [
                {
                  "@type": "ListItem",
                  position: 2,
                  name: `${match.league} 편성표`,
                  item: `https://haeseol.com/league/${leagueSlug}`,
                },
              ]
            : []),
          {
            "@type": "ListItem",
            position: leagueSlug ? 3 : 2,
            name: `${match.homeTeam} vs ${match.awayTeam}`,
            item: `https://haeseol.com/match/${params.slug}`,
          },
        ],
      },
      ...(insight
        ? [
            {
              // SportsArticle: 일반 Article보다 sports vertical에 더 정확. Google이 카테고리 인식 ↑
              "@type": "SportsArticle",
              headline: insight.sections.headline,
              description: insight.sections.recentForm.slice(0, 160),
              image: "https://haeseol.com/og-default.png",
              datePublished: insight.generatedAt,
              dateModified: insight.generatedAt,
              inLanguage: "ko",
              articleBody: [
                insight.sections.recentForm,
                insight.sections.keyMatchup,
                ...insight.sections.watchPoints,
              ].join(" "),
              author: { "@type": "Organization", name: "한해설" },
              publisher: {
                "@type": "Organization",
                name: "한해설",
                logo: {
                  "@type": "ImageObject",
                  url: "https://haeseol.com/icon.png",
                },
              },
              mainEntityOfPage: {
                "@type": "WebPage",
                "@id": `https://haeseol.com/match/${params.slug}`,
              },
              about: {
                "@type": "SportsEvent",
                name: `${match.league} ${match.homeTeam} vs ${match.awayTeam}`,
              },
            },
          ]
        : []),
    ],
  };

  return (
    <main className="min-h-screen text-gray-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-2xl px-3 pb-8 text-[14px] sm:px-4 sm:pb-12">
        <StickyHeader>
          <header className="flex items-center justify-between">
            <Link href="/" className="flex items-end">
              <Image
                src="/icon.png"
                alt="한해설 아이콘"
                width={32}
                height={32}
                className="h-6 w-6 self-center sm:h-8 sm:w-8"
              />
              <span className="ml-1 text-xl font-bold text-white sm:ml-2 sm:text-3xl">한해설</span>
              <span className="ml-2 text-sm font-normal text-zinc-500 sm:ml-3 sm:text-lg">
                한국어중계 편성표
              </span>
            </Link>
            <Link
              href="/"
              className="btn-caps-stripe inline-flex items-center justify-center whitespace-nowrap px-4 py-1.5 text-[11px] font-medium sm:px-5 sm:py-2 sm:text-xs"
            >
              ← &ensp;편성표
            </Link>
          </header>
        </StickyHeader>

        <nav className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500 sm:mt-6">
          <Link href="/" className="transition-colors hover:text-zinc-300">
            편성표
          </Link>
          {leagueSlug && (
            <>
              <span>›</span>
              <Link
                href={`/league/${leagueSlug}`}
                className="transition-colors hover:text-zinc-300"
              >
                {match.league}
              </Link>
            </>
          )}
          <span>›</span>
          <span className="text-zinc-400">
            {match.homeTeam} vs {match.awayTeam}
          </span>
        </nav>

        <article className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-5 text-center sm:p-6">
          <p className="text-xs text-zinc-500 sm:text-sm">
            {date} · {match.time} (KST) · {match.league}
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight text-white sm:text-3xl">
            {match.homeTeam}{" "}
            <span className="text-zinc-500">vs</span> {match.awayTeam}
          </h1>

          {/* 팀 엠블럼 좌우 배치 — standings.json에 로고 있으면 이미지, 없으면 initials 자동 fallback */}
          <div className="mt-4 flex items-center justify-center gap-5 sm:gap-7">
            <TeamLogo
              name={match.homeTeam}
              src={findTeamLogo(match.homeTeam)}
              size={56}
            />
            <span className="text-sm font-bold text-zinc-500 sm:text-base">vs</span>
            <TeamLogo
              name={match.awayTeam}
              src={findTeamLogo(match.awayTeam)}
              size={56}
            />
          </div>

          {hasScore && (
            <div className="mt-4 rounded-lg border border-emerald-700/40 bg-emerald-900/15 px-4 py-3">
              <p className="mb-2 text-[11px] font-medium text-emerald-300/80 sm:text-xs">
                최종 결과
              </p>
              <div className="flex items-center justify-center gap-4 sm:gap-6">
                <div className="flex-1 text-right">
                  <p className="truncate text-xs text-zinc-300 sm:text-sm">
                    {match.homeTeam}
                  </p>
                  <p
                    className={`tabular-nums text-3xl font-bold sm:text-4xl ${
                      result!.homeScore! > result!.awayScore!
                        ? "text-white"
                        : result!.homeScore! < result!.awayScore!
                        ? "text-zinc-500"
                        : "text-zinc-200"
                    }`}
                  >
                    {result!.homeScore}
                  </p>
                </div>
                <div className="text-2xl text-zinc-600 sm:text-3xl">:</div>
                <div className="flex-1 text-left">
                  <p className="truncate text-xs text-zinc-300 sm:text-sm">
                    {match.awayTeam}
                  </p>
                  <p
                    className={`tabular-nums text-3xl font-bold sm:text-4xl ${
                      result!.awayScore! > result!.homeScore!
                        ? "text-white"
                        : result!.awayScore! < result!.homeScore!
                        ? "text-zinc-500"
                        : "text-zinc-200"
                    }`}
                  >
                    {result!.awayScore}
                  </p>
                </div>
              </div>
              {result!.period && (
                <p className="mt-2 text-center text-[11px] text-zinc-500 sm:text-xs">
                  {result!.period}
                </p>
              )}
            </div>
          )}

          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            <strong>{match.league}</strong>{" "}
            <strong>{match.homeTeam}</strong> vs <strong>{match.awayTeam}</strong>{" "}
            경기는 <strong>{match.platform}</strong>에서 중계됩니다.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            {match.koreanCommentary === true ? (
              <>
                해당 중계는{" "}
                <span className="font-semibold text-emerald-400">한국어 해설</span>로
                제공됩니다.
              </>
            ) : match.koreanCommentary === false ? (
              <>
                해당 중계는{" "}
                <span className="font-semibold text-rose-400">현지(영어) 해설</span>로
                제공되며 한국어 해설은 제공되지 않습니다.
              </>
            ) : (
              <>
                한국어 해설 여부는{" "}
                <span className="font-semibold text-yellow-400">아직 확인되지 않았습니다</span>.
                중계 직전 각 플랫폼의 공식 편성표를 한 번 더 확인해주세요.
              </>
            )}
          </p>

        </article>

        {insight && <MatchInsightSection insight={insight} />}

        {/* 같은 리그 다른 경기 — 내부 링크 + 사용자 탐색 동선 */}
        {relatedByLeague.length > 0 && (
          <section className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white sm:text-base">
              {match.league} 다음 경기
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {relatedByLeague.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/match/${matchToSlug(s)}`}
                    className="text-zinc-300 transition-colors hover:text-white hover:underline underline-offset-2"
                  >
                    {formatDateHeader(s.date)} {s.time} · {s.homeTeam} vs{" "}
                    {s.awayTeam}{" "}
                    <span className="text-xs text-zinc-500">({s.platform})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 같은 플랫폼 다른 경기 */}
        {relatedByPlatform.length > 0 && (
          <section className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white sm:text-base">
              {match.platform} 다른 중계
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {relatedByPlatform.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/match/${matchToSlug(s)}`}
                    className="text-zinc-300 transition-colors hover:text-white hover:underline underline-offset-2"
                  >
                    {formatDateHeader(s.date)} {s.time} · {s.league} {s.homeTeam}{" "}
                    vs {s.awayTeam}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white sm:text-base">
            {match.homeTeam} vs {match.awayTeam} 경기를 어디서 시청하나요?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {match.platform} 공식 앱·웹사이트에서 {date} {match.time}부터 시청
            가능합니다. 한해설은 편성 정보를 모아서 안내하는 서비스이며,
            실제 중계는 각 플랫폼에서 시청해야 합니다.{" "}
            {leagueSlug && (
              <>
                {match.league}의 더 많은 한국어 해설 일정은{" "}
                <Link
                  href={`/league/${leagueSlug}`}
                  className="text-emerald-400 hover:underline underline-offset-2"
                >
                  {match.league} 편성표
                </Link>
                에서 확인하세요.
              </>
            )}
          </p>
        </section>
      </div>
    </main>
  );
}

