import { Schedule } from "@/types/schedule";
import { WorldCupStandings, WorldCupGroup } from "@/types/worldcup";

// 2026 북중미 월드컵 편성 = 네이버 스포츠 비공개 API (인증 불필요).
// gameDateTime이 이미 KST라 시간대 변환 불필요.
// 호출당 최대 10경기만 반환하므로 날짜 단위로 끊어 받아 gameId로 dedup.
interface NaverGame {
  gameId: string;
  gameDate: string; // "2026-06-12" (KST)
  gameDateTime: string; // "2026-06-12T11:00:00" (KST)
  homeTeamName: string;
  awayTeamName: string;
  homeTeamEmblemUrl: string | null; // 국기 이미지 (미정 경기는 null)
  awayTeamEmblemUrl: string | null;
}

const API = "https://api-gw.sports.naver.com/schedule/games?categoryId=worldcup";
const TOURNAMENT_START = "2026-06-11";
const TOURNAMENT_END = "2026-07-20";

// 조별리그는 6/28(KST)에 끝나고 토너먼트는 6/29부터 시작. 진출 확정 전엔 팀명이
// "미정"이지만, 확정되면 실팀명으로 바뀌므로 라운드 판별은 팀명이 아니라 날짜로 한다.
const KNOCKOUT_START_DATE = "2026-06-29";

// 토너먼트 라운드: 날짜순으로 누적해 라벨링. [32강16, 16강8, 8강4, 4강2, 3·4위전1, 결승1] = 32.
const ROUND_BUCKETS: [number, string][] = [
  [16, "32강"],
  [8, "16강"],
  [4, "8강"],
  [2, "4강"],
  [1, "3·4위전"],
  [1, "결승"],
];

function roundLabel(knockoutIndex: number): string {
  let acc = 0;
  for (const [count, label] of ROUND_BUCKETS) {
    acc += count;
    if (knockoutIndex < acc) return label;
  }
  return "토너먼트";
}

async function fetchDay(day: string): Promise<NaverGame[]> {
  const res = await fetch(`${API}&fromDate=${day}&toDate=${day}`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://m.sports.naver.com/",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json?.result?.games ?? [];
}

export async function crawlWorldcup(): Promise<Schedule[]> {
  const days: string[] = [];
  const start = new Date(`${TOURNAMENT_START}T00:00:00Z`);
  const end = new Date(`${TOURNAMENT_END}T00:00:00Z`);
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }

  const byId = new Map<string, NaverGame>();
  for (const day of days) {
    try {
      for (const g of await fetchDay(day)) byId.set(g.gameId, g);
    } catch (e) {
      console.error(`  ✗ 월드컵 ${day}: ${e}`);
    }
  }

  const all = [...byId.values()].sort((a, b) => a.gameDateTime.localeCompare(b.gameDateTime));

  let knockoutCount = 0;
  let knockoutIdx = 0;
  const schedules: Schedule[] = [];
  for (const g of all) {
    const isKnockout = g.gameDate >= KNOCKOUT_START_DATE;
    if (isKnockout) knockoutCount++;
    const league = isKnockout ? `북중미 월드컵 ${roundLabel(knockoutIdx++)}` : "북중미 월드컵";
    schedules.push({
      id: `worldcup-${g.gameId}`,
      date: g.gameDate,
      time: g.gameDateTime.slice(11, 16), // "HH:MM"
      sport: "축구",
      league,
      homeTeam: g.homeTeamName || "미정",
      awayTeam: g.awayTeamName || "미정",
      platform: "JTBC",
      koreanCommentary: true,
      ...(g.homeTeamEmblemUrl ? { homeEmblem: g.homeTeamEmblemUrl } : {}),
      ...(g.awayTeamEmblemUrl ? { awayEmblem: g.awayTeamEmblemUrl } : {}),
    });
  }

  // 토너먼트가 32경기가 아니면 라운드 라벨 누적이 어긋날 수 있어 경고만 남김(데이터는 유지).
  if (knockoutCount !== 32) {
    console.warn(`  ⚠ 월드컵 토너먼트 경기 수 ${knockoutCount} (예상 32) — 라운드 라벨 확인 필요`);
  }

  return schedules;
}

// ── 조별 순위 ──────────────────────────────────────────────
// 2026 북중미 월드컵 시즌 코드 (네이버 record 페이지 seasonCode). 대회 고정값.
const SEASON_CODE = "3F9X";

interface NaverTeamStat {
  teamName: string;
  group: string;
  rank: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  goalsConceded: number;
  goalsDifference: number;
  points: number;
  teamEmblemUrl: string | null;
  tournamentSimulation: { roundOf16?: number } | null;
}

export async function crawlWorldcupStandings(): Promise<WorldCupStandings | null> {
  const url = `https://api-gw.sports.naver.com/statistics/categories/worldcup/seasons/${SEASON_CODE}/teams`;
  let stats: NaverTeamStat[] = [];
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://m.sports.naver.com/", Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    stats = json?.result?.seasonTeamStats ?? [];
  } catch (e) {
    console.error(`  ✗ 월드컵 순위: ${e}`);
    return null;
  }
  if (stats.length === 0) return null;

  const byGroup = new Map<string, WorldCupGroup>();
  for (const t of stats) {
    const g = t.group;
    if (!g) continue;
    if (!byGroup.has(g)) byGroup.set(g, { group: g, teams: [] });
    byGroup.get(g)!.teams.push({
      name: t.teamName,
      rank: t.rank,
      played: t.matchesPlayed,
      win: t.wins,
      draw: t.draws,
      loss: t.losses,
      gf: t.goals,
      ga: t.goalsConceded,
      gd: t.goalsDifference,
      points: t.points,
      ...(t.teamEmblemUrl ? { emblem: t.teamEmblemUrl } : {}),
      ...(typeof t.tournamentSimulation?.roundOf16 === "number" ? { advanceProb: t.tournamentSimulation.roundOf16 } : {}),
    });
  }

  const groups = [...byGroup.values()]
    .map((g) => ({ ...g, teams: g.teams.sort((a, b) => a.rank - b.rank) }))
    .sort((a, b) => a.group.localeCompare(b.group));

  return { lastUpdated: new Date().toISOString(), groups };
}
