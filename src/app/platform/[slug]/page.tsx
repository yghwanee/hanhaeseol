import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { ScheduleData, Schedule } from "@/types/schedule";
import { TeamRecordsData, TeamRecordsMap } from "@/types/team-record";
import { PLATFORM_SEO, findPlatformBySlug } from "@/lib/slugs";
import { PLATFORM_GUIDES } from "@/lib/platform-guides";
import { PLATFORM_FAQS } from "@/lib/platform-faqs";
import FilteredScheduleView from "@/app/_components/FilteredScheduleView";
import PlatformGuideSection from "@/app/_components/PlatformGuideSection";
import FaqSection from "@/app/_components/FaqSection";

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

function loadSchedules(): Schedule[] {
  const filePath = path.join(process.cwd(), "public", "schedule.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data: ScheduleData = JSON.parse(raw);
  return data.schedules;
}

function loadTeamRecords(): TeamRecordsMap {
  try {
    const filePath = path.join(process.cwd(), "public", "team-records.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return (JSON.parse(raw) as TeamRecordsData).records;
  } catch {
    return {};
  }
}

export default function PlatformPage({ params }: { params: { slug: string } }) {
  const meta = findPlatformBySlug(params.slug);
  if (!meta) notFound();

  const guide = PLATFORM_GUIDES[params.slug];
  const faqs = PLATFORM_FAQS[params.slug];
  const schedules = loadSchedules();
  const teamRecords = loadTeamRecords();

  return (
    <FilteredScheduleView
      meta={meta}
      kind="platform"
      schedules={schedules}
      teamRecords={teamRecords}
      guideSlot={
        guide ? <PlatformGuideSection guide={guide} display={meta.display} /> : undefined
      }
      faqSlot={
        faqs ? (
          <FaqSection title={`${meta.display} 자주 묻는 질문`} faqs={faqs} />
        ) : undefined
      }
    />
  );
}
