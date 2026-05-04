import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LEAGUE_SEO, findLeagueBySlug } from "@/lib/slugs";
import { LEAGUE_GUIDES } from "@/lib/league-guides";
import { LEAGUE_FAQS } from "@/lib/league-faqs";
import { loadScheduleData, loadTeamRecords } from "@/lib/server-data";
import FilteredScheduleView from "@/app/_components/FilteredScheduleView";
import LeagueGuideSection from "@/app/_components/LeagueGuideSection";
import FaqSection from "@/app/_components/FaqSection";
import WeekHighlights from "@/app/_components/WeekHighlights";

export const revalidate = 600;

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
      images: [{ url: "https://haeseol.com/logo.png", alt: "한해설" }],
    },
    twitter: {
      card: "summary",
      title: meta.title,
      description: meta.description,
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

  return (
    <FilteredScheduleView
      meta={meta}
      kind="league"
      schedules={schedules}
      teamRecords={teamRecords}
      guideSlot={
        guide ? <LeagueGuideSection guide={guide} display={meta.display} /> : undefined
      }
      highlightsSlot={
        <WeekHighlights
          title={`이번 주 ${meta.display} 미리보기`}
          intro={`이번 주 ${meta.display} 한국어 해설 우선 추천 매치업입니다. 매일 자동으로 갱신되며, 종료된 경기는 제외됩니다.`}
          schedules={schedules}
          league={meta.match}
          max={5}
          emptyText={`이번 주 예정된 ${meta.display} 경기가 없습니다.`}
        />
      }
      faqSlot={
        faqs ? (
          <FaqSection title={`${meta.display} 자주 묻는 질문`} faqs={faqs} />
        ) : undefined
      }
    />
  );
}
