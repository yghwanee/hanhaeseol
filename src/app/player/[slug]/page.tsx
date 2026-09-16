import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import archiveData from "@/data/schedule-archive.json";
import standingsData from "@/data/standings.json";
import {
  findTeamSchedules,
  groupGames,
  isSameTeam,
  koreanCommentaryRatio,
  opponentOf,
  platformsFor,
  recentFor,
  upcomingFor,
  type StandingsData,
  type TeamGame,
} from "@/lib/teams";
import {
  findPlayerBySlug,
  playerIndexFor,
  playerSiblings,
  type PlayerEntry,
} from "@/lib/players";
import { getKoreanPlayers, rosterGeneratedAt } from "@/lib/korean-players/load";
import {
  loadScheduleData,
  loadResults,
  loadResultsArchive,
  loadTeamRecords,
} from "@/lib/server-data";
import { getTodayString } from "@/lib/schedule-utils";
import { fullTeamName } from "@/lib/team-full-names";
import { buildBreadcrumbLd } from "@/lib/structured-data";
import { buildPlayerLead } from "@/lib/answer-lead";
import { clampDescription, buildPlayerFaqs } from "@/lib/seo-meta";
import { josa } from "@/lib/josa";
import FaqSection from "@/app/_components/FaqSection";
import { ScheduleCard } from "@/app/_components/ScheduleCard";
import { AdfitBanner } from "@/app/_components/AdfitBanner";
import { proxyLogo } from "@/lib/emblem";
import type { Schedule } from "@/types/schedule";
import type { TeamRecord } from "@/types/team-record";
import type { MatchResult } from "@/types/results";

// 날짜 의존 허브 — `revalidate` 정책 정본은 `src/app/page.tsx` 주석. 값은 배포 주기(6h)와 같다.
export const revalidate = 21600;

/**
 * 🔴 로스터가 낡으면(`ROSTER_MAX_AGE_DAYS`) `getKoreanPlayers()` 가 빈 배열을 준다.
 * 그러면 목록이 비고 선수 페이지가 통째로 사라진다 — **그게 설계다.** 낡은 로스터로
 * "손흥민 소속"을 주장하는 것보다 페이지가 없는 편이 낫다(작업97 오보 이력).
 * 크롤 실패는 `crawl-korean-players.yml` 이 텔레그램으로 알린다.
 * 사이트맵도 같은 함수를 쓰므로 둘이 어긋나지 않는다.
 */
export const dynamicParams = false;

const BASE = "https://haeseol.com";

/**
 * 🔴 팀 페이지와 같은 이유로 메모한다 — 한 장을 그리는 동안 `generateStaticParams` ·
 * `generateMetadata` · 본문이 각각 이 인덱스를 부른다. 편성 아카이브를 이어 붙이고
 * 팀 색인을 세우는 일이라 한 번이 싸지 않다(팀 페이지 실측 렌더당 CPU 860ms).
 * 입력이 전부 배포 번들 안의 정적 데이터라 몇 번을 불러도 같은 값이다.
 */
let schedulesCache: Schedule[] | null = null;
let playerCache: PlayerEntry[] | null = null;

function allSchedules(): Schedule[] {
  if (schedulesCache) return schedulesCache;
  const built = [
    ...loadScheduleData().schedules,
    ...((archiveData as unknown as { schedules: Schedule[] }).schedules ?? []),
  ];
  if (process.env.NODE_ENV === "production") schedulesCache = built;
  return built;
}

function index(): PlayerEntry[] {
  if (playerCache) return playerCache;
  const built = playerIndexFor(
    allSchedules(),
    standingsData as unknown as StandingsData,
    getKoreanPlayers(),
  );
  if (process.env.NODE_ENV === "production") playerCache = built;
  return built;
}

