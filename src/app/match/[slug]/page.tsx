import type { Metadata } from "next";
import Link from "next/link";
import standingsJson from "@/data/standings.json";
import {
  buildTeamIndex,
  eligibleTeams,
  findTeamForSchedule,
  type StandingsData as TeamStandingsData,
  type TeamEntry,
} from "@/lib/teams";
import { notFound } from "next/navigation";
import scheduleData from "@/data/schedule.json";
import archiveData from "@/data/schedule-archive.json";
import worldcupData from "@/data/worldcup.json";
import resultsArchiveData from "@/data/results-archive.json";
import resultsData from "@/data/results.json";
import standingsData from "@/data/standings.json";
import type { Schedule, ScheduleData } from "@/types/schedule";
import type { GoalEvent, ResultsData } from "@/types/results";
import type { StandingsData } from "@/types/standings";
import { LEAGUE_SEO } from "@/lib/slugs";
import { matchToSlug, findMatchBySlug } from "@/lib/match-slug";
import { findResult } from "@/lib/results/lookup";
import {
  formatDateHeader,
  formatShortDate,
  GAME_DURATION_HOURS,
  isGameFinished,
} from "@/lib/schedule-utils";
import { SiteHeader } from "../../_components/SiteHeader";
import { AdfitBanner } from "../../_components/AdfitBanner";
import { readInsight } from "@/lib/insights/storage";
import { MatchInsightSection } from "./_components/MatchInsight";
import { MatchStarters } from "./_components/MatchStarters";
import { MatchLineup } from "./_components/MatchLineup";
import { MatchBaseballLineup } from "./_components/MatchBaseballLineup";
import { getStartersForMatch } from "@/lib/starters/lookup";
import type { StartersData } from "@/types/starter";
import startersData from "@/data/starters.json";
import { MatchContextSection } from "./_components/MatchContext";
import { MatchRecentGames } from "./_components/MatchRecentGames";
import { TeamLogo } from "../../_components/TeamLogo";
import { NAVER_TO_SCHEDULE_TEAM_NAME } from "@/lib/team-records/team-name-aliases";
import { getTeamLogo } from "@/data/team-logos";
import teamRecordsData from "@/data/team-records.json";
import type { TeamRecordsData } from "@/types/team-record";
import { buildMatchNarrative } from "@/lib/match-content/build";
import { isRichMatch } from "@/lib/match-quality";
import { clampDescription, buildMatchFaqs, buildMatchTitle } from "@/lib/seo-meta";
import FaqSection from "@/app/_components/FaqSection";

const data = scheduleData as unknown as ScheduleData;
const archive = archiveData as unknown as ScheduleData;
const worldcup = worldcupData as unknown as ScheduleData;
const standings = standingsData as unknown as StandingsData;
const teamRecords = teamRecordsData as unknown as TeamRecordsData;

const LAST_UPDATED_KST_DISPLAY = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date(data.lastUpdated));

/**
 * standings teamName → logo URL. 모듈 로드 시 1회 평탄화해서 O(1) 조회.
 * standings 표기는 네이버 원본(예: "맨체스터 시티").
 */
const STANDINGS_LOGOS: Map<string, string | null> = (() => {
  const m = new Map<string, string | null>();
  const all = [
    ...standings.soccer,
    ...standings.baseball,
    ...standings.basketball,
  ];
  for (const league of all) {
    for (const team of league.teams) {
      m.set(team.teamName, team.teamLogo ?? null);
    }
  }
  return m;
})();

/**
 * schedule 표기 → standings(네이버) 표기 reverse map.
 * 원본은 naver→schedule 매핑이라 여기서 뒤집어준다. 한 schedule 이름이
 * 여러 standings 이름과 매칭될 수 있는 충돌 케이스는 마지막 정의가 wins.
 */
const SCHEDULE_TO_STANDINGS_NAME: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const leagueAliases of Object.values(NAVER_TO_SCHEDULE_TEAM_NAME)) {
    for (const [naverName, scheduleNames] of Object.entries(leagueAliases)) {
      const names = Array.isArray(scheduleNames) ? scheduleNames : [scheduleNames];
      for (const sn of names) m.set(sn, naverName);
    }
  }
  return m;
})();

