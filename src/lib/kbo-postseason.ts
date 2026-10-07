// src/lib/kbo-postseason.ts
//
// KBO 포스트시즌(가을야구) 허브 `/postseason/kbo` 의 데이터 판정. 페이지와 테스트가 같이 쓴다.
//
// 왜 이 페이지가 있나 (2026-10-07 실측):
//   · 9월 아시안게임 허브가 네이버 노출 폭증과 ChatGPT 유입(28일 471세션, 랜딩의 ~90%)을
//     만들었다. 대회가 끝나면서 그 자리가 빈다. 다음 대회가 가을야구인데 허브가 없었다
//     (가이드 글뿐 — 네이버 개별 색인이 수 주 걸려 시의성을 놓친다).
//   · 검색량(9월, 월간): 가을야구 40,890 · 한국시리즈 14,700 · 와일드카드 11,270 ·
//     포스트시즌 8,820 · 가을야구일정 5,170 · 준플레이오프 4,010 · 플레이오프 3,440.
//
// 🔴 편성 데이터에는 **라운드가 없다.** 크롤러가 `포스트시즌 와일드카드 1차전 …` 같은
// 접두를 팀명 정리 단계에서 지운다(parsers.ts `cleanTeam`). 그래서 라운드는 **시드로
// 추론**한다 — 맞붙는 두 팀의 정규시즌 순위 조합이 라운드를 하나로 정한다:
//   {4,5} 와일드카드 · 1위가 끼면 한국시리즈 · 2위가 끼면 플레이오프 · 3위가 끼면 준플레이오프.
// 순위를 모르는 팀이 끼면 라운드를 지어내지 않는다(null).
//
// 🔴 포스트시즌 경기와 정규시즌 경기를 가르는 기준은 **정규시즌 잔여 경기 수**다
// (팀당 144경기). 잔여가 0 이 된 뒤의 KBO 경기만 포스트시즌으로 센다.

import type { Schedule } from "@/types/schedule";
import type { BaseballStanding } from "@/types/standings";

export const KBO_REGULAR_GAMES = 144;
export const POSTSEASON_TEAMS = 5;

export type RoundKey = "wildcard" | "semipo" | "po" | "ks";

export interface RoundInfo {
  key: RoundKey;
  name: string;
  /** 대진 시드. 승자 쪽은 null(미정). */
  seeds: [number, number | null];
  format: string;
  home: string;
}

/** 라운드 규정(KBO 포스트시즌, 5개 팀 계단식). 규정이 바뀌면 여기 한 곳만 고친다. */
export const ROUNDS: RoundInfo[] = [
  { key: "wildcard", name: "와일드카드 결정전", seeds: [4, 5], format: "최대 2경기 · 4위가 1승을 안고 시작(1승 또는 무승부면 통과)", home: "4위 팀 홈" },
  { key: "semipo", name: "준플레이오프", seeds: [3, null], format: "5전 3선승제", home: "3위 팀 홈에서 시작" },
  { key: "po", name: "플레이오프", seeds: [2, null], format: "5전 3선승제", home: "2위 팀 홈에서 시작" },
  { key: "ks", name: "한국시리즈", seeds: [1, null], format: "7전 4선승제", home: "1위 팀 홈에서 시작" },
];

export function roundInfo(key: RoundKey): RoundInfo {
  return ROUNDS.find((r) => r.key === key)!;
}

/** 정규시즌 남은 경기 수(리그 전체). 팀별 잔여 합의 절반. */
export function remainingRegularGames(teams: BaseballStanding[]): number {
  const left = teams.reduce((sum, t) => sum + Math.max(0, KBO_REGULAR_GAMES - t.gameCount), 0);
  return Math.ceil(left / 2);
}

/** 순위 1~5위 팀. 순위표가 비면 []. */
export function postseasonSeeds(teams: BaseballStanding[]): BaseballStanding[] {
  return [...teams].sort((a, b) => a.rank - b.rank).slice(0, POSTSEASON_TEAMS);
}

/** 두 팀의 시드로 라운드를 정한다. 5위 밖 팀이 끼거나 조합이 규정에 없으면 null. */
export function roundForMatchup(seedA: number | undefined, seedB: number | undefined): RoundKey | null {
  if (!seedA || !seedB || seedA === seedB) return null;
  if (seedA > POSTSEASON_TEAMS || seedB > POSTSEASON_TEAMS) return null;
  const [hi, lo] = seedA < seedB ? [seedA, seedB] : [seedB, seedA];
  if (hi === 4 && lo === 5) return "wildcard";
  if (hi === 1) return "ks";
  if (hi === 2) return "po";
  if (hi === 3 && (lo === 4 || lo === 5)) return "semipo";
  return null;
}

