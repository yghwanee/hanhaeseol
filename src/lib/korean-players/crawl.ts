import { NAVER_TO_SCHEDULE_TEAM_NAME } from "@/lib/team-records/team-name-aliases";
import {
  KR_COUNTRY_NAMES,
  MLB_KOREAN_NAMES,
  MLB_TEAM_ID_TO_SCHEDULE,
  SOCCER_SOURCES,
} from "./sources";
import type { KoreanPlayer, KoreanPlayersData } from "./types";

const NAVER = "https://api-gw.sports.naver.com";
const NAVER_HEADERS = {
  Referer: "https://m.sports.naver.com/",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
};

// 네이버 선수 목록은 페이지 파라미터가 안 먹는다(page=1·2 응답이 동일). pageSize 는 먹는데
// 1000 을 주면 빈 배열이 온다 — 500 이면 리그 전원이 한 번에 온다(EPL 478명 실측).
const PAGE_SIZE = 500;

interface NaverSeason {
  seasonCode: string;
  isSeason: "Y" | "N";
}
interface NaverPlayerStat {
  playerName?: string;
  teamName?: string;
  countryName?: string;
}

async function naverGet<T>(path: string): Promise<T> {
  const res = await fetch(`${NAVER}${path}`, {
    headers: NAVER_HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Naver HTTP ${res.status}: ${path}`);
  const json = (await res.json()) as { success: boolean; result?: T };
  if (!json.success || !json.result) throw new Error(`Naver API failed: ${path}`);
  return json.result;
}

async function currentSeasonCode(categoryId: string): Promise<string | null> {
  const r = await naverGet<{ seasons?: NaverSeason[] }>(
    `/statistics/categories/${categoryId}/seasons`,
  );
  const seasons = r.seasons ?? [];
  if (!seasons.length) return null;
  return (seasons.find((s) => s.isSeason === "Y") ?? seasons[seasons.length - 1]).seasonCode;
}

/**
 * 네이버 팀명 → schedule.json 표기 후보 전부.
 * 별칭 표가 없으면 네이버 표기를 그대로 쓴다(못 맞히면 점수만 못 받는다 — 오보는 안 난다).
 */
export function resolveTeamNames(league: string, naverTeam: string): string[] {
  const alias = NAVER_TO_SCHEDULE_TEAM_NAME[league]?.[naverTeam];
  const mapped = alias === undefined ? [] : Array.isArray(alias) ? alias : [alias];
  return [...new Set([...mapped, naverTeam])];
}

async function crawlSoccer(): Promise<{ players: KoreanPlayer[]; failures: string[] }> {
  const players: KoreanPlayer[] = [];
  const failures: string[] = [];

  for (const src of SOCCER_SOURCES) {
    try {
      const seasonCode = await currentSeasonCode(src.categoryId);
      if (!seasonCode) {
        failures.push(`${src.league}: season-not-found`);
        continue;
      }
      const r = await naverGet<{ seasonPlayerStats?: NaverPlayerStat[] }>(
        `/statistics/categories/${src.categoryId}/seasons/${seasonCode}/players?pageSize=${PAGE_SIZE}`,
      );
      const stats = r.seasonPlayerStats ?? [];
      if (stats.length === 0) {
        // 시즌 개막 전이면 통계가 비어 있다. 실패로 보지 않되 기록은 남긴다.
        failures.push(`${src.league}: empty`);
        continue;
      }
      for (const p of stats) {
        if (!p.playerName || !p.teamName) continue;
        if (!KR_COUNTRY_NAMES.has(p.countryName ?? "")) continue;
        players.push({
          name: p.playerName,
          team: resolveTeamNames(src.league, p.teamName)[0],
          teams: resolveTeamNames(src.league, p.teamName),
          league: src.league,
          source: "naver",
        });
      }
    } catch (err) {
      failures.push(`${src.league}: ${(err as Error).message}`);
    }
  }
  return { players, failures };
}

interface MlbPerson {
  id: number;
  fullName: string;
  birthCountry?: string;
  currentTeam?: { id: number; name: string };
}

async function mlbGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`MLB HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function crawlMlb(): Promise<{ players: KoreanPlayer[]; failures: string[] }> {
  const players: KoreanPlayer[] = [];
  const failures: string[] = [];
  try {
    const season = new Date().getUTCFullYear();
    const all = await mlbGet<{ people: MlbPerson[] }>(
      `https://statsapi.mlb.com/api/v1/sports/1/players?season=${season}`,
    );
    // 이름 표를 허용 목록으로 쓴다. 한국에서 태어난 미국 선수를 코리안리거로 잡지 않기 위함.
    const targets = all.people.filter((p) => MLB_KOREAN_NAMES[p.fullName]);
    if (targets.length === 0) return { players, failures: ["MLB: no-korean-players"] };

    const ids = targets.map((p) => p.id).join(",");
    const detail = await mlbGet<{ people: MlbPerson[] }>(
      `https://statsapi.mlb.com/api/v1/people?personIds=${ids}&hydrate=currentTeam`,
    );
    for (const p of detail.people) {
      const name = MLB_KOREAN_NAMES[p.fullName];
      const teamId = p.currentTeam?.id;
      if (!name || !teamId) continue;
      // 🔴 currentTeam 이 마이너 팀일 수 있다(2026-08-23 실측: 배지환=Nashville Sounds,
      // 김혜성=Oklahoma City Comets). 빅리그 30팀에 없으면 로스터에서 뺀다 —
      // 마이너에 있는 선수를 "오늘 MLB 경기 출전"처럼 내보내면 그게 오보다.
      const team = MLB_TEAM_ID_TO_SCHEDULE[teamId];
      if (!team) continue;
      players.push({ name, team, teams: [team], league: "MLB", source: "mlb-statsapi" });
    }
  } catch (err) {
    failures.push(`MLB: ${(err as Error).message}`);
  }
  return { players, failures };
}

/** 중복 제거 — 같은 선수가 리그+컵대회에 동시에 잡힌다(예: 라리가 + 챔피언스리그). */
export function dedupePlayers(players: KoreanPlayer[]): KoreanPlayer[] {
  const byName = new Map<string, KoreanPlayer>();
  for (const p of players) {
    const prev = byName.get(p.name);
    if (!prev) {
      byName.set(p.name, { ...p, teams: [...p.teams] });
      continue;
    }
    // 같은 선수가 여러 대회에 잡히면 팀 표기 후보만 합친다(리그는 먼저 잡힌 쪽 유지).
    prev.teams = [...new Set([...prev.teams, ...p.teams])];
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export async function crawlKoreanPlayers(): Promise<{
  data: KoreanPlayersData;
  failures: string[];
}> {
  const [soccer, mlb] = await Promise.all([crawlSoccer(), crawlMlb()]);
  const players = dedupePlayers([...soccer.players, ...mlb.players]);
  return {
    data: {
      generatedAt: new Date().toISOString(),
      players,
      unresolvedTeams: [],
    },
    failures: [...soccer.failures, ...mlb.failures],
  };
}
