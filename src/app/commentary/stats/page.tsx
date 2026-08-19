import Link from "next/link";
import type { Metadata } from "next";
import archiveData from "@/data/schedule-archive.json";
import { PLATFORM_SEO, findPlatformSlugByName } from "@/lib/slugs";
import { buildBreadcrumbLd } from "@/lib/structured-data";
import {
  buildPlatformCommentaryStats,
  statsPeriod,
  MIN_LEAGUE_SAMPLE,
  type CommentaryStat,
} from "@/lib/commentary-stats";
import { SiteHeader } from "@/app/_components/SiteHeader";
import { withJosa } from "@/lib/josa";
import { AdfitBanner } from "@/app/_components/AdfitBanner";
import type { ScheduleData } from "@/types/schedule";

export const revalidate = 3600;

const BASE = "https://haeseol.com";

/**
 * 플랫폼별 한국어 해설 비율 — 원본 데이터 공개.
 *
 * 왜 만드는가 — 10개 중계 플랫폼의 **해설 언어**를 매일 수집하는 곳은 우리뿐이다.
 * 각 플랫폼은 자기 편성만 공개하고 해설 언어를 집계해 내놓지 않는다. 그래서 이건
 * 다른 데 없는 원본 데이터이고, 인용될 수 있는 형태의 사실이다.
 *
 * 빙 웹마스터가 2026-08-19 에 "고품질 도메인의 인바운드 링크 부족" 을 권고했다.
 * 백링크는 코드로 직접 만들 수 없지만, **인용 가능한 형태로 내놓는 것**까지가
 * 우리가 통제할 수 있는 범위다.
 *
 * 확실한 부수 효과: 플랫폼 페이지 10개가 "편성표 + 안내문" 에서 벗어나 우리만
 * 가진 수치를 갖게 된다(중복 콘텐츠의 정반대 방향).
 */

const archive = archiveData as unknown as ScheduleData;
const STATS = buildPlatformCommentaryStats(archive.schedules);
const PERIOD = statsPeriod(archive.schedules);

function pct(stat: CommentaryStat): string {
  if (stat.ratio === null) return "확인 불가";
  return `${stat.ratio.toFixed(1).replace(/\.0$/, "")}%`;
}

function dot(d: string) {
  return d.replace(/-/g, ".");
}

const topKorean = STATS.filter((s) => s.ratio !== null).sort((a, b) => b.ratio! - a.ratio!);
const lowest = topKorean[topKorean.length - 1];

export const metadata: Metadata = {
  title: "한국어 해설 비율 - 플랫폼별 중계 해설 언어 집계 | 한해설",
  description: PERIOD
    ? `${dot(PERIOD.from)}~${dot(PERIOD.to)} 편성 ${archive.schedules.length}건을 집계한 플랫폼별 한국어 해설 비율. SPOTV NOW·쿠팡플레이·티빙·Apple TV+ 등 10개 중계 플랫폼을 리그별로 나눠 확인하세요.`
    : "플랫폼별 한국어 해설 비율 집계.",
  keywords: [
    "한국어 해설 비율",
    "쿠팡플레이 한국어 해설",
    "SPOTV NOW 한국어 해설",
    "애플티비 한국어 중계",
    "티빙 한국어 해설",
    "중계 해설 언어",
    "현지 해설 비율",
    "스포츠 중계 해설 통계",
  ],
  alternates: { canonical: `${BASE}/commentary/stats` },
  openGraph: {
    title: "한국어 해설 비율 - 플랫폼별 중계 해설 언어 집계 | 한해설",
    description: "10개 중계 플랫폼의 한국어 해설 비율을 리그별로 집계했습니다.",
    url: `${BASE}/commentary/stats`,
    siteName: "한해설",
    locale: "ko_KR",
    type: "website",
    images: [{ url: `${BASE}/og-default.png`, width: 1200, height: 630, alt: "한해설" }],
  },
};

function StatRow({ stat, indent = false }: { stat: CommentaryStat; indent?: boolean }) {
  return (
    <tr className="border-t border-zinc-800/70">
      <td className={`py-2 pr-2 ${indent ? "pl-4 text-zinc-400" : "text-zinc-200"}`}>
        {indent ? `· ${stat.name}` : stat.name}
      </td>
      <td className="py-2 pr-2 text-right tabular-nums text-zinc-400">{stat.total}</td>
      <td className="py-2 pr-2 text-right tabular-nums text-emerald-400">{stat.korean}</td>
      <td className="py-2 pr-2 text-right tabular-nums text-rose-400">{stat.local}</td>
      <td className="py-2 pr-2 text-right tabular-nums text-zinc-500">{stat.unknown || "-"}</td>
      <td className="py-2 text-right tabular-nums font-semibold text-white">{pct(stat)}</td>
    </tr>
  );
}

