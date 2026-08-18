import type { GameStatus, GoalEvent, MatchResult, ResultsData } from "@/types/results";
import { NAVER_TO_SCHEDULE_TEAM_NAME } from "@/lib/team-records/team-name-aliases";
import { resultKey } from "./lookup";
import { pLimit } from "@/lib/crawlers/_utils";

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
  winner?: string; // "HOME" / "AWAY" — 무승부여도 승부차기로 갈리면 채워짐
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
  england2: ["EFL 챔피언십"],
  facup: ["잉글랜드 FA컵"],
  primera: ["라리가"],
  seria: ["세리에A"],
  coppaitalia: ["코파 이탈리아"],
  bundesliga: ["분데스리가"],
  ligue1: ["리그 1"],
  mls: ["MLS"],
  kleague: ["K리그", "K리그1"],
  kleague2: ["K리그2"],
  champs: ["챔피언스리그"],
  europa: ["유로파리그"],
  eredivisie: ["에레디비시"],
  denmark: ["수페르리가"],
  acl: ["ACL"],
  amatch: ["남자축구 국가대표팀", "친선 경기", "국가 친선경기"],
  amatchfriendly: ["친선 경기", "국가 친선경기"],
  clubfriendly: ["클럽 친선경기"],
  communityshield: ["FA 커뮤니티 실드"],
  uefasupercup: ["UEFA 슈퍼컵"],
  koreacup: ["코리아컵"],
  dfbpokal: ["DFB-포칼"],
  germansupercup: ["프란츠 베켄바워 슈퍼컵"],
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
  // 업스트림(네이버)이 응답하지 않을 때 무한 대기 방지(특히 /api/live 핫패스).
  const res = await fetch(`${BASE}${path}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(8000),
    // 🔴 필수. 이거 없으면 Next.js Data Cache 가 응답을 붙잡는다.
    // dateRange() 의 from/to 는 toYmd(KST) 라 URL 이 KST 하루 내내 고정이고,
    // 라우트에 dynamic="force-dynamic" 이 있어도 라이브러리 내부 fetch 까지는
    // 막지 못했다. 그 결과 /api/live 가 "그날 첫 폴링 시점" 스냅샷에 얼어붙어
    // 끝난 경기를 계속 진행중으로 내보냈다(2026-07-15 발견).
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Naver HTTP ${res.status}: ${path}`);
  const json = (await res.json()) as NaverApiResponse<T>;
  if (!json.success || !json.result) return null;
  return json.result;
}

/** 네이버 game.scorers 한 명. */
interface NaverScorer {
  time?: number;
  addedTime?: number;
  playerName?: string;
  ownGoal?: boolean;
}
interface NaverGameDetail {
  game?: {
    scorers?: { home?: NaverScorer[]; away?: NaverScorer[] } | null;
    hasPtScore?: boolean;
    homePtScore?: number | null;
    awayPtScore?: number | null;
  };
}

/** 경기 상세에서 가져온 추가 정보(득점자 + 승부차기 점수). */
export interface GameDetail {
  goals: GoalEvent[];
  homePtScore?: number;
  awayPtScore?: number;
}

/**
 * 축구 경기 상세에서 득점자·득점시간 + 승부차기 점수를 가져온다
 * (목록 API엔 없어 경기별 호출 필요). 실패하면 빈 값(표시는 생략).
 * scorers.home/away는 g.homeTeamName/awayTeamName 기준 → MatchResult의 home/away와 동일 방향.
 * (schedule와의 home/away 역전은 findResult에서 처리)
 */
export async function fetchGameDetail(gameId: string): Promise<GameDetail> {
  let detail: NaverGameDetail | null;
  try {
    detail = await naverGet<NaverGameDetail>(`/schedule/games/${gameId}`);
  } catch {
    return { goals: [] };
  }
  const game = detail?.game;
  const sc = game?.scorers;
  const map = (arr: NaverScorer[] | undefined, team: "home" | "away"): GoalEvent[] =>
    (arr ?? [])
      .filter((s) => s.playerName && typeof s.time === "number")
      .map((s) => ({
        team,
        player: s.playerName!,
        minute: s.time!,
        ...(s.addedTime ? { addedTime: s.addedTime } : {}),
        ...(s.ownGoal ? { ownGoal: true } : {}),
      }));
  const goals = sc
    ? [...map(sc.home, "home"), ...map(sc.away, "away")].sort(
        (a, b) => a.minute + (a.addedTime ?? 0) - (b.minute + (b.addedTime ?? 0)),
      )
    : [];
  const pt =
    game?.hasPtScore && typeof game.homePtScore === "number" && typeof game.awayPtScore === "number"
      ? { homePtScore: game.homePtScore, awayPtScore: game.awayPtScore }
      : {};
  return { goals, ...pt };
}

