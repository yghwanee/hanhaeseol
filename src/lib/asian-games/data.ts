/**
 * 2026 아이치·나고야 아시안게임 허브(`/asian-games`) 데이터 규칙.
 *
 * 원천 = 네이버 스포츠 이벤트 앱 API(`/olympic/asiangames2026/*`, 인증 불필요).
 * 일반 리그 API(`/schedule/games?categoryId=`)에는 이 대회가 없다 — 후보 id 전부 400
 * (2026-09-14 실측). 네이버가 종합대회를 별도 앱으로 다루기 때문이다.
 *
 * 🔴 Vercel Hobby 한도(FOT·ISR Writes)가 이미 턱밑이라 설계를 가볍게 잡았다.
 *  - 페이지는 **한 장**. 경기별 매치 페이지를 만들지 않는다(월드컵 때 ISR 쓰기의 주범).
 *  - 국기 이미지를 안 쓴다. pstatic 은 핫링크 403 이라 `/api/emblem` 프록시를 타야 하는데
 *    그러면 국가 45개 × 방문마다 함수 호출·FOT 가 붙는다.
 *  - 최신값은 브라우저가 GitHub raw 에서 받는다(Vercel 을 안 거친다). 서버 렌더는 배포
 *    시점 데이터로 그려 검색엔진이 내용을 볼 수 있게 한다.
 *
 * 순수 함수만 둔다(클라이언트·서버·테스트가 같이 쓴다).
 */

export const AG_EVENT = "asiangames2026";
/** 편성 데이터(`schedule.json`)의 league 표기. SPOTV NOW 가 이렇게 준다. */
export const AG_LEAGUE = "아이치·나고야 아시안게임";
export const AG_OPEN = "2026-09-19";
export const AG_CLOSE = "2026-10-04";
/** 개막 전 예선이 먼저 열린다(농구 9/10, 여자축구 9/14 — 위키백과 2026 아시안 게임). */
export const AG_FIRST_GAME = "2026-09-10";
/** 이 날(포함)까지 홈 배너를 띄운다. 폐막 다음 날 하루는 결과를 보러 오는 사람이 있다. */
export const AG_BANNER_UNTIL = "2026-10-05";
export const AG_RAW_URL =
  "https://raw.githubusercontent.com/yghwanee/hanhaeseol/main/public/asian-games.json";

export type AgMedalRow = {
  countryId: string;
  countryName: string;
  rank: number;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
};

export type AgDisciplineMedal = {
  name: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
};

export type AgGame = {
  id: string;
  date: string;
  time: string;
  discipline: string;
  title: string;
  /** 단체 맞대결이면 양 팀, 개인·기록 종목이면 빈 문자열. */
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  statusInfo: string;
  /** 메달이 걸린 경기(결승·동메달결정전 등). */
  medal: boolean;
};

export type AsianGamesData = {
  lastUpdated: string;
  medals: AgMedalRow[];
  korea: (Omit<AgMedalRow, "countryId" | "countryName"> & { disciplines: AgDisciplineMedal[] }) | null;
  koreaGames: AgGame[];
};

/**
 * 금 → 은 → 동 순으로 정렬하고 공동 순위를 매긴다.
 *
 * 🔴 네이버 `rankOrder` 를 그대로 쓰지 않는다. 메달이 0개인 개막 전에는 45개국이 전부
 * `rankOrder:1` 로 온다(2026-09-14 실측). 그걸 표에 찍으면 "1위 45개국" 이 된다.
 */
export function rankMedals(rows: Omit<AgMedalRow, "rank">[]): AgMedalRow[] {
  const sorted = [...rows].sort(
    (a, b) =>
      b.gold - a.gold ||
      b.silver - a.silver ||
      b.bronze - a.bronze ||
      a.countryName.localeCompare(b.countryName, "ko"),
  );
  let rank = 0;
  return sorted.map((r, i) => {
    const prev = sorted[i - 1];
    const tied = prev && prev.gold === r.gold && prev.silver === r.silver && prev.bronze === r.bronze;
    if (!tied) rank = i + 1;
    return { ...r, rank };
  });
}

/** 메달이 하나라도 나왔나. 0이면 순위표 대신 "첫 메달 전" 안내를 보여 준다. */
export function medalsStarted(rows: AgMedalRow[]): boolean {
  return rows.some((r) => r.total > 0);
}

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** 개막까지 남은 날. 개막 당일 0, 개막 후 음수. */
export function daysToOpen(today: string): number {
  return dayDiff(today, AG_OPEN);
}

export type AgPhase = "before" | "prelim" | "live" | "closed" | "over";

/**
 * 대회 국면. 배너 문구와 노출 여부가 여기서 갈린다.
 *  before  = 첫 예선 전 · prelim = 예선은 시작, 개막 전 · live = 개막~폐막
 *  closed  = 폐막 다음 날(배너 유지) · over = 그 뒤(배너 내림)
 */
export function agPhase(today: string): AgPhase {
  if (today < AG_FIRST_GAME) return "before";
  if (today < AG_OPEN) return "prelim";
  if (today <= AG_CLOSE) return "live";
  if (today <= AG_BANNER_UNTIL) return "closed";
  return "over";
}

/**
 * 크롤 대상 날짜 = 대회 전 기간(첫 예선 ~ 폐막).
 *
 * 🔴 처음엔 "어제~6일 뒤" 만 받았다. 그러면 페이지가 대회 전체 한국 일정을 못 보여 준다
 * (2026-09-14 화니 지적). 한국 경기는 전 기간 116건 · 약 25KB 라 통째로 들고 있어도 된다.
 */
export function crawlDates(): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${AG_FIRST_GAME}T00:00:00Z`); t <= Date.parse(`${AG_CLOSE}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** 네이버 경기 원본 → 화면용. 필요한 필드만 남겨 JSON 크기를 줄인다. */
export function toAgGame(raw: Record<string, unknown>): AgGame {
  const s = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  const dt = s("gameDateTime"); // "2026-09-17T16:00:00" (KST)
  const home = s("homeTeamName");
  const away = s("awayTeamName");
  const status = s("statusCode");
  // 🔴 예정 경기도 스코어가 0:0 으로 온다. 맞대결이 아니거나 시작 전이면 점수를 버린다.
  const showScore = !!home && !!away && status !== "BEFORE" && status !== "";
  const num = (k: string) => (showScore && typeof raw[k] === "number" ? (raw[k] as number) : null);
  return {
    id: s("gameId"),
    date: s("gameDate") || dt.slice(0, 10),
    time: dt.slice(11, 16),
    discipline: s("disciplineName"),
    title: s("title"),
    home,
    away,
    homeScore: num("homeTeamScore"),
    awayScore: num("awayTeamScore"),
    status,
    statusInfo: s("statusInfo"),
    medal: raw.medal === true,
  };
}

export function groupByDate(games: AgGame[]): [string, AgGame[]][] {
  const m = new Map<string, AgGame[]>();
  for (const g of [...games].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))) {
    if (!m.has(g.date)) m.set(g.date, []);
    m.get(g.date)!.push(g);
  }
  return [...m.entries()];
}
