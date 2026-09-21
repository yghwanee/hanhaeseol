import type { Metadata } from "next";
import Link from "next/link";
import { loadAsianGames, loadScheduleData } from "@/lib/server-data";
import { getTodayString } from "@/lib/schedule-utils";
import { AsianGamesBanner } from "@/app/_components/AsianGamesBanner";
import { AsianGamesLive } from "./_components/AsianGamesLive";
import { SportNav } from "./_components/SportNav";
import {
  AG_CLOSE,
  AG_OPEN,
  agPhase,
  broadcastKey,
  isAgScheduleLeague,
  daysToOpen,
  medalsStarted,
} from "@/lib/asian-games/data";

// 다른 허브와 같다. 데이터는 배포 번들 안에 있고 최신값은 브라우저가 GitHub raw 에서 받는다.
// 🔴 날짜 의존 허브 — `revalidate` 정책 정본은 `src/app/page.tsx` 주석. 값은 배포 주기(6h)와 같다.
export const revalidate = 21600;

const URL = "https://haeseol.com/asian-games";
// 🔴 `나고야아시안게임` 이 월 725,500 이다(2026-09-21 검색광고 실측). 제목에 `나고야` 를 넣는다.
const TITLE = "2026 나고야 아시안게임 한국 경기 일정·메달 순위 | 한해설";
const DESC =
  "2026 아이치·나고야 아시안게임(9월 19일~10월 4일) 대한민국 전 종목 경기 일정과 메달, 국가별 메달 순위를 한곳에서. 한국 경기 한국어 해설 중계 여부도 함께 확인하세요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "나고야 아시안게임",
    "아시안게임 축구",
    "아시안게임 롤",
    "아시안게임 한국 경기 일정",
    "아시안게임 한국 일정",
    "아시안게임 메달 순위",
    "아시안게임 메달",
    "아시안게임 중계",
    "2026 아시안게임",
    "아시안게임 축구 한국",
    "아시안게임 배구 한국",
    "아시안게임 한국어 해설",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: URL,
    siteName: "한해설",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "https://haeseol.com/og-asian-games.jpg", width: 1200, height: 630, alt: "2026 아이치·나고야 아시안게임 한국 경기 일정" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: ["https://haeseol.com/og-asian-games.jpg"],
  },
};

const FAQS = [
  {
    q: "2026 아시안게임은 언제, 어디서 열리나요?",
    a: "2026년 9월 19일 개막해 10월 4일까지 일본 아이치현 나고야를 중심으로 열립니다. 농구·여자축구 등 일부 종목 예선은 개막 전인 9월 중순에 먼저 시작합니다.",
  },
  {
    q: "아시안게임 한국 경기는 어디서 한국어 해설로 보나요?",
    a: "SPOTV NOW가 축구·야구·농구·배구 경기를 중계하며, 편성이 확인된 대한민국 경기에는 일정 옆에 중계 채널이 표시됩니다. 다른 나라 경기의 한국어 해설 중계는 한해설 메인 편성표에 날짜별로 나옵니다. 다른 종목과 지상파 중계 편성은 방송사 발표를 확인하세요.",
  },
  {
    q: "메달 순위는 어떤 기준으로 매기나요?",
    a: "금메달 수가 많은 순서로 매기고, 같으면 은메달, 그다음 동메달 수로 가릅니다. 세 가지가 모두 같으면 공동 순위입니다. 메달 집계는 네이버 스포츠 대회 데이터를 기준으로 합니다.",
  },
];

function answerLead(today: string, koreaGamesToday: number, data: ReturnType<typeof loadAsianGames>): string {
  const phase = agPhase(today);
  const base = `${today} 기준`;
  if (!data) return `${base} 2026 아이치·나고야 아시안게임은 ${AG_OPEN} 개막해 ${AG_CLOSE} 폐막합니다.`;
  const kor = data.korea;
  const medalPart =
    kor && medalsStarted(data.medals)
      ? `대한민국은 금 ${kor.gold}·은 ${kor.silver}·동 ${kor.bronze}(합계 ${kor.total})로 종합 ${kor.rank}위입니다.`
      : "아직 메달이 나오지 않았습니다.";
  const when =
    phase === "before" || phase === "prelim"
      ? `아시안게임 개막까지 ${daysToOpen(today)}일 남았고`
      : phase === "live"
        ? "아시안게임이 열리고 있고"
        : "아시안게임이 끝났고";
  return `${base} ${when} ${medalPart} 대회 기간 대한민국 경기는 ${data.koreaGames.length}건이며 오늘 경기는 ${koreaGamesToday}건입니다.`;
}

