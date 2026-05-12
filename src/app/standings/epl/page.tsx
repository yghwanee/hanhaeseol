import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import standingsData from "@/data/standings.json";
import type { StandingsData } from "@/types/standings";
import { SoccerTable } from "../_components/SoccerTable";
import { StickyHeader } from "../../_components/StickyHeader";

const data = standingsData as unknown as StandingsData;

export const metadata: Metadata = {
  title: "EPL 순위 - 프리미어리그 팀 순위표 | 한해설",
  description:
    "2025-26 잉글랜드 프리미어리그(EPL) 팀 순위. 승점·득실차·연속 결과·챔피언스리그 진출권까지 한눈에. 한국어 해설 중계 편성표와 함께.",
  keywords: [
    "EPL 순위",
    "프리미어리그 순위",
    "EPL 팀 순위",
    "잉글랜드 프리미어리그 순위표",
    "EPL 승점",
    "EPL 일정",
    "프리미어리그 일정",
  ],
  alternates: { canonical: "https://haeseol.com/standings/epl" },
  openGraph: {
    title: "EPL 순위 - 한해설",
    description: "프리미어리그 팀 순위·승점·득실·연속 결과를 한눈에.",
    url: "https://haeseol.com/standings/epl",
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
    title: "EPL 순위 - 한해설",
    description: "프리미어리그 팀 순위를 한눈에.",
    images: ["https://haeseol.com/og-default.png"],
  },
};

export default function EplStandingsPage() {
  const epl = data.soccer.find((l) => l.id === "epl") ?? null;

  return (
    <main className="min-h-screen text-gray-100">
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

        <nav className="mt-4 flex items-center gap-2 text-xs text-zinc-500 sm:mt-6">
          <Link href="/standings" className="transition-colors hover:text-zinc-300">
            순위
          </Link>
          <span>›</span>
          <span className="text-zinc-400">EPL</span>
        </nav>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">EPL 순위</h1>
            <p className="mt-1 text-sm text-zinc-500">
              프리미어리그 2025-26 시즌 · {epl?.teams.length ?? 0}개 팀
            </p>
          </div>
          <Link
            href="/league/epl"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm font-semibold text-emerald-400 transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/10"
          >
            한국어 해설 EPL 편성표 →
          </Link>
        </div>

        <div className="mt-6">
          {!epl || epl.teams.length === 0 ? (
            <p className="text-zinc-400">EPL 순위 데이터를 불러오지 못했습니다.</p>
          ) : (
            <SoccerTable teams={epl.teams} />
          )}
        </div>

        <p className="mt-4 text-xs text-zinc-600">
          데이터 출처: 네이버 스포츠 · 갱신:{" "}
          {new Date(data.lastUpdated).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (KST)
        </p>

        <p className="mt-3 text-xs text-zinc-500 sm:hidden">
          💡 컬럼 헤더를 탭하면 정렬됩니다.
        </p>
      </div>
    </main>
  );
}
