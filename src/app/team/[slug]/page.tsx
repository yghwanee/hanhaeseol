import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import standingsData from "@/data/standings.json";
import archiveData from "@/data/schedule-archive.json";
import { loadScheduleData, loadResults, loadResultsArchive, loadTeamRecords } from "@/lib/server-data";
import { ScheduleCard } from "@/app/_components/ScheduleCard";
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
  standingContext,
  recentFormText,
  splitHomeAway,
  platformBreakdown,
  standingsWindow,
  groupGames,
  findTeamSchedules,
  opponentOf,
  type StandingsData,
  type TeamEntry,
  type TeamGame,
} from "@/lib/teams";
import { buildBreadcrumbLd } from "@/lib/structured-data";
import { fullTeamName, hasFullName, teamNameVariants } from "@/lib/team-full-names";
import { clampDescription, buildTeamFaqs } from "@/lib/seo-meta";
import FaqSection from "@/app/_components/FaqSection";
import { proxyLogo } from "@/lib/emblem";
import { getTodayString } from "@/lib/schedule-utils";
import type { Schedule } from "@/types/schedule";
import type { TeamRecord } from "@/types/team-record";
import type { MatchResult } from "@/types/results";

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


/**
 * 날짜별로 묶어 렌더한다.
 * 메인은 날짜 탭이 있어 카드에 날짜가 없어도 되지만, 팀 페이지는 여러 날이 한 화면에 섞인다.
 * 날짜가 없으면 3연전 카드 세 장이 똑같아 보인다(실제로 그렇게 나왔다).
 */
