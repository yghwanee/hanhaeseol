import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAsianGamesSport, loadScheduleData } from "@/lib/server-data";
import { getTodayString } from "@/lib/schedule-utils";
import { SportScheduleLive } from "../_components/SportScheduleLive";
import { SportNav } from "../_components/SportNav";
import { withJosa } from "@/lib/josa";
import {
  AG_CLOSE,
  AG_OPEN,
  AG_SPORTS,
  agSportBySlug,
  broadcastKey,
  fmtAgDate,
  gamesForRender,
  groupEsports,
  isAgScheduleLeague,
  isKoreaGame,
  koreaRecord,
  koreanPlayersOf,
  nextKoreaGame,
  type AgGame,
  type AgSport,
} from "@/lib/asian-games/data";

/**
 * 2026 아시안게임 종목별 일정 — 「아시안게임 축구 일정」「아시안게임 롤 일정」의 착지 페이지.
 *
 * 허브(`/asian-games`)는 한국 전 종목을 한 장에 담아 종목 검색어로는 제목이 안 맞는다.
 * 이 페이지는 **종목 하나 × 전 경기**다. 한국 경기를 위에, 전체 일정을 아래에 둔다.
 *
 * 🔴 날짜 의존 페이지 — `revalidate` 정책 정본은 `src/app/page.tsx` 주석. 배포 주기(6h)와 같다.
 * 🔴 종목은 `AG_SPORTS` 에 있는 것만 연다(`dynamicParams=false`). 경기별 페이지는 만들지 않는다.
 */
export const revalidate = 21600;
export const dynamicParams = false;

export function generateStaticParams() {
  return AG_SPORTS.map((s) => ({ sport: s.slug }));
}

const BASE = "https://haeseol.com/asian-games";

/**
 * 🔴 제목에 **`나고야` 와 `아시안게임 <종목>` 어구가 둘 다** 들어가야 한다(2026-09-21 검색광고 실측).
 *   나고야아시안게임 725,500/월 · 아시안게임축구 322,000 · 아시안게임롤 73,200 ·
 *   아시안게임배구 16,100 · 아시안게임E스포츠 13,330 · 아시안게임축구중계 9,850.
 * 종전 제목은 `아이치·나고야` 를 본문에만 뒀다 — 725,500 짜리 머리 키워드를 통째로 놓쳤다.
 * 어구를 쪼개지 말 것: `아시안게임 축구` 가 붙어 있어야 322,000 쪽도 같이 받는다.
 */
function titleOf(sp: AgSport): string {
  return sp.slug === "esports"
    ? "아시안게임 e스포츠 종목·일정 — 2026 나고야 경기 시간 | 한해설"
    : `아시안게임 ${sp.name} 일정·결과 — 2026 나고야 한국 경기 | 한해설`;
}

function h1Of(sp: AgSport): string {
  return sp.slug === "esports"
    ? "2026 나고야 아시안게임 e스포츠 종목·일정"
    : `2026 나고야 아시안게임 ${sp.name} 일정·결과`;
}

function descOf(sp: AgSport): string {
  return sp.slug === "esports"
    ? "2026 아이치·나고야 아시안게임 e스포츠 종목과 경기 일정. 배틀그라운드 모바일·e풋볼·대전격투게임·리그 오브 레전드 등 세부 종목별 날짜와 시간, 금메달전 일정을 한곳에서."
    : `2026 아이치·나고야 아시안게임 ${sp.name} 경기 일정과 결과. 대한민국 남녀 경기 시간, 조편성과 전체 대진, 한국어 해설 중계 채널을 한곳에서 확인하세요.`;
}

