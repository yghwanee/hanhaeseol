import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { ScheduleData, Schedule } from "@/types/schedule";
import { PLATFORM_SEO, findPlatformBySlug } from "@/lib/slugs";
import { PLATFORM_GUIDES } from "@/lib/platform-guides";
import FilteredScheduleView from "@/app/_components/FilteredScheduleView";
import PlatformGuideSection from "@/app/_components/PlatformGuideSection";

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

export default function PlatformPage({ params }: { params: { slug: string } }) {
  const meta = findPlatformBySlug(params.slug);
  if (!meta) notFound();

  const guide = PLATFORM_GUIDES[params.slug];
  const schedules = loadSchedules();
  return (
    <FilteredScheduleView
      meta={meta}
      kind="platform"
      schedules={schedules}
      guideSlot={guide ? <PlatformGuideSection guide={guide} display={meta.display} /> : undefined}
    />
  );
}
