import type { Metadata } from "next";
import Link from "next/link";
import { loadAsianGamesSport } from "@/lib/server-data";
import { getTodayString } from "@/lib/schedule-utils";
import { SportScheduleLive } from "../_components/SportScheduleLive";
import { SportNav } from "../_components/SportNav";
import {
  fmtAgDate,
  LOL_COACH,
  LOL_EVENT,
  LOL_KOREA_ROSTER,
  LOL_ROSTER_ANNOUNCED,
  type AgGame,
} from "@/lib/asian-games/data";

/**
 * 2026 아시안게임 롤(LoL) — 일정 + 대한민국 국가대표 명단.
 *
 * 🔴 왜 e스포츠 페이지와 따로 두나(2026-09-21 검색광고 실측, 월간):
 *   아시안게임롤 73,200 · 아시안게임롤일정 7,210 · 롤국가대표 6,820 · 아시안게임롤명단 3,830 ·
 *   아시안게임롤중계 2,100 · 페이커아시안게임 1,150 · 아시안게임페이커 1,080.
 * e스포츠 페이지는 11개 세부 종목을 다 담아 제목이 「롤 명단·페이커」를 못 싣는다. 그리고
 * **선수 이름이 페이지에 없으면 `아시안게임 페이커` 검색의 후보조차 못 된다** — 이름으로
 * 찾는 사람에게는 이름이 곧 착지 조건이다.
 *
 * 🔴 e스포츠 페이지(`/asian-games/esports`)는 이제 「e스포츠 종목·일정」 쪽을 받는다.
 * 두 페이지가 같은 `롤` 제목을 달면 서로 순위를 깎는다.
 *
 * 🔴 날짜 의존 페이지 — `revalidate` 정책 정본은 `src/app/page.tsx` 주석. 배포 주기와 같다.
 */
export const revalidate = 21600;

const URL = "https://haeseol.com/asian-games/lol";
const TITLE = "아시안게임 롤 일정·국가대표 명단 — 페이커 출전 | 한해설";
const DESC =
  "2026 나고야 아시안게임 롤(LoL) 경기 일정과 대한민국 국가대표 명단. 페이커·제우스·캐니언·제카·구마유시·케리아 6인, 조별 경기부터 10월 2일 금메달전까지 한국 시각으로 정리했습니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "아시안게임 롤",
    "아시안게임 롤 일정",
    "아시안게임 롤 명단",
    "아시안게임 롤 국가대표",
    "롤 국가대표",
    "아시안게임 페이커",
    "페이커 아시안게임",
    "아시안게임 롤 중계",
    "나고야 아시안게임 롤",
    "아시안게임 LoL",
    "아시안게임 리그 오브 레전드",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: URL,
    siteName: "한해설",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "https://haeseol.com/og-asian-games.jpg", width: 1200, height: 630, alt: "2026 나고야 아시안게임 롤 일정·국가대표 명단" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["https://haeseol.com/og-asian-games.jpg"] },
};

function hhmm(g: AgGame) {
  return `${fmtAgDate(g.date)} ${g.time}`;
}