function GameList({
  games,
  recordFor,
  resultFor,
}: {
  games: TeamGame[];
  recordFor: (league: string, name: string) => TeamRecord | undefined;
  resultFor: (g: { date: string; homeTeam: string; awayTeam: string }) => MatchResult | undefined;
}) {
  const days: { date: string; items: TeamGame[] }[] = [];
  for (const g of games) {
    const last = days[days.length - 1];
    if (last && last.date === g.date) last.items.push(g);
    else days.push({ date: g.date, items: [g] });
  }

  return (
    <div className="space-y-4">
      {days.map((d) => (
        <div key={d.date}>
          <p className="mb-1.5 px-1 text-xs font-medium text-zinc-400">{formatDate(d.date)}</p>
          <div className="space-y-2">
            {d.items.map((g) => (
              <ScheduleCard
                key={g.id}
                schedule={g.source}
                query=""
                homeRecord={recordFor(g.source.league, g.source.homeTeam)}
                awayRecord={recordFor(g.source.league, g.source.awayTeam)}
                result={resultFor(g)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
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

  // 순위표 축약명(`두산`)이 아니라 정식명(`두산 베어스`)을 앞세운다. 검색 쿼리는 정식명으로
  // 들어오는데 축약명만 있으면 매칭이 안 된다. 축약명도 실제 검색어라 keywords에 함께 남긴다.
  const full = fullTeamName(team.leagueSlug, team.name);
  const variants = teamNameVariants(team.leagueSlug, team.name);

  // 🔴 `일정` 을 팀명 바로 뒤로 올린다.
  //
  // 네이버 실측(2026-08-13) — `로스앤젤레스 fc 일정` 이 노출 14,701 에 CTR 0.1% 다.
  // 팀 페이지가 실제로 받는 쿼리는 **팀명 + 일정** 형태인데, 종전 제목은
  // `… 경기 중계 어디서 보나 - 일정·한국어 해설` 이라 `일정` 이 20번째 글자 뒤에 있었다.
  // 앞자리는 검색엔진이 가장 무겁게 보는 자리이고, 한글 제목은 SERP 에서 30자 안팎에 잘린다.
  //
  // ⚠️ 순위 자체를 올리는 레버가 아니다. CTR 0.1% 의 원인이 제목이 아니라 순위일 수 있어
  // 효과를 보장하지 못한다 — 매치 제목(작업85)과 같은 성격의 변경이고 같이 관측한다.
  const title = `${full} 일정·중계 - 한국어 해설 편성표 | 한해설`;
  const description = next
    ? `${full} 다음 경기는 ${formatDate(next.date)} ${next.time} ${next.awayTeam === team.name ? next.homeTeam : next.awayTeam}전. ${next.platforms.slice(0, 2).join(", ")}에서 ${commentaryLabel(next)}로 중계됩니다. ${team.leagueName} ${team.rank}위, ${team.win}승 ${team.lose}패.`
    : `${full} ${team.leagueName} ${team.rank}위(${team.win}승 ${team.lose}패). 국내 중계는 ${platforms.join(", ") || "편성 확인 필요"}에서 볼 수 있습니다.`;

  const url = `${BASE}/team/${encodeURIComponent(team.slug)}`;
  return {
    title,
    description: clampDescription(description),
    keywords: [
      ...variants.flatMap((n) => [`${n} 중계`, `${n} 경기 일정`, `${n} 중계 어디서`, `${n} 한국어 해설`]),
      `${team.leagueName} 중계`,
    ],
    alternates: { canonical: url },
    openGraph: {
      title,
      description: clampDescription(description),
      url,
      siteName: "한해설",
      locale: "ko_KR",
      type: "website",
    },
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
  const teamRecords = loadTeamRecords();
  const today = getTodayString();

  const upcoming = upcomingFor(schedules, team, today, 6);
  const recent = recentFor(schedules, team, today, 5);
  const platforms = platformsFor(schedules, team);
  const ratio = koreanCommentaryRatio(schedules, team);
  const siblings = leagueSiblings(all, team);

  const url = `${BASE}/team/${encodeURIComponent(team.slug)}`;
  // 정식명이 본문·제목의 주 표기. 축약명은 병기해서 양쪽 검색어를 다 잡는다.
  const full = fullTeamName(team.leagueSlug, team.name);
  const showsShort = hasFullName(team.leagueSlug, team.name);
  const breadcrumbLd = buildBreadcrumbLd([
    { name: "한해설", url: BASE },
    { name: team.leagueName, url: `${BASE}/league/${team.leagueSlug}` },
    { name: full, url },
  ]);

  const recordFor = (league: string, name: string) => {
    const byLeague = teamRecords?.[league];
    if (!byLeague) return undefined;
    const key = Object.keys(byLeague).find((k) => isSameTeam(k, name));
    return key ? byLeague[key] : undefined;
  };

  const resultFor = (s: { date: string; homeTeam: string; awayTeam: string }) => {
    const match = (r: { date: string; homeTeam: string; awayTeam: string }) =>
      r.date === s.date &&
      isSameTeam(r.homeTeam, s.homeTeam) &&
      isSameTeam(r.awayTeam, s.awayTeam);
    return results?.results?.find(match) ?? resultsArchive?.results?.find(match);
  };

  // resultFor 정의 뒤에 와야 한다. splitHomeAway가 콜백을 즉시 호출해서
  // 위로 올리면 TDZ(Cannot access before initialization)로 빌드가 깨진다.
  const played = groupGames(findTeamSchedules(schedules, team)).filter((g) => g.date < today);
  const homeAway = splitHomeAway(played, team, (g) => resultFor(g));
  const breakdown = platformBreakdown(schedules, team);
  const nearby = standingsWindow(all, team, 2);

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
          <span className="text-zinc-300">{full}</span>
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
              {full} 경기 중계
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
            {full} 경기, 어디서 보나
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            {platforms.length > 0 ? (
              <>
                최근 편성 기준으로 {full}
                {showsShort && `(${team.name})`} 경기는{" "}
                <strong className="text-white">{platforms.slice(0, 3).join(", ")}</strong>
                에서 중계됩니다.{" "}
                {ratio.korean === ratio.total
                  ? "확인된 경기는 모두 한국어 해설로 제공됩니다."
                  : ratio.korean === 0
                    ? "확인된 경기는 현지 해설로 제공됩니다."
                    : `수집된 ${ratio.total}경기 중 ${ratio.korean}경기가 한국어 해설입니다.`}
              </>
            ) : (
              <>{full} 경기의 국내 중계 편성이 아직 확인되지 않았습니다.</>
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

        <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "순위", value: `${team.rank}위` },
            {
              label: "전적",
              value: `${team.win}승${team.draw > 0 ? ` ${team.draw}무` : ""} ${team.lose}패`,
            },
            typeof team.winRate === "number"
              ? { label: "승률", value: team.winRate.toFixed(3) }
              : typeof team.points === "number"
                ? { label: "승점", value: `${team.points}` }
                : null,
            typeof team.goalsDifference === "number"
              ? {
                  label: "득실차",
                  value: `${team.goalsDifference > 0 ? "+" : ""}${team.goalsDifference}`,
                }
              : typeof team.gameBehind === "number"
                ? { label: "선두와", value: `${team.gameBehind}경기` }
                : null,
          ]
            .filter((x): x is { label: string; value: string } => x !== null)
            .map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5 text-center"
              >
                <p className="text-[11px] text-zinc-500">{stat.label}</p>
                <p className="mt-0.5 text-base font-bold text-white sm:text-lg">{stat.value}</p>
              </div>
            ))}
        </section>

        {(homeAway.home.win + homeAway.home.lose + homeAway.away.win + homeAway.away.lose > 0 ||
          breakdown.length > 0) && (
          <section className="mt-4 grid gap-2 sm:grid-cols-2">
            {homeAway.home.win + homeAway.home.lose + homeAway.away.win + homeAway.away.lose >
              0 && (
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
                <h2 className="text-sm font-semibold text-white">홈·원정 성적</h2>
                <p className="mt-2 text-sm text-zinc-300">
                  홈 {homeAway.home.win}승
                  {homeAway.home.draw > 0 && ` ${homeAway.home.draw}무`} {homeAway.home.lose}패
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  원정 {homeAway.away.win}승
                  {homeAway.away.draw > 0 && ` ${homeAway.away.draw}무`} {homeAway.away.lose}패
                </p>
                <p className="mt-2 text-xs text-zinc-500">한해설이 수집한 결과 기준</p>
              </div>
            )}

            {breakdown.length > 0 && (
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
                <h2 className="text-sm font-semibold text-white">중계 플랫폼별 경기 수</h2>
                <ul className="mt-2 space-y-1.5">
                  {breakdown.slice(0, 5).map((b) => (
                    <li key={b.platform} className="flex items-center gap-2 text-sm">
                      <span className="w-28 shrink-0 truncate text-zinc-300">{b.platform}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                        <span
                          className="block h-full rounded-full bg-emerald-600/70"
                          style={{ width: `${Math.round((b.count / breakdown[0].count) * 100)}%` }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-right tabular-nums text-zinc-400">
                        {b.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {nearby.length > 1 && (
          <section className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white sm:text-base">
              {team.leagueName} 순위표
            </h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="pb-1.5 font-normal">순위</th>
                  <th className="pb-1.5 font-normal">팀</th>
                  <th className="pb-1.5 text-right font-normal">전적</th>
                  <th className="pb-1.5 text-right font-normal">
                    {typeof team.points === "number" ? "승점" : "승률"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {nearby.map((t) => {
                  const me = t.slug === team.slug;
                  return (
                    <tr key={t.slug} className={me ? "text-white" : "text-zinc-400"}>
                      <td className="py-1 tabular-nums">{t.rank}</td>
                      <td className="py-1">
                        {me ? (
                          <strong>{t.name}</strong>
                        ) : (
                          <Link
                            href={`/team/${encodeURIComponent(t.slug)}`}
                            className="hover:text-zinc-200"
                          >
                            {t.name}
                          </Link>
                        )}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {t.win}
                        {t.draw > 0 ? `-${t.draw}` : ""}-{t.lose}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {typeof t.points === "number"
                          ? t.points
                          : typeof t.winRate === "number"
                            ? t.winRate.toFixed(3)
                            : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-zinc-500">
              <Link href={`/standings/${team.leagueSlug}`} className="hover:text-zinc-300">
                {team.leagueName} 전체 순위 보기
              </Link>
            </p>
          </section>
        )}

        {upcoming.length > 0 && (
          <section className="mt-4">
            <h2 className="mb-2 px-1 text-sm font-semibold text-white sm:text-base">
              다음 경기 일정
            </h2>
            <GameList games={upcoming} recordFor={recordFor} resultFor={resultFor} />
          </section>
        )}

        {recent.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 px-1 text-sm font-semibold text-white sm:text-base">
              최근 경기 결과
            </h2>
            <GameList games={recent} recordFor={recordFor} resultFor={resultFor} />
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

        {/* 질문형 쿼리("두산 베어스 중계 어디서")가 이 페이지의 주 검색 의도다.
            ⚠️ 구글 FAQ 리치결과는 2026-05-07 폐지됐으므로 SERP 확장 목적이 아니다.
            AI 답변 엔진의 인용 단위 + 화면에 답이 보이는 이득으로 유지한다. */}
        <div className="mt-6">
          <FaqSection
            title={`${full} 중계 자주 묻는 질문`}
            faqs={buildTeamFaqs({
              fullName: full,
              leagueName: team.leagueName,
              platforms,
              koreanRatio: ratio,
              next: upcoming[0]
                ? {
                    dateLabel: formatDate(upcoming[0].date),
                    time: upcoming[0].time,
                    opponent: opponentOf(upcoming[0], team).name,
                    platforms: upcoming[0].platforms,
                  }
                : null,
            })}
          />
        </div>
      </main>
    </>
  );
}
