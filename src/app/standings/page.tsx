import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import standingsData from "@/data/standings.json";
import type { StandingsData } from "@/types/standings";
import { StickyHeader } from "../_components/StickyHeader";
import { StandingsView } from "./_components/StandingsView";
import { STANDINGS_LEAGUES } from "@/lib/standings-seo";

const data = standingsData as unknown as StandingsData;

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
        <StickyHeader>
          <header className="flex items-center justify-between">
            <Link href="/" className="flex items-end">
              <Image
                src="/icon.png"
                alt="한해설 아이콘"
                width={32}
                height={32}
                className="h-6 w-6 self-center sm:h-8 sm:w-8"
              />
              <span className="ml-1 text-xl font-bold text-white sm:ml-2 sm:text-3xl">한해설</span>
              <span className="ml-2 text-sm font-normal text-zinc-500 sm:ml-3 sm:text-lg">
                한국어중계 편성표
              </span>
            </Link>
            <Link
              href="/"
              className="whitespace-nowrap rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white sm:px-4 sm:py-1.5 sm:text-sm"
            >
              ← &ensp;편성표
            </Link>
          </header>
        </StickyHeader>

        <div className="mt-4 sm:mt-6">
          <StandingsView data={data} initialSport={initialSport} initialLeague={initialLeague} />
        </div>

        <p className="mt-6 text-xs text-zinc-600">
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