export default function AsianGamesLolPage() {
  const today = getTodayString();
  const data = loadAsianGamesSport("esports");
  const games = (data?.games ?? [])
    .filter((g) => g.event === LOL_EVENT)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const first = games[0];
  const gold = games.find((g) => g.medal && g.title.includes("금메달"));
  const bronze = games.find((g) => g.medal && g.title.includes("동메달"));
  const semis = games.filter((g) => g.title.includes("준결승"));
  const koreaNext = games.find((g) => (g.home === "대한민국" || g.away === "대한민국") && g.status !== "RESULT" && g.date >= today);
  const names = LOL_KOREA_ROSTER.map((p) => `'${p.nick}' ${p.name}`).join(", ");

  const lead = first
    ? `${today} 기준 2026 나고야 아시안게임 롤(LoL)은 ${fmtAgDate(first.date)} 조별 경기로 시작해${
        semis[0] ? ` ${fmtAgDate(semis[0].date)} 준결승,` : ""
      }${gold ? ` ${hhmm(gold)} 금메달전` : ""}으로 끝나며 모두 ${games.length}경기입니다. 대한민국 대표팀은 페이커를 포함한 ${LOL_KOREA_ROSTER.length}명으로 꾸려졌습니다.${
        koreaNext ? ` 대한민국 다음 경기는 ${hhmm(koreaNext)} ${koreaNext.home === "대한민국" ? koreaNext.away : koreaNext.home}전입니다.` : ""
      }`
    : `${today} 기준 롤 경기 일정을 준비 중입니다. 대한민국 대표팀은 페이커를 포함한 ${LOL_KOREA_ROSTER.length}명입니다.`;

  const faqs = [
    {
      q: "페이커는 아시안게임에 나가나요?",
      a: `네. 한국e스포츠협회가 ${LOL_ROSTER_ANNOUNCED}에 발표한 2026 아시안게임 LoL 국가대표 명단에 '페이커' 이상혁(T1)이 들어 있습니다. 함께 뽑힌 선수는 ${LOL_KOREA_ROSTER.filter((p) => p.nick !== "페이커")
        .map((p) => `'${p.nick}' ${p.name}(${p.team})`)
        .join(", ")}입니다.`,
    },
    {
      q: "아시안게임 롤 국가대표 명단은?",
      a: `${LOL_ROSTER_ANNOUNCED} 발표 기준 ${names}의 ${LOL_KOREA_ROSTER.length}명이고 감독은 '${LOL_COACH.nick}' ${LOL_COACH.name}입니다. 선발전 없이 프로팀에서 선수를 차출하는 방식으로 꾸렸습니다.`,
    },
    {
      q: "아시안게임 롤 경기는 언제인가요?",
      a: first
        ? `조별 경기는 ${fmtAgDate(first.date)}부터 열리고${semis[0] ? `, 준결승은 ${hhmm(semis[0])}` : ""}${bronze ? `, 동메달전은 ${hhmm(bronze)}` : ""}${gold ? `, 금메달전은 ${hhmm(gold)}` : ""}(모두 한국 시각)입니다. 조 편성이 확정되면 경기 목록에 참가국이 표시됩니다.`
        : "경기 일정이 확정되면 이 페이지에 한국 시각으로 올라옵니다.",
    },
    {
      q: "아시안게임 롤 중계는 어디서 보나요?",
      a: `${today} 기준 한해설이 확인한 롤 중계 편성은 아직 없습니다. 편성이 확인되면 경기 목록 옆에 채널이 표시됩니다. 다른 종목의 중계 편성은 아시안게임 중계 채널 페이지에서 볼 수 있습니다.`,
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "한해설", item: "https://haeseol.com" },
        { "@type": "ListItem", position: 2, name: "아시안게임", item: "https://haeseol.com/asian-games" },
        { "@type": "ListItem", position: 3, name: "아시안게임 롤 일정·국가대표", item: URL },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "SportsTeam",
      name: "대한민국 LoL 국가대표",
      sport: "League of Legends",
      coach: { "@type": "Person", name: `${LOL_COACH.name} (${LOL_COACH.nick})` },
      athlete: LOL_KOREA_ROSTER.map((p) => ({
        "@type": "Person",
        name: `${p.name} (${p.nick})`,
        alternateName: p.nick,
        affiliation: { "@type": "SportsTeam", name: p.team },
      })),
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
        <Link href="/asian-games/esports" className="relative underline underline-offset-2 after:absolute after:-inset-y-2 after:content-[''] hover:text-fg-strong">
          e스포츠
        </Link>
        {" › "}롤
      </nav>

      <div className="mb-5 mt-2">
        <h1 className="text-heading1 font-bold text-fg-strong sm:text-title3">2026 나고야 아시안게임 롤(LoL) 일정·국가대표 명단</h1>
        <p className="mt-2 text-label1 leading-relaxed text-fg-strong">{lead}</p>
      </div>

      <SportNav current="lol" />

      <section id="roster" className="mb-6 scroll-mt-20 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
        <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">대한민국 롤 국가대표 명단</h2>
        <p className="mt-1 text-caption1 text-fg-tertiary">
          한국e스포츠협회 {LOL_ROSTER_ANNOUNCED} 발표 기준 · 감독 &apos;{LOL_COACH.nick}&apos; {LOL_COACH.name}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[320px] text-label1">
            <thead>
              <tr className="text-caption1 text-fg-tertiary">
                <th className="py-2 text-left font-medium">포지션</th>
                <th className="py-2 text-left font-medium">선수</th>
                <th className="py-2 text-left font-medium">소속팀</th>
              </tr>
            </thead>
            <tbody>
              {LOL_KOREA_ROSTER.map((p) => (
                <tr key={p.nick} className="border-t border-line-subtle">
                  <td className="py-2 text-fg-secondary">{p.role}</td>
                  <td className="py-2 text-fg-strong">
                    <b>{p.nick}</b> <span className="text-fg-secondary">{p.name}</span>
                  </td>
                  <td className="py-2 text-fg">{p.team}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data ? (
        <SportScheduleLive
          slug="esports"
          name="롤"
          initialGames={games}
          lastUpdated={data.lastUpdated}
          today={today}
          broadcasts={{}}
          onlyEvent={LOL_EVENT}
        />
      ) : (
        <p className="mb-6 rounded-xl border border-line-subtle p-4 text-label1 text-fg-secondary">경기 일정을 준비 중입니다.</p>
      )}

      <section className="mb-8 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
        <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">아시안게임 롤 자주 묻는 질문</h2>
        <dl className="mt-3 space-y-4">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="text-label1 font-semibold text-fg-strong">{f.q}</dt>
              <dd className="mt-1 text-label1 leading-relaxed text-fg-secondary">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-label1 text-fg-secondary">
          배틀그라운드·e풋볼 등 다른 e스포츠 종목 일정은{" "}
          <Link href="/asian-games/esports" className="relative text-fg underline underline-offset-2 after:absolute after:-inset-y-2 after:content-[''] hover:text-fg-strong">
            아시안게임 e스포츠 종목·일정
          </Link>
          , 중계 편성은{" "}
          <Link href="/asian-games/broadcast" className="relative text-fg underline underline-offset-2 after:absolute after:-inset-y-2 after:content-[''] hover:text-fg-strong">
            아시안게임 중계 채널
          </Link>
          에서 볼 수 있습니다.
        </p>
      </section>
    </main>
  );
}