/**
 * schedule 표기로 팀 로고 찾기.
 * 1순위: team-logos.ts (schedule 표기 기준, 로컬/ESPN/SDB 등 안정적 소스).
 *   네이버 sports-phinf CDN은 외부 사이트 핫링크가 차단되는 경우가 있어 standings보다 우선.
 * 2순위: standings.json 직접 매칭 → alias 역매핑.
 */
function findTeamLogo(teamName: string): string | null {
  const mapped = getTeamLogo(teamName);
  if (mapped) return mapped;
  if (STANDINGS_LOGOS.has(teamName)) return STANDINGS_LOGOS.get(teamName) ?? null;
  const standingsName = SCHEDULE_TO_STANDINGS_NAME.get(teamName);
  if (standingsName && STANDINGS_LOGOS.has(standingsName)) {
    return STANDINGS_LOGOS.get(standingsName) ?? null;
  }
  return null;
}
const resultsArchive = resultsArchiveData as unknown as ResultsData;
const results = resultsData as unknown as ResultsData;

/**
 * 매치 슬러그 조회: 현재 schedule(7일치) → archive(영구 누적) 순으로 찾는다.
 * archive에는 schedule.json에 한 번이라도 들어온 모든 경기가 누적되므로,
 * 7일이 지나 schedule.json에서 빠진 과거 경기도 archive에서 부활시켜 404를 막는다.
 */
function findMatchAnywhere(slug: string): Schedule | undefined {
  return (
    findMatchBySlug(data.schedules, slug) ??
    findMatchBySlug(worldcup.schedules, slug) ??
    findMatchBySlug(archive.schedules, slug)
  );
}

// 관련 경기 검색용 통합 목록 (schedule + archive, id 기준 dedupe).
// archive에 이미 schedule이 포함되어 있지만 초기 배포 시점에 archive가 비어 있을 수 있어 둘 다 merge.
const allSchedules: Schedule[] = (() => {
  const byId = new Map<string, Schedule>();
  for (const s of archive.schedules) byId.set(s.id, s);
  for (const s of worldcup.schedules) byId.set(s.id, s);
  for (const s of data.schedules) byId.set(s.id, s); // schedule이 최신
  return [...byId.values()];
})();

type Params = { slug: string };

/**
 * 빌드 시점에 schedule.json(7일치)만 정적 생성. archive(영구 누적)는 런타임 SSR로 처리.
 * archive가 수천 건으로 커지면 빌드 폭발하므로, 정적 생성은 트래픽이 몰리는 현재 7일치에만.
 */
export function generateStaticParams(): Params[] {
  const seen = new Set<string>();
  const params: Params[] = [];
  for (const s of [...data.schedules, ...worldcup.schedules]) {
    const slug = matchToSlug(s);
    if (seen.has(slug)) continue;
    seen.add(slug);
    params.push({ slug });
  }
  return params;
}

// dynamicParams=true: archive에 있는 과거 경기는 런타임에 SSR로 렌더링.
export const dynamicParams = true;

function matchKoreanLabel(s: Schedule): string {
  if (s.koreanCommentary === true) return "한국어 해설";
  if (s.koreanCommentary === false) return "현지 해설";
  return "해설 정보 미확인";
}

function leagueSlugFor(leagueName: string): string | undefined {
  return LEAGUE_SEO.find((l) => l.match.includes(leagueName))?.slug;
}

/**
 * 매치 페이지 메타 keywords + SportsArticle JSON-LD keywords 공통 빌더.
 * GSC 데이터상 매치 페이지는 롱테일 영역이라 다양한 조합을 깔아 캡처력 ↑.
 */
