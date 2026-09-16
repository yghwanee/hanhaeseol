/**
 * 코리안리거 선수 페이지(`/player/[slug]`).
 *
 * 왜 만드는가 — 팀 페이지가 실제로 잡힌다. 네이버 30일 실측(2026-08-13, 작업89)에서
 * `/team/mls-로스앤젤레스-FC` 가 웹문서 **9위 · 57클릭 · 66,777노출** 이었고, 그 쿼리
 * 형태가 `로스앤젤레스 fc 일정` 이었다. 사람들은 팀보다 **선수 이름**으로 더 많이 찾는다
 * (`손흥민 경기 중계` · `이정후 오늘 경기`). 그 질문의 답은 우리 데이터에 전부 있다 —
 * 다음 경기 · 중계 플랫폼 · **한국어 해설 여부**.
 *
 * 리그·팀 페이지와 무엇이 다른가 — 주어가 사람이다. 팀 페이지는 "LAFC 의 다음 경기",
 * 이 페이지는 "손흥민을 어디서 보나" 에 답한다. 그 차이가 없으면 그냥 중복 콘텐츠라
 * 선수 페이지는 팀 페이지로 **보내는** 링크를 반드시 들고 있어야 한다.
 *
 * 🔴 선수→팀은 손으로 적지 않는다. `korean-players.json` 이 매일 자동 갱신된다
 * (`crawl-korean-players.yml`, KST 04:37). 이강인 PSG→AT마드리드를 한 달 넘게 못 따라가
 * 오보를 낸 전례가 있다(작업97).
 */
import type { Schedule } from "@/types/schedule";
import {
  buildTeamIndex,
  eligibleTeams,
  findTeamSchedules,
  isSameTeam,
  type StandingsData,
  type TeamEntry,
} from "@/lib/teams";
import type { KoreanPlayer } from "@/lib/korean-players/load";

export type PlayerEntry = {
  /** URL 슬러그. 한글 이름 그대로 쓴다(팀 슬러그도 한글을 쓴다). */
  slug: string;
  name: string;
  /** 로스터가 적은 리그 표기(`MLS`·`분데스리가`·`MLB` …). 대회명일 수 있다. */
  league: string;
  /** 편성 데이터(`Schedule.sport`) 표기 */
  sport: string;
  /** 해석된 소속팀. 여기까지 와야 페이지가 생긴다. */
  team: TeamEntry;
};

/**
 * 로스터 리그 표기 → 편성 종목 표기.
 *
 * 🔴 종목으로 자르지 않으면 **다른 종목 팀에 붙는다.** 실측(2026-09-16): `isSameTeam` 이
 * 접두 매칭이라 MLS 김기희(시애틀 사운더스)가 MLB `시애틀` 에, MLS 정상빈(세인트루이스
 * 시티)이 MLB `세인트루이스` 에 붙었다. `TeamEntry.sport` 주석이 경고하는 그 함정이고,
 * 도시명을 공유하는 미국 리그 조합에서 통째로 일어난다.
 *
 * 리그로 자르지 않는 이유도 같은 주석에 있다 — 컵대회(UCL·유로파)는 리그명이 달라서
 * 리그로 자르면 그 경기가 사라진다.
 */
const BASEBALL_LEAGUES = new Set(["MLB", "KBO"]);

export function sportOfPlayerLeague(league: string): string {
  return BASEBALL_LEAGUES.has(league) ? "야구" : "축구";
}

/**
 * 선수 목록을 팀 인덱스에 붙인다.
 *
 * 🔴 **후보가 유일할 때만 붙인다.** 둘 이상이면 버린다 — 틀린 팀을 붙이는 것보다
 * 페이지가 없는 편이 낫다(`results/lookup` 의 한쪽 일치 안전망과 같은 판단).
 * 동명이인도 같은 이유로 둘 다 버린다.
 *
 * @param players   `getKoreanPlayers()` 결과. 로스터가 낡으면 빈 배열이 와서 결과도 빈다.
 * @param teamIndex `eligibleTeams()` 를 이미 통과한 목록 — 국내 중계가 한 번도 없는 팀은
 *                  여기서 이미 빠져 있어야 "중계 없음"만 적힌 빈 페이지가 안 생긴다.
 */
export function buildPlayerIndex(
  players: KoreanPlayer[],
  teamIndex: TeamEntry[],
): PlayerEntry[] {
  const nameCount = new Map<string, number>();
  for (const p of players) nameCount.set(p.name, (nameCount.get(p.name) ?? 0) + 1);

  const out: PlayerEntry[] = [];
  for (const p of players) {
    if ((nameCount.get(p.name) ?? 0) !== 1) continue;
    const sport = sportOfPlayerLeague(p.league);
    const candidates = teamIndex.filter(
      (t) =>
        t.sport === sport &&
        p.teams.some((n) => isSameTeam(n, t.name) || isSameTeam(t.name, n)),
    );
    if (candidates.length !== 1) continue;
    out.push({
      slug: p.name,
      name: p.name,
      league: p.league,
      sport,
      team: candidates[0],
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

/**
 * 페이지를 낼 선수만 남긴다.
 *
 * 팀 인덱스가 이미 "중계가 한 번이라도 잡힌 팀"으로 좁혀져 있지만, 여기서 한 번 더
 * 편성 건수를 센다. 팀 인덱스를 만들 때 쓴 목록과 페이지가 읽는 목록이 다를 수 있다.
 */
export function eligiblePlayers(
  index: PlayerEntry[],
  schedules: Schedule[],
  minGames = 1,
): PlayerEntry[] {
  return index.filter((p) => findTeamSchedules(schedules, p.team).length >= minGames);
}

export function findPlayerBySlug(
  index: PlayerEntry[],
  slug: string,
): PlayerEntry | undefined {
  return index.find((p) => p.slug === slug);
}

/** 같은 리그의 다른 코리안리거. 내부 링크용 — 선수 페이지끼리 고아가 되지 않게. */
export function playerSiblings(
  index: PlayerEntry[],
  player: PlayerEntry,
  limit = 8,
): PlayerEntry[] {
  const sameLeague = index.filter(
    (p) => p.slug !== player.slug && p.team.leagueSlug === player.team.leagueSlug,
  );
  const rest = index.filter(
    (p) => p.slug !== player.slug && p.team.leagueSlug !== player.team.leagueSlug,
  );
  return [...sameLeague, ...rest].slice(0, limit);
}

/**
 * 🔴 사이트맵과 페이지가 **같은 함수**로 목록을 만들게 하려고 둔다.
 *
 * 종목 허브 주석(`sitemap.ts`)이 같은 말을 한다 — 게이트가 어긋나면 사이트맵이 없는
 * URL 을 올리거나(404) 있는 URL 을 빠뜨린다. 선수 페이지는 `dynamicParams=false` 라
 * 어긋나는 순간 사이트맵에 404 가 올라간다.
 */
export function playerIndexFor(
  schedules: Schedule[],
  standings: StandingsData,
  players: KoreanPlayer[],
): PlayerEntry[] {
  const teams = eligibleTeams(buildTeamIndex(standings), schedules);
  return eligiblePlayers(buildPlayerIndex(players, teams), schedules);
}