export interface PostseasonGame {
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  /** 같은 경기를 중계하는 플랫폼(중복 행을 접은 것). */
  platforms: string[];
  koreanCommentary: boolean;
  round: RoundKey | null;
  /** 라운드 안에서 몇 번째 경기인지(1부터). 라운드를 모르면 null. */
  gameNo: number | null;
  /** 결과·링크용 대표 편성 행. */
  schedule: Schedule;
}

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** 같은 경기로 묶는 시각 차 상한. TV 는 경기 15분 전 사전 방송부터 편성한다(실측 18:15 vs 티빙 18:30). */
const SAME_GAME_MINUTES = 90;

/**
 * KBO 편성 행을 경기 단위로 접는다(같은 경기를 티빙·TV 채널이 각각 낸다). 시간순.
 * 같은 날·같은 두 팀이고 시각 차가 90분 이내면 한 경기다 — 더블헤더(1·2차전은 몇 시간
 * 떨어진다)는 따로 남는다. 표시 시각은 묶음에서 **가장 늦은 시각**(= 실제 경기 시작,
 * 이른 쪽은 사전 방송).
 */
export function groupKboGames(schedules: Schedule[]): Omit<PostseasonGame, "round" | "gameNo">[] {
  const rows = schedules
    .filter((s) => s.league === "KBO")
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const out: Omit<PostseasonGame, "round" | "gameNo">[] = [];
  const open = new Map<string, Omit<PostseasonGame, "round" | "gameNo">>();
  const firstMinute = new Map<string, number>();
  for (const s of rows) {
    const k = `${s.date}|${[s.homeTeam, s.awayTeam].sort().join("|")}`;
    const g = open.get(k);
    if (g && minutes(s.time) - (firstMinute.get(k) ?? 0) <= SAME_GAME_MINUTES) {
      if (!g.platforms.includes(s.platform)) g.platforms.push(s.platform);
      g.koreanCommentary = g.koreanCommentary || s.koreanCommentary === true;
      if (s.time > g.time) {
        g.time = s.time;
        g.schedule = s;
      }
      continue;
    }
    const fresh = {
      date: s.date,
      time: s.time,
      homeTeam: s.homeTeam,
      awayTeam: s.awayTeam,
      platforms: [s.platform],
      koreanCommentary: s.koreanCommentary === true,
      schedule: s,
    };
    open.set(k, fresh);
    firstMinute.set(k, minutes(s.time));
    out.push(fresh);
  }
  return out.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

/**
 * 포스트시즌 경기만 골라 라운드·차전을 붙인다.
 *
 * 포스트시즌 경기 = 시즌 연도 9월 이후 KBO 경기 중 **가을야구에 안 나가는 팀이 낀 마지막
 * 경기보다 뒤**에 열리고, 두 팀 다 5위 안인 경기. 정규시즌 마지막 날 5위 안 팀끼리의
 * 경기가 섞이지 않게 하는 장치다. 잔여 경기가 남아 있으면 빈 배열(아직 정규시즌).
 */
export function postseasonGames(
  schedules: Schedule[],
  teams: BaseballStanding[],
  season: string,
): PostseasonGame[] {
  if (teams.length === 0 || remainingRegularGames(teams) > 0) return [];
  const seedOf = new Map(postseasonSeeds(teams).map((t) => [t.teamName, t.rank]));
  const games = groupKboGames(schedules).filter((g) => g.date >= `${season}-09-01`);
  const lastRegular = games
    .filter((g) => !seedOf.has(g.homeTeam) || !seedOf.has(g.awayTeam))
    .reduce((max, g) => (g.date > max ? g.date : max), "");
  const counters = new Map<RoundKey, number>();
  return games
    .filter((g) => g.date > lastRegular && seedOf.has(g.homeTeam) && seedOf.has(g.awayTeam))
    .map((g) => {
      const round = roundForMatchup(seedOf.get(g.homeTeam), seedOf.get(g.awayTeam));
      const gameNo = round ? (counters.get(round) ?? 0) + 1 : null;
      if (round) counters.set(round, gameNo!);
      return { ...g, round, gameNo };
    });
}

export type Phase = "regular" | "postseason";

export function phaseOf(teams: BaseballStanding[]): Phase {
  return teams.length > 0 && remainingRegularGames(teams) === 0 ? "postseason" : "regular";
}
