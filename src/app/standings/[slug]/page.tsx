import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import standingsData from "@/data/standings.json";
import scheduleArchive from "@/data/schedule-archive.json";
import type {
  BaseballLeagueStandings,
  SoccerLeagueStandings,
  StandingsData,
} from "@/types/standings";
import { SoccerTable } from "../_components/SoccerTable";
import { MlsStandingsTable } from "../_components/MlsStandingsTable";
import { BaseballTable } from "../_components/BaseballTable";
import { MlbStandingsTable } from "../_components/MlbStandingsTable";
import { SiteHeader } from "../../_components/SiteHeader";
import { CoupangTopBannerOnly } from "../../_components/CoupangBanners";
import {
  STANDINGS_LEAGUES,
  findStandingsBySlug,
} from "@/lib/standings-seo";
import { findLeagueBySlug } from "@/lib/slugs";
import { loadScheduleData } from "@/lib/server-data";
import type { Schedule } from "@/types/schedule";
import UpcomingScheduleForLeague from "../_components/UpcomingScheduleForLeague";
import { buildTeamLinkMap } from "@/lib/team-links";
import type { StandingsData as TeamStandingsData } from "@/lib/teams";

const data = standingsData as unknown as StandingsData;
// 팀 링크 게이트는 홈·사이트맵과 같은 범위(현재 편성 + 아카이브)를 봐야 한다.
// 현재 7일치만 보면 이번 주 경기가 없는 팀이 링크에서 빠진다.
const archiveSchedules = (scheduleArchive as unknown as { schedules: Schedule[] }).schedules;

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return STANDINGS_LEAGUES.map((l) => ({ slug: l.slug }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const meta = findStandingsBySlug(params.slug);
  if (!meta) {
    return { title: "순위 - 한해설" };
  }
  const url = `https://haeseol.com/standings/${meta.slug}`;
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: `${meta.display} 순위 - 한해설`,
      description: meta.description,
      url,
      siteName: "한해설",
      locale: "ko_KR",
      type: "website",
      images: [
        {
          url: "https://haeseol.com/og-default.png",
          width: 1200,
          height: 630,
          alt: "한해설 - 스포츠 한국어해설 편성표",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${meta.display} 순위 - 한해설`,
      description: meta.description,
      images: ["https://haeseol.com/og-default.png"],
    },
  };
}

export default function StandingsBySlugPage({ params }: { params: Params }) {
  const meta = findStandingsBySlug(params.slug);
  if (!meta) notFound();

  const league =
    meta.sport === "soccer"
      ? (data.soccer.find((l) => l.id === meta.dataId) as
          | SoccerLeagueStandings
          | undefined)
      : (data.baseball.find((l) => l.id === meta.dataId) as
          | BaseballLeagueStandings
          | undefined);

  const teamCount = league?.teams.length ?? 0;
  const scheduleHref = meta.scheduleSlug
    ? `/league/${meta.scheduleSlug}`
    : `/?sport=${meta.sport === "baseball" ? "야구" : "축구"}`;

  // 해당 리그의 schedule 매칭 키 (LEAGUE_SEO.match) — 일정 섹션 노출 여부 결정.
  const leagueSeo = meta.scheduleSlug ? findLeagueBySlug(meta.scheduleSlug) : undefined;
  const schedules = leagueSeo ? loadScheduleData().schedules : [];

  // 순위표 팀명 → 팀 페이지 링크. `/standings/kbo` 는 네이버 노출 108.9만인데 팀 페이지로
  // 나가는 링크가 0개였다(팀 페이지 86개는 색인 대기 중). 순위표는 팀명이 그대로 나열되는
  // 자리라 링크를 붙일 가장 자연스러운 위치다. 팀 페이지가 있는 팀만 링크된다.
  // 팀 링크 판정은 전체 편성(아카이브 포함)으로 해야 홈·사이트맵의 게이트와 일치한다.
  const allSchedulesForLinks = [...loadScheduleData().schedules, ...archiveSchedules];
  const teamLinks =
    league && buildTeamLinkMap(data as unknown as TeamStandingsData, allSchedulesForLinks)[league.id];

  // JSON-LD: BreadcrumbList + SportsEvent collection (ItemList of teams)
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "한해설",
            item: "https://haeseol.com",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "팀 순위",
            item: "https://haeseol.com/standings",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `${meta.display} 순위`,
            item: `https://haeseol.com/standings/${meta.slug}`,
          },
        ],
      },
      league && league.teams.length > 0
        ? {
            "@type": "ItemList",
            name: `${meta.display} ${meta.seasonLabel} 순위`,
            numberOfItems: teamCount,
            itemListOrder: "https://schema.org/ItemListOrderAscending",
            itemListElement: league.teams.slice(0, 20).map((t) => ({
              "@type": "ListItem",
              position: t.rank,
              item: {
                "@type": "SportsTeam",
                name: t.teamName,
                ...(t.teamLogo ? { logo: t.teamLogo } : {}),
              },
            })),
          }
        : null,
    ].filter(Boolean),
  };

  return (
    <main className="min-h-screen text-gray-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-2xl px-3 pb-8 text-[14px] sm:px-4 sm:pb-12">
        <SiteHeader />

        <nav className="mt-4 flex items-center gap-2 text-xs text-zinc-500 sm:mt-6">
          <Link href="/standings" className="transition-colors hover:text-zinc-300">
            팀 순위
          </Link>
          <span>›</span>
          <span className="text-zinc-400">{meta.short}</span>
        </nav>

        <div className="mt-4 mb-3 sm:mb-4 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-center">
          <p className="text-[11px] sm:text-xs text-zinc-400">이 포스팅은 쿠팡 파트너스 활동의 일환으로,<br className="sm:hidden" /> 이에 따른 일정액의 수수료를 제공받습니다.</p>
        </div>

        <CoupangTopBannerOnly />

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              {meta.display} 순위
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {meta.seasonLabel} 시즌 · {teamCount}개 팀
            </p>
          </div>
          <Link
            href={scheduleHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm font-semibold text-emerald-400 transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/10"
          >
            {meta.short} 한국어 해설 편성표 →
          </Link>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{meta.intro}</p>

        <div className="mt-5">
          {!league || league.teams.length === 0 ? (
            <p className="text-zinc-400">순위 데이터를 불러오지 못했습니다.</p>
          ) : meta.sport === "soccer" ? (
            meta.dataId === "mls" ? (
              <MlsStandingsTable teams={(league as SoccerLeagueStandings).teams} teamLinks={teamLinks} />
            ) : (
              <SoccerTable teams={(league as SoccerLeagueStandings).teams} teamLinks={teamLinks} />
            )
          ) : meta.dataId === "mlb" ? (
            <MlbStandingsTable teams={(league as BaseballLeagueStandings).teams} teamLinks={teamLinks} />
          ) : (
            <BaseballTable teams={(league as BaseballLeagueStandings).teams} teamLinks={teamLinks} />
          )}
        </div>

        <p className="mt-4 text-xs text-zinc-400">
          데이터 출처: 네이버 스포츠 · 갱신:{" "}
          {new Date(data.lastUpdated).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (KST)
        </p>

        {leagueSeo && meta.scheduleSlug && (
          <UpcomingScheduleForLeague
            schedules={schedules}
            display={meta.display}
            matchKeys={leagueSeo.match}
            scheduleSlug={meta.scheduleSlug}
            days={7}
          />
        )}

        {/* 다른 리그 순위로 이동 — 내부 링크 강화 */}
        <section className="mt-8 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
          <h2 className="text-sm font-semibold text-zinc-300">다른 리그 순위</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STANDINGS_LEAGUES.filter((l) => l.slug !== meta.slug).map((l) => (
              <Link
                key={l.slug}
                href={`/standings/${l.slug}`}
                className="rounded-md border border-zinc-700/60 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
              >
                {l.short} 순위
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