export default function AsianGamesPage() {
  const today = getTodayString();
  const data = loadAsianGames();

  // 한국 경기에 붙일 중계 채널. SPOTV NOW 편성(`schedule.json`)에서 대한민국이 뛰는 행만.
  // 다른 나라 경기의 한국어 해설 중계는 메인 편성표가 이미 보여 주므로 여기선 안 다룬다.
  const broadcasts: Record<string, string[]> = {};
  for (const s of loadScheduleData().schedules) {
    if (!isAgScheduleLeague(s.league)) continue;
    if (s.homeTeam !== "대한민국" && s.awayTeam !== "대한민국") continue;
    const label = s.koreanCommentary === true ? `${s.platform} 한국어해설` : s.platform;
    const key = broadcastKey(s.date, s.homeTeam, s.awayTeam);
    broadcasts[key] = [...new Set([...(broadcasts[key] ?? []), label])];
  }

  const koreaGamesToday = data?.koreaGames.filter((g) => g.date === today).length ?? 0;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: "2026 아이치·나고야 아시안게임",
      startDate: AG_OPEN,
      endDate: AG_CLOSE,
      eventStatus: "https://schema.org/EventScheduled",
      location: { "@type": "Place", name: "일본 아이치현 나고야", address: { "@type": "PostalAddress", addressCountry: "JP" } },
      url: URL,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "한해설", item: "https://haeseol.com" },
        { "@type": "ListItem", position: 2, name: "아시안게임 한국 경기 일정·메달 순위", item: URL },
      ],
    },
  ];

  return (
    <main className="relative mx-auto min-h-screen max-w-[1100px] px-5 pb-12 sm:px-6 sm:pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mt-4 sm:mt-6">
        <AsianGamesBanner today={today} href="#today" />
      </div>

      <div className="mb-6">
        <h1 className="text-heading1 font-bold text-fg-strong sm:text-title3">2026 나고야 아시안게임 한국 경기 일정·메달 순위</h1>
        <p className="mt-2 text-label1 leading-relaxed text-fg-strong">{answerLead(today, koreaGamesToday, data)}</p>
        <p className="mt-1.5 text-label1 leading-relaxed text-fg-secondary">
          아이치·나고야 아시안게임({AG_OPEN} ~ {AG_CLOSE}) 대한민국 전 종목 경기 일정과 메달, 국가별 메달 순위를 모았습니다. 다른 나라 경기의 한국어 해설 중계는{" "}
          <Link href="/" className="-my-2 inline-block py-2 text-fg underline underline-offset-2 hover:text-fg-strong">메인 편성표</Link>에서 볼 수 있습니다.
        </p>
      </div>

      {/* 종목별 전 경기 페이지로 가는 유일한 길(「아시안게임 축구 일정」「롤 일정」 착지 페이지). */}
      <SportNav />

      <div id="korea">
        {data ? (
          <AsianGamesLive initial={data} today={today} broadcasts={broadcasts} />
        ) : (
          <p className="mb-6 rounded-xl border border-line-subtle p-4 text-label1 text-fg-secondary">경기 일정과 메달 데이터를 준비 중입니다.</p>
        )}
      </div>

      <section className="mb-8 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
        <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">아시안게임 자주 묻는 질문</h2>
        <dl className="mt-3 space-y-4">
          {FAQS.map((f) => (
            <div key={f.q}>
              <dt className="text-label1 font-semibold text-fg-strong">{f.q}</dt>
              <dd className="mt-1 text-label1 leading-relaxed text-fg-secondary">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
