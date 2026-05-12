import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import standingsData from "@/data/standings.json";
import type { StandingsData } from "@/types/standings";
import { StickyHeader } from "../_components/StickyHeader";
import { StandingsView } from "./_components/StandingsView";

const data = standingsData as unknown as StandingsData;

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
    "챔피언스리그 순위",
    "유로파리그 순위",
    "MLS 순위",
    "K리그 순위",
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

export default function StandingsPage() {
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

        <div className="mt-4 sm:mt-6">
          <StandingsView data={data} />
        </div>

        <p className="mt-6 text-xs text-zinc-600">
          데이터 출처: 네이버 스포츠 · 갱신:{" "}
          {new Date(data.lastUpdated).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (KST)
        </p>
      </div>
    </main>
  );
}
