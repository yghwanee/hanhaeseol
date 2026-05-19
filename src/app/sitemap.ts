import { MetadataRoute } from "next";
import scheduleData from "@/data/schedule.json";
import archiveData from "@/data/schedule-archive.json";
import { LEAGUE_SEO, PLATFORM_SEO } from "@/lib/slugs";
import { STANDINGS_LEAGUES } from "@/lib/standings-seo";
import { matchToSlug } from "@/lib/match-slug";
import type { Schedule, ScheduleData } from "@/types/schedule";

const data = scheduleData as unknown as ScheduleData;
const archive = archiveData as unknown as ScheduleData;

const BASE = "https://haeseol.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(scheduleData.lastUpdated);

  const leagueUrls = LEAGUE_SEO.map((l) => ({
    url: `${BASE}/league/${l.slug}`,
    lastModified,
    changeFrequency: "daily" as const,
    priority: 0.85,
  }));

  const platformUrls = PLATFORM_SEO.map((p) => ({
    url: `${BASE}/platform/${p.slug}`,
    lastModified,
    changeFrequency: "daily" as const,
    priority: 0.85,
  }));

  const standingsLeagueUrls = STANDINGS_LEAGUES.map((l) => ({
    url: `${BASE}/standings/${l.slug}`,
    lastModified,
    changeFrequency: "daily" as const,
    priority: 0.85,
  }));

  // sitemap.org 규격은 URL이 RFC 3986 (percent-encoded). 한글 슬러그는 반드시 encodeURIComponent.
  // 하이픈/숫자/영문은 그대로 통과, 한글만 %xx 형태로 변환됨.
  //
  // schedule(현재 7일치) + archive(영구 누적)를 id 기준 dedupe해 사이트맵에 포함.
  // 과거 경기 URL도 영구 노출 → Google이 영구 색인 가능, 404 누적 차단.
  const matchById = new Map<string, Schedule>();
  for (const s of archive.schedules) matchById.set(s.id, s);
  for (const s of data.schedules) matchById.set(s.id, s); // 최신 우선
  const matchUrls = [...matchById.values()].map((s) => ({
    url: `${BASE}/match/${encodeURIComponent(matchToSlug(s))}`,
    lastModified: new Date(s.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    {
      url: BASE,
      lastModified,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${BASE}/standings`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...standingsLeagueUrls,
    ...leagueUrls,
    ...platformUrls,
    ...matchUrls,
    {
      url: `${BASE}/about`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
