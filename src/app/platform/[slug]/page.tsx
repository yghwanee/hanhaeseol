import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PLATFORM_SEO, findPlatformBySlug } from "@/lib/slugs";
import { PLATFORM_GUIDES } from "@/lib/platform-guides";
import { PLATFORM_FAQS } from "@/lib/platform-faqs";
import { loadScheduleData, loadTeamRecords } from "@/lib/server-data";
import { buildSportsEventLd } from "@/lib/structured-data";
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
      images: [{ url: "https://haeseol.com/logo.png", alt: "한해설" }],
    },
    twitter: {
      card: "summary",
      title: meta.title,
      description: meta.description,
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

  const pageUrl = `https://haeseol.com/platform/${meta.slug}`;
  const matched = schedules.filter((s) => meta.match.includes(s.platform));
  const sportsEventLd = buildSportsEventLd(matched, pageUrl);

  return (
    <>
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
        guideSlot={
          guide ? <PlatformGuideSection guide={guide} display={meta.display} /> : undefined
        }
        highlightsSlot={
          <WeekHighlights
            title={`이번 주 ${meta.display} 추천 매치`}
            intro={`이번 주 ${meta.display}에서 시청 가능한 한국어 해설 우선 매치업입니다. 매일 자동으로 갱신됩니다.`}
            schedules={schedules}
            platform={meta.match}
            max={5}
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
