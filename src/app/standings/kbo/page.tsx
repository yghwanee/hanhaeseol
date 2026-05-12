import type { Metadata } from "next";
import Link from "next/link";
import standingsData from "@/data/standings.json";
import type { StandingsData } from "@/types/standings";
import { KboTable } from "../_components/KboTable";

const data = standingsData as StandingsData;

export const metadata: Metadata = {
  title: "KBO 순위 - 한국 프로야구 팀 순위표 | 한해설",
  description:
    "2026 KBO 리그 팀 순위. 승률·게임차·연속 결과를 한눈에. 한국어 해설 중계 편성표와 함께 확인하세요.",
  keywords: [
    "KBO 순위",
    "KBO 리그 순위",
    "프로야구 순위",
    "KBO 팀 순위",
    "KBO 승률",
    "프로야구 순위표",
    "KBO 게임차",
    "KBO 일정",
  ],
  alternates: { canonical: "https://haeseol.com/standings/kbo" },
  openGraph: {
    title: "KBO 순위 - 한해설",
    description: "KBO 리그 팀 순위·승률·게임차·연속 결과를 한눈에.",
    url: "https://haeseol.com/standings/kbo",
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
    title: "KBO 순위 - 한해설",
    description: "KBO 리그 팀 순위를 한눈에.",
    images: ["https://haeseol.com/og-default.png"],
  },
};

export default function KboStandingsPage() {
  const kbo = data.kbo;
  if (!kbo || kbo.teams.length === 0) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-zinc-100">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-zinc-400">KBO 순위 데이터를 불러오지 못했습니다.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <header className="mb-6">
          <nav className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/" className="transition-colors hover:text-zinc-300">
              한해설
            </Link>
            <span>›</span>
            <Link href="/standings" className="transition-colors hover:text-zinc-300">
              순위
            </Link>
            <span>›</span>
            <span className="text-zinc-400">KBO</span>
          </nav>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                KBO 순위
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                한국 프로야구 2026 시즌 · {kbo.teams.length}개 팀
              </p>
            </div>
            <Link
              href="/?sport=야구"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm font-semibold text-emerald-400 transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/10"
            >
              KBO 중계 편성표 →
            </Link>
          </div>
        </header>

        <KboTable teams={kbo.teams} />

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
