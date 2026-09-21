import type { Metadata } from "next";
import Link from "next/link";
import { loadScheduleData } from "@/lib/server-data";
import { getTodayString } from "@/lib/schedule-utils";
import { SportNav } from "../_components/SportNav";
import { AG_CLOSE, AG_OPEN, fmtAgDate, isAgScheduleLeague } from "@/lib/asian-games/data";
import { withJosa } from "@/lib/josa";
import type { Schedule } from "@/types/schedule";

/**
 * 아시안게임 중계 채널 — 「아시안게임 중계」 월 34,710(2026-09-21 검색광고 실측).
 *
 * 🔴 **확인된 편성만 적는다.** 지상파(KBS·MBC·SBS) 중계권은 우리가 크롤하는 편성에
 * 안 들어오고, 교차확인 전이라 적지 않는다(작업116 에서도 같은 이유로 비워 뒀다).
 * 없는 편성을 "어디서 한다"고 쓰면 그 순간 이 페이지가 오답이 된다.
 *
 * 🔴 날짜 의존 페이지 — `revalidate` 정책 정본은 `src/app/page.tsx` 주석. 배포 주기와 같다.
 */
export const revalidate = 21600;

const URL = "https://haeseol.com/asian-games/broadcast";
const TITLE = "아시안게임 중계 채널·편성표 — 2026 나고야 | 한해설";
const DESC =
  "2026 나고야 아시안게임 중계 편성표. 대한민국 축구·야구·농구·배구 경기를 어느 채널에서 한국어 해설로 중계하는지 날짜별로 확인하세요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "아시안게임 중계",
    "아시안게임 중계 채널",
    "아시안게임 생중계",
    "아시안게임 온라인 중계",
    "아시안게임 축구 중계",
    "나고야 아시안게임 중계",
    "아시안게임 편성표",
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
    images: [{ url: "https://haeseol.com/og-asian-games.jpg", width: 1200, height: 630, alt: "2026 나고야 아시안게임 중계 편성표" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["https://haeseol.com/og-asian-games.jpg"] },
};

