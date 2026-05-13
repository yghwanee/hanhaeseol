import type { GameStatus, MatchResult, ResultsData } from "@/types/results";
import { NAVER_TO_SCHEDULE_TEAM_NAME } from "@/lib/team-records/team-name-aliases";
import { resultKey } from "./lookup";

const BASE = "https://api-gw.sports.naver.com";
const HEADERS = {
  Referer: "https://m.sports.naver.com/",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
};

/** 네이버 schedule API 응답 한 건. 종목/리그마다 누락 필드가 있을 수 있으므로 모두 optional. */
interface NaverGame {
  gameId?: string;
  gameDate?: string; // "YYYYMMDD"
  gameDateTime?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeTeamScore?: number | null;
  awayTeamScore?: number | null;
  statusCode?: string; // RESULT / STARTED / BEFORE / READY / CANCEL / POSTPONE 등
  statusInfo?: string | null; // 라이브 시 "9회말", "전반전" 등
  categoryId?: string; // "epl", "kbo" 등
  superCategoryId?: string; // "baseball", "football", "basketball", "volleyball"
  cancel?: boolean;
  cancelReason?: string | null;
}

interface NaverScheduleResult {
  games?: NaverGame[];
}

interface NaverApiResponse<T> {
  code: number;
  success: boolean;
  result?: T;
}

/** 네이버 statusCode → 우리 GameStatus. 미상은 scheduled로 보수적 분류. */
function mapStatus(g: NaverGame): GameStatus {
  if (g.cancel) {
    const reason = (g.cancelReason ?? "").toLowerCase();
    if (reason.includes("연기") || reason.includes("postpone")) return "postponed";
    return "canceled";
  }
  const s = (g.statusCode ?? "").toUpperCase();
  if (s === "RESULT" || s === "END" || s === "FINISH") return "finished";
  if (s === "STARTED" || s === "LIVE" || s === "PROGRESS") return "live";
  if (s === "CANCEL") return "canceled";
  if (s === "POSTPONE" || s === "DELAY") return "postponed";
  return "scheduled";
}

/**
 * 네이버 gameDate를 "YYYY-MM-DD" 형식으로 정규화.
 * 2026년경 네이버 API 변경으로 응답이 "YYYY-MM-DD" 하이픈 포함 형식으로 바뀜.
 * 옛 "YYYYMMDD" 8자 숫자 응답도 들어올 경우를 위해 폴백 변환 유지.
 */
function formatDate(input: string | undefined): string | null {
  if (!input) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  if (/^\d{8}$/.test(input)) {
    return `${input.slice(0, 4)}-${input.slice(4, 6)}-${input.slice(6, 8)}`;
  }
  return null;
}

/** 네이버 팀명에 대해 schedule.json 표기 alias를 모두 수집 (원본 포함). */
function expandAliases(league: string, naverTeam: string): string[] {
  const aliasMap = findAliasMapByCategory(league);
  const mapped = aliasMap[naverTeam];
  const out = new Set<string>([naverTeam]);
  if (mapped) {
    if (Array.isArray(mapped)) {
      for (const m of mapped) out.add(m);
    } else {
      out.add(mapped);
    }
  }
  return [...out];
}

/** team-name-aliases는 schedule.league 키지만, 우리는 categoryId로 받음. 역매핑. */
const CATEGORY_TO_LEAGUE_KEYS: Record<string, string[]> = {
  kbo: ["KBO"],
  mlb: ["MLB"],
  kbl: ["KBL"],
  nba: ["NBA"],
  epl: ["프리미어리그"],
  primera: ["라리가"],
  seria: ["세리에A"],
  bundesliga: ["분데스리가"],
  ligue1: ["리그 1"],
  mls: ["MLS"],
  kleague: ["K리그", "K리그1"],
  kleague2: ["K리그2"],
  champs: ["챔피언스리그"],
  europa: ["유로파리그"],
  eredivisie: ["에레디비시"],
};

function findAliasMapByCategory(categoryId: string): Record<string, string | string[]> {
  const keys = CATEGORY_TO_LEAGUE_KEYS[categoryId] ?? [];
  const merged: Record<string, string | string[]> = {};
  for (const k of keys) {
    const m = NAVER_TO_SCHEDULE_TEAM_NAME[k];
    if (m) Object.assign(merged, m);
  }
  return merged;
}

