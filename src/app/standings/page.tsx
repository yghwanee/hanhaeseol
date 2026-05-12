import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import standingsData from "@/data/standings.json";
import type { StandingsData } from "@/types/standings";
import { StickyHeader } from "../_components/StickyHeader";

const data = standingsData as StandingsData;

export const metadata: Metadata = {
  title: "EPL · KBO 순위 - 한해설",
  description:
    "프리미어리그(EPL)와 KBO 리그의 실시간 팀 순위표. 승률·게임차·승점·득실차·연속 결과까지 한눈에. 한국어 해설 중계 편성표와 함께 확인하세요.",
  alternates: { canonical: "https://haeseol.com/standings" },
  openGraph: {
    title: "EPL · KBO 순위 - 한해설",
    description: "프리미어리그·KBO 팀 순위를 한눈에. 한국어 해설 중계 편성표와 함께.",
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
    title: "EPL · KBO 순위 - 한해설",
    description: "프리미어리그·KBO 팀 순위를 한눈에.",
    images: ["https://haeseol.com/og-default.png"],
  },
};

export default function StandingsLandingPage() {
  const cards = [
    {
      key: "epl",
      title: "프리미어리그 (EPL)",
      sub: "잉글랜드 1부 · 20팀",
      href: "/standings/epl",
      leader: data.epl?.teams[0]?.teamName,
      sport: "축구",
    },
    {
      key: "kbo",
      title: "KBO 리그",
      sub: "한국 프로야구 · 10팀",
      href: "/standings/kbo",
      leader: data.kbo?.teams[0]?.teamName,
      sport: "야구",
    },
  ];

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

        <h1 className="mb-2 mt-4 text-2xl font-bold sm:mt-6 sm:text-3xl">팀 순위</h1>
        <p className="mb-6 text-zinc-400 sm:mb-8">
          네이버 스포츠 기준 실시간 순위. 한국어 해설 중계 일정과 함께 확인하세요.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {cards.map((c) => (
            <Link
              key={c.key}
              href={c.href}
              className="group block rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4 transition-all hover:border-zinc-600/80 hover:bg-zinc-900/70 sm:p-5"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                  {c.sport}
                </span>
                <span className="text-xs text-zinc-500 transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </div>
              <h2 className="mt-3 text-lg font-bold text-white sm:mt-4 sm:text-xl">{c.title}</h2>
              <p className="mt-1 text-sm text-zinc-500">{c.sub}</p>
              {c.leader && (
                <p className="mt-3 text-sm text-zinc-400 sm:mt-4">
                  <span className="text-zinc-500">현재 1위 · </span>
                  <span className="font-semibold text-zinc-100">{c.leader}</span>
                </p>
              )}
            </Link>
          ))}
        </div>

        <p className="mt-6 text-xs text-zinc-600">
          데이터 갱신:{" "}
          {new Date(data.lastUpdated).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (KST)
        </p>
      </div>
    </main>
  );
}
