import { TeamRecord } from "@/types/team-record";
import { NAVER_TO_SCHEDULE_TEAM_NAME } from "./team-name-aliases";

interface NaverSeasonTeamStat {
  teamName: string;
  lastFiveGames?: string | null;
  // 야구/축구 필드
  winGameCount?: number;
  loseGameCount?: number;
  drawnGameCount?: number;
  wra?: number;
  // 농구/배구 필드
  wins?: number;
  losses?: number;
  winRate?: number;
}

interface NaverApiResponse<T> {
  code: number;
  success: boolean;
  result?: T;
}

interface NaverSeason {
  seasonCode: string;
  isSeason: "Y" | "N";
}

const BASE = "https://api-gw.sports.naver.com";
const HEADERS = {
  Referer: "https://m.sports.naver.com/",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
};

/** schedule.json의 league 문자열 → 네이버 categoryId. */
export const CATEGORY_ID: Record<string, string> = {
  KBO: "kbo",
  MLB: "mlb",
  프리미어리그: "epl",
  라리가: "primera",
  세리에A: "seria",
  분데스리가: "bundesliga",
  "리그 1": "ligue1",
  MLS: "mls",
  K리그: "kleague",
  K리그2: "kleague2",
  챔피언스리그: "champs",
  유로파리그: "europa",
  에레디비시: "eredivisie",
  KBL: "kbl",
  NBA: "nba",
  V리그: "kovo",
};

async function naverGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Naver HTTP ${res.status}: ${path}`);
  const json = (await res.json()) as NaverApiResponse<T>;
  if (!json.success || !json.result) throw new Error(`Naver API failed: ${path}`);
  return json.result;
}

/** /seasons에서 isSeason="Y"인 현재 시즌 코드를 가져온다. 없으면 가장 최근 시즌. */
async function fetchCurrentSeasonCode(categoryId: string): Promise<string | null> {
  const r = await naverGet<{ seasons?: NaverSeason[] }>(
    `/statistics/categories/${categoryId}/seasons`,
  );
  const seasons = r.seasons ?? [];
  if (!seasons.length) return null;
  const current = seasons.find((s) => s.isSeason === "Y");
  return current?.seasonCode ?? seasons[seasons.length - 1].seasonCode;
}

/** 한 리그의 팀별 최근 5경기 기록을 schedule.json 팀명 키로 가져온다. */
export async function fetchNaverTeamRecords(
  league: string,
): Promise<Record<string, TeamRecord>> {
  const categoryId = CATEGORY_ID[league];
  if (!categoryId) throw new Error(`Unsupported league: ${league}`);

  const seasonCode = await fetchCurrentSeasonCode(categoryId);
  if (!seasonCode) return {};

  const r = await naverGet<{ seasonTeamStats?: NaverSeasonTeamStat[] }>(
    `/statistics/categories/${categoryId}/seasons/${seasonCode}/teams`,
  );
  const stats = r.seasonTeamStats ?? [];

  const aliasMap = NAVER_TO_SCHEDULE_TEAM_NAME[league] ?? {};
  const out: Record<string, TeamRecord> = {};
  for (const t of stats) {
    if (!t.teamName) continue;
    // 종목별 필드 차이 흡수: 야구/축구는 winGameCount, 농구/배구는 wins.
    const win = t.winGameCount ?? t.wins ?? 0;
    const lose = t.loseGameCount ?? t.losses ?? 0;
    const wra = t.wra ?? t.winRate;
    const record: TeamRecord = {
      last5: t.lastFiveGames ?? "",
      win,
      lose,
      ...(t.drawnGameCount ? { draw: t.drawnGameCount } : {}),
      ...(typeof wra === "number" ? { wra } : {}),
    };
    // 네이버 원본 이름과 매핑된 schedule 이름을 모두 키로 등록.
    // schedule.json이 같은 팀을 여러 표기로 쓰는 경우(예: "AT.마드리드"와 "아틀레티코 마드리드")를 모두 커버.
    out[t.teamName] = record;
    const mapped = aliasMap[t.teamName];
    if (mapped) {
      const names = Array.isArray(mapped) ? mapped : [mapped];
      for (const n of names) out[n] = record;
    }
  }
  return out;
}