export async function generateMetadata({ params }: { params: { sport: string } }): Promise<Metadata> {
  const sp = agSportBySlug(params.sport);
  if (!sp) return {};
  const url = `${BASE}/${sp.slug}`;
  const title = titleOf(sp);
  const description = descOf(sp);
  const kw = [`아시안게임 ${sp.name}`, `나고야 아시안게임 ${sp.name}`, `아시안게임 ${sp.name} 일정`, `아시안게임 ${sp.name} 중계`, `아시안게임 ${sp.name} 결과`, `2026 아시안게임 ${sp.name}`];
  if (sp.slug === "esports")
    kw.push("아시안게임 e스포츠", "아시안게임 e스포츠 종목", "아시안게임 e스포츠 일정", "아시안게임 배틀그라운드", "아시안게임 e풋볼");
  else
    kw.push(
      `아시안게임 ${sp.name} 한국 일정`,
      `아시안게임 ${sp.name} 대표팀 명단`,
      `아시안게임 ${sp.name} 선수`,
      `아시안게임 ${sp.name} 조편성`,
      `아시안게임 ${sp.name} 일정표`,
      `나고야 아시안게임 ${sp.name} 일정`,
      `아시안게임 남자 ${sp.name}`,
      `아시안게임 여자 ${sp.name}`,
    );
  return {
    title,
    description,
    keywords: kw,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "한해설",
      locale: "ko_KR",
      type: "website",
      images: [{ url: "https://haeseol.com/og-asian-games.jpg", width: 1200, height: 630, alt: h1Of(sp) }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["https://haeseol.com/og-asian-games.jpg"] },
  };
}

function hhmm(g: AgGame): string {
  return `${fmtAgDate(g.date)} ${g.time}`;
}

function opponent(g: AgGame): string {
  return g.home === "대한민국" ? g.away : g.home;
}

/** 금메달전(결승). 메달 경기 중 제목에 「금메달」「결승」이 있는 것, 성별마다 하나. */
function finals(games: AgGame[]): AgGame[] {
  const out = games.filter((g) => g.medal && /금메달|결승/.test(g.title) && !/준결승/.test(g.title));
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

function answerLead(sp: AgSport, games: AgGame[], today: string): string {
  const base = `${today} 기준`;
  if (games.length === 0) return `${base} 아시안게임 ${sp.name} 경기 일정을 준비 중입니다.`;
  const first = games[0];
  const last = games[games.length - 1];
  const span = `${fmtAgDate(first.date)}부터 ${fmtAgDate(last.date)}까지 ${games.length}경기`;

  if (sp.slug === "esports") {
    const lol = groupEsports(games).find((g) => g.name.startsWith("리그 오브 레전드"));
    const lolPart = lol
      ? ` 리그 오브 레전드(롤)는 ${fmtAgDate(lol.games[0].date)} 조별 경기로 시작해 ${hhmm(lol.games[lol.games.length - 1])}에 마지막 경기가 열립니다.`
      : "";
    return `${base} 2026 아시안게임 e스포츠는 ${span}가 잡혀 있습니다.${lolPart}`;
  }

  const next = nextKoreaGame(games, today);
  // 🔴 개인 종목(양궁·수영 등)은 네이버가 한국 선수를 아직 안 붙여 한국 경기가 0 일 수 있다.
  // 그때는 빈 문장으로 끝내지 말고 **금메달전 날짜**를 준다 — 그게 이 종목에서 사람이 찾는 값이다.
  const gold = finals(games).filter((g) => g.date >= today)[0];
  const nextPart = next
    ? ` 대한민국 다음 경기는 ${hhmm(next)} ${opponent(next) ? `${opponent(next)}전` : next.title}${next.title && opponent(next) ? `(${next.title})` : ""}입니다.`
    : games.some(isKoreaGame)
      ? " 대한민국의 남은 경기는 대진이 정해지면 추가됩니다."
      : gold
        ? ` 다음 금메달 경기는 ${hhmm(gold)} ${gold.title}입니다.`
        : "";
  const rec = koreaRecord(games);
  const recPart =
    rec.length > 0
      ? ` 지금까지 대한민국은 ${rec
          .map((r) => `${r.gender ? `${r.gender} ` : ""}${r.win}승${r.draw ? ` ${r.draw}무` : ""} ${r.lose}패`)
          .join(", ")}입니다.`
      : "";
  return `${base} 2026 아시안게임 ${withJosa(sp.name, "은/는")} ${span}가 잡혀 있습니다.${nextPart}${recPart}`;
}

function faqsOf(sp: AgSport, games: AgGame[], today: string, tvCount: number, players: string[]): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  // 🔴 선수 이름으로 들어오는 검색(`김도영 아시안게임` 8,920/월)을 받는 자리. 이름은 네이버
  // `koreanPlayers` 에서 오고, 손으로 적지 않는다. 비어 있으면 질문 자체를 안 낸다.
  if (players.length > 0) {
    out.push({
      q: `아시안게임 ${sp.name} 대한민국 대표 선수는 누구인가요?`,
      a: `${today} 기준 네이버 대회 데이터에 오른 대한민국 ${sp.name} 선수는 ${players.length}명입니다: ${players.join(", ")}.`,
    });
  }
  if (sp.slug === "esports") {
    const lol = groupEsports(games).find((g) => g.name.startsWith("리그 오브 레전드"));
    if (lol) {
      const f = finals(lol.games)[0];
      out.push({
        q: "아시안게임 롤(리그 오브 레전드) 경기는 언제인가요?",
        a: `${fmtAgDate(lol.games[0].date)}부터 조별 경기가 열리고${f ? ` 금메달전은 ${hhmm(f)}(한국 시각)입니다` : ""}. 조 편성과 대진이 확정되면 이 페이지의 경기 목록에 참가국이 표시됩니다.`,
      });
    }
    const titles = groupEsports(games).map((g) => g.name);
    out.push({
      q: "2026 아시안게임 e스포츠 종목은 무엇인가요?",
      a: `${titles.join(", ")} 등 ${titles.length}개 세부 종목이 열립니다. 경기 수는 모두 ${games.length}경기입니다.`,
    });
  } else {
    const next = nextKoreaGame(games, today);
    out.push({
      q: `아시안게임 ${sp.name} 한국 다음 경기는 언제인가요?`,
      a: next
        ? `${today} 기준 대한민국 다음 경기는 ${hhmm(next)}(한국 시각) ${opponent(next) ? `${opponent(next)}전` : ""}(${next.title})입니다.`
        : `${today} 기준 확정된 대한민국 남은 경기가 없습니다. 다음 라운드 대진이 정해지면 이 페이지에 추가됩니다.`,
    });
    const fs = finals(games);
    if (fs.length > 0) {
      out.push({
        q: `아시안게임 ${sp.name} 결승(금메달전)은 언제인가요?`,
        a: fs.map((f) => `${f.title.replace(/\s*\d+경기$/, "")} ${hhmm(f)}`).join(", ") + "(한국 시각)입니다.",
      });
    }
    out.push({
      q: `아시안게임 ${sp.name} 중계는 어디서 보나요?`,
      a:
        tvCount > 0
          ? `${today} 기준 SPOTV NOW가 아시안게임 ${sp.name} ${tvCount}경기를 편성했고, 경기마다 한국어 해설 여부가 목록에 표시됩니다. 지상파 중계 편성은 방송사 발표를 확인하세요.`
          : `${today} 기준 확인된 OTT 편성이 아직 없습니다. 편성이 확인되면 경기 목록 옆에 중계 채널이 표시됩니다. 지상파 중계 편성은 방송사 발표를 확인하세요.`,
    });
  }
  out.push({
    q: "2026 아시안게임은 언제, 어디서 열리나요?",
    a: `${AG_OPEN} 개막해 ${AG_CLOSE}까지 일본 아이치현 나고야 일대에서 열립니다. 축구·농구 등 일부 종목은 개막 전에 예선을 먼저 시작했습니다.`,
  });
  return out;
}