export default function CommentaryStatsPage() {
  const breadcrumbLd = buildBreadcrumbLd([
    { name: "한해설", url: BASE },
    { name: "한국어 해설 편성표", url: `${BASE}/commentary` },
    { name: "플랫폼별 한국어 해설 비율", url: `${BASE}/commentary/stats` },
  ]);

  // schema.org Dataset — 이 페이지가 "글" 이 아니라 **데이터셋** 임을 명시한다.
  // 인용·수집 대상이 되는 형태다.
  const datasetLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "플랫폼별 한국어 해설 비율",
    description:
      "국내 스포츠 중계 플랫폼 10곳의 경기별 해설 언어(한국어/현지)를 수집해 플랫폼·리그별로 집계한 데이터.",
    url: `${BASE}/commentary/stats`,
    creator: { "@type": "Organization", name: "한해설", url: BASE },
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    ...(PERIOD ? { temporalCoverage: `${PERIOD.from}/${PERIOD.to}` } : {}),
    variableMeasured: [
      { "@type": "PropertyValue", name: "한국어 해설 경기 수" },
      { "@type": "PropertyValue", name: "현지 해설 경기 수" },
      { "@type": "PropertyValue", name: "한국어 해설 비율" },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetLd) }}
      />
      <main className="relative mx-auto min-h-screen max-w-2xl px-3 sm:px-4 pb-8 sm:pb-12">
        <SiteHeader />

        <div className="mt-4 sm:mt-6 mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            플랫폼별 한국어 해설 비율
          </h1>
          {/* 🔴 첫 문단은 수치를 담은 자기완결 직답으로 쓴다. AI 답변 인용은 문장
              단위로 잡히고, 인용의 상당수가 문서 앞부분에서 나온다. */}
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            {PERIOD && (
              <>
                {dot(PERIOD.from)}부터 {dot(PERIOD.to)}까지 한해설이 수집한 중계 편성{" "}
                {archive.schedules.length.toLocaleString()}건을 플랫폼별로 집계했습니다.{" "}
              </>
            )}
            같은 플랫폼이라도 리그에 따라 한국어 해설 여부가 크게 갈립니다
            {topKorean.length > 0 && lowest && (
              <>
                {/* 🔴 조사를 고정하면 `티빙 가` 가 나온다(받침 ㅇ). josa 로 고른다 —
                    플랫폼명은 한글·영문이 섞여 있어(`티빙` vs `Apple TV+`) 더 그렇다. */}
                {" "}— 확인된 경기 기준으로 {withJosa(topKorean[0].name, "이/가")}{" "}
                {pct(topKorean[0])}, {withJosa(lowest.name, "이/가")} {pct(lowest)}입니다
              </>
            )}
            .
          </p>
        </div>

        <AdfitBanner className="mb-6" />

        <section className="mb-8">
          <h2 className="mb-3 text-base sm:text-lg font-semibold text-zinc-200">
            플랫폼별 집계
          </h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-xs text-zinc-500">
                  <th className="py-2 pl-3 pr-2 text-left font-medium">플랫폼 / 리그</th>
                  <th className="py-2 pr-2 text-right font-medium">전체</th>
                  <th className="py-2 pr-2 text-right font-medium">한국어</th>
                  <th className="py-2 pr-2 text-right font-medium">현지</th>
                  <th className="py-2 pr-2 text-right font-medium">미확인</th>
                  <th className="py-2 pr-3 text-right font-medium">한국어 비율</th>
                </tr>
              </thead>
              <tbody className="[&_td:first-child]:pl-3 [&_td:last-child]:pr-3">
                {STATS.map((s) => (
                  <StatRow key={s.name} stat={s} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            한국어 비율 = 한국어 ÷ (한국어 + 현지). 해설 언어가 확인되지 않은 편성은
            분모에서 뺐습니다.
          </p>
        </section>

        <section className="mb-8 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-zinc-200">
            플랫폼 안에서도 리그마다 다릅니다
          </h2>
          {STATS.filter((s) => s.leagues.length > 1).map((s) => {
            const slug = findPlatformSlugByName(s.name);
            return (
              <div
                key={s.name}
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <h3 className="mb-2 text-sm font-semibold text-white">
                  {slug ? (
                    <Link href={`/platform/${slug}`} className="hover:underline">
                      {s.name}
                    </Link>
                  ) : (
                    s.name
                  )}{" "}
                  <span className="font-normal text-zinc-500">전체 {pct(s)}</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <tbody>
                      {s.leagues.map((l) => (
                        <StatRow key={l.name} stat={l} indent />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-zinc-500">
            표본이 {MIN_LEAGUE_SAMPLE}건 미만인 리그는 뺐습니다. 표본이 적으면 0%·100%
            같은 극단값이 쉽게 나와 오해를 부릅니다.
          </p>
        </section>

        <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-2 text-sm font-semibold text-zinc-200">집계 방법</h2>
          <ul className="space-y-1.5 text-sm text-zinc-400 leading-relaxed">
            <li>
              · 한해설이 각 플랫폼의 공개 편성 정보를 매일 수집해 쌓은 기록입니다
              {PERIOD && ` (${dot(PERIOD.from)}~${dot(PERIOD.to)})`}.
            </li>
            <li>· 한 경기가 여러 채널에 편성되면 채널마다 한 건으로 셉니다.</li>
            <li>
              · 해설 언어는 플랫폼이 제공하는 정보로 판단하며, 국내 리그(KBO·K리그 등)는
              한국어 해설로 봅니다. 판단 근거가 없으면 &quot;미확인&quot;으로 두고 비율
              계산에서 뺍니다.
            </li>
            <li>· 편성이 쌓일수록 수치가 갱신됩니다. 표본 기간은 위에 적힌 그대로입니다.</li>
            <li>
              · 이 데이터는 자유롭게 인용하실 수 있습니다. 출처로{" "}
              <span className="text-zinc-300">한해설(haeseol.com)</span>을 적어 주세요.
            </li>
          </ul>
        </section>

        <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-200">플랫폼별 편성표 보기</h2>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORM_SEO.map((p) => (
              <Link
                key={p.slug}
                href={`/platform/${p.slug}`}
                className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700/60 hover:text-white"
              >
                {p.display}
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            <Link href="/commentary" className="text-zinc-400 hover:text-white hover:underline">
              오늘부터 7일간 한국어 해설 경기 보기 →
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
