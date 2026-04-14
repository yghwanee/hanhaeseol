import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { ScheduleData, Schedule } from "@/types/schedule";
import { LEAGUE_SEO, findLeagueBySlug } from "@/lib/slugs";
import FilteredScheduleView from "@/app/_components/FilteredScheduleView";

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

function loadSchedules(): Schedule[] {
  const filePath = path.join(process.cwd(), "public", "schedule.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data: ScheduleData = JSON.parse(raw);
  return data.schedules;
}

export default function LeaguePage({ params }: { params: { slug: string } }) {
  const meta = findLeagueBySlug(params.slug);
  if (!meta) notFound();

  const schedules = loadSchedules();
  return <FilteredScheduleView meta={meta} kind="league" schedules={schedules} />;
}