/** 득점자만 필요한 곳(백필 등)용 얇은 래퍼. */
export async function fetchGoals(gameId: string): Promise<GoalEvent[]> {
  return (await fetchGameDetail(gameId)).goals;
}

/** 네이버 winner("HOME"/"AWAY") → 우리 방향. 무승부·미정은 undefined. */
function mapWinner(winner: string | undefined): "home" | "away" | undefined {
  const w = (winner ?? "").toUpperCase();
  if (w === "HOME") return "home";
  if (w === "AWAY") return "away";
  return undefined;
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

// 축구 카테고리(득점자 상세 조회 대상). 목록 API엔 superCategoryId가 없어 categoryId로 판별.
// 야구(kbo,mlb)·농구(kbl,nba) 외 LEAGUES의 나머지 = 전부 축구.
export const SOCCER_CATEGORIES = new Set([
  "epl", "england2", "facup", "primera", "seria", "coppaitalia", "bundesliga",
  "ligue1", "mls", "kleague", "kleague2", "champs", "europa", "eredivisie",
  "denmark", "acl", "amatch", "amatchfriendly", "worldcup",
  "clubfriendly", "communityshield", "uefasupercup", "koreacup",
  "dfbpokal", "germansupercup",
]);

/** 결과 크롤 대상. LEAGUE_TO_CATEGORY 가 가리키는 categoryId 는 전부 여기 있어야 한다
 *  (매핑만 있고 크롤을 안 하면 스코어가 영영 안 붙는다 — league-coverage.test.ts 가 검사). */
export const LEAGUES: Array<{ categoryId: string; label: string }> = [
  { categoryId: "kbo", label: "KBO" },
  { categoryId: "mlb", label: "MLB" },
  { categoryId: "kbl", label: "KBL" },
  { categoryId: "nba", label: "NBA" },
  { categoryId: "epl", label: "EPL" },
  { categoryId: "england2", label: "EFL 챔피언십" },
  { categoryId: "facup", label: "FA컵" },
  { categoryId: "primera", label: "라리가" },
  { categoryId: "seria", label: "세리에A" },
  { categoryId: "coppaitalia", label: "코파 이탈리아" },
  { categoryId: "bundesliga", label: "분데스리가" },
  { categoryId: "ligue1", label: "리그1" },
  { categoryId: "mls", label: "MLS" },
  { categoryId: "kleague", label: "K리그1" },
  { categoryId: "kleague2", label: "K리그2" },
  { categoryId: "champs", label: "챔스" },
  { categoryId: "europa", label: "유로파" },
  { categoryId: "eredivisie", label: "에레디비시" },
  { categoryId: "denmark", label: "수페르리가" },
  { categoryId: "acl", label: "ACL" },
  { categoryId: "amatch", label: "A매치(한국)" },
  { categoryId: "amatchfriendly", label: "국가대표 친선" },
  { categoryId: "clubfriendly", label: "클럽 친선" },
  { categoryId: "communityshield", label: "커뮤니티 실드" },
  { categoryId: "uefasupercup", label: "UEFA 슈퍼컵" },
  { categoryId: "koreacup", label: "코리아컵" },
  { categoryId: "worldcup", label: "월드컵" },
  { categoryId: "dfbpokal", label: "DFB-포칼" },
  { categoryId: "germansupercup", label: "독일 슈퍼컵" },
];

/** NaverGame → MatchResult 매핑(득점자 상세 제외). 유효하지 않으면 null.
 *  crawlAllResults(전체)·crawlLiveResults(진행중·종료만) 공용 — 두 함수의 매핑 중복 제거.
 *  needsDetail=true 면 축구 득점자/승부차기 상세를 추가 조회해야 하는 경기. */
function mapGameToResult(g: NaverGame): {
  result: MatchResult;
  homeAliases: string[];
  awayAliases: string[];
  needsDetail: boolean;
} | null {
  const date = formatDate(g.gameDate);
  const categoryId = g.categoryId;
  const home = g.homeTeamName;
  const away = g.awayTeamName;
  if (!date || !categoryId || !home || !away) return null;

  const status = mapStatus(g);
  const homeAliases = expandAliases(categoryId, home);
  const awayAliases = expandAliases(categoryId, away);
  // 정규+연장 무승부인데 승자가 있으면(=승부차기로 갈림) winner를 채워 승패 표시.
  const decisiveDraw =
    status === "finished" &&
    typeof g.homeTeamScore === "number" &&
    g.homeTeamScore === g.awayTeamScore &&
    !!mapWinner(g.winner);
  const result: MatchResult = {
    date,
    categoryId,
    ...(g.gameId ? { gameId: g.gameId } : {}),
    // 1차 표기는 alias map의 두 번째 변형(있으면)을 사용 — schedule.json 호환 우선.
    homeTeam: homeAliases[1] ?? homeAliases[0],
    awayTeam: awayAliases[1] ?? awayAliases[0],
    ...(typeof g.homeTeamScore === "number" ? { homeScore: g.homeTeamScore } : {}),
    ...(typeof g.awayTeamScore === "number" ? { awayScore: g.awayTeamScore } : {}),
    status,
    ...(g.statusInfo ? { period: g.statusInfo } : {}),
    ...(decisiveDraw ? { winner: mapWinner(g.winner) } : {}),
  };
  // 축구 종료/진행 경기 중 골이 있거나 승부차기로 갈린 경우만 상세(득점자+승부차기) 조회.
  const totalGoals = (g.homeTeamScore ?? 0) + (g.awayTeamScore ?? 0);
  const needsDetail =
    SOCCER_CATEGORIES.has(categoryId) &&
    !!g.gameId &&
    (totalGoals > 0 || decisiveDraw) &&
    (status === "finished" || status === "live");
  return { result, homeAliases, awayAliases, needsDetail };
}

/** detailJobs(득점자/승부차기 조회 대상)를 동시 6건 병렬로 채운다.
 *  results/byKey 가 같은 result 객체를 참조하므로 여기서의 변이가 그대로 반영된다. */
async function fillDetails(jobs: { gameId: string; result: MatchResult }[]): Promise<void> {
  await pLimit(jobs, 6, async ({ gameId, result }) => {
    const detail = await fetchGameDetail(gameId);
    if (detail.goals.length > 0) result.goals = detail.goals;
    if (typeof detail.homePtScore === "number") {
      result.homePtScore = detail.homePtScore;
      result.awayPtScore = detail.awayPtScore;
    }
  });
}

/**
 * 라이브 전용 경량 크롤 (/api/live 핫패스용).
 * crawlAllResults와 달리: ①리그를 병렬 호출 ②진행중/종료 경기만 포함(예정·취소 제외로 payload 축소)
 * ③득점자 상세는 "진행중 축구"만 추가 조회(종료 경기 득점자는 30분 주기 결과 크롤이 채움).
 * 반환은 동일한 ResultsData 모양 → 클라가 빌드시 results 위에 byKey로 머지해 카드 스코어만 갱신.
 */
export async function crawlLiveResults(): Promise<ResultsData> {
  const lists = await Promise.all(
    LEAGUES.map((lg) => fetchLeagueGames(lg.categoryId).catch(() => [] as NaverGame[])),
  );
  const allGames = lists.flat();

  const results: MatchResult[] = [];
  const byKey: Record<string, MatchResult> = {};
  // 상세(득점자+승부차기) 조회 대상을 모아 뒤에서 병렬 조회(핫패스에서 직렬 8초 누적 방지).
  const detailJobs: { gameId: string; result: MatchResult }[] = [];

  for (const g of allGames) {
    // 라이브 화면에 필요한 건 진행중·종료뿐(예정/취소는 빌드 데이터로 충분).
    const status = mapStatus(g);
    if (status !== "live" && status !== "finished") continue;

    const mapped = mapGameToResult(g);
    if (!mapped) continue;
    const { result, homeAliases, awayAliases, needsDetail } = mapped;
    if (needsDetail) detailJobs.push({ gameId: g.gameId!, result });

    results.push(result);
    for (const h of homeAliases) {
      for (const a of awayAliases) {
        byKey[resultKey(result.date, result.categoryId, h, a)] = result;
      }
    }
  }

  await fillDetails(detailJobs);

  return {
    lastUpdated: new Date().toISOString(),
    byKey,
    results,
  };
}

export async function crawlAllResults(): Promise<ResultsData> {
  // 리그를 병렬 호출(기존 직렬 → 30분 주기 크롤 시간 단축). 라이브 크롤과 동일 방식.
  const lists = await Promise.all(
    LEAGUES.map((lg) =>
      fetchLeagueGames(lg.categoryId)
        .then((games) => {
          console.log(`  [${lg.label}] ${games.length}건`);
          return games;
        })
        .catch((e) => {
          console.error(`  [${lg.label}] ❌ ${(e as Error).message}`);
          return [] as NaverGame[];
        }),
    ),
  );
  const allGames = lists.flat();

  const results: MatchResult[] = [];
  const byKey: Record<string, MatchResult> = {};
  const detailJobs: { gameId: string; result: MatchResult }[] = [];

  for (const g of allGames) {
    const mapped = mapGameToResult(g);
    if (!mapped) continue;
    const { result, homeAliases, awayAliases, needsDetail } = mapped;
    if (needsDetail) detailJobs.push({ gameId: g.gameId!, result });

    results.push(result);
    for (const h of homeAliases) {
      for (const a of awayAliases) {
        byKey[resultKey(result.date, result.categoryId, h, a)] = result;
      }
    }
  }

  // 상세(득점자/승부차기) 조회를 병렬로(기존 루프 내 직렬 await → N+1 해소).
  await fillDetails(detailJobs);

  return {
    lastUpdated: new Date().toISOString(),
    byKey,
    results,
  };
}