export function generateStaticParams() {
  return index().map((p) => ({ slug: p.slug }));
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const day = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${day})`;
}

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
          <p className="mb-1.5 px-1 text-caption1 font-medium text-fg-secondary">
            {formatDate(d.date)}
          </p>
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
  const player = findPlayerBySlug(index(), decodeURIComponent(params.slug));
  if (!player) return {};

  const schedules = allSchedules();
  const today = getTodayString();
  const next = upcomingFor(schedules, player.team, today, 1)[0];
  const full = fullTeamName(player.team.leagueSlug, player.team.name);
  const platforms = platformsFor(schedules, player.team);

  // 🔴 팀 페이지와 같은 규칙 — `중계`·`일정` 을 이름 바로 뒤에 둔다. 네이버는 한글 제목을
  // 30자 안팎에서 자르고, 실제로 들어오는 쿼리가 `<이름> 경기 중계`·`<이름> 오늘 경기` 다
  // (팀 페이지에서 `일정` 을 앞으로 올린 근거가 작업89 실측이다).
  const title = `${player.name} 경기 중계 일정 - 한국어 해설 | 한해설`;

  const opponent = next ? opponentOf(next, player.team) : undefined;
  const description = next
    ? `${player.name} 선수는 ${today} 기준 ${player.team.leagueName} ${full} 소속입니다. 다음 경기는 ${formatDate(next.date)} ${next.time} ${opponent!.name}전이며 ${next.platforms.slice(0, 2).join(", ") || "편성 확인 필요"}에서 중계됩니다. 한국어 해설 여부와 최근 경기 결과를 함께 확인하세요.`
    : `${player.name} 선수는 ${today} 기준 ${player.team.leagueName} ${full} 소속입니다. 국내 중계는 ${platforms.slice(0, 3).join(", ") || "편성 확인 필요"}에서 볼 수 있습니다. 경기 일정과 한국어 해설 여부를 확인하세요.`;

  const url = `${BASE}/player/${encodeURIComponent(player.slug)}`;
  return {
    title,
    description: clampDescription(description),
    keywords: [
      `${player.name} 경기`,
      `${player.name} 중계`,
      `${player.name} 오늘 경기`,
      `${player.name} 경기 일정`,
      `${player.name} 중계 어디서`,
      `${player.name} 한국어 해설`,
      `${player.name} ${player.team.leagueName}`,
      `${full} 중계`,
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

export default function PlayerPage({ params }: { params: { slug: string } }) {
  const all = index();
  const player = findPlayerBySlug(all, decodeURIComponent(params.slug));
  if (!player) notFound();

  const team = player.team;
  const schedules = allSchedules();
  const results = loadResults();
  const resultsArchive = loadResultsArchive();
  const teamRecords = loadTeamRecords();
  const today = getTodayString();

  const upcoming = upcomingFor(schedules, team, today, 6);
  const recent = recentFor(schedules, team, today, 5);
  const platforms = platformsFor(schedules, team);
  const ratio = koreanCommentaryRatio(schedules, team);
  const siblings = playerSiblings(all, player);
  const full = fullTeamName(team.leagueSlug, team.name);
  const url = `${BASE}/player/${encodeURIComponent(player.slug)}`;

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

  const lead = buildPlayerLead(player.name, full, team.leagueName, upcoming, today);

  const breadcrumbLd = buildBreadcrumbLd([
    { name: "한해설", url: BASE },
    { name: team.leagueName, url: `${BASE}/league/${team.leagueSlug}` },
    { name: `${player.name} 경기 중계`, url },
  ]);

  // 로스터 기준일(KST). 소속 주장에 근거를 붙이는 자리라 화면에도 보여 준다.
  const rosterDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date(rosterGeneratedAt()),
  );

  const playedCount = groupGames(findTeamSchedules(schedules, team)).filter(
    (g) => g.date < today,
  ).length;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbLd }} />

      <main className="mx-auto w-full max-w-[1100px] px-5 sm:px-6 py-6 sm:py-8">
        <nav className="mb-4 text-caption1 text-fg-tertiary sm:text-label1">
          <Link href="/" className="-my-2 inline-block py-2 hover:text-fg">
            편성표
          </Link>
          <span className="px-1.5">›</span>
          <Link
            href={`/league/${team.leagueSlug}`}
            className="-my-2 inline-block py-2 hover:text-fg"
          >
            {team.leagueName}
          </Link>
          <span className="px-1.5">›</span>
          <span className="text-fg">{player.name}</span>
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
            <h1 className="text-heading1 font-bold text-fg-strong sm:text-title3">
              {player.name} 경기 중계
            </h1>
            <p className="mt-1 text-label1 text-fg-secondary">
              {team.leagueName} {full} · {rosterDate} 기준 소속
            </p>
          </div>
        </header>

        {/* 🔴 직답 리드. [주어 + 수치 + 기준일] 을 문장 자체가 들고 있어야 답변엔진이
            문단째로 잘라 가도 뜻이 남는다(`answer-lead.ts` 주석). */}
        <section className="mt-6 rounded-xl border border-line-subtle bg-subtle p-4 sm:p-5">
          <p className="text-label1 leading-relaxed text-fg">{lead}</p>
        </section>

        {upcoming.length > 0 && (
          <section className="mt-4">
            <h2 className="mb-2 px-1 text-label1 font-semibold text-fg-strong sm:text-headline1">
              {player.name} 다음 경기
            </h2>
            <GameList games={upcoming} recordFor={recordFor} resultFor={resultFor} />
          </section>
        )}

        {/* 🔴 이 페이지는 팀 페이지로 **보내는** 링크를 반드시 들고 있어야 한다.
            순위·홈원정·플랫폼 분해는 팀 페이지 몫이다 — 여기서 또 그리면 주어만 바뀐
            중복 콘텐츠가 된다(매치 페이지가 저지른 실수와 같은 부류). */}
        <section className="mt-4 rounded-xl border border-line-subtle bg-subtle p-4 sm:p-5">
          <h2 className="text-label1 font-semibold text-fg-strong sm:text-headline1">
            {player.name} 경기, 어디서 보나
          </h2>
          <p className="mt-2 text-label1 leading-relaxed text-fg">
            {platforms.length > 0 ? (
              <>
                최근 편성 기준으로 {full} 경기는{" "}
                <strong className="text-fg-strong">{platforms.slice(0, 3).join(", ")}</strong>
                에서 중계됩니다.{" "}
                {ratio.total === 0
                  ? "해설 언어는 아직 확인되지 않았습니다."
                  : ratio.korean === ratio.total
                    ? "확인된 경기는 모두 한국어 해설로 제공됩니다."
                    : ratio.korean === 0
                      ? "확인된 경기는 현지 해설로 제공됩니다."
                      : `수집된 ${ratio.total}경기 중 ${ratio.korean}경기가 한국어 해설입니다.`}
              </>
            ) : (
              <>{full} 경기의 국내 중계 편성이 아직 확인되지 않았습니다.</>
            )}
          </p>
          <p className="mt-3 text-caption1 text-fg-tertiary">
            <Link
              href={`/team/${encodeURIComponent(team.slug)}`}
              className="-my-2 inline-block py-2 hover:text-fg"
            >
              {full} 순위·홈원정 성적·전체 일정 보기
            </Link>
          </p>
        </section>

        <div className="mt-4">
          <AdfitBanner slot="inline" />
        </div>

        {recent.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 px-1 text-label1 font-semibold text-fg-strong sm:text-headline1">
              {full} 최근 경기 결과
            </h2>
            <GameList games={recent} recordFor={recordFor} resultFor={resultFor} />
            {playedCount > recent.length && (
              <p className="mt-2 px-1 text-caption1 text-fg-tertiary">
                한해설이 수집한 {full} 경기 {playedCount}건 중 최근 {recent.length}건입니다.
              </p>
            )}
          </section>
        )}

        {siblings.length > 0 && (
          <section className="mt-4 rounded-xl border border-line-subtle bg-subtle p-4 sm:p-5">
            <h2 className="text-label1 font-semibold text-fg-strong sm:text-headline1">
              다른 코리안리거 중계
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {siblings.map((s) => (
                <Link
                  key={s.slug}
                  href={`/player/${encodeURIComponent(s.slug)}`}
                  className="w-chip w-chip--sm"
                >
                  {s.name} · {s.team.name}
                </Link>
              ))}
            </div>
            <p className="mt-3 text-caption1 text-fg-tertiary">
              소속은 {rosterDate} 기준이고 매일 갱신됩니다.
            </p>
          </section>
        )}

        <div className="mt-6">
          <FaqSection
            title={`${player.name} 중계 자주 묻는 질문`}
            faqs={buildPlayerFaqs({
              name: player.name,
              teamFullName: full,
              leagueName: team.leagueName,
              today,
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

        <p className="mt-6 text-caption1 text-fg-tertiary">
          {player.name}
          {josa(player.name, "이/가")} 뛰는 {team.leagueName} 전체 편성은{" "}
          <Link
            href={`/league/${team.leagueSlug}`}
            className="-my-2 inline-block py-2 underline hover:text-fg"
          >
            {team.leagueName} 중계 편성표
          </Link>
          에서 볼 수 있습니다.
        </p>
      </main>
    </>
  );
}
