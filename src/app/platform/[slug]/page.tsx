import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PLATFORM_SEO, findPlatformBySlug } from "@/lib/slugs";
import { PLATFORM_GUIDES } from "@/lib/platform-guides";
import { PLATFORM_FAQS } from "@/lib/platform-faqs";
import { loadScheduleData, loadTeamRecords, loadResults } from "@/lib/server-data";
import { buildSportsEventLd, buildBreadcrumbLd } from "@/lib/structured-data";
import FilteredScheduleView from "@/app/_components/FilteredScheduleView";
import PlatformGuideSection from "@/app/_components/PlatformGuideSection";
import FaqSection from "@/app/_components/FaqSection";
import WeekHighlights from "@/app/_components/WeekHighlights";

export const revalidate = 600;

export function generateStaticParams() {
  return PLATFORM_SEO.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const meta = findPlatformBySlug(params.slug);
  if (!meta) return {};

  const url = `https://haeseol.com/platform/${meta.slug}`;
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

export default function PlatformPage({ params }: { params: { slug: string } }) {
  const meta = findPlatformBySlug(params.slug);
  if (!meta) notFound();

  const guide = PLATFORM_GUIDES[params.slug];
  const faqs = PLATFORM_FAQS[params.slug];
  const schedules = loadScheduleData().schedules;
  const teamRecords = loadTeamRecords();
  const results = loadResults();

  const pageUrl = `https://haeseol.com/platform/${meta.slug}`;
  const matched = schedules.filter((s) => meta.match.includes(s.platform));
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
        kind="platform"
        schedules={schedules}
        teamRecords={teamRecords}
        results={results}
        guideSlot={
          guide ? <PlatformGuideSection guide={guide} display={meta.display} /> : undefined
        }
        highlightsSlot={
          <WeekHighlights
            title={`이번 주 ${meta.display} 빅매치`}
            schedules={schedules}
            platform={meta.match}
            days={7}
            emptyText={`이번 주 예정된 ${meta.display} 중계가 없습니다.`}
          />
        }
        faqSlot={
          faqs ? (
            <FaqSection title={`${meta.display} 자주 묻는 질문`} faqs={faqs} />
          ) : undefined
        }
      />
    </>
  );
}
