import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { findSportBySlug, eligibleSports, leaguesOfSport } from "@/lib/sport-seo";
import { STANDINGS_LEAGUES } from "@/lib/standings-seo";
import { loadScheduleData, loadTeamRecords, loadResults } from "@/lib/server-data";
import { buildSportsEventLd, buildBreadcrumbLd } from "@/lib/structured-data";
import { getTodayString } from "@/lib/schedule-utils";
import { clampDescription } from "@/lib/seo-meta";
import FilteredScheduleView from "@/app/_components/FilteredScheduleView";
import { PlatformBreakdown, type PlatformCount } from "@/app/_components/PlatformBreakdown";
import type { Schedule } from "@/types/schedule";

// 데이터가 빌드 번들에 있어 재생성해도 같은 HTML 이다. 신선도는 배포가 만든다.
export const revalidate = 3600;

const BASE = "https://haeseol.com";

/**
 * 🔴 `dynamicParams` 를 끈다.
 *
 * 게이트를 통과하지 못한 종목(경기가 적은 비시즌 농구·배구)은 페이지가 아예 없어야
 * 한다. 켜 두면 `/sport/volleyball` 이 경기 0건짜리 빈 페이지로 렌더된다 — 팀
 * 페이지에서 개막 전 138팀을 걸러낸 것과 같은 이유다.
 */
export const dynamicParams = false;

function sportSchedules(): Schedule[] {
  return loadScheduleData().schedules;
}

export function generateStaticParams() {
  return eligibleSports(sportSchedules(), getTodayString()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const meta = findSportBySlug(params.slug);
  if (!meta) return {};

  const url = `${BASE}/sport/${meta.slug}`;
  const description = clampDescription(meta.description);
  return {
    title: meta.title,
    description,
    keywords: meta.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: meta.title,
      description,
      url,
      siteName: "한해설",
      locale: "ko_KR",
      type: "website",
      images: [
        {
          url: `${BASE}/og-default.png`,
          width: 1200,
          height: 630,
          alt: "한해설 - 스포츠 한국어해설 편성표",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description,
      images: [`${BASE}/og-default.png`],
    },
  };
}

/** 한 경기가 여러 채널에 걸리므로 경기 단위로 접어 센다(화면 카드 수와 일치). */
function gameKey(s: Schedule) {
  return `${s.date}|${s.homeTeam}|${s.awayTeam}`;
}

function leagueCounts(rows: Schedule[]): { league: string; count: number }[] {
  const seen = new Map<string, Set<string>>();
  for (const s of rows) {
    if (!seen.has(s.league)) seen.set(s.league, new Set());
    seen.get(s.league)!.add(gameKey(s));
  }
  return [...seen.entries()]
    .map(([league, keys]) => ({ league, count: keys.size }))
    .sort((a, b) => b.count - a.count);
}

/** 플랫폼별 경기 수. 한 경기가 여러 채널이면 각 채널에 한 번씩 센다. */
function platformCounts(rows: Schedule[]): PlatformCount[] {
  const seen = new Map<string, Set<string>>();
  for (const s of rows) {
    if (!seen.has(s.platform)) seen.set(s.platform, new Set());
    seen.get(s.platform)!.add(gameKey(s));
  }
  return [...seen.entries()]
    .map(([platform, keys]) => ({ platform, count: keys.size }))
    .sort((a, b) => b.count - a.count);
}

export default function SportPage({ params }: { params: { slug: string } }) {
  const meta = findSportBySlug(params.slug);
  if (!meta) notFound();

  const today = getTodayString();
  const all = sportSchedules();

  // 게이트를 통과하지 못한 종목은 페이지를 만들지 않는다. generateStaticParams 와
  // 같은 함수를 써야 사이트맵·링크와 신호가 어긋나지 않는다.
  if (!eligibleSports(all, today).some((s) => s.slug === meta.slug)) notFound();

  const rows = all.filter((s) => meta.match.includes(s.sport) && s.date >= today);

  // 🔴 클라이언트로 직렬화되는 것만 넘긴다.
  //
  // 처음엔 `schedules={all}` 로 전체를 넘기고 컴포넌트가 필터하게 뒀는데, RSC payload
  // 에는 **넘긴 배열 전체**가 실린다. 실측 1,078KB(리그 페이지 558KB의 2배)였다.
  // 컴포넌트는 다시 필터해도 결과가 같으므로(idempotent) 여기서 미리 잘라 보낸다.
  //
  // teamRecords·results 도 같은 이유로 이 종목 범위로 줄인다 — 홈이 쓰는 것과 같은 수법.
  const shownLeagues = new Set(rows.map((s) => s.league));
  const teamRecords = Object.fromEntries(
    Object.entries(loadTeamRecords()).filter(([league]) => shownLeagues.has(league)),
  );
  const allResults = loadResults();
  const results = allResults
    ? {
        lastUpdated: allResults.lastUpdated,
        byKey: Object.fromEntries(
          Object.entries(allResults.byKey).filter(([, r]) => r.date >= today),
        ),
        results: [],
      }
    : null;

  const pageUrl = `${BASE}/sport/${meta.slug}`;
  const sportsEventLd = buildSportsEventLd(rows, pageUrl);
  const breadcrumbLd = buildBreadcrumbLd([
    { name: "한해설", url: BASE },
    { name: `${meta.display} 중계 편성표`, url: pageUrl },
  ]);

  const byLeague = leagueCounts(rows);
  const byPlatform = platformCounts(rows);
  const leagueMetas = leaguesOfSport(meta);

  /** 리그명 → 우리 리그 페이지 슬러그. 매핑이 없으면 링크를 걸지 않는다. */
  const leagueSlugOf = (name: string) =>
    leagueMetas.find((l) => l.match.includes(name))?.slug;
  /** 리그명 → 순위표 슬러그. 순위표가 없는 컵대회는 링크를 걸지 않는다. */
  const standingsSlugOf = (name: string) => {
    const slug = leagueSlugOf(name);
    return slug && STANDINGS_LEAGUES.some((s) => s.slug === slug) ? slug : undefined;
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <FilteredScheduleView
        meta={meta}
        kind="sport"
        schedules={rows}
        teamRecords={teamRecords}
        results={results}
        highlightsSlot={
          <section className="mb-8 grid gap-3 sm:grid-cols-2">
            {byLeague.length > 0 && (
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
                <h2 className="text-sm font-semibold text-white">리그별 경기 수</h2>
                <ul className="mt-2 space-y-1.5">
                  {byLeague.slice(0, 6).map((b) => {
                    const s = standingsSlugOf(b.league);
                    const l = leagueSlugOf(b.league);
                    return (
                      <li key={b.league} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate text-zinc-300">
                          {l ? (
                            <Link href={`/league/${l}`} className="hover:text-white hover:underline">
                              {b.league}
                            </Link>
                          ) : (
                            b.league
                          )}
                        </span>
                        {s && (
                          <Link
                            href={`/standings/${s}`}
                            className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300 hover:underline"
                          >
                            순위표
                          </Link>
                        )}
                        <span className="w-10 shrink-0 text-right tabular-nums text-zinc-400">
                          {b.count}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <PlatformBreakdown
              items={byPlatform}
              title={`${meta.display} 중계 플랫폼별 경기 수`}
            />
          </section>
        }
      />
    </>
  );
}
