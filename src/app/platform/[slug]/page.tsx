import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { PLATFORM_SEO, findPlatformBySlug } from "@/lib/slugs";
import { PLATFORM_GUIDES } from "@/lib/platform-guides";
import { PLATFORM_FAQS } from "@/lib/platform-faqs";
import { loadScheduleData, loadTeamRecords, loadResults } from "@/lib/server-data";
import { buildSportsEventLd, buildBreadcrumbLd } from "@/lib/structured-data";
import FilteredScheduleView from "@/app/_components/FilteredScheduleView";
import PlatformGuideSection from "@/app/_components/PlatformGuideSection";
import FaqSection from "@/app/_components/FaqSection";
import WeekHighlights from "@/app/_components/WeekHighlights";
import archiveData from "@/data/schedule-archive.json";
import {
  buildPlatformCommentaryStats,
  statsPeriod,
  summarySentence,
} from "@/lib/commentary-stats";
import type { ScheduleData } from "@/types/schedule";

// 데이터가 빌드 번들에 있어 재생성해도 같은 HTML 이다. 신선도는 배포가 만든다.
// (2026-08-18 Hobby 한도 초과로 600 → 3600. 상세는 page.tsx 주석)
export const revalidate = 3600;

export function generateStaticParams() {
  return PLATFORM_SEO.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const meta = findPlatformBySlug(params.slug);
  if (!meta) return {};

  const url = `https://haeseol.com/platform/${meta.slug}`;
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url,
      siteName: "한해설",
      locale: "ko_KR",
      type: "website",
      images: [
        {
          url: "https://haeseol.com/og-default.png",
          width: 1200,
          height: 630,
          alt: "한해설 - 스포츠 한국어해설 편성표",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: ["https://haeseol.com/og-default.png"],
    },
  };
}

/**
 * 이 플랫폼의 한국어 해설 비율.
 *
 * 🔴 아카이브(과거 누적)로 센다 — 앞으로의 편성은 해설 여부가 확정 전인 경우가 많아
 * 미확인이 부풀고 비율이 실제와 어긋난다.
 *
 * 이 한 줄이 플랫폼 페이지 10개를 "편성표 + 안내문"에서 벗어나게 한다. 우리만 가진
 * 수치이고, 다른 사이트가 복제할 수 없다(빙이 2026-08-19 duplicate content 를
 * 권고 항목으로 띄웠다 — 그 정반대 방향이다).
 */
const ARCHIVE = archiveData as unknown as ScheduleData;
const COMMENTARY_STATS = buildPlatformCommentaryStats(ARCHIVE.schedules);
const STATS_PERIOD = statsPeriod(ARCHIVE.schedules);

export default function PlatformPage({ params }: { params: { slug: string } }) {
  const meta = findPlatformBySlug(params.slug);
  if (!meta) notFound();

  const guide = PLATFORM_GUIDES[params.slug];
  const faqs = PLATFORM_FAQS[params.slug];
  const schedules = loadScheduleData().schedules;
  const teamRecords = loadTeamRecords();
  const results = loadResults();

  const pageUrl = `https://haeseol.com/platform/${meta.slug}`;
  const matched = schedules.filter((s) => meta.match.includes(s.platform));
  const sportsEventLd = buildSportsEventLd(matched, pageUrl);
  const breadcrumbLd = buildBreadcrumbLd([
    { name: "한해설", url: "https://haeseol.com" },
    { name: `${meta.display} 편성표`, url: pageUrl },
  ]);

  // 표기가 갈리는 플랫폼이 있어 meta.match 로 찾는다(표시명과 편성 표기가 다를 수 있다).
  const stat = COMMENTARY_STATS.find((s) => meta.match.includes(s.name));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbLd }}
      />
      {sportsEventLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: sportsEventLd }}
        />
      )}
      <FilteredScheduleView
        meta={meta}
        kind="platform"
        schedules={schedules}
        teamRecords={teamRecords}
        results={results}
        guideSlot={
          <>
            {stat && stat.total > 0 && (
              <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <h2 className="mb-2 text-sm font-semibold text-zinc-200">
                  {meta.display} 한국어 해설 비율
                </h2>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {summarySentence(stat, STATS_PERIOD)}
                </p>
                {stat.leagues.length > 1 && (
                  <p className="mt-2 text-sm text-zinc-400">
                    리그별로는{" "}
                    {stat.leagues
                      .slice(0, 3)
                      .map(
                        (l) =>
                          `${l.name} ${l.ratio === null ? "확인 불가" : `${l.ratio.toFixed(0)}%`}`,
                      )
                      .join(" · ")}
                    입니다.
                  </p>
                )}
                <p className="mt-2 text-xs text-zinc-500">
                  <Link
                    href="/commentary/stats"
                    className="text-zinc-400 hover:text-white hover:underline"
                  >
                    플랫폼 10곳 전체 집계 보기 →
                  </Link>
                </p>
              </section>
            )}
            {guide ? <PlatformGuideSection guide={guide} display={meta.display} /> : null}
          </>
        }
        highlightsSlot={
          <WeekHighlights
            title={`이번 주 ${meta.display} 빅매치`}
            schedules={schedules}
            platform={meta.match}
            days={7}
            emptyText={`이번 주 예정된 ${meta.display} 중계가 없습니다.`}
          />
        }
        faqSlot={
          faqs ? (
            <FaqSection title={`${meta.display} 자주 묻는 질문`} faqs={faqs} />
          ) : undefined
        }
      />
    </>
  );
}
