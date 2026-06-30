import type { Metadata } from "next";
import {
  loadWorldcupStandings,
  loadScheduleData,
  loadResults,
  loadResultsArchive,
} from "@/lib/server-data";
import type { WorldCupGroup } from "@/types/worldcup";
import type { Schedule } from "@/types/schedule";
import { buildSportsEventLd } from "@/lib/structured-data";
import { proxyLogo } from "@/lib/emblem";
import { findResult } from "@/lib/results/lookup";
import { WorldCupBanner } from "@/app/_components/WorldCupBanner";
import { SiteHeader } from "@/app/_components/SiteHeader";
import { GuideCards } from "@/app/_components/GuideCards";
import { getAllGuides } from "@/lib/guides";
import { WorldcupTabs } from "./_components/WorldcupTabs";
import {
  TournamentBracket,
  type BracketMatch,
  type BracketRound,
} from "./_components/TournamentBracket";

// 토너먼트 라운드 표시 순서. worldcup.json league 접미사("북중미 월드컵 32강" 등)와 일치.
const ROUND_ORDER = ["32강", "16강", "8강", "4강", "3·4위전", "결승"];

/** 월드컵 토너먼트 편성 + 결과를 합쳐 라운드별 대진표 데이터로 만든다. */
function buildBracket(wcSchedules: Schedule[]): BracketRound[] {
  const results = loadResults();
  const archive = loadResultsArchive();
  // 라운드 접미사가 붙은 편성만 토너먼트(조별리그는 "북중미 월드컵" 그대로).
  const knockout = wcSchedules.filter((s) => s.league !== "북중미 월드컵");

  const byRound = new Map<string, BracketMatch[]>();
  for (const s of knockout) {
    const label = s.league.replace("북중미 월드컵", "").trim();
    // 종료 결과는 archive에 영구 보관, 진행/직전 경기는 results(3일 윈도우)에 있음.
    const r = findResult(archive, s) ?? findResult(results, s);
    const m: BracketMatch = {
      date: s.date,
      time: s.time,
      homeTeam: s.homeTeam,
      awayTeam: s.awayTeam,
      ...(s.homeEmblem ? { homeEmblem: s.homeEmblem } : {}),
      ...(s.awayEmblem ? { awayEmblem: s.awayEmblem } : {}),
      ...(typeof r?.homeScore === "number" ? { homeScore: r.homeScore } : {}),
      ...(typeof r?.awayScore === "number" ? { awayScore: r.awayScore } : {}),
      ...(typeof r?.homePtScore === "number"
        ? { homePtScore: r.homePtScore, awayPtScore: r.awayPtScore }
        : {}),
      ...(r?.winner ? { winner: r.winner } : {}),
      status: r?.status ?? "scheduled",
    };
    if (!byRound.has(label)) byRound.set(label, []);
    byRound.get(label)!.push(m);
  }

  const sortMatches = (ms: BracketMatch[]) =>
    ms.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const rounds: BracketRound[] = ROUND_ORDER.filter((l) => byRound.has(l)).map((l) => ({
    label: l,
    matches: sortMatches(byRound.get(l)!),
  }));
  // 예상 순서에 없는 라운드 라벨이 있으면 뒤에 덧붙임(누락 방지).
  for (const [l, ms] of byRound) {
    if (!ROUND_ORDER.includes(l)) rounds.push({ label: l, matches: sortMatches(ms) });
  }
  return rounds;
}

const CANONICAL = "https://haeseol.com/worldcup";
const OG_DESC =
  "2026 FIFA 북중미 월드컵 조별 순위·16강 진출 확률과 한국 경기 한국어 해설 중계 편성을 한곳에서.";

export const metadata: Metadata = {
  title: "북중미 월드컵 조별 순위·중계 편성표 | 한해설",
  description:
    "2026 FIFA 북중미 월드컵 12개 조 순위·승점·골득실·16강 진출 확률과 한국 경기 중계 편성을 한곳에서. 한국어 해설 중계 어디서 보는지 한눈에.",
  keywords: [
    "월드컵 중계",
    "북중미 월드컵",
    "2026 월드컵",
    "월드컵 조별 순위",
    "월드컵 16강 진출",
    "월드컵 편성표",
    "월드컵 한국어 해설",
    "월드컵 한국 경기",
    "월드컵 중계 어디서",
    "FIFA 월드컵 2026",
  ],
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: "북중미 월드컵 조별 순위·중계 편성표 | 한해설",
    description: OG_DESC,
    url: CANONICAL,
    siteName: "한해설",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "2026 북중미 월드컵" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "북중미 월드컵 조별 순위·중계 편성표 | 한해설",
    description: OG_DESC,
    images: ["/og-default.png"],
  },
};

/** 오늘(로컬)부터 첫 경기까지 D-day. */
function computeDday(wcSchedules: Schedule[]): number | null {
  const wcDates = wcSchedules.map((s) => s.date).sort();
  if (wcDates.length === 0) return null;
  const d = new Date();
  const a = [d.getFullYear(), d.getMonth() + 1, d.getDate()];
  const [by, bm, bd] = wcDates[0].split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
}