function rows(): Schedule[] {
  return loadScheduleData()
    .schedules.filter((s) => isAgScheduleLeague(s.league))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export default function AsianGamesBroadcastPage() {
  const today = getTodayString();
  const all = rows();
  const upcoming = all.filter((s) => s.date >= today);
  const byPlatform = new Map<string, number>();
  for (const s of all) byPlatform.set(s.platform, (byPlatform.get(s.platform) ?? 0) + 1);
  const platforms = [...byPlatform.entries()].sort((a, b) => b[1] - a[1]);
  const koCount = all.filter((s) => s.koreanCommentary === true).length;

  const lead =
    all.length > 0
      ? `${today} 기준 한해설이 수집한 2026 나고야 아시안게임 중계 편성은 ${all.length}경기이고, 그중 한국어 해설이 확인된 경기는 ${koCount}경기입니다. 편성을 준 곳은 ${platforms
          .map(([p, n]) => `${p} ${n}경기`)
          .join(", ")}입니다.`
      : `${today} 기준 확인된 아시안게임 중계 편성이 없습니다. 편성이 확인되면 이 자리에 날짜별로 올라옵니다.`;

  const faqs = [
    {
      q: "아시안게임 중계는 어디서 보나요?",
      a:
        platforms.length > 0
          ? `${today} 기준 한해설이 확인한 편성은 ${platforms.map(([p, n]) => `${p} ${n}경기`).join(", ")}입니다. 경기마다 한국어 해설 여부가 목록에 함께 표시됩니다. 지상파 중계 편성은 각 방송사 발표를 확인하세요.`
          : "확인된 편성이 아직 없습니다. 편성이 확인되면 이 페이지에 날짜별로 올라옵니다. 지상파 중계 편성은 각 방송사 발표를 확인하세요.",
    },
    {
      q: "아시안게임 축구·야구 경기 시간은 언제인가요?",
      a: `대회는 ${AG_OPEN} 개막해 ${AG_CLOSE}까지 열리고, 축구·농구 등 일부 종목은 개막 전에 예선을 먼저 시작했습니다. 종목별 경기 시간은 한해설의 종목별 일정 페이지에서 한국 시각으로 확인할 수 있습니다.`,
    },
    {
      q: "한국어 해설이 있는 경기만 볼 수 있나요?",
      a: "한해설은 경기마다 [한국어해설]·[현지해설]·[확인중] 뱃지를 붙입니다. 메인 편성표 상단 필터에서 '한국어해설만'을 고르면 한국어 해설 중계만 모아 볼 수 있습니다.",
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "한해설", item: "https://haeseol.com" },
        { "@type": "ListItem", position: 2, name: "아시안게임", item: "https://haeseol.com/asian-games" },
        { "@type": "ListItem", position: 3, name: "아시안게임 중계 채널", item: URL },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <main className="relative mx-auto min-h-screen max-w-[1100px] px-5 pb-12 sm:px-6 sm:pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="경로" className="mt-4 text-caption1 text-fg-tertiary sm:mt-6">
        <Link href="/asian-games" className="relative underline underline-offset-2 after:absolute after:-inset-y-2 after:content-[''] hover:text-fg-strong">
          아시안게임
        </Link>
        {" › "}
        중계 채널
      </nav>

      <div className="mb-5 mt-2">
        <h1 className="text-heading1 font-bold text-fg-strong sm:text-title3">2026 나고야 아시안게임 중계 채널·편성표</h1>
        <p className="mt-2 text-label1 leading-relaxed text-fg-strong">{lead}</p>
        <p className="mt-1.5 text-label1 leading-relaxed text-fg-secondary">
          경기 시간은 모두 한국 시각입니다. 종목별 전 경기 일정은 아래 종목 버튼에서, 대한민국 메달과 전 종목 한국 경기는{" "}
          <Link href="/asian-games" className="relative text-fg underline underline-offset-2 after:absolute after:-inset-y-2 after:content-[''] hover:text-fg-strong">
            아시안게임 허브
          </Link>
          에서 볼 수 있습니다.
        </p>
      </div>

      <SportNav current="broadcast" />

      <section className="mb-6 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
        <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">
          앞으로의 중계 편성{" "}
          <span className="whitespace-nowrap text-label1 font-normal text-fg-tertiary">({upcoming.length}경기)</span>
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-label1 text-fg-secondary">
            앞으로 확인된 중계 편성이 없습니다. 편성사가 일정을 올리면 자동으로 이 자리에 나옵니다.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {upcoming.map((s) => (
              <li key={`${s.date}${s.time}${s.homeTeam}${s.awayTeam}${s.platform}`} className="rounded-lg bg-subtle px-3 py-2 text-label1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="shrink-0 tabular-nums text-fg-secondary">
                    {fmtAgDate(s.date)} {s.time}
                  </span>
                  <span className="shrink-0 text-fg">{s.sport}</span>
                  <span className="min-w-0 flex-1 text-fg-strong">
                    {s.homeTeam} vs {s.awayTeam}
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-caption2 font-semibold text-fg">{s.platform}</span>
                  {s.koreanCommentary === true && (
                    <span className="shrink-0 rounded-full bg-brand-subtle px-2 py-0.5 text-caption2 font-semibold text-fg-brand-bright">
                      한국어해설
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
        <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">중계 채널별 경기 수</h2>
        {platforms.length === 0 ? (
          <p className="mt-2 text-label1 text-fg-secondary">확인된 채널이 없습니다.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {platforms.map(([p, n]) => (
              <li key={p} className="rounded-full border border-line px-3 py-1.5 text-label1 text-fg">
                {p} <span className="tabular-nums text-fg-secondary">{n}경기</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-caption1 leading-relaxed text-fg-tertiary">
          한해설은 OTT·스포츠 채널이 공개한 편성만 수집합니다. 지상파 중계는 방송사 발표를 확인하세요.
        </p>
      </section>

      <section className="mb-8 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
        <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">아시안게임 중계 자주 묻는 질문</h2>
        <dl className="mt-3 space-y-4">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="text-label1 font-semibold text-fg-strong">{f.q}</dt>
              <dd className="mt-1 text-label1 leading-relaxed text-fg-secondary">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-label1 text-fg-secondary">
          다른 나라 경기의 한국어 해설 중계까지 보려면{" "}
          <Link href="/" className="relative text-fg underline underline-offset-2 after:absolute after:-inset-y-2 after:content-[''] hover:text-fg-strong">
            {withJosa("메인 편성표", "을/를")}
          </Link>{" "}
          확인하세요.
        </p>
      </section>
    </main>
  );
}
