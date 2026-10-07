import type { Metadata } from "next";
import Link from "next/link";
import standingsData from "@/data/standings.json";
import scheduleArchive from "@/data/schedule-archive.json";
import resultsArchiveData from "@/data/results-archive.json";
import type { StandingsData } from "@/types/standings";
import type { Schedule } from "@/types/schedule";
import type { ResultsData } from "@/types/results";
import { loadScheduleData } from "@/lib/server-data";
import { getTodayString, formatDateHeader } from "@/lib/schedule-utils";
import { findResult } from "@/lib/results/lookup";
import { matchToSlug } from "@/lib/match-slug";
import { isRetiredMatchDate } from "@/lib/match-retention";
import { withJosa } from "@/lib/josa";
import {
  ROUNDS,
  groupKboGames,
  phaseOf,
  postseasonGames,
  postseasonSeeds,
  remainingRegularGames,
  roundInfo,
  type PostseasonGame,
} from "@/lib/kbo-postseason";

// 🔴 날짜 의존 허브(오늘 기준 리드·남은 경기) — `revalidate` 정책 정본은 `src/app/page.tsx` 주석.
export const revalidate = 21600;

const URL = "https://haeseol.com/postseason/kbo";
// 🔴 네이버 제목 상한 40자. `가을야구`(40,890) · `포스트시즌`(8,820) 이 둘 다 제목에 있어야 한다.
const TITLE = "KBO 포스트시즌 일정·중계 — 2026 가을야구 | 한해설";
const DESC =
  "2026 KBO 포스트시즌(가을야구) 일정과 중계 채널. 와일드카드 결정전·준플레이오프·플레이오프·한국시리즈 대진과 경기 시간, 한국어 해설 중계를 한곳에서 확인하세요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: URL,
    siteName: "한해설",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "https://haeseol.com/og-default.png", width: 1200, height: 630, alt: "KBO 포스트시즌 일정·중계" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["https://haeseol.com/og-default.png"] },
};

const data = standingsData as unknown as StandingsData;
const archive = (scheduleArchive as unknown as { schedules: Schedule[] }).schedules;
const resultsArchive = resultsArchiveData as unknown as ResultsData;

const FAQS = [
  {
    q: "KBO 포스트시즌에는 몇 팀이 나가나요?",
    a: "정규시즌 1위부터 5위까지 다섯 팀이 나갑니다. 4위와 5위가 와일드카드 결정전을 치르고, 이긴 팀이 3위와 준플레이오프, 그 승자가 2위와 플레이오프, 마지막으로 플레이오프 승자가 1위와 한국시리즈를 치르는 계단식입니다.",
  },
  {
    q: "와일드카드 결정전은 어떻게 진행되나요?",
    a: "최대 2경기이고 4위 팀 홈에서 열립니다. 4위가 1승을 안고 시작해 첫 경기를 이기거나 비기면 바로 준플레이오프에 오르고, 5위는 두 경기를 모두 이겨야 올라갑니다.",
  },
  {
    q: "한국시리즈는 몇 전 몇 선승제인가요?",
    a: "7전 4선승제입니다. 준플레이오프와 플레이오프는 5전 3선승제이며, 각 시리즈는 정규시즌 순위가 높은 팀 홈에서 시작합니다.",
  },
  {
    q: "가을야구 중계는 어디서 보나요?",
    a: "온라인(OTT)은 티빙에서 볼 수 있고, TV 중계 채널은 경기마다 다릅니다. 이 페이지 일정에는 편성이 확인된 채널만 경기 옆에 표시합니다.",
  },
];

function teamWithSeed(name: string, seedOf: Map<string, number>): string {
  const seed = seedOf.get(name);
  return seed ? `${name}(${seed}위)` : name;
}

