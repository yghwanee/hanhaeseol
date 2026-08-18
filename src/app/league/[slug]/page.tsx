import { notFound } from "next/navigation";
import Link from "next/link";
import standingsJson from "@/data/standings.json";
import { buildTeamIndex, eligibleTeams, type StandingsData } from "@/lib/teams";
import type { Metadata } from "next";
import { LEAGUE_SEO, findLeagueBySlug } from "@/lib/slugs";
import { LEAGUE_GUIDES } from "@/lib/league-guides";
import { LEAGUE_FAQS } from "@/lib/league-faqs";
import { loadScheduleData, loadTeamRecords, loadResults } from "@/lib/server-data";
import { buildSportsEventLd, buildBreadcrumbLd } from "@/lib/structured-data";
import FilteredScheduleView from "@/app/_components/FilteredScheduleView";
import LeagueGuideSection from "@/app/_components/LeagueGuideSection";
import FaqSection from "@/app/_components/FaqSection";
import WeekHighlights from "@/app/_components/WeekHighlights";

// 데이터가 빌드 번들에 있어 재생성해도 같은 HTML 이다. 신선도는 배포가 만든다.
// (2026-08-18 Hobby 한도 초과로 600 → 3600. 상세는 page.tsx 주석)
export const revalidate = 3600;

export function generateStaticParams() {
  return LEAGUE_SEO.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const meta = findLeagueBySlug(params.slug);
  if (!meta) return {};

  const url = `https://haeseol.com/league/${meta.slug}`;
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: meta.title,
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
      title: meta.title,
      description: meta.description,
      images: ["https://haeseol.com/og-default.png"],
    },
  };
}

export default function LeaguePage({ params }: { params: { slug: string } }) {
  const meta = findLeagueBySlug(params.slug);
  if (!meta) notFound();

  const guide = LEAGUE_GUIDES[params.slug];
  const faqs = LEAGUE_FAQS[params.slug];
  const schedules = loadScheduleData().schedules;
  const teamRecords = loadTeamRecords();
  const results = loadResults();
  const teams = eligibleTeams(
    buildTeamIndex(standingsJson as unknown as StandingsData),
    schedules,
  )
    .filter((t) => t.leagueSlug === meta.slug)
    .sort((a, b) => a.rank - b.rank);

  const pageUrl = `https://haeseol.com/league/${meta.slug}`;
  const matched = schedules.filter((s) => meta.match.includes(s.league));
  const sportsEventLd = buildSportsEventLd(matched, pageUrl);
  const breadcrumbLd = buildBreadcrumbLd([
    { name: "한해설", url: "https://haeseol.com" },
    { name: `${meta.display} 편성표`, url: pageUrl },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbLd }}
      />
      {sportsEventLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: sportsEventLd }}
        />
      )}
      <FilteredScheduleView
        meta={meta}
        kind="league"
        schedules={schedules}
        teamRecords={teamRecords}
        results={results}
        guideSlot={
          guide ? <LeagueGuideSection guide={guide} display={meta.display} /> : undefined
        }
        highlightsSlot={
          <WeekHighlights
            title={`이번 주 ${meta.display} 빅매치`}
            schedules={schedules}
            league={meta.match}
            days={7}
            emptyText={`이번 주 예정된 ${meta.display} 경기가 없습니다.`}
          />
        }
        faqSlot={
          faqs ? (
            <FaqSection title={`${meta.display} 자주 묻는 질문`} faqs={faqs} />
          ) : undefined
        }
      />
      {/* 팀 페이지로 내려가는 링크. 매치 페이지 1,330개가 색인에서 통째로 빠진 원인이
          사이트맵에만 있고 링크로 도달할 수 없는 고아 상태였다. 같은 실수를 반복하지 않는다. */}
      {teams.length > 0 && (
        <section className="mx-auto w-full max-w-3xl px-4 pb-8 sm:px-6">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white sm:text-base">
              {meta.display} 팀별 중계 일정
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {teams.map((t) => (
                <Link
                  key={t.slug}
                  href={`/team/${encodeURIComponent(t.slug)}`}
                  className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 hover:text-white"
                >
                  {t.rank}. {t.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