function buildMatchKeywords(match: Schedule): string[] {
  const matchupShort = `${match.homeTeam} vs ${match.awayTeam}`;
  const koTag = match.koreanCommentary === true ? "한국어 해설" : "현지 해설";
  return [
    `${matchupShort} 중계`,
    matchupShort,
    `${matchupShort} 한국어 중계`,
    `${matchupShort} ${match.platform}`,
    `${matchupShort} 결과`,
    `${matchupShort} 하이라이트`,
    `${match.homeTeam} 중계`,
    `${match.awayTeam} 중계`,
    `${match.homeTeam} ${koTag}`,
    `${match.awayTeam} ${koTag}`,
    `${match.league} ${matchupShort}`,
    `${match.league} 중계`,
    `${match.league} 편성표`,
    `${match.league} 한국어 중계`,
    `${match.platform} 편성표`,
    `${match.platform} ${match.league}`,
    `${match.sport} 중계`,
    `${match.sport} 한국어 해설`,
  ];
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const match = findMatchAnywhere(params.slug);
  if (!match) return { title: "경기 정보 - 한해설" };

  const insight = readInsight(match.id);

  const date = formatDateHeader(match.date);
  const ko = matchKoreanLabel(match);

  // 제목 조립·순서 근거는 seo-meta.buildMatchTitle 주석 참조(날짜를 맨 앞으로).
  // 제목은 인사이트 유무와 무관하게 한 포맷으로 통일한다.
  //
  // 전에는 인사이트가 있으면 headline을 앞세웠다(`애슬레틱스의 반등과 LA 다저스의 상승세가
  // 맞붙는 MLB 경기 | ...`). 그런데 네이버에서 실제로 노출을 만드는 쿼리는
  // `2026년 07월 16일 kia 타이거즈 ssg 랜더스` 처럼 **팀명 + 날짜** 형태다(단일 쿼리 14.7만 노출).
  // headline을 앞세우면 그 요소가 전부 뒤로 밀리거나 사라져서, 정보가 더 많은 페이지가
  // 오히려 검색에 더 안 맞는 역전이 생겼다. headline은 description으로 옮긴다.
  const title = buildMatchTitle({
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    platform: match.platform,
    shortDate: formatShortDate(match.date),
    // 확인 안 된 경우는 라벨을 뺀다. `해설 정보 미확인 중계` 가 제목에 박히면 안 된다.
    commentaryLabel: match.koreanCommentary === true || match.koreanCommentary === false ? ko : "",
  });

  // 인사이트가 있으면 고유 산문을 앞에 둔다(SERP snippet 차별화 → CTR).
  // 길이는 clampDescription이 SERP 상한에서 자른다. 전에는 187~200자로 나가 잘렸다.
  const koSuffix = match.koreanCommentary === true ? "로" : "으로";
  const description = clampDescription(
    insight
      ? `${date} ${match.time} ${match.league} ${match.homeTeam} vs ${match.awayTeam}, ${match.platform} ${ko} 중계. ${insight.sections.headline}`
      : `${date} ${match.time} ${match.league} ${match.homeTeam} vs ${match.awayTeam} 경기 중계. ${match.platform}에서 ${ko}${koSuffix} 시청 가능합니다.`,
  );

  const url = `https://haeseol.com/match/${params.slug}`;
  const keywords = buildMatchKeywords(match);

  // 얇은 매치(지난 경기인데 스코어가 없는 것)는 noindex. sitemap 제외와 일치시킨다.
  // follow는 유지해 내부 링크 equity가 허브(리그·플랫폼) 페이지로 흐르게 한다.
  const rich = isRichMatch(match, resultsArchive);

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    // 🔴 `robots: rich ? undefined : {...}` 로 쓰면 안 된다. Next.js는 메타데이터 객체에
    // **명시적으로 존재하는 `undefined`를 "상속"이 아니라 "해제"로 처리**한다. 그래서 색인
    // 대상 매치(=대부분)에서 layout.tsx의 robots 설정이 통째로 사라지고 있었다.
    // 실측(2026-07-28): 매치 페이지 1,571개 전부 robots·googlebot 메타가 없었고,
    // 디스커버 진입 조건인 `max-image-preview:large`와 `max-snippet:-1`이 사이트의 91%에
    // 적용되지 않고 있었다. 조건부 스프레드로 키 자체를 없애야 상속된다.
    ...(rich ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      title: insight
        ? `${insight.sections.headline} - 한해설`
        : `${match.homeTeam} vs ${match.awayTeam} - ${match.platform} 중계`,
      description,
      url,
      siteName: "한해설",
      locale: "ko_KR",
      type: "website",
      // og:image 는 매치별 동적 OG(opengraph-image.tsx)가 파일 컨벤션으로 자동 주입.
      // 여기서 images 를 명시하면 파일 컨벤션을 덮어써 정적 og-default 로 고정되므로 비워둔다.
    },
    twitter: {
      card: "summary_large_image",
      title: insight
        ? `${insight.sections.headline}`
        : `${match.homeTeam} vs ${match.awayTeam} - ${ko}`,
      description,
      // twitter:image 미지정 → 트위터/X는 og:image(동적 OG)로 폴백.
    },
  };
}