function GroupCard({ g }: { g: WorldCupGroup }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="bg-zinc-800/60 px-3 py-1.5 text-xs font-bold text-zinc-200">{g.group}조</div>
      <div className="overflow-x-auto">
        {/* table-fixed + 고정폭 → 팀명 길이와 무관하게 모든 조가 동일한 컬럼 위치로 정렬 */}
        <table className="w-full min-w-[360px] table-fixed text-[10px] sm:text-xs">
          <thead>
            <tr className="text-zinc-500">
              <th className="w-6 py-1.5 pl-2 text-center font-medium" />
              <th className="py-1.5 text-left font-medium">팀</th>
              <th className="w-9 px-1 py-1.5 text-center font-bold text-zinc-300">승점</th>
              <th className="w-9 px-1 py-1.5 text-center font-medium">경기</th>
              <th className="w-7 px-1 py-1.5 text-center font-medium">승</th>
              <th className="w-7 px-1 py-1.5 text-center font-medium">무</th>
              <th className="w-7 px-1 py-1.5 text-center font-medium">패</th>
              <th className="w-9 px-1 py-1.5 text-center font-medium">득점</th>
              <th className="w-9 px-1 py-1.5 text-center font-medium">실점</th>
              <th className="w-10 px-1 py-1.5 pr-2 text-center font-medium">득실</th>
            </tr>
          </thead>
          <tbody>
            {g.teams.map((t) => {
              const advance = t.rank <= 2;
              return (
                <tr key={t.name} className={`border-t border-zinc-800/70 ${advance ? "bg-amber-400/[0.05]" : ""}`}>
                  <td className="py-1.5 pl-2 text-center font-bold">
                    <span className={advance ? "text-amber-300" : "text-zinc-500"}>{t.rank}</span>
                  </td>
                  <td className="py-1.5 pr-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {t.emblem && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={proxyLogo(t.emblem)} alt="" referrerPolicy="no-referrer" className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover" />
                      )}
                      <span className="truncate font-medium text-zinc-100">{t.name}</span>
                    </span>
                  </td>
                  <td className="px-1 py-1.5 text-center font-bold text-zinc-100">{t.points}</td>
                  <td className="px-1 py-1.5 text-center text-zinc-400">{t.played}</td>
                  <td className="px-1 py-1.5 text-center text-zinc-400">{t.win}</td>
                  <td className="px-1 py-1.5 text-center text-zinc-400">{t.draw}</td>
                  <td className="px-1 py-1.5 text-center text-zinc-400">{t.loss}</td>
                  <td className="px-1 py-1.5 text-center text-zinc-400">{t.gf}</td>
                  <td className="px-1 py-1.5 text-center text-zinc-400">{t.ga}</td>
                  <td className="px-1 py-1.5 pr-2 text-center text-zinc-400">{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function WorldCupPage() {
  const standings = loadWorldcupStandings();
  const wcSchedules = loadScheduleData().schedules.filter((s) =>
    s.league.startsWith("북중미 월드컵")
  );
  const dday = computeDday(wcSchedules);
  const bracketRounds = buildBracket(wcSchedules);

  // 다가오는 월드컵 경기를 SportsEvent + BroadcastEvent("어디서 시청")로 노출 →
  // Google sports "Where to watch" 신호. 홈/리그 페이지와 동일한 헬퍼 재사용.
  const sportsEventLd = buildSportsEventLd(wcSchedules, CANONICAL);
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "한해설", item: "https://haeseol.com" },
      { "@type": "ListItem", position: 2, name: "북중미 월드컵 조별 순위", item: CANONICAL },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {sportsEventLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: sportsEventLd }} />
      )}
      <main className="mx-auto min-h-screen max-w-2xl px-3 pb-12 sm:px-4">
      <SiteHeader />

      <div className="mt-4 sm:mt-6">
        <WorldCupBanner dday={dday} href="/?sport=북중미 월드컵" />
      </div>

      <h1 className="mb-3 text-base font-bold text-zinc-100 sm:text-lg">
        북중미 월드컵 토너먼트·조별 순위
      </h1>

      <WorldcupTabs
        bracket={
          <>
            <TournamentBracket rounds={bracketRounds} />
            <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-600">
              정규+연장 무승부 시 승부차기로 승자 결정 · 결과 출처: 네이버 스포츠
            </p>
          </>
        }
        groups={
          <>
            {!standings ? (
              <p className="py-16 text-center text-sm text-zinc-500">
                순위 데이터가 아직 준비되지 않았습니다.
              </p>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {standings.groups.map((g) => (
                  <GroupCard key={g.group} g={g} />
                ))}
              </div>
            )}
            <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-600">
              조 1·2위 16강 직행 + 각 조 3위 중 상위 8팀 추가 진출 · 순위 출처: 네이버 스포츠
            </p>
          </>
        }
      />

      <section className="mt-8">
        <GuideCards
          title="월드컵 가이드"
          guides={getAllGuides().filter((g) => g.category === "월드컵").slice(0, 4)}
        />
      </section>
      </main>
    </>
  );
}
