import Link from "next/link";
import type { Metadata } from "next";
import { loadScheduleData } from "@/lib/server-data";
import { PLATFORM_SEO, findPlatformSlugByName } from "@/lib/slugs";
import { getTodayString, getUpcomingDates } from "@/lib/schedule-utils";
import { buildBreadcrumbLd } from "@/lib/structured-data";
import type { Schedule } from "@/types/schedule";

export const revalidate = 600;

const BASE = "https://haeseol.com";

/**
 * 한국어 해설 편성 모아보기.
 *
 * 2026-07-20 네이버 서치어드바이저에서 나온 것: "sbs 스포츠 야구 해설 일정"이 CTR 23.6%,
 * "스포티비2 야구 해설"이 11.6%다. 사이트 전체 평균 CTR이 0.1%인 걸 감안하면 압도적인데
 * 노출은 각각 407, 267뿐이었다. 이 질문을 정면으로 받는 페이지가 없어서다.
 *
 * 순위 쿼리는 네이버가 자체 위젯을 최상단에 박아 백만 노출에도 클릭이 0이지만,
 * "어디서 한국어 해설로 보나"는 네이버가 답하지 않는 질문이라 우리가 이긴다.
 */
export const metadata: Metadata = {
  title: "한국어 해설 중계 일정 — 오늘 어떤 경기를 해설로 보나 | 한해설",
  description:
    "오늘부터 7일간 한국어 해설로 중계되는 스포츠 경기 편성표. 야구·축구·농구·배구를 채널과 시간, 해설 여부까지 한 번에 확인하세요.",
  keywords: [
    "한국어 해설 중계",
    "야구 해설 일정",
    "축구 해설 일정",
    "해설 중계 일정",
    "오늘 해설 경기",
    "한국어 중계 편성표",
  ],
  alternates: { canonical: `${BASE}/commentary` },
  openGraph: {
    title: "한국어 해설 중계 일정 | 한해설",
    description: "오늘부터 7일간 한국어 해설로 중계되는 경기를 채널·시간과 함께 정리했습니다.",
    url: `${BASE}/commentary`,
    siteName: "한해설",
    locale: "ko_KR",
    type: "website",
  },
};

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}월 ${d}일 (${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

/** 한 경기가 여러 채널에 걸리면 한 줄로 합친다. 팀 페이지와 같은 이유다. */
function groupByGame(list: Schedule[]) {
  const byKey = new Map<string, { s: Schedule; platforms: string[] }>();
  for (const s of list) {
    const key = `${s.date}|${s.homeTeam}|${s.awayTeam}`;
    const prev = byKey.get(key);
    if (prev) {
      if (!prev.platforms.includes(s.platform)) prev.platforms.push(s.platform);
      continue;
    }
    byKey.set(key, { s, platforms: [s.platform] });
  }
  return [...byKey.values()].sort((a, b) => a.s.time.localeCompare(b.s.time));
}

export default function CommentaryPage() {
  const schedules = loadScheduleData().schedules;
  const today = getTodayString();
  const dates = getUpcomingDates().map((d) => d.value);

  const korean = schedules.filter((s) => s.koreanCommentary === true && s.date >= today);
  const byDate = dates
    .map((date) => ({ date, games: groupByGame(korean.filter((s) => s.date === date)) }))
    .filter((d) => d.games.length > 0);

  // 채널별 한국어 해설 경기 수. 어느 채널을 켜야 하는지가 이 페이지의 답이다.
  const byPlatform = new Map<string, number>();
  for (const g of byDate.flatMap((d) => d.games)) {
    for (const p of g.platforms) byPlatform.set(p, (byPlatform.get(p) ?? 0) + 1);
  }
  const platformRanking = [...byPlatform.entries()].sort((a, b) => b[1] - a[1]);

  const breadcrumbLd = buildBreadcrumbLd([
    { name: "한해설", url: BASE },
    { name: "한국어 해설 중계 일정", url: `${BASE}/commentary` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbLd }} />

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <nav className="mb-4 text-xs text-zinc-500 sm:text-sm">
          <Link href="/" className="hover:text-zinc-300">
            편성표
          </Link>
          <span className="px-1.5">›</span>
          <span className="text-zinc-300">한국어 해설 중계</span>
        </nav>

        <h1 className="text-xl font-bold text-white sm:text-2xl">한국어 해설 중계 일정</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          같은 경기라도 채널에 따라 한국어 해설이 붙기도 하고 현지 중계만 나가기도 합니다. 오늘부터
          7일간 <strong className="text-white">한국어 해설로 볼 수 있는 경기만</strong> 모았습니다.
        </p>

        {platformRanking.length > 0 && (
          <section className="mt-5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white sm:text-base">
              어느 채널에 한국어 해설이 많나
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {platformRanking.map(([platform, count]) => {
                const slug = findPlatformSlugByName(platform);
                const label = `${platform} ${count}경기`;
                return slug ? (
                  <Link
                    key={platform}
                    href={`/platform/${slug}`}
                    className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                  >
                    {label}
                  </Link>
                ) : (
                  <span
                    key={platform}
                    className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400"
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          </section>
        )}

        {byDate.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-400">
            현재 확인된 한국어 해설 편성이 없습니다. 편성이 올라오는 대로 갱신됩니다.
          </p>
        ) : (
          <div className="mt-5 space-y-5">
            {byDate.map(({ date, games }) => (
              <section key={date}>
                <h2 className="mb-2 text-sm font-semibold text-white sm:text-base">
                  {formatDate(date)}
                </h2>
                <ul className="space-y-1.5">
                  {games.map(({ s, platforms }) => (
                    <li
                      key={`${s.date}-${s.homeTeam}-${s.awayTeam}`}
                      className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-sm"
                    >
                      <span className="tabular-nums text-zinc-400">{s.time}</span>{" "}
                      <span className="text-zinc-500">{s.league}</span>{" "}
                      <span className="text-zinc-100">
                        {s.homeTeam} vs {s.awayTeam}
                      </span>
                      <span className="block text-xs text-zinc-500 sm:inline sm:text-sm">
                        {" "}
                        · {platforms.join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <section className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white sm:text-base">채널별 해설 편성 보기</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLATFORM_SEO.map((p) => (
              <Link
                key={p.slug}
                href={`/platform/${p.slug}`}
                className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-700/60 hover:text-white"
              >
                {p.display}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