/** "이름 45+2'" 형태 라벨. 자책골은 (OG) 표기. (ScheduleCard와 동일 규칙) */
function goalLabel(g: GoalEvent): string {
  const t = g.addedTime ? `${g.minute}+${g.addedTime}'` : `${g.minute}'`;
  return `${g.player} ${t}${g.ownGoal ? " (OG)" : ""}`;
}

/**
 * 엠블럼 + 팀명. 팀 페이지가 있으면 통째로 링크한다.
 *
 * 팀 페이지로 들어갈 입구가 리그 페이지 맨 아래뿐이라 사실상 아무도 못 찾았다.
 * 경기를 보고 있는 사람에게 그 팀 일정을 여는 게 제일 자연스러운 동선이다.
 */
function TeamSide({
  name,
  logo,
  team,
}: {
  name: string;
  logo: string | null;
  team?: TeamEntry;
}) {
  const body = (
    <>
      <TeamLogo name={name} src={logo} size={56} />
      <span className="mt-1.5 block max-w-[7rem] truncate text-xs text-zinc-400 sm:text-sm">
        {name}
      </span>
    </>
  );

  if (!team) return <div className="text-center">{body}</div>;

  return (
    <Link
      href={`/team/${encodeURIComponent(team.slug)}`}
      className="group text-center transition-opacity hover:opacity-80"
      aria-label={`${name} 팀 상세정보`}
    >
      {body}
      {/* 텍스트만 두면 눌러도 되는지 모른다. 알약 태그로 눌리는 것임을 드러낸다. */}
      <span className="mt-1 inline-flex items-center gap-0.5 rounded-full border border-zinc-700 bg-zinc-800/70 px-2 py-0.5 text-[10px] text-zinc-300 transition-colors group-hover:border-zinc-500 group-hover:bg-zinc-700/70 group-hover:text-white sm:text-[11px]">
        팀 상세정보
        <span aria-hidden>›</span>
      </span>
    </Link>
  );
}

