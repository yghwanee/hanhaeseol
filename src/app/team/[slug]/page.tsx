import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import standingsData from "@/data/standings.json";
import archiveData from "@/data/schedule-archive.json";
import { loadScheduleData, loadResults, loadResultsArchive } from "@/lib/server-data";
import {
  buildTeamIndex,
  eligibleTeams,
  findTeamBySlug,
  upcomingFor,
  recentFor,
  platformsFor,
  koreanCommentaryRatio,
  leagueSiblings,
  isSameTeam,
  opponentOf,
  findOpponentEntry,
  standingContext,
  recentFormText,
  type StandingsData,
  type TeamEntry,
} from "@/lib/teams";
import { buildBreadcrumbLd } from "@/lib/structured-data";
import { proxyLogo } from "@/lib/emblem";
import { getTodayString } from "@/lib/schedule-utils";
import type { Schedule } from "@/types/schedule";

export const revalidate = 600;

const BASE = "https://haeseol.com";

/**
 * 페이지를 낼 팀 목록.
 *
 * 자격 판정은 편성 아카이브(시즌 전체)로 한다. 7일치 편성만 보면 이번 주 경기가 없는 팀이
 * 빠져서 URL이 주마다 생겼다 사라진다. 색인에 그보다 나쁜 신호가 없다.
 */
function allSchedules(): Schedule[] {
  return [
    ...loadScheduleData().schedules,
    ...((archiveData as unknown as { schedules: Schedule[] }).schedules ?? []),
  ];
}

function index(): TeamEntry[] {
  return eligibleTeams(
    buildTeamIndex(standingsData as unknown as StandingsData),
    allSchedules(),
  );
}

export function generateStaticParams() {
  return index().map((t) => ({ slug: t.slug }));
}

