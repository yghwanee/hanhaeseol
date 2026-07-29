import type { Metadata } from "next";
import Link from "next/link";
import standingsData from "@/data/standings.json";
import type { StandingsData } from "@/types/standings";
import { SiteHeader } from "../_components/SiteHeader";
import { StandingsView } from "./_components/StandingsView";
import { AdfitBanner } from "../_components/AdfitBanner";
import { STANDINGS_LEAGUES } from "@/lib/standings-seo";
import { loadScheduleData } from "@/lib/server-data";
import scheduleArchive from "@/data/schedule-archive.json";
import { buildTeamLinkMap } from "@/lib/team-links";
import type { StandingsData as TeamStandingsData } from "@/lib/teams";
import type { Schedule } from "@/types/schedule";

const data = standingsData as unknown as StandingsData;
const archiveSchedules = (scheduleArchive as unknown as { schedules: Schedule[] }).schedules;

const STANDINGS_INDEX_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "한해설", item: "https://haeseol.com" },
        { "@type": "ListItem", position: 2, name: "팀 순위", item: "https://haeseol.com/standings" },
      ],
    },
    {
      "@type": "ItemList",
      name: "한해설 - 리그별 순위 목록",
      itemListElement: STANDINGS_LEAGUES.map((l, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://haeseol.com/standings/${l.slug}`,
        name: `${l.display} 순위`,
      })),
    },
  ],
};

export const metadata: Metadata = {
  title: "팀 순위 - EPL · 라리가 · 분데스 · KBO 등 | 한해설",
  description:
    "프리미어리그·라리가·분데스리가·세리에A·리그앙·챔피언스리그·유로파리그·MLS·K리그·KBO·MLB 팀 순위. 승점·득실·승률·게임차·연속 결과까지 한눈에. 한국어 해설 중계 편성표와 함께.",
  keywords: [
    "EPL 순위",
    "프리미어리그 순위",
    "라리가 순위",
    "분데스리가 순위",
    "세리에A 순위",
    "리그앙 순위",
    "리그1 순위",
    "챔피언스리그 순위",
    "UCL 순위",
    "유로파리그 순위",
    "UEL 순위",
    "MLS 순위",
    "K리그 순위",
    "K리그1 순위",
    "K리그2 순위",
    "에레디비시 순위",
    "KBO 순위",
    "MLB 순위",
    "프로야구 순위",
  ],
  alternates: { canonical: "https://haeseol.com/standings" },
  openGraph: {
    title: "팀 순위 - 한해설",
    description:
      "EPL·라리가·분데스·세리에A·KBO·MLB 등 팀 순위. 한국어 해설 중계 편성표와 함께.",
    url: "https://haeseol.com/standings",
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
    title: "팀 순위 - 한해설",
    description: "EPL·KBO 등 팀 순위를 한눈에.",
    images: ["https://haeseol.com/og-default.png"],
  },
};

export default function StandingsPage({
  searchParams,
}: {
  searchParams: { sport?: string; league?: string };
}) {
  // 순위표 팀명 → 팀 페이지 링크(리그 id 로 스코프). 서버에서 계산해 내려준다.
  // 팀 페이지가 존재하는 팀만 들어간다 — 없는 페이지로 링크하면 404를 양산한다.
  const teamLinks = buildTeamLinkMap(data as unknown as TeamStandingsData, [
    ...loadScheduleData().schedules,
    ...archiveSchedules,
  ]);

  // 서버 단에서 query → 초기값 결정. 클라이언트 hydration 시 default → 분데스 깜빡임 방지.
  const qSport = searchParams.sport;
  const qLeague = searchParams.league;
  let initialSport: "soccer" | "baseball" = "soccer";
  let initialLeague: string = data.soccer[0]?.id ?? "";
  if (qSport === "soccer" || qSport === "baseball") {
    initialSport = qSport;
    const list = qSport === "soccer" ? data.soccer : data.baseball;
    initialLeague = qLeague && list.some((l) => l.id === qLeague) ? qLeague : list[0]?.id ?? "";
  } else if (qLeague) {
    if (data.soccer.some((l) => l.id === qLeague)) {
      initialSport = "soccer";
      initialLeague = qLeague;
    } else if (data.baseball.some((l) => l.id === qLeague)) {
      initialSport = "baseball";
      initialLeague = qLeague;
    }
  }

  return (
    <main className="min-h-screen text-gray-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STANDINGS_INDEX_JSONLD) }}
      />
      <div className="mx-auto max-w-2xl px-3 pb-8 text-[14px] sm:px-4 sm:pb-12">
        <SiteHeader />

        <div className="mt-4 sm:mt-6 mb-3 sm:mb-4 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-center">
          <p className="text-[11px] sm:text-xs text-zinc-400">이 포스팅은 쿠팡 파트너스 활동의 일환으로,<br className="sm:hidden" /> 이에 따른 일정액의 수수료를 제공받습니다.</p>
        </div>

        <AdfitBanner />

        <div className="mt-4 sm:mt-6">
          <StandingsView
            data={data}
            initialSport={initialSport}
            initialLeague={initialLeague}
            teamLinks={teamLinks}
          />
        </div>

        <p className="mt-6 text-xs text-zinc-400">
          데이터 출처: 네이버 스포츠 · 갱신:{" "}
          {new Date(data.lastUpdated).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (KST)
        </p>

        {/* 리그별 순위 진입 카드 — SEO 내부 링크 + 별도 접근 경로 */}
        <section className="mt-8 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-white sm:text-lg">리그별 순위 바로가기</h2>
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
            각 리그의 상세 순위표·진출권·연속 결과를 별도 페이지에서 확인하세요.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STANDINGS_LEAGUES.map((l) => (
              <Link
                key={l.slug}
                href={`/standings/${l.slug}`}
                className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white sm:text-sm"
              >
                {l.display} 순위 →
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
