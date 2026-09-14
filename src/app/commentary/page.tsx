import Link from "next/link";
import type { Metadata } from "next";
import { loadScheduleData } from "@/lib/server-data";
import { PLATFORM_SEO, findPlatformSlugByName } from "@/lib/slugs";
import { getTodayString, getUpcomingDates } from "@/lib/schedule-utils";
import { buildBreadcrumbLd } from "@/lib/structured-data";
import type { Schedule } from "@/types/schedule";

// 데이터가 빌드 번들에 있어 재생성해도 같은 HTML 이다. 신선도는 배포가 만든다.
// (2026-08-18 Hobby 한도 초과로 600 → 3600. 상세는 page.tsx 주석)
export const revalidate = 3600;

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
  // 띄어쓰기 변형을 제목 안에 둘 다 넣는다 — 검색어가 `한국어 해설`(띄움)과
  // `한국어해설`(붙임) 양쪽으로 들어오는데, 종전 제목엔 붙임 표기가 없었다.
  title: "한국어 해설 중계 편성표 - 오늘 한국어해설 경기 일정 | 한해설",
  description:
    "오늘부터 7일간 한국어 해설로 중계되는 스포츠 경기 편성표. 야구·축구·농구·배구의 한국어해설 중계를 채널과 시간, 해설 여부까지 한 번에 확인하세요.",
  keywords: [
    "한국어 해설",
    "한국어해설",
    "한국어 해설 중계",
    "한국어해설 중계",
    "한국어중계",
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

  // 첫 문단에 넣을 직답용 집계. 경기 수는 중복 편성을 제외한 경기 단위로 센다.
  const totalGames = byDate.reduce((n, d) => n + d.games.length, 0);
  const topPlatforms = platformRanking.slice(0, 3);

  const breadcrumbLd = buildBreadcrumbLd([
    { name: "한해설", url: BASE },
    { name: "한국어 해설 중계 일정", url: `${BASE}/commentary` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbLd }} />

      <main className="mx-auto w-full max-w-[1100px] px-5 sm:px-6 py-6 sm:py-8">
        <nav className="mb-4 text-caption1 text-fg-tertiary sm:text-label1">
          <Link href="/" className="relative after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] inline-block hover:text-fg">
            편성표
          </Link>
          <span className="px-1.5">›</span>
          <span className="text-fg">한국어 해설 중계</span>
        </nav>

        <h1 className="text-heading1 font-bold text-fg-strong sm:text-title3">한국어 해설 중계 일정</h1>
        {/* 첫 문단은 그 자체로 답이 되게 쓴다(수치 포함, 문맥 없이 인용 가능).
            AI 답변 인용의 약 44%가 페이지 첫 30% 구간에서 나오고, 인용은 자기완결형
            문장 단위로 잡힌다. 전에는 이 자리에 수치 없는 설명문만 있어서 집계 데이터가
            페이지 안에 있는데도 인용 가능한 문장이 없었다. */}
        <p className="mt-2 text-label1 leading-relaxed text-fg">
          {totalGames > 0 ? (
            <>
              오늘부터 7일간 한국어 해설로 볼 수 있는 경기는{" "}
              <strong className="text-fg-strong">총 {totalGames}경기</strong>이고,{" "}
              {topPlatforms.length > 0 && (
                <>
                  가장 많은 채널은{" "}
                  <strong className="text-fg-strong">
                    {topPlatforms.map(([p, c]) => `${p} ${c}경기`).join(", ")}
                  </strong>
                  입니다.{" "}
                </>
              )}
              같은 경기라도 채널에 따라 한국어 해설이 붙기도 하고 현지 중계만 나가기도 하므로,
              아래 목록은 한국어 해설이 확인된 편성만 모았습니다.
            </>
          ) : (
            <>
              같은 경기라도 채널에 따라 한국어 해설이 붙기도 하고 현지 중계만 나가기도 합니다.
              오늘부터 7일간{" "}
              <strong className="text-fg-strong">한국어 해설로 볼 수 있는 경기만</strong> 모았습니다.
            </>
          )}
        </p>

        {platformRanking.length > 0 && (
          <section className="mt-5 rounded-xl border border-line-subtle bg-subtle p-4 sm:p-5">
            <h2 className="text-label1 font-semibold text-fg-strong sm:text-headline1">
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
                    className="relative after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] inline-block rounded-full border border-line-subtle px-3 py-1.5 text-caption1 text-fg transition-colors hover:border-line hover:text-fg-strong"
                  >
                    {label}
                  </Link>
                ) : (
                  <span
                    key={platform}
                    className="rounded-full border border-line-subtle px-3 py-1.5 text-caption1 text-fg-secondary"
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          </section>
        )}

        {byDate.length === 0 ? (
          <p className="mt-6 text-label1 text-fg-secondary">
            현재 확인된 한국어 해설 편성이 없습니다. 편성이 올라오는 대로 갱신됩니다.
          </p>
        ) : (
          <div className="mt-5 space-y-5">
            {byDate.map(({ date, games }) => (
              <section key={date}>
                <h2 className="mb-2 text-label1 font-semibold text-fg-strong sm:text-headline1">
                  {formatDate(date)}
                </h2>
                <ul className="space-y-1.5">
                  {games.map(({ s, platforms }) => (
                    <li
                      key={`${s.date}-${s.homeTeam}-${s.awayTeam}`}
                      className="rounded-lg border border-line-subtle bg-subtle px-3 py-2 text-label1"
                    >
                      <span className="tabular-nums text-fg-secondary">{s.time}</span>{" "}
                      <span className="text-fg-tertiary">{s.league}</span>{" "}
                      <span className="text-fg-strong">
                        {s.homeTeam} vs {s.awayTeam}
                      </span>
                      <span className="block text-caption1 text-fg-tertiary sm:inline sm:text-label1">
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

        <section className="mt-6 rounded-xl border border-line-subtle bg-subtle p-4 sm:p-5">
          <h2 className="text-label1 font-semibold text-fg-strong sm:text-headline1">채널별 해설 편성 보기</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLATFORM_SEO.map((p) => (
              <Link
                key={p.slug}
                href={`/platform/${p.slug}`}
                className="relative after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] inline-block rounded-lg border border-line bg-muted px-2.5 py-1 text-caption1 text-fg transition-colors hover:bg-muted hover:text-fg-strong"
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
