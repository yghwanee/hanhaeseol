import type { Metadata } from "next";
import Link from "next/link";
import standingsData from "@/data/standings.json";
import type { StandingsData } from "@/types/standings";

const data = standingsData as StandingsData;

export const metadata: Metadata = {
  title: "EPL · KBO 순위 - 한해설",
  description:
    "프리미어리그(EPL)와 KBO 리그의 실시간 팀 순위표. 승률·게임차·승점·득실차·연속 결과까지 한눈에. 한국어 해설 중계 편성표와 함께 확인하세요.",
  alternates: { canonical: "https://haeseol.com/standings" },
  openGraph: {
    title: "EPL · KBO 순위 - 한해설",
    description:
      "프리미어리그·KBO 팀 순위를 한눈에. 한국어 해설 중계 편성표와 함께.",
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
      teams: data.epl?.teams.length ?? 0,
      leader: data.epl?.teams[0]?.teamName,
      sport: "축구",
    },
    {
      key: "kbo",
      title: "KBO 리그",
      sub: "한국 프로야구 · 10팀",
      href: "/standings/kbo",
      teams: data.kbo?.teams.length ?? 0,
      leader: data.kbo?.teams[0]?.teamName,
      sport: "야구",
    },
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <header className="mb-8">
          <Link
            href="/"
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            ← 한해설 메인
          </Link>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            팀 순위
          </h1>
          <p className="mt-2 text-zinc-400">
            네이버 스포츠 기준 실시간 순위. 한국어 해설 중계 일정과 함께 확인하세요.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <Link
              key={c.key}
              href={c.href}
              className="group block rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-5 transition-all hover:border-zinc-600/80 hover:bg-zinc-900/70"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                  {c.sport}
                </span>
                <span className="text-xs text-zinc-500 transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </div>
              <h2 className="mt-4 text-xl font-bold text-white">{c.title}</h2>
              <p className="mt-1 text-sm text-zinc-500">{c.sub}</p>
              {c.leader && (
                <p className="mt-4 text-sm text-zinc-400">
                  <span className="text-zinc-500">현재 1위 · </span>
                  <span className="font-semibold text-zinc-100">{c.leader}</span>
                </p>
              )}
            </Link>
          ))}
        </div>

        <p className="mt-8 text-xs text-zinc-600">
          데이터 갱신: {new Date(data.lastUpdated).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (KST)
        </p>
      </div>
    </main>
  );
}