async function naverGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Naver HTTP ${res.status}: ${path}`);
  const json = (await res.json()) as NaverApiResponse<T>;
  if (!json.success || !json.result) return null;
  return json.result;
}

/** YYYY-MM-DD 포맷 (KST). 네이버 API가 2026년경 하이픈 포맷만 받도록 바뀜. */
function toYmd(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 어제부터 오늘+1일까지 3일치 (KST). 진행 중/끝난 경기 둘 다 잡기 위함. */
function dateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return { from: toYmd(from), to: toYmd(to) };
}

/**
 * 한 리그(categoryId)에 대해 schedule API 호출.
 * 과거에는 upperCategoryId=baseball 식으로 종목 단위 조회가 가능했으나,
 * 2026년경 네이버 API 변경으로 upperCategoryId의 baseball/football/basketball/volleyball 값이
 * 빈 응답을 주게 되어 리그별 categoryId 단위로 조회한다.
 */
async function fetchLeagueGames(categoryId: string): Promise<NaverGame[]> {
  const { from, to } = dateRange();
  const path =
    `/schedule/games?categoryId=${categoryId}` +
    `&fromDate=${from}&toDate=${to}&size=500`;
  const r = await naverGet<NaverScheduleResult>(path);
  return r?.games ?? [];
}

const LEAGUES: Array<{ categoryId: string; label: string }> = [
  { categoryId: "kbo", label: "KBO" },
  { categoryId: "mlb", label: "MLB" },
  { categoryId: "kbl", label: "KBL" },
  { categoryId: "nba", label: "NBA" },
  { categoryId: "epl", label: "EPL" },
  { categoryId: "primera", label: "라리가" },
  { categoryId: "seria", label: "세리에A" },
  { categoryId: "bundesliga", label: "분데스리가" },
  { categoryId: "ligue1", label: "리그1" },
  { categoryId: "mls", label: "MLS" },
  { categoryId: "kleague", label: "K리그1" },
  { categoryId: "kleague2", label: "K리그2" },
  { categoryId: "champs", label: "챔스" },
  { categoryId: "europa", label: "유로파" },
  { categoryId: "eredivisie", label: "에레디비시" },
];

export async function crawlAllResults(): Promise<ResultsData> {
  const allGames: NaverGame[] = [];
  for (const lg of LEAGUES) {
    try {
      const games = await fetchLeagueGames(lg.categoryId);
      console.log(`  [${lg.label}] ${games.length}건`);
      allGames.push(...games);
    } catch (e) {
      console.error(`  [${lg.label}] ❌ ${(e as Error).message}`);
    }
  }

  const results: MatchResult[] = [];
  const byKey: Record<string, MatchResult> = {};

  for (const g of allGames) {
    const date = formatDate(g.gameDate);
    const categoryId = g.categoryId;
    const home = g.homeTeamName;
    const away = g.awayTeamName;
    if (!date || !categoryId || !home || !away) continue;

    // 결과 표기는 naver 원본을 1차 표기로, alias 다 적용해 byKey에 채움.
    const homeAliases = expandAliases(categoryId, home);
    const awayAliases = expandAliases(categoryId, away);
    const status = mapStatus(g);
    const result: MatchResult = {
      date,
      categoryId,
      // 1차 표기는 alias map의 첫 번째 변형(있으면 그것)을 사용 — schedule.json 호환 우선.
      homeTeam: homeAliases[1] ?? homeAliases[0],
      awayTeam: awayAliases[1] ?? awayAliases[0],
      ...(typeof g.homeTeamScore === "number" ? { homeScore: g.homeTeamScore } : {}),
      ...(typeof g.awayTeamScore === "number" ? { awayScore: g.awayTeamScore } : {}),
      status,
      ...(g.statusInfo ? { period: g.statusInfo } : {}),
    };
    results.push(result);

    for (const h of homeAliases) {
      for (const a of awayAliases) {
        byKey[resultKey(date, categoryId, h, a)] = result;
      }
    }
  }

  return {
    lastUpdated: new Date().toISOString(),
    byKey,
    results,
  };
}
