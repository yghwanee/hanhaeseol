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
import { dedupeReversedFixtures } from "@/lib/fixture-dedupe";
import { eligibleSports } from "@/lib/sport-seo";
import { getTodayString } from "@/lib/schedule-utils";

const data = scheduleData as unknown as ScheduleData;
const archive = archiveData as unknown as ScheduleData;
const worldcup = worldcupData as unknown as ScheduleData;
const resultsArchive = resultsArchiveData as unknown as ResultsData;

const BASE = "https://haeseol.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(scheduleData.lastUpdated);

  // 🔴 lastmod 는 **미래일 수 없다**. 매치 URL 은 경기일을 lastmod 로 쓰고 있었는데,
  // 편성이 오늘부터 7일치라 예정 경기 수십 건이 항상 미래 날짜를 주장했다(2026-08-19
  // 실측 92건, 최대 오늘+6일). Google 은 lastmod 가 부정확하면 사이트맵의 lastmod 를
  // 통째로 무시한다 — 실제로 GSC 의 "마지막으로 읽은 날짜"가 2026-06-22 에서
  // 58일째 멈춰 있었고 발견 페이지도 848 로 고정이었다(사이트맵 실제 URL 2,164).
  //
  // 예정 경기 페이지의 진짜 갱신 시각은 경기일이 아니라 **편성 데이터가 마지막으로
  // 바뀐 시각**이다. 그래서 데이터 갱신 시각으로 클램프한다. 과거 경기는 그대로 통과.
  const clamp = (d: Date) => (d.getTime() > lastModified.getTime() ? lastModified : d);

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
  // schedule(현재 7일치) + worldcup + archive(영구 누적)를 **슬러그 기준**으로 묶는다.
  // 과거 경기 URL도 영구 노출 → 영구 색인 가능, 404 누적 차단.
  //
  // 전에는 id 기준으로 묶었는데, 그러면 서로 다른 id 가 같은 슬러그(=같은 URL)를 내는
  // 경우를 못 잡는다(실측 충돌 228종). id 기준으로 행별 isRichMatch 를 돌리면 같은 URL 을
  // 두고 사이트맵과 페이지가 서로 다른 결론을 낼 수 있다.
  //
  // 색인 대상은 isRichMatch 로 판정한다(인사이트 or 최종 스코어 or 예정 경기, 그리고
  // 파싱이 신뢰 가능한 행). 매치 페이지의 noindex 도 같은 함수를 쓰므로 신호가 일치한다 —
  // 단 **같은 행에 대해 판정해야** 일치가 성립한다. 아래 bySlug 가 그걸 보장한다.
  // 인사이트가 있으면 priority 0.8/weekly, 스코어만 있으면 0.7/monthly.
  // 가이드(에디토리얼) 글 — 사람이 쓴 고유 콘텐츠라 색인 가치가 높다. weekly/0.7.
  // 팀 페이지 — 매치와 달리 시즌 내내 수요가 붙는 상시 엔티티라 색인 가치가 높다.
  // 데이터가 빈 팀(개막 전 리그)과 국내 중계가 없는 팀은 buildTeamIndex/eligibleTeams가 이미 걸러낸다.
  const teamUrls = eligibleTeams(
    buildTeamIndex(standingsJson as unknown as StandingsData),
    [...data.schedules, ...archive.schedules],
  ).map((t) => ({
    url: `${BASE}/team/${encodeURIComponent(t.slug)}`,
    // new Date() 였다. 그러면 팀 86개가 **매 배포마다** "방금 바뀜"을 주장한다.
    // 실제 갱신원은 편성·순위 데이터라 그 시각을 쓴다.
    lastModified,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // 종목 허브. 게이트는 페이지의 generateStaticParams 와 **같은 함수**여야 한다 —
  // 어긋나면 사이트맵이 없는 URL 을 올리거나(404) 있는 URL 을 빠뜨린다.
  const sportUrls = eligibleSports(data.schedules, getTodayString()).map((s) => ({
    url: `${BASE}/sport/${s.slug}`,
    lastModified,
    changeFrequency: "daily" as const,
    priority: 0.85,
  }));

  const guideUrls = getAllGuides().map((g) => ({
    url: `${BASE}/guide/${g.slug}`,
    lastModified: clamp(new Date(`${g.updated ?? g.date}T09:00:00+09:00`)),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // 서로 다른 schedule id가 같은 슬러그를 낼 수 있다(사전방송/본방송 등). 실측 2026-07-28:
  // 슬러그 충돌 228종.
  //
  // 그래서 **슬러그로 먼저 묶고, 매치 페이지가 실제로 고를 행 하나에 대해서만 isRichMatch를
  // 판정한다.** 행별로 판정하면 같은 URL을 두고 사이트맵은 "색인하라", 페이지는 noindex 를
  // 주장하는 모순이 생긴다(실측 1건 발생). 페이지의 해석 순서는
  // findMatchAnywhere = schedule → worldcup → archive 이므로 여기서도 같은 순서로 고른다.
  // findMatchAnywhere 는 각 소스에서 **첫 번째** 일치를 고르고 schedule → worldcup → archive
  // 순으로 시도한다. 그 순서대로 훑으면서 **이미 있으면 건너뛴다**(먼저 넣은 쪽이 이긴다).
  // Map.set 으로 덮어쓰면 같은 소스 안의 마지막 행이 이겨서 페이지 해석과 어긋난다.
  //
  // 🔴 슬러그로 묶기 **전에** 홈/원정 반전 중복을 접는다. 그건 슬러그가 서로 달라
  // (`리즈-vs-맨유` / `맨유-vs-리즈`) 이 Map 을 그냥 통과해 URL 이 두 개 올라간다
  // (2026-08-13 실측 2건). 매치 페이지도 같은 함수를 거친 목록을 보므로 신호가 일치한다.
  const bySlug = new Map<string, Schedule>();
  for (const s of dedupeReversedFixtures([
    ...data.schedules,
    ...worldcup.schedules,
    ...archive.schedules,
  ])) {
    const slug = matchToSlug(s);
    if (!bySlug.has(slug)) bySlug.set(slug, s);
  }

  const matchUrls = dedupeSitemapEntries(
    [...bySlug.values()]
      .filter((s) => isRichMatch(s, resultsArchive))
      .map((s) => {
        const insight = readInsight(s.id);
        return {
          url: `${BASE}/match/${encodeURIComponent(matchToSlug(s))}`,
          lastModified: clamp(
            insight ? new Date(insight.generatedAt) : new Date(s.date),
          ),
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
      // 한국어 해설 편성 모아보기. 네이버에서 "해설 일정" 계열 쿼리가 CTR 10~23%로
      // 사이트 평균(0.1%)을 압도해 만든 페이지다(2026-07-20).
      url: `${BASE}/commentary`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      // 플랫폼별 한국어 해설 비율 — 우리만 가진 원본 데이터. 인용 대상이라 색인 가치가 높다.
      url: `${BASE}/commentary/stats`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE}/guide`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...sportUrls,
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
