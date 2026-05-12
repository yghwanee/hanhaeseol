import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import standingsData from "@/data/standings.json";
import type {
  BaseballLeagueStandings,
  SoccerLeagueStandings,
  StandingsData,
} from "@/types/standings";
import { SoccerTable } from "../_components/SoccerTable";
import { BaseballTable } from "../_components/BaseballTable";
import { MlbStandingsTable } from "../_components/MlbStandingsTable";
import { StickyHeader } from "../../_components/StickyHeader";
import {
  STANDINGS_LEAGUES,
  findStandingsBySlug,
} from "@/lib/standings-seo";

const data = standingsData as unknown as StandingsData;

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
              className="whitespace-nowrap rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white sm:px-4 sm:py-1.5 sm:text-sm"
            >
              ← &ensp;편성표
            </Link>
          </header>
        </StickyHeader>

        <nav className="mt-4 flex items-center gap-2 text-xs text-zinc-500 sm:mt-6">
          <Link href="/standings" className="transition-colors hover:text-zinc-300">
            팀 순위
          </Link>
          <span>›</span>
          <span className="text-zinc-400">{meta.short}</span>
        </nav>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
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
            <SoccerTable teams={(league as SoccerLeagueStandings).teams} />
          ) : meta.dataId === "mlb" ? (
            <MlbStandingsTable teams={(league as BaseballLeagueStandings).teams} />
          ) : (
            <BaseballTable teams={(league as BaseballLeagueStandings).teams} />
          )}
        </div>

        <p className="mt-4 text-xs text-zinc-600">
          데이터 출처: 네이버 스포츠 · 갱신:{" "}
          {new Date(data.lastUpdated).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (KST)
        </p>

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