function answerLead(today: string, games: PostseasonGame[], seedOf: Map<string, number>): string {
  const teams = data.baseball.find((l) => l.id === "kbo")?.teams ?? [];
  const base = `${today} 기준`;
  if (teams.length === 0) return `${base} KBO 순위 데이터를 준비 중입니다.`;
  const seeds = postseasonSeeds(teams);
  const seedText = seeds.map((t) => `${t.rank}위 ${t.teamName}`).join("·");
  if (phaseOf(teams) === "regular") {
    const left = remainingRegularGames(teams);
    const wc = seeds.length >= 5 ? ` 와일드카드 결정전은 4위 ${withJosa(seeds[3].teamName, "와/과")} 5위 ${seeds[4].teamName}의 대결이 됩니다.` : "";
    return `${base} KBO 정규시즌은 ${left}경기가 남았고, 현재 순위로 가을야구에 나가는 5팀은 ${seedText}입니다.${wc} 순위는 정규시즌이 끝나야 확정됩니다.`;
  }
  const next = games.find((g) => g.date >= today);
  if (!next) return `${base} KBO 정규시즌이 끝났고 가을야구 진출 5팀은 ${seedText}입니다. 편성이 확인된 다음 포스트시즌 경기는 아직 없습니다.`;
  const round = next.round ? `${roundInfo(next.round).name}${next.gameNo ? ` ${next.gameNo}차전` : ""}` : "포스트시즌 경기";
  return `${base} KBO 포스트시즌이 진행 중입니다. 다음 경기는 ${formatDateHeader(next.date)} ${next.time} ${round} ${teamWithSeed(next.homeTeam, seedOf)} 대 ${teamWithSeed(next.awayTeam, seedOf)}이고, ${next.platforms.join("·")}에서 중계합니다.`;
}

