import { MetadataRoute } from "next";
import scheduleData from "@/data/schedule.json";
import archiveData from "@/data/schedule-archive.json";
import worldcupData from "@/data/worldcup.json";
import resultsArchiveData from "@/data/results-archive.json";
import { LEAGUE_SEO, PLATFORM_SEO } from "@/lib/slugs";
import { STANDINGS_LEAGUES } from "@/lib/standings-seo";
import { matchToSlug } from "@/lib/match-slug";
import { readInsight } from "@/lib/insights/storage";
import { isRichMatch } from "@/lib/match-quality";
import { getAllGuides } from "@/lib/guides";
import { dedupeSitemapEntries } from "@/lib/seo-meta";
import standingsJson from "@/data/standings.json";
import { buildTeamIndex, eligibleTeams, type StandingsData } from "@/lib/teams";
import type { Schedule, ScheduleData } from "@/types/schedule";
import type { ResultsData } from "@/types/results";

const data = scheduleData as unknown as ScheduleData;
const archive = archiveData as unknown as ScheduleData;
const worldcup = worldcupData as unknown as ScheduleData;
const resultsArchive = resultsArchiveData as unknown as ResultsData;

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
  // 월드컵 편성은 worldcup.json에 별도 보관(매시간 도는 일반 크롤러가 덮어쓰지 않도록).
  // 사이트맵은 schedule.json만 읽으므로 병합하지 않으면 월드컵 매치가 색인에서 누락된다.
  // 동일하게 isRichMatch 필터를 적용해 얇은 매치 noindex 정책과 신호를 일치시킨다.
  for (const s of worldcup.schedules) matchById.set(s.id, s);
  for (const s of data.schedules) matchById.set(s.id, s); // 최신 우선
  // 색인은 "풍부한" 매치(인사이트 or 최종 스코어 보유)만 포함한다. 템플릿에 데이터만
  // 채운 얇은 매치 수백 개가 색인되면 사이트 전체가 low value content로 판정되므로,
  // sitemap에서 빼서 색인 평균 품질을 끌어올린다. (얇은 매치는 페이지 자체에 noindex 부여 —
  // match/[slug]/page.tsx 의 generateMetadata 참고. sitemap 제외와 noindex를 일치시켜 신호 모순 방지.)
  // 인사이트가 있으면 priority 0.8/weekly, 스코어만 있으면 0.7/monthly.
  // 가이드(에디토리얼) 글 — 사람이 쓴 고유 콘텐츠라 색인 가치가 높다. weekly/0.7.
  // 팀 페이지 — 매치와 달리 시즌 내내 수요가 붙는 상시 엔티티라 색인 가치가 높다.
  // 데이터가 빈 팀(개막 전 리그)과 국내 중계가 없는 팀은 buildTeamIndex/eligibleTeams가 이미 걸러낸다.
  const teamUrls = eligibleTeams(
    buildTeamIndex(standingsJson as unknown as StandingsData),
    [...data.schedules, ...archive.schedules],
  ).map((t) => ({
    url: `${BASE}/team/${encodeURIComponent(t.slug)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const guideUrls = getAllGuides().map((g) => ({
    url: `${BASE}/guide/${g.slug}`,
    lastModified: new Date(`${g.updated ?? g.date}T09:00:00+09:00`),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // 서로 다른 schedule id가 같은 슬러그를 낼 수 있어(사전방송/본방송 등) URL이 중복된다.
  // 실측 2026-07-28: 중복 53건. 같은 페이지를 두 번 등록하면서 lastmod·priority만 다르게
  // 주장하는 모순 신호가 되므로 dedupeSitemapEntries로 걸러낸다.
  const matchUrls = dedupeSitemapEntries(
    [...matchById.values()]
      .filter((s) => isRichMatch(s, resultsArchive))
      .map((s) => {
        const insight = readInsight(s.id);
        return {
          url: `${BASE}/match/${encodeURIComponent(matchToSlug(s))}`,
          lastModified: insight ? new Date(insight.generatedAt) : new Date(s.date),
          changeFrequency: insight ? ("weekly" as const) : ("monthly" as const),
          priority: insight ? 0.8 : 0.7,
        };
      }),
  );

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
    {
      // 2026 북중미 월드컵 허브(조별 순위). 대회 기간 트래픽 집중 → 높은 우선순위.
      url: `${BASE}/worldcup`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      // 한국어 해설 편성 모아보기. 네이버에서 "해설 일정" 계열 쿼리가 CTR 10~23%로
      // 사이트 평균(0.1%)을 압도해 만든 페이지다(2026-07-20).
      url: `${BASE}/commentary`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE}/guide`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...guideUrls,
    ...teamUrls,
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
      url: `${BASE}/faq`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
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