export default function AsianGamesSportPage({ params }: { params: { sport: string } }) {
  const sp = agSportBySlug(params.sport);
  if (!sp) notFound();
  const today = getTodayString();
  const data = loadAsianGamesSport(sp.slug);
  const all = [...(data?.games ?? [])].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  // 🔴 예선 라운드가 수백 건인 종목(양궁 362·탁구 295)은 추려서 그린다. 근거는 gamesForRender 주석.
  const games = gamesForRender(all, today);

  // 이 종목의 편성(SPOTV NOW 등). 한국 경기만이 아니라 전 경기에 붙인다.
  const broadcasts: Record<string, string[]> = {};
  let tvCount = 0;
  if (sp.scheduleSport) {
    for (const s of loadScheduleData().schedules) {
      if (!isAgScheduleLeague(s.league) || s.sport !== sp.scheduleSport) continue;
      tvCount++;
      const label = s.koreanCommentary === true ? `${s.platform} 한국어해설` : s.platform;
      const key = broadcastKey(s.date, s.homeTeam, s.awayTeam);
      broadcasts[key] = [...new Set([...(broadcasts[key] ?? []), label])];
    }
  }

  const url = `${BASE}/${sp.slug}`;
  // 선수 명단은 렌더 상한(gamesForRender)으로 자르기 전 **전체 경기**에서 모은다.
  const players = koreanPlayersOf(all);
  const faqs = faqsOf(sp, games, today, tvCount, players);
  const koreaUpcoming = games.filter((g) => isKoreaGame(g) && g.date >= today && g.status !== "RESULT").slice(0, 10);

  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "한해설", item: "https://haeseol.com" },
        { "@type": "ListItem", position: 2, name: "아시안게임", item: BASE },
        { "@type": "ListItem", position: 3, name: `아시안게임 ${sp.name} 일정`, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];
  if (koreaUpcoming.length > 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `아시안게임 ${sp.name} 대한민국 경기 일정`,
      itemListElement: koreaUpcoming.map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "SportsEvent",
          name: `[아시안게임 ${sp.name}] ${g.home} vs ${g.away}`,
          description: g.title,
          startDate: `${g.date}T${g.time}:00+09:00`,
          eventStatus: "https://schema.org/EventScheduled",
          location: { "@type": "Place", name: "일본 아이치·나고야", address: { "@type": "PostalAddress", addressCountry: "JP" } },
          homeTeam: { "@type": "SportsTeam", name: g.home },
          awayTeam: { "@type": "SportsTeam", name: g.away },
          superEvent: { "@type": "SportsEvent", name: "2026 아이치·나고야 아시안게임", startDate: AG_OPEN, endDate: AG_CLOSE },
          url,
        },
      })),
    });
  }

  return (
    <main className="relative mx-auto min-h-screen max-w-[1100px] px-5 pb-12 sm:px-6 sm:pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="경로" className="mt-4 text-caption1 text-fg-tertiary sm:mt-6">
        <Link href="/asian-games" className="relative underline underline-offset-2 after:absolute after:-inset-y-2 after:content-[''] hover:text-fg-strong">
          아시안게임
        </Link>
        {" › "}
        {sp.name}
      </nav>

      <div className="mb-5 mt-2">
        <h1 className="text-heading1 font-bold text-fg-strong sm:text-title3">{h1Of(sp)}</h1>
        <p className="mt-2 text-label1 leading-relaxed text-fg-strong">{answerLead(sp, games, today)}</p>
        <p className="mt-1.5 text-label1 leading-relaxed text-fg-secondary">
          경기 시간은 모두 한국 시각입니다. 대한민국 메달과 전 종목 한국 경기는{" "}
          <Link href="/asian-games" className="relative text-fg underline underline-offset-2 after:absolute after:-inset-y-2 after:content-[''] hover:text-fg-strong">
            아시안게임 한국 경기 일정·메달 순위
          </Link>
          에서 볼 수 있습니다.
        </p>
      </div>

      <SportNav current={sp.slug} />

      {data ? (
        <SportScheduleLive
          slug={sp.slug}
          name={sp.name}
          initialGames={games}
          lastUpdated={data.lastUpdated}
          today={today}
          broadcasts={broadcasts}
        />
      ) : (
        <p className="mb-6 rounded-xl border border-line-subtle p-4 text-label1 text-fg-secondary">경기 일정을 준비 중입니다.</p>
      )}

      {players.length > 0 && (
        <section id="players" className="mb-6 scroll-mt-20 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
          <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">
            아시안게임 {sp.name} 대한민국 대표 선수{" "}
            <span className="whitespace-nowrap text-label1 font-normal text-fg-tertiary">({players.length}명)</span>
          </h2>
          <p className="mt-1 text-caption1 text-fg-tertiary">네이버 대회 데이터 기준 · 경기에 배정되는 대로 늘어납니다</p>
          <p className="mt-3 text-label1 leading-relaxed text-fg break-keep">{players.join(" · ")}</p>
          <Link href="/asian-games/players" className="relative mt-2 inline-block text-label1 text-fg underline underline-offset-2 after:absolute after:-inset-y-2 after:content-[''] hover:text-fg-strong">
            전 종목 한국 선수단 보기
          </Link>
        </section>
      )}

      <section className="mb-8 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
        <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">아시안게임 {sp.name} 자주 묻는 질문</h2>
        <dl className="mt-3 space-y-4">
          {faqs.map((f) => (
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
