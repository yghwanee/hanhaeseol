import type { Metadata } from "next";
import Link from "next/link";
import { loadAsianGames, loadScheduleData } from "@/lib/server-data";
import { getTodayString } from "@/lib/schedule-utils";
import { SiteHeader } from "@/app/_components/SiteHeader";
import { AsianGamesBanner } from "@/app/_components/AsianGamesBanner";
import { AsianGamesLive } from "./_components/AsianGamesLive";
import {
  AG_CLOSE,
  AG_LEAGUE,
  AG_OPEN,
  agPhase,
  daysToOpen,
  medalsStarted,
} from "@/lib/asian-games/data";
import type { Schedule } from "@/types/schedule";

// 다른 허브와 같다. 데이터는 배포 번들 안에 있고 최신값은 브라우저가 GitHub raw 에서 받는다.
export const revalidate = 3600;

const URL = "https://haeseol.com/asian-games";
const TITLE = "아시안게임 메달 순위·한국 경기 일정·중계 | 한해설";
const DESC =
  "2026 아이치·나고야 아시안게임(9월 19일~10월 4일) 국가별 메달 순위와 대한민국 메달, 한국 경기 일정, SPOTV NOW 한국어 해설 중계 편성을 한곳에서 확인하세요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "아시안게임 메달 순위",
    "아시안게임 메달",
    "아시안게임 중계",
    "아시안게임 일정",
    "아시안게임 한국 경기",
    "나고야 아시안게임",
    "2026 아시안게임",
    "아시안게임 축구 중계",
    "아시안게임 배구 중계",
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
    images: [{ url: "https://haeseol.com/og-asian-games.jpg", width: 1200, height: 630, alt: "2026 아이치·나고야 아시안게임 메달 순위" }],
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
    q: "아시안게임 축구·배구·농구는 어디서 한국어 해설로 보나요?",
    a: "SPOTV NOW가 축구·배구·농구 경기를 중계하며, 대한민국 경기는 한국어 해설로 편성돼 있습니다. 경기별 채널과 시간은 이 페이지의 중계 편성표에서 확인할 수 있습니다. 다른 종목과 지상파 중계 편성은 방송사 발표를 확인하세요.",
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
  return `${base} ${when} ${medalPart} 오늘 대한민국 경기는 ${koreaGamesToday}건입니다.`;
}

export default function AsianGamesPage() {
  const today = getTodayString();
  const data = loadAsianGames();

  // SPOTV NOW 편성(`schedule.json`)에서 아시안게임 행만. 같은 경기가 채널마다 있으면 접는다.
  const seen = new Set<string>();
  const broadcasts: Schedule[] = loadScheduleData()
    .schedules.filter((s) => s.league === AG_LEAGUE && s.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .filter((s) => {
      const k = `${s.date}|${s.homeTeam}|${s.awayTeam}|${s.platform}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

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
        { "@type": "ListItem", position: 2, name: "아시안게임 메달 순위·중계", item: URL },
      ],
    },
  ];

  return (
    <main className="relative mx-auto min-h-screen max-w-2xl px-3 pb-8 sm:px-4 sm:pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <div className="mt-4 sm:mt-6">
        <AsianGamesBanner today={today} href="#medals" />
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-white sm:text-2xl">2026 아시안게임 메달 순위·한국 경기 중계</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-200">{answerLead(today, koreaGamesToday, data)}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
          아이치·나고야 아시안게임({AG_OPEN} ~ {AG_CLOSE})의 국가별 메달 순위, 대한민국 메달과 경기 일정, 한국어 해설 중계 편성을 모았습니다.
        </p>
      </div>

      <div id="medals">
        {data ? (
          <AsianGamesLive initial={data} today={today} />
        ) : (
          <p className="mb-6 rounded-xl border border-zinc-800 p-4 text-sm text-zinc-400">메달 데이터를 준비 중입니다.</p>
        )}
      </div>

      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-white sm:text-lg">한국어 해설 중계 편성 ({broadcasts.length}건)</h2>
        {broadcasts.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">앞으로 7일간 한해설이 수집한 아시안게임 중계 편성이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {broadcasts.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-lg bg-zinc-950/50 px-3 py-2 text-sm">
                <span className="w-24 shrink-0 tabular-nums text-zinc-400">
                  {Number(s.date.slice(5, 7))}/{Number(s.date.slice(8, 10))} {s.time}
                </span>
                <span className="w-9 shrink-0 text-zinc-300">{s.sport}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-100">
                  {s.homeTeam} vs {s.awayTeam}
                </span>
                <span className="shrink-0 text-xs text-zinc-400">{s.platform}</span>
                {s.koreanCommentary === true && (
                  <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">한국어해설</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          전체 편성은 <Link href="/" className="underline underline-offset-2 hover:text-zinc-300">한해설 편성표</Link>에서 날짜별로 볼 수 있습니다.
        </p>
      </section>

      <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-white sm:text-lg">아시안게임 자주 묻는 질문</h2>
        <dl className="mt-3 space-y-4">
          {FAQS.map((f) => (
            <div key={f.q}>
              <dt className="text-sm font-semibold text-zinc-100">{f.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-zinc-400">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
