import type { Metadata } from "next";
import Link from "next/link";
import { loadAsianGames } from "@/lib/server-data";
import { getTodayString } from "@/lib/schedule-utils";
import { SportNav } from "../_components/SportNav";
import { AG_SPORTS, koreanPlayersOf, type AgGame } from "@/lib/asian-games/data";

/**
 * 2026 아시안게임 대한민국 선수단 — 종목별 선수 이름.
 *
 * 🔴 왜 만들었나(2026-09-21 검색광고 실측, 월간): 아시안게임선수단 2,000 · 김도영아시안게임 8,920 ·
 * 안세영아시안게임 2,790 · 우상혁아시안게임 340 · 김연경아시안게임 180 · 문동주아시안게임 160 …
 * 사람들은 종목보다 **선수 이름**으로 찾는다. 이름이 페이지에 없으면 그 검색의 후보조차 못 된다.
 *
 * 🔴 이름을 손으로 적지 않는다. 네이버 대회 데이터의 `koreanPlayers` 를 매시 크롤이 받아 오고
 * (`crawl-asian-games.ts`), 경기에 선수가 배정되는 대로 이 페이지가 저절로 늘어난다.
 * 12개 종목 페이지에 없는 종목(육상·펜싱·사격…)의 선수도 여기서는 전부 나온다.
 *
 * 🔴 날짜 의존 페이지 — `revalidate` 정책 정본은 `src/app/page.tsx` 주석. 배포 주기와 같다.
 */
export const revalidate = 21600;

const URL = "https://haeseol.com/asian-games/players";
const TITLE = "아시안게임 한국 선수단 명단 — 2026 나고야 종목별 선수 | 한해설";
const DESC =
  "2026 나고야 아시안게임 대한민국 선수단 명단. 야구·축구·배드민턴·탁구·수영·골프 등 종목별 한국 대표 선수와 경기 일정을 한곳에서 확인하세요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "아시안게임 선수단",
    "아시안게임 한국 선수단",
    "아시안게임 한국 선수",
    "아시안게임 국가대표 명단",
    "아시안게임 대표팀 명단",
    "나고야 아시안게임 선수",
    "2026 아시안게임 한국 대표",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: URL,
    siteName: "한해설",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "https://haeseol.com/og-asian-games.jpg", width: 1200, height: 630, alt: "2026 나고야 아시안게임 한국 선수단" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["https://haeseol.com/og-asian-games.jpg"] },
};

/** 네이버 세부 종목명 → 우리 종목 페이지. 없으면 링크를 걸지 않는다. */
function slugOf(discipline: string): string | undefined {
  return AG_SPORTS.find((s) => s.disciplines.includes(discipline))?.slug;
}

export default function AsianGamesPlayersPage() {
  const today = getTodayString();
  const data = loadAsianGames();
  const games: AgGame[] = data?.koreaGames ?? [];

  const byDiscipline = new Map<string, AgGame[]>();
  for (const g of games) {
    if (!g.players?.length) continue;
    const k = g.discipline.replace(/\s+/g, " ").trim();
    if (!byDiscipline.has(k)) byDiscipline.set(k, []);
    byDiscipline.get(k)!.push(g);
  }
  const groups = [...byDiscipline.entries()]
    .map(([discipline, gs]) => ({ discipline, players: koreanPlayersOf(gs), slug: slugOf(discipline) }))
    .sort((a, b) => b.players.length - a.players.length);
  const total = koreanPlayersOf(games).length;

  const lead =
    total > 0
      ? `${today} 기준 네이버 대회 데이터에 오른 2026 나고야 아시안게임 대한민국 선수는 ${groups.length}개 종목 ${total}명입니다. 경기에 선수가 배정되는 대로 이 명단이 늘어납니다.`
      : `${today} 기준 선수 배정 정보가 아직 없습니다. 네이버 대회 데이터에 선수가 오르면 이 자리에 종목별로 나옵니다.`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "한해설", item: "https://haeseol.com" },
        { "@type": "ListItem", position: 2, name: "아시안게임", item: "https://haeseol.com/asian-games" },
        { "@type": "ListItem", position: 3, name: "한국 선수단 명단", item: URL },
      ],
    },
  ];

  return (
    <main className="relative mx-auto min-h-screen max-w-[1100px] px-5 pb-12 sm:px-6 sm:pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="경로" className="mt-4 text-caption1 text-fg-tertiary sm:mt-6">
        <Link href="/asian-games" className="relative underline underline-offset-2 after:absolute after:-inset-y-2 after:content-[''] hover:text-fg-strong">
          아시안게임
        </Link>
        {" › "}선수단
      </nav>

      <div className="mb-5 mt-2">
        <h1 className="text-heading1 font-bold text-fg-strong sm:text-title3">2026 나고야 아시안게임 대한민국 선수단 명단</h1>
        <p className="mt-2 text-label1 leading-relaxed text-fg-strong">{lead}</p>
      </div>

      <SportNav current="players" />

      {groups.map((gr) => (
        <section key={gr.discipline} className="mb-4 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
          <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">
            아시안게임 {gr.discipline} 한국 선수{" "}
            <span className="whitespace-nowrap text-label1 font-normal text-fg-tertiary">({gr.players.length}명)</span>
          </h2>
          <p className="mt-2 text-label1 leading-relaxed text-fg break-keep">{gr.players.join(" · ")}</p>
          {gr.slug && (
            <Link
              href={`/asian-games/${gr.slug}`}
              className="relative mt-2 inline-block text-label1 text-fg underline underline-offset-2 after:absolute after:-inset-y-2 after:content-[''] hover:text-fg-strong"
            >
              {gr.discipline} 경기 일정·결과
            </Link>
          )}
        </section>
      ))}
    </main>
  );
}