export default function MatchPage({ params }: { params: Params }) {
  const match = findMatchAnywhere(params.slug);
  if (!match) notFound();

  const date = formatDateHeader(match.date);
  const finished = isGameFinished(match.date, match.time, match.sport);
  // 종료된 경기는 결과 archive에서 스코어를 찾아 표시한다. 영구 페이지로 색인 가치를 부여.
  const result = finished ? findResult(resultsArchive, match) : undefined;
  const hasScore =
    !!result && typeof result.homeScore === "number" && typeof result.awayScore === "number";

  // 라인업용 네이버 gameId. 진행중/예정은 results(3일 윈도우), 과거는 archive에서.
  // 축구=포메이션(/api/lineup), 야구=타순(/api/lineup-baseball).
  const lineupGameId =
    match.sport === "축구" || match.sport === "야구"
      ? findResult(results, match)?.gameId ?? findResult(resultsArchive, match)?.gameId
      : undefined;

  const insight = readInsight(match.id);
  const starters = getStartersForMatch(startersData as unknown as StartersData, match);

  // 데이터 기반 자동 콘텐츠 — 인사이트 유무와 무관하게 항상 시도.
  // standings/results-archive/team-records가 있으면 풍부한 섹션을 만들고, 없으면 자연어 단락만.
  const narrative = buildMatchNarrative(
    match,
    resultsArchive,
    standings,
    teamRecords.records,
  );

  const ko = matchKoreanLabel(match);
  const leagueSlug = leagueSlugFor(match.league);
  const keywords = buildMatchKeywords(match);

  // 동일 리그 / 동일 플랫폼의 직후 매치들. 같은 매치업이 여러 플랫폼에서 중계되면
  // 슬러그가 달라서 슬러그 비교만으론 자기 경기/중복 경기를 못 거른다. 매치업 키
  // (date|home|away) 단위로 dedupe + 자기 자신 제외.
  // 팀 페이지가 있는 팀만 링크한다(개막 전 리그·국내 미중계 팀은 페이지가 없다).
  const teamIndex = eligibleTeams(
    buildTeamIndex(standingsJson as unknown as TeamStandingsData),
    allSchedules,
  );
  const selfMatchupKey = `${match.date}|${match.homeTeam}|${match.awayTeam}`;
  const dedupByMatchup = (list: Schedule[]): Schedule[] => {
    const seen = new Set<string>([selfMatchupKey]);
    return list.filter((s) => {
      const k = `${s.date}|${s.homeTeam}|${s.awayTeam}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const relatedByLeague = dedupByMatchup(
    allSchedules.filter((s) => s.league === match.league && s.date >= match.date),
  ).slice(0, 6);
  const relatedByPlatform = dedupByMatchup(
    allSchedules.filter((s) => s.platform === match.platform && s.date >= match.date),
  ).slice(0, 6);

  // SportsEvent JSON-LD
  const [hh, mm] = match.time.split(":");
  const start = new Date(`${match.date}T${hh}:${mm}:00+09:00`);
  const durationMs = (GAME_DURATION_HOURS[match.sport] ?? 3) * 60 * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);
  const inLang = match.koreanCommentary === true ? "ko" : "en";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SportsEvent",
        name: `${match.league} ${match.homeTeam} vs ${match.awayTeam}`,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        eventStatus: finished
          ? "https://schema.org/EventCompleted"
          : "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
        location: {
          "@type": "VirtualLocation",
          url: `https://haeseol.com/match/${params.slug}`,
        },
        description: `${match.league} ${match.homeTeam} vs ${match.awayTeam} ${match.platform} 중계 (${ko})`,
        sport: match.sport,
        inLanguage: inLang,
        competitor: [
          { "@type": "SportsTeam", name: match.homeTeam },
          { "@type": "SportsTeam", name: match.awayTeam },
        ],
        performer: [
          { "@type": "SportsTeam", name: match.homeTeam },
          { "@type": "SportsTeam", name: match.awayTeam },
        ],
        organizer: { "@type": "Organization", name: match.league },
        offers: {
          "@type": "Offer",
          url: "https://haeseol.com",
          availability: "https://schema.org/InStock",
          price: "0",
          priceCurrency: "KRW",
        },
        // BroadcastEvent: "Where to watch" 시그널. 한해설의 핵심 가치를 schema-level에
        // 명시해 Google sports 캐러셀 후보로 만든다.
        subEvent: {
          "@type": "BroadcastEvent",
          name: `${match.platform} 중계 — ${match.homeTeam} vs ${match.awayTeam}`,
          isLiveBroadcast: !finished,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          inLanguage: inLang,
          publishedOn: {
            "@type": "BroadcastService",
            name: match.platform,
            broadcastDisplayName: match.platform,
            inLanguage: inLang,
            areaServed: "KR",
            broadcaster: {
              "@type": "Organization",
              name: match.platform,
            },
          },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "한해설", item: "https://haeseol.com" },
          ...(leagueSlug
            ? [
                {
                  "@type": "ListItem",
                  position: 2,
                  name: `${match.league} 편성표`,
                  item: `https://haeseol.com/league/${leagueSlug}`,
                },
              ]
            : []),
          {
            "@type": "ListItem",
            position: leagueSlug ? 3 : 2,
            name: `${match.homeTeam} vs ${match.awayTeam}`,
            item: `https://haeseol.com/match/${params.slug}`,
          },
        ],
      },
      ...(insight
        ? [
            {
              // SportsArticle: 일반 Article보다 sports vertical에 더 정확. Google이 카테고리 인식 ↑
              "@type": "SportsArticle",
              headline: insight.sections.headline,
              description: insight.sections.recentForm.slice(0, 160),
              image: "https://haeseol.com/og-default.png",
              datePublished: insight.generatedAt,
              dateModified: insight.generatedAt,
              inLanguage: "ko",
              // articleSection / keywords로 sports vertical 카테고리·롱테일 키워드 노출.
              articleSection: match.sport,
              keywords: keywords.slice(0, 10).join(", "),
              articleBody: [
                insight.sections.recentForm,
                insight.sections.keyMatchup,
                ...insight.sections.watchPoints,
              ].join(" "),
              author: { "@type": "Organization", name: "한해설" },
              publisher: {
                "@type": "Organization",
                name: "한해설",
                logo: {
                  "@type": "ImageObject",
                  url: "https://haeseol.com/icon.png",
                },
              },
              mainEntityOfPage: {
                "@type": "WebPage",
                "@id": `https://haeseol.com/match/${params.slug}`,
              },
              about: {
                "@type": "SportsEvent",
                name: `${match.league} ${match.homeTeam} vs ${match.awayTeam}`,
              },
            },
          ]
        : []),
    ],
  };

  return (
    <main className="min-h-screen text-gray-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-2xl px-3 pb-8 text-[14px] sm:px-4 sm:pb-12">
        <SiteHeader />

        <nav className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500 sm:mt-6">
          <Link href="/" className="transition-colors hover:text-zinc-300">
            편성표
          </Link>
          {leagueSlug && (
            <>
              <span>›</span>
              <Link
                href={`/league/${leagueSlug}`}
                className="transition-colors hover:text-zinc-300"
              >
                {match.league}
              </Link>
            </>
          )}
          <span>›</span>
          <span className="text-zinc-400">
            {match.homeTeam} vs {match.awayTeam}
          </span>
        </nav>

        <article className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-5 text-center sm:p-6">
          {/* H1 텍스트 콘텐츠를 일·시·리그·매치업·해설·플랫폼 모두 포함하도록 구성.
              시각적으로는 작은 자막 + 큰 매치업 + 작은 자막 3단으로 자연스럽게 분리.
              크롤러가 보는 H1 textContent: "5월 25일 (월) · 16:30 (KST) · K리그2 파주 vs 김포 한국어 해설 중계 · 쿠팡플레이"
              → "파주 vs 김포 중계", "K리그2 한국어 해설", "쿠팡플레이 K리그2" 등 롱테일 캡처. */}
          <h1 className="mt-1 text-2xl font-bold leading-tight text-white sm:text-3xl">
            <span className="block text-xs font-normal text-zinc-500 sm:text-sm">
              {date} · {match.time} (KST) · {match.league}
            </span>
            <span className="mt-1 block">
              {match.homeTeam}{" "}
              <span className="text-zinc-500">vs</span> {match.awayTeam}
            </span>
            <span className="mt-1 block text-xs font-normal text-zinc-400 sm:text-sm">
              {ko} 중계 · {match.platform}
            </span>
          </h1>

          {/* 팀 엠블럼 좌우 배치 — standings.json에 로고 있으면 이미지, 없으면 initials 자동 fallback */}
          <div className="mt-4 flex items-center justify-center gap-5 sm:gap-7">
            <TeamSide
              name={match.homeTeam}
              logo={findTeamLogo(match.homeTeam) ?? match.homeEmblem ?? null}
              team={findTeamForSchedule(teamIndex, match.league, match.homeTeam)}
            />
            <span className="text-sm font-bold text-zinc-500 sm:text-base">vs</span>
            <TeamSide
              name={match.awayTeam}
              logo={findTeamLogo(match.awayTeam) ?? match.awayEmblem ?? null}
              team={findTeamForSchedule(teamIndex, match.league, match.awayTeam)}
            />
          </div>

          {hasScore && (
            <div className="mt-4 rounded-lg border border-emerald-700/40 bg-emerald-900/15 px-4 py-3">
              <p className="mb-2 text-[11px] font-medium text-emerald-300/80 sm:text-xs">
                최종 결과
              </p>
              <div className="flex items-center justify-center gap-4 sm:gap-6">
                <div className="flex-1 text-right">
                  <p className="truncate text-xs text-zinc-300 sm:text-sm">
                    {match.homeTeam}
                  </p>
                  <p
                    className={`tabular-nums text-3xl font-bold sm:text-4xl ${
                      result!.winner
                        ? result!.winner === "home"
                          ? "text-white"
                          : "text-zinc-500"
                        : result!.homeScore! > result!.awayScore!
                        ? "text-white"
                        : result!.homeScore! < result!.awayScore!
                        ? "text-zinc-500"
                        : "text-zinc-200"
                    }`}
                  >
                    {result!.homeScore}
                  </p>
                </div>
                <div className="text-2xl text-zinc-600 sm:text-3xl">:</div>
                <div className="flex-1 text-left">
                  <p className="truncate text-xs text-zinc-300 sm:text-sm">
                    {match.awayTeam}
                  </p>
                  <p
                    className={`tabular-nums text-3xl font-bold sm:text-4xl ${
                      result!.winner
                        ? result!.winner === "away"
                          ? "text-white"
                          : "text-zinc-500"
                        : result!.awayScore! > result!.homeScore!
                        ? "text-white"
                        : result!.awayScore! < result!.homeScore!
                        ? "text-zinc-500"
                        : "text-zinc-200"
                    }`}
                  >
                    {result!.awayScore}
                  </p>
                </div>
              </div>
              {typeof result!.homePtScore === "number" &&
                typeof result!.awayPtScore === "number" && (
                  <p className="mt-1 text-center text-xs font-semibold text-amber-300/90 sm:text-sm">
                    승부차기 {result!.homePtScore}-{result!.awayPtScore}{" "}
                    <span className="text-amber-200/70">
                      ({result!.winner === "away" ? match.awayTeam : match.homeTeam} 승)
                    </span>
                  </p>
                )}
              {match.sport === "축구" && result!.goals && result!.goals.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-x-6 border-t border-emerald-700/20 pt-2 text-[11px] leading-snug text-zinc-300 sm:text-xs">
                  <div className="min-w-0 space-y-0.5 text-right">
                    {result!.goals!.filter((g) => g.team === "home").map((g, i) => (
                      <div key={i} className="truncate">
                        {goalLabel(g)} <span aria-hidden>⚽</span>
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0 space-y-0.5 text-left">
                    {result!.goals!.filter((g) => g.team === "away").map((g, i) => (
                      <div key={i} className="truncate">
                        <span aria-hidden>⚽</span> {goalLabel(g)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result!.period && (
                <p className="mt-2 text-center text-[11px] text-zinc-500 sm:text-xs">
                  {result!.period}
                </p>
              )}
            </div>
          )}

          {result?.highlightVideoId && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-medium text-zinc-400 sm:text-xs">
                경기 하이라이트
              </p>
              <div className="relative aspect-video overflow-hidden rounded-lg border border-zinc-800">
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${result.highlightVideoId}`}
                  title={`${match.homeTeam} vs ${match.awayTeam} 하이라이트`}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </div>
          )}

          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            <strong>{match.league}</strong>{" "}
            <strong>{match.homeTeam}</strong> vs <strong>{match.awayTeam}</strong>{" "}
            경기는 <strong>{match.platform}</strong>에서 중계됩니다.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            {match.koreanCommentary === true ? (
              <>
                해당 중계는{" "}
                <span className="font-semibold text-emerald-400">한국어 해설</span>로
                제공됩니다.
              </>
            ) : match.koreanCommentary === false ? (
              <>
                해당 중계는{" "}
                <span className="font-semibold text-rose-400">현지(영어) 해설</span>로
                제공되며 한국어 해설은 제공되지 않습니다.
              </>
            ) : (
              <>
                한국어 해설 여부는{" "}
                <span className="font-semibold text-yellow-400">아직 확인되지 않았습니다</span>.
                중계 직전 각 플랫폼의 공식 편성표를 한 번 더 확인해주세요.
              </>
            )}
          </p>

        </article>

        {lineupGameId && match.sport === "축구" && (
          <MatchLineup
            gameId={lineupGameId}
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
          />
        )}
        {lineupGameId && match.sport === "야구" && (
          <MatchBaseballLineup
            gameId={lineupGameId}
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
          />
        )}

        <div className="mt-6">
          <AdfitBanner />
        </div>

        {starters && (
          <MatchStarters
            home={starters.home}
            away={starters.away}
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
          />
        )}
        {insight && <MatchInsightSection insight={insight} />}

        <MatchRecentGames
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          homeRecent={narrative.homeRecent}
          awayRecent={narrative.awayRecent}
          logoFor={findTeamLogo}
        />

        <MatchContextSection
          narrative={narrative}
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          league={match.league}
          platform={match.platform}
          hasInsight={!!insight}
        />

        {/* 같은 리그 다른 경기 — 내부 링크 + 사용자 탐색 동선 */}
        {relatedByLeague.length > 0 && (
          <section className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white sm:text-base">
              {match.league} 다음 경기
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {relatedByLeague.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/match/${matchToSlug(s)}`}
                    className="text-zinc-300 transition-colors hover:text-white hover:underline underline-offset-2"
                  >
                    {formatDateHeader(s.date)} {s.time} · {s.homeTeam} vs{" "}
                    {s.awayTeam}{" "}
                    <span className="text-xs text-zinc-500">({s.platform})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 같은 플랫폼 다른 경기 */}
        {relatedByPlatform.length > 0 && (
          <section className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white sm:text-base">
              {match.platform} 다른 중계
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {relatedByPlatform.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/match/${matchToSlug(s)}`}
                    className="text-zinc-300 transition-colors hover:text-white hover:underline underline-offset-2"
                  >
                    {formatDateHeader(s.date)} {s.time} · {s.league} {s.homeTeam}{" "}
                    vs {s.awayTeam}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white sm:text-base">
            {match.homeTeam} vs {match.awayTeam} 경기를 어디서 시청하나요?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {match.platform} 공식 앱·웹사이트에서 {date} {match.time}부터 시청
            가능합니다. 한해설은 편성 정보를 모아서 안내하는 서비스이며,
            실제 중계는 각 플랫폼에서 시청해야 합니다.{" "}
            {leagueSlug && (
              <>
                {match.league}의 더 많은 한국어 해설 일정은{" "}
                <Link
                  href={`/league/${leagueSlug}`}
                  className="text-emerald-400 hover:underline underline-offset-2"
                >
                  {match.league} 편성표
                </Link>
                에서 확인하세요.
              </>
            )}
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            편성 정보 갱신 ·{" "}
            <time dateTime={data.lastUpdated}>
              {LAST_UPDATED_KST_DISPLAY} KST
            </time>
          </p>
        </section>

        {/* 위 안내 섹션은 질문형 H2를 쓰면서도 FAQPage 마크업이 없었다. 매치 페이지는
            사이트맵의 91%인데 질문형 구조화 데이터가 빠져 있었다. 데이터로 자동 생성하므로
            사람 손이 안 든다.

            ⚠️ **구글 FAQ 리치결과는 2026-05-07 전 사이트 대상으로 폐지됐다.** 그래서 이걸
            넣는 이유는 구글 SERP 확장이 아니다. 남는 이득은 두 개다.
            ① AI 답변 엔진이 Q&A 마크업을 인용 단위로 쓴다("이 경기 어디서 보나"가 정확히
               질문형 쿼리다) ② 화면에 실제로 답이 보인다(사용자 이득).
            구글 리치결과를 기대하고 확대하지는 말 것. */}
        <FaqSection
          title={`${match.homeTeam} vs ${match.awayTeam} 중계 자주 묻는 질문`}
          faqs={buildMatchFaqs({
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            league: match.league,
            platform: match.platform,
            dateLabel: date,
            time: match.time,
            commentaryLabel: ko,
            koreanCommentary: match.koreanCommentary,
          })}
        />
      </div>
    </main>
  );
}