/** "2026-07-21" → "7월 21일 (화)" */
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const day = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${day})`;
}

function commentaryLabel(g: { koreanCommentary: boolean | "unknown" }): string {
  if (g.koreanCommentary === true) return "한국어 해설";
  if (g.koreanCommentary === false) return "현지 해설";
  return "해설 확인중";
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const team = findTeamBySlug(index(), decodeURIComponent(params.slug));
  if (!team) return {};

  const schedules = allSchedules();
  const next = upcomingFor(schedules, team, getTodayString(), 1)[0];
  const platforms = platformsFor(schedules, team).slice(0, 3);

  const title = `${team.name} 경기 중계 어디서 보나 - 일정·한국어 해설 | 한해설`;
  const description = next
    ? `${team.name} 다음 경기는 ${formatDate(next.date)} ${next.time} ${next.awayTeam === team.name ? next.homeTeam : next.awayTeam}전. ${next.platforms.slice(0, 2).join(", ")}에서 ${commentaryLabel(next)}로 중계됩니다. ${team.leagueName} ${team.rank}위, ${team.win}승 ${team.lose}패.`
    : `${team.name} ${team.leagueName} ${team.rank}위(${team.win}승 ${team.lose}패). 국내 중계는 ${platforms.join(", ") || "편성 확인 필요"}에서 볼 수 있습니다.`;

  const url = `${BASE}/team/${encodeURIComponent(team.slug)}`;
  return {
    title,
    description,
    keywords: [
      `${team.name} 중계`,
      `${team.name} 경기 일정`,
      `${team.name} 중계 어디서`,
      `${team.name} 한국어 해설`,
      `${team.leagueName} 중계`,
    ],
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "한해설", locale: "ko_KR", type: "website" },
  };
}

export default function TeamPage({ params }: { params: { slug: string } }) {
  const all = index();
  const team = findTeamBySlug(all, decodeURIComponent(params.slug));
  if (!team) notFound();

  const schedules = allSchedules();
  // 최근 경기 스코어는 results.json(3일 창) 밖으로 나가면 아카이브에서 찾아야 한다.
  const results = loadResults();
  const resultsArchive = loadResultsArchive();
  const today = getTodayString();

  const upcoming = upcomingFor(schedules, team, today, 6);
  const recent = recentFor(schedules, team, today, 5);
  const platforms = platformsFor(schedules, team);
  const ratio = koreanCommentaryRatio(schedules, team);
  const siblings = leagueSiblings(all, team);

  const url = `${BASE}/team/${encodeURIComponent(team.slug)}`;
  const breadcrumbLd = buildBreadcrumbLd([
    { name: "한해설", url: BASE },
    { name: team.leagueName, url: `${BASE}/league/${team.leagueSlug}` },
    { name: team.name, url },
  ]);

  const resultFor = (s: { date: string; homeTeam: string; awayTeam: string }) => {
    const match = (r: { date: string; homeTeam: string; awayTeam: string }) =>
      r.date === s.date &&
      isSameTeam(r.homeTeam, s.homeTeam) &&
      isSameTeam(r.awayTeam, s.awayTeam);
    return results?.results?.find(match) ?? resultsArchive?.results?.find(match);
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbLd }}
      />

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <nav className="mb-4 text-xs text-zinc-500 sm:text-sm">
          <Link href="/" className="hover:text-zinc-300">
            편성표
          </Link>
          <span className="px-1.5">›</span>
          <Link href={`/league/${team.leagueSlug}`} className="hover:text-zinc-300">
            {team.leagueName}
          </Link>
          <span className="px-1.5">›</span>
          <span className="text-zinc-300">{team.name}</span>
        </nav>

        <header className="flex items-center gap-4">
          {team.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxyLogo(team.logo)}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 object-contain"
            />
          )}
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">
              {team.name} 경기 중계
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {team.leagueName} {team.rank}위 · {team.win}승 {team.draw > 0 ? `${team.draw}무 ` : ""}
              {team.lose}패
              {typeof team.winRate === "number" && ` · 승률 ${team.winRate.toFixed(3)}`}
              {typeof team.points === "number" && team.points > 0 && ` · 승점 ${team.points}`}
            </p>
          </div>
        </header>

        <section className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white sm:text-base">
            {team.name} 경기, 어디서 보나
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            {platforms.length > 0 ? (
              <>
                최근 편성 기준으로 {team.name} 경기는{" "}
                <strong className="text-white">{platforms.slice(0, 3).join(", ")}</strong>
                에서 중계됩니다.{" "}
                {ratio.korean === ratio.total
                  ? "확인된 경기는 모두 한국어 해설로 제공됩니다."
                  : ratio.korean === 0
                    ? "확인된 경기는 현지 해설로 제공됩니다."
                    : `수집된 ${ratio.total}경기 중 ${ratio.korean}경기가 한국어 해설입니다.`}
              </>
            ) : (
              <>{team.name} 경기의 국내 중계 편성이 아직 확인되지 않았습니다.</>
            )}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            {[
              standingContext(team, all.find((t) => t.leagueSlug === team.leagueSlug && t.rank === 1)),
              recentFormText(team.lastFive),
              team.streak && `${team.streak.count}${team.streak.type === "W" ? "연승" : "연패"} 중`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </section>

        {upcoming.length > 0 && (
          <section className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white sm:text-base">다음 경기 일정</h2>
            <ul className="mt-3 space-y-2">
              {upcoming.map((s) => {
                const opp = opponentOf(s, team);
                const oppEntry = findOpponentEntry(all, team, opp.name);
                return (
                  <li key={s.id} className="text-sm text-zinc-300">
                    <span className="text-zinc-500">
                      {formatDate(s.date)} {s.time}
                    </span>{" "}
                    <span className="text-zinc-400">{opp.home ? "홈" : "원정"}</span>{" "}
                    {oppEntry ? (
                      <Link
                        href={`/team/${encodeURIComponent(oppEntry.slug)}`}
                        className="text-zinc-100 underline decoration-zinc-700 underline-offset-2 hover:decoration-zinc-400"
                      >
                        {opp.name}
                      </Link>
                    ) : (
                      opp.name
                    )}
                    전{" "}
                    {oppEntry && (
                      <span className="text-zinc-500">
                        ({oppEntry.rank}위 {oppEntry.win}승 {oppEntry.lose}패)
                      </span>
                    )}
                    <span className="block text-zinc-400 sm:inline">
                      {" "}
                      · {s.platforms.join(", ")} · {commentaryLabel(s)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {recent.length > 0 && (
          <section className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white sm:text-base">최근 경기 결과</h2>
            <ul className="mt-3 space-y-2">
              {recent.map((s) => {
                const r = resultFor(s);
                const goals = r?.goals ?? [];
                return (
                  <li key={s.id} className="text-sm text-zinc-300">
                    <span className="text-zinc-500">{formatDate(s.date)}</span> {s.homeTeam}{" "}
                    {r ? (
                      <strong className="text-white">
                        {r.homeScore} : {r.awayScore}
                      </strong>
                    ) : (
                      "vs"
                    )}{" "}
                    {s.awayTeam}
                    <span className="text-zinc-500"> · {s.platforms.join(", ")}</span>
                    {r?.highlightVideoId && (
                      <>
                        {" "}
                        <a
                          href={`https://www.youtube.com/watch?v=${r.highlightVideoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-300 underline decoration-zinc-700 underline-offset-2 hover:decoration-zinc-400"
                        >
                          하이라이트
                        </a>
                      </>
                    )}
                    {goals.length > 0 && (
                      <span className="block text-xs text-zinc-500">
                        {goals.map((g) => `${g.player} ${g.minute}'`).join(", ")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {siblings.length > 0 && (
          <section className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white sm:text-base">
              {team.leagueName} 다른 팀
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {siblings.map((t) => (
                <Link
                  key={t.slug}
                  href={`/team/${encodeURIComponent(t.slug)}`}
                  className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 hover:text-white"
                >
                  {t.rank}. {t.name}
                </Link>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              <Link href={`/league/${team.leagueSlug}`} className="hover:text-zinc-300">
                {team.leagueName} 전체 편성표 보기
              </Link>
            </p>
          </section>
        )}
      </main>
    </>
  );
}