function GameRow({ g, seedOf, today }: { g: Omit<PostseasonGame, "round" | "gameNo"> & Partial<PostseasonGame>; seedOf: Map<string, number>; today: string }) {
  const result = g.date <= today ? findResult(resultsArchive, g.schedule) : undefined;
  const score =
    result && typeof result.homeScore === "number" && typeof result.awayScore === "number"
      ? `${result.homeScore} : ${result.awayScore}`
      : null;
  const label = g.round ? `${roundInfo(g.round).name}${g.gameNo ? ` ${g.gameNo}차전` : ""}` : null;
  const linkable = !isRetiredMatchDate(g.date);
  const body = (
    <>
      <span className="tabular-nums text-fg-secondary">{formatDateHeader(g.date)} {g.time}</span>
      {label && <span className="ml-2 font-semibold text-fg-strong">{label}</span>}
      <span className="ml-2 text-fg">
        {teamWithSeed(g.homeTeam, seedOf)} {score ? <b className="tabular-nums">{score}</b> : "vs"} {teamWithSeed(g.awayTeam, seedOf)}
      </span>
      <span className="ml-2 text-caption1 text-fg-tertiary">{g.platforms.join(" · ")}</span>
    </>
  );
  return (
    <li className="py-2">
      {linkable ? (
        <Link href={`/match/${matchToSlug(g.schedule)}`} className="hover:underline underline-offset-2">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}

export default function KboPostseasonPage() {
  const today = getTodayString();
  const teams = data.baseball.find((l) => l.id === "kbo")?.teams ?? [];
  const season = data.baseball.find((l) => l.id === "kbo")?.season ?? today.slice(0, 4);
  const seeds = postseasonSeeds(teams);
  const seedOf = new Map(seeds.map((t) => [t.teamName, t.rank]));
  const phase = phaseOf(teams);
  const current = loadScheduleData().schedules;
  const games = postseasonGames([...archive, ...current], teams, season);
  // 정규시즌 중에는 남은 정규시즌 경기를 보여 준다(가을야구 순위 싸움이 걸린 경기).
  const upcomingRegular = phase === "regular" ? groupKboGames(current).filter((g) => g.date >= today) : [];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: `${season} KBO 포스트시즌`,
      sport: "Baseball",
      eventStatus: "https://schema.org/EventScheduled",
      location: { "@type": "Place", name: "대한민국", address: { "@type": "PostalAddress", addressCountry: "KR" } },
      url: URL,
      ...(games.length > 0 ? { startDate: games[0].date } : {}),
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
        { "@type": "ListItem", position: 2, name: "KBO 편성표", item: "https://haeseol.com/league/kbo" },
        { "@type": "ListItem", position: 3, name: "KBO 포스트시즌 일정·중계", item: URL },
      ],
    },
  ];

  return (
    <main className="relative mx-auto min-h-screen max-w-[1100px] px-5 pb-12 sm:px-6 sm:pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mb-6 mt-6">
        <h1 className="text-heading1 font-bold text-fg-strong sm:text-title3">
          {season} KBO 포스트시즌 일정·중계 — 가을야구 와일드카드부터 한국시리즈까지
        </h1>
        <p className="mt-2 text-label1 leading-relaxed text-fg-strong">{answerLead(today, games, seedOf)}</p>
        <p className="mt-1.5 text-label1 leading-relaxed text-fg-secondary">
          가을야구 대진과 라운드별 방식, 경기 일정과 중계 채널을 모았습니다. 정규시즌 전 경기 편성은{" "}
          <Link href="/league/kbo" className="text-fg underline underline-offset-2 hover:text-fg-strong">KBO 중계 편성표</Link>, 순위는{" "}
          <Link href="/standings/kbo" className="text-fg underline underline-offset-2 hover:text-fg-strong">KBO 순위</Link>에서 볼 수 있습니다.
        </p>
      </div>

      <section className="mb-8 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
        <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">
          가을야구 대진{phase === "regular" ? " (현재 순위 기준)" : ""}
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-label1">
            <thead className="text-caption1 text-fg-tertiary">
              <tr>
                <th className="py-2 pr-3 font-medium">라운드</th>
                <th className="py-2 pr-3 font-medium">대진</th>
                <th className="py-2 pr-3 font-medium">방식</th>
                <th className="py-2 font-medium">장소</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {ROUNDS.map((r) => {
                const top = seeds.find((t) => t.rank === r.seeds[0]);
                const other =
                  r.seeds[1] !== null
                    ? `${r.seeds[1]}위${seeds.find((t) => t.rank === r.seeds[1]) ? ` ${seeds.find((t) => t.rank === r.seeds[1])!.teamName}` : ""}`
                    : r.key === "semipo"
                      ? "와일드카드 승자"
                      : r.key === "po"
                        ? "준플레이오프 승자"
                        : "플레이오프 승자";
                return (
                  <tr key={r.key}>
                    <td className="py-2 pr-3 font-semibold text-fg-strong">{r.name}</td>
                    <td className="py-2 pr-3 text-fg">
                      {top ? `${r.seeds[0]}위 ${top.teamName}` : `${r.seeds[0]}위`} vs {other}
                    </td>
                    <td className="py-2 pr-3 text-fg-secondary">{r.format}</td>
                    <td className="py-2 text-fg-secondary">{r.home}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
        <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">
          {phase === "postseason" ? "포스트시즌 경기 일정·결과" : "정규시즌 남은 경기 (가을야구 순위 싸움)"}
        </h2>
        {phase === "postseason" ? (
          games.length > 0 ? (
            <ul className="mt-2 divide-y divide-line-subtle text-label1">
              {games.map((g) => (
                <GameRow key={`${g.date}|${g.time}|${g.homeTeam}`} g={g} seedOf={seedOf} today={today} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-label1 text-fg-secondary">중계 편성이 발표되면 이곳에 경기 일정과 채널이 올라옵니다.</p>
          )
        ) : upcomingRegular.length > 0 ? (
          <ul className="mt-2 divide-y divide-line-subtle text-label1">
            {upcomingRegular.map((g) => (
              <GameRow key={`${g.date}|${g.time}|${g.homeTeam}`} g={g} seedOf={seedOf} today={today} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-label1 text-fg-secondary">편성이 확인된 남은 정규시즌 경기가 없습니다.</p>
        )}
        <p className="mt-3 text-caption1 text-fg-tertiary">
          경기 시간은 한국 시각입니다. 중계 채널은 편성이 확인된 것만 표시하며, 지상파 편성은 방송사 발표를 확인하세요.
        </p>
      </section>

      <section className="mb-8 rounded-xl border border-line-subtle bg-surface p-4 sm:p-5">
        <h2 className="text-headline1 font-semibold text-fg-strong sm:text-heading2">KBO 포스트시즌 자주 묻는 질문</h2>
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
