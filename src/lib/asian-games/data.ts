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
  /** 네이버 세부 종목 id(예: `ESPOLOL`). e스포츠처럼 한 종목 안에 게임이 여럿일 때 가른다. */
  event?: string;
  /**
   * 이 경기에 나서는 **한국 선수 이름**(네이버 `koreanPlayers`). 없으면 필드 자체를 뺀다.
   * 🔴 손으로 명단을 적지 않는다 — 네이버가 대회 중 채워 넣는 값이라 매시 크롤이 따라간다.
   * `김도영 아시안게임` 8,920/월처럼 사람들은 선수 이름으로 찾는다(2026-09-21 실측).
   */
  players?: string[];
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
    event: s("eventId") || undefined,
    ...(koreanNames(raw).length ? { players: koreanNames(raw) } : {}),
  };
}

function koreanNames(raw: Record<string, unknown>): string[] {
  const list = Array.isArray(raw.koreanPlayers) ? (raw.koreanPlayers as { name?: unknown }[]) : [];
  return [...new Set(list.map((p) => (typeof p.name === "string" ? p.name.trim() : "")).filter(Boolean))];
}

/**
 * 편성 행(`schedule.json`)이 아시안게임 경기인가.
 *
 * 🔴 리그명을 문자열 하나로 비교하지 말 것. SPOTV NOW 는 `아이치-나고야 아시안게임`(하이픈)으로
 * 주는데 상수는 `아이치·나고야`(가운뎃점)였다 — 허브의 중계 뱃지가 개막 후에도 **하나도**
 * 안 붙었다(2026-09-21 발견). 표기가 또 바뀌어도 걸리게 「아시안게임」만 본다.
 */
export function isAgScheduleLeague(league: string): boolean {
  return /아시안\s*게임/.test(league);
}

/**
 * 네이버 ↔ SPOTV NOW 국가명 차이. 공백을 다 지운 뒤 비교하고, 이름 자체가 다른 것만 여기 적는다.
 * 🔴 실제로 어긋난 것만 넣을 것(2026-09-21 편성 16건 대조: `사우디아라비아`↔`사우디 아라비아` 는
 * 공백 제거로 풀리고, `대만`↔`차이니스 타이베이` 만 이름이 다르다).
 */
const COUNTRY_ALIAS: Record<string, string> = {
  대만: "차이니스타이베이",
  중화타이베이: "차이니스타이베이",
};

function normCountry(name: string): string {
  const n = name.replace(/\s+/g, "");
  return COUNTRY_ALIAS[n] ?? n;
}

/**
 * 한국 경기 ↔ 편성 행 매칭 키. 날짜 + 두 팀(순서 무관).
 * 네이버와 SPOTV NOW 가 홈/원정을 반대로 적는 경우가 있어 정렬해서 묶는다.
 * 시각은 넣지 않는다 — 사전방송 때문에 편성 시각이 경기 시각과 다를 수 있다.
 */
export function broadcastKey(date: string, a: string, b: string): string {
  return `${date}|${[normCountry(a), normCountry(b)].sort().join("|")}`;
}

export function groupByDate(games: AgGame[]): [string, AgGame[]][] {
  const m = new Map<string, AgGame[]>();
  for (const g of [...games].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))) {
    if (!m.has(g.date)) m.set(g.date, []);
    m.get(g.date)!.push(g);
  }
  return [...m.entries()];
}

// ───────────────────────── 종목별 페이지(`/asian-games/[sport]`) ─────────────────────────

/**
 * 종목별 페이지 목록 — 「아시안게임 축구 일정」「아시안게임 롤 일정」 검색의 착지점.
 *
 * 🔴 허브(`/asian-games`)는 한국 경기만 다룬다. 여기는 그 종목 **전 경기**를 든다 —
 * e스포츠는 조 추첨 전이라 참가국이 비어 있어 `koreaPlayer` 가 전부 false 다(2026-09-21 실측
 * 163경기). 한국 경기만 거르면 「롤 일정」을 찾는 사람에게 빈 페이지를 준다.
 *
 * 🔴 Hobby 한도 때문에 **종목 수를 늘리기 전에 검색 수요부터 볼 것**. 한 장당 하루 4번
 * 재생성이라 ISR 쓰기는 무시할 수준이지만, 경기별 매치 페이지는 여전히 만들지 않는다.
 */
export type AgSport = {
  slug: string;
  /** 네이버 `disciplineName` 과 정확히 같아야 한다. 한 종목이 여러 세부 종목으로 쪼개져 오면 다 적는다
   *  (양궁 = 리커브+컴파운드, 태권도 = 품새+겨루기+버추얼, 농구 = 5대5+3x3). */
  disciplines: string[];
  /** 화면·제목에 쓰는 이름. */
  name: string;
  /** 편성(`schedule.json`)의 `sport` 값. 한국어 해설 중계를 붙일 때 쓴다. 없으면 편성 매칭 안 함. */
  scheduleSport?: string;
  /** 제목에 괄호로 붙이는 검색어(예: 롤). */
  alias?: string;
};

/**
 * 🔴 순서와 구성은 **검색광고 실측 검색량**으로 정했다(2026-09-21, 월간 PC+모바일):
 *   축구 322,000 · 야구일정 90,400 · 롤 73,200 · 배구 16,100 · e스포츠종목 8,710 ·
 *   양궁 8,470 · 배드민턴 8,090 · 탁구 5,300 · 골프 2,850 · 핸드볼 1,750.
 * 농구(19)·수영(18)·태권도(18)는 도구 수치가 바닥이지만 한국 메달 종목이라 대회 중 실검이 붙는다
 * — 데이터가 이미 있어 비용이 0 이므로 같이 연다.
 */
export const AG_SPORTS: AgSport[] = [
  { slug: "soccer", disciplines: ["축구"], name: "축구", scheduleSport: "축구" },
  { slug: "baseball", disciplines: ["야구"], name: "야구", scheduleSport: "야구" },
  // 🔴 alias(롤)를 뗐다 — 롤은 `/asian-games/lol` 이 받는다. 둘 다 `롤` 을 달면 서로 순위를 깎는다.
  { slug: "esports", disciplines: ["e스포츠"], name: "e스포츠" },
  { slug: "volleyball", disciplines: ["배구"], name: "배구", scheduleSport: "배구" },
  { slug: "basketball", disciplines: ["농구", "3x3 농구"], name: "농구", scheduleSport: "농구" },
  { slug: "archery", disciplines: ["양궁 리커브", "양궁 컴파운드"], name: "양궁" },
  { slug: "badminton", disciplines: ["배드민턴"], name: "배드민턴" },
  { slug: "table-tennis", disciplines: ["탁구"], name: "탁구" },
  { slug: "swimming", disciplines: ["수영"], name: "수영" },
  { slug: "golf", disciplines: ["골프"], name: "골프" },
  { slug: "handball", disciplines: ["핸드볼"], name: "핸드볼" },
  { slug: "taekwondo", disciplines: ["태권도 품새", "태권도 겨루기", "버추얼 태권도"], name: "태권도" },
];

export function agSportBySlug(slug: string): AgSport | undefined {
  return AG_SPORTS.find((s) => s.slug === slug);
}

export type AgSportsData = {
  lastUpdated: string;
  /** 그 종목 전 경기(날짜·시각 순). */
  games: AgGame[];
};

/**
 * 🔴 종목마다 **파일을 나눈다**. 한 파일에 12종목을 담으면 409KB 였고(2026-09-21 실측),
 * 종목 페이지 하나를 여는 사람이 나머지 11종목까지 받게 된다. 파일당 5~40KB 다.
 */
export const agSportsFile = (slug: string) => `asian-games/${slug}.json`;
export const agSportsRawUrl = (slug: string) =>
  `https://raw.githubusercontent.com/yghwanee/hanhaeseol/main/public/${agSportsFile(slug)}`;

/**
 * e스포츠 세부 종목 이름. 네이버 `title` 은 대개 「리그 오브 레전드 A조 1경기」처럼 게임명으로
 * 시작하지만 그란투리스모 예선은 「타임어택 예선 매치 1」이라 제목만으로는 못 가른다 → eventId 로 묶는다.
 * 순서 = 화면 순서. 🔴 롤을 맨 앞에 둔다 — 「아시안게임 롤 일정」이 이 페이지의 주 검색어다.
 */
export const ESPORTS_TITLES: { prefix: string; name: string }[] = [
  { prefix: "리그 오브 레전드", name: "리그 오브 레전드(롤)" },
  { prefix: "배틀그라운드", name: "배틀그라운드 모바일" },
  { prefix: "e풋볼", name: "e풋볼" },
  { prefix: "대전격투게임", name: "대전격투게임" },
  { prefix: "아너 오브 킹스", name: "아너 오브 킹스" },
  { prefix: "모바일 레전드", name: "모바일 레전드" },
  { prefix: "포켓몬 유나이트", name: "포켓몬 유나이트" },
  { prefix: "아이덴티티 V", name: "아이덴티티 V" },
  { prefix: "나라카", name: "나라카" },
  { prefix: "뿌요뿌요", name: "뿌요뿌요 챔피언스" },
  { prefix: "그란투리스모", name: "그란투리스모 7" },
];

/** e스포츠 경기 → 세부 종목 이름. 제목 접두어 → 같은 eventId 의 다른 경기 제목 순으로 찾는다. */
export function groupEsports(games: AgGame[]): { name: string; games: AgGame[] }[] {
  const byEvent = new Map<string, string>();
  const nameOf = (g: AgGame): string | undefined =>
    ESPORTS_TITLES.find((t) => g.title.startsWith(t.prefix))?.name;
  for (const g of games) {
    const n = nameOf(g);
    if (n && g.event && !byEvent.has(g.event)) byEvent.set(g.event, n);
  }
  const out = new Map<string, AgGame[]>();
  for (const g of games) {
    const n = nameOf(g) ?? (g.event ? byEvent.get(g.event) : undefined) ?? (g.event?.startsWith("ESPOGT") ? "그란투리스모 7" : "기타");
    if (!out.has(n)) out.set(n, []);
    out.get(n)!.push(g);
  }
  const order = (n: string) => {
    const i = ESPORTS_TITLES.findIndex((t) => t.name === n);
    return i < 0 ? 99 : i;
  };
  return [...out.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([name, gs]) => ({ name, games: gs }));
}

export const KOREA = "대한민국";

/** 대한민국 맞대결이거나, 한국 선수가 나서는 경기(개인·기록 종목). */
export function isKoreaGame(g: AgGame): boolean {
  return g.home === KOREA || g.away === KOREA || (g.players?.length ?? 0) > 0;
}

/** 종목 전체에서 한국 선수 이름을 모은다(가나다순). 선수 목록 섹션·선수단 페이지가 쓴다. */
export function koreanPlayersOf(games: AgGame[]): string[] {
  const set = new Set<string>();
  for (const g of games) for (const n of g.players ?? []) set.add(n);
  return [...set].sort((a, b) => a.localeCompare(b, "ko"));
}

/** 제목 앞 「남자」「여자」. 없으면 빈 문자열. */
export function genderOf(g: AgGame): "남자" | "여자" | "" {
  return g.title.startsWith("남자") ? "남자" : g.title.startsWith("여자") ? "여자" : "";
}

/** 대한민국 전적(끝난 맞대결만). 성별이 섞인 종목은 성별마다 따로 센다. */
export function koreaRecord(games: AgGame[]): { gender: string; win: number; draw: number; lose: number }[] {
  const m = new Map<string, { gender: string; win: number; draw: number; lose: number }>();
  for (const g of games) {
    if (!isKoreaGame(g) || g.homeScore === null || g.awayScore === null || g.status !== "RESULT") continue;
    const k = genderOf(g);
    const r = m.get(k) ?? { gender: k, win: 0, draw: 0, lose: 0 };
    const [my, op] = g.home === KOREA ? [g.homeScore, g.awayScore] : [g.awayScore, g.homeScore];
    if (my > op) r.win++;
    else if (my < op) r.lose++;
    else r.draw++;
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => a.gender.localeCompare(b.gender, "ko"));
}

/** 오늘(포함) 이후 첫 대한민국 경기. 끝난 경기는 건너뛴다. */
export function nextKoreaGame(games: AgGame[], today: string): AgGame | undefined {
  return [...games]
    .filter((g) => isKoreaGame(g) && g.date >= today && g.status !== "RESULT")
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
}

/** 「9월 22일 (화)」 */
export function fmtAgDate(date: string): string {
  const w = ["일", "월", "화", "수", "목", "금", "토"][new Date(`${date}T12:00:00Z`).getUTCDay()];
  const [, m, dd] = date.split("-");
  return `${Number(m)}월 ${Number(dd)}일 (${w})`;
}

/**
 * 조편성 — 경기 제목(「남자 D조 1경기」)에서 조와 참가국을 모은다. 「아시안게임 축구 조편성」 검색용.
 * 🔴 손으로 적지 않는다. 대진은 네이버 경기 목록이 정본이고, 조가 제목에 없는 경기(토너먼트)는 건너뛴다.
 */
export function groupStandingsTable(games: AgGame[]): { label: string; teams: string[] }[] {
  const m = new Map<string, Set<string>>();
  for (const g of games) {
    const hit = g.title.match(/^(남자|여자)?\s*([A-Z])조/);
    if (!hit || !g.home || !g.away) continue;
    const label = `${hit[1] ? `${hit[1]} ` : ""}${hit[2]}조`;
    const set = m.get(label) ?? new Set<string>();
    set.add(g.home);
    set.add(g.away);
    m.set(label, set);
  }
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "ko"))
    .map(([label, t]) => ({ label, teams: [...t].sort((a, b) => (a === KOREA ? -1 : b === KOREA ? 1 : a.localeCompare(b, "ko"))) }));
}

/**
 * 렌더 대상 경기 추리기.
 *
 * 🔴 양궁 362경기(96KB)·탁구 295 처럼 예선 라운드가 통째로 오는 종목이 있다. 전부 그리면
 * HTML 이 200KB 를 넘고, 그건 Hobby 의 Fast Origin Transfer 한도를 그대로 갉아먹는다
 * (2026-09-14 대시보드 FOT 10/10GB). 그래서 **사람이 찾는 경기만** 남긴다:
 * 한국 경기 · 메달이 걸린 경기 · 오늘 이후 경기. 그 뒤에도 많으면 최신 것부터 자른다.
 */
export const RENDER_LIMIT = 150;

export function gamesForRender(games: AgGame[], today: string): AgGame[] {
  if (games.length <= RENDER_LIMIT) return games;
  const keep = games.filter((g) => isKoreaGame(g) || g.medal || g.date >= today);
  if (keep.length <= RENDER_LIMIT) return keep;
  // 🔴 한국 경기와 메달 경기는 날짜가 멀어도 안 자른다 — 사람이 찾는 건 그것이다.
  // 나머지는 오늘에 가까운 것부터 채운다(과거는 결과, 미래는 일정 — 양쪽 다 필요하다).
  const must = keep.filter((g) => isKoreaGame(g) || g.medal);
  const rest = keep.filter((g) => !(isKoreaGame(g) || g.medal));
  const near = (g: AgGame) => Math.abs(Date.parse(`${g.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`));
  const filled = [...must, ...[...rest].sort((a, b) => near(a) - near(b))].slice(0, RENDER_LIMIT);
  return filled.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

// ───────────────────────── 롤(LoL) 전용 페이지(`/asian-games/lol`) ─────────────────────────

/** 네이버 세부 종목 id. e스포츠 파일에서 롤만 걸러 낼 때 쓴다. */
export const LOL_EVENT = "ESPOLOL";

/**
 * 대한민국 LoL 국가대표 명단.
 *
 * 🔴 **바뀌는 값을 코드에 적지 말라는 규칙의 예외다** — 단일 대회 명단이라 대회 기간 안에는
 * 안 바뀌고, 폐막(10/04) 뒤엔 페이지 자체를 정리한다. 대신 **출처와 발표일을 같이 적고
 * 화면에도 그 날짜를 박는다**(부상 교체가 나면 이 표가 틀리므로, 기준일이 보여야 한다).
 *
 * 출처: 한국e스포츠협회 공식 발표(2026-05-18), 엑스포츠뉴스 「2026 아시안게임 LoL 국가대표
 * 6인 발표」(https://v.daum.net/v/20260518140153993). 선발전 없이 프로팀 차출.
 * 감독: '히라이' 강동훈.
 */
export const LOL_ROSTER_ANNOUNCED = "2026-05-18";
export const LOL_COACH = { nick: "히라이", name: "강동훈" };
export const LOL_KOREA_ROSTER: { role: string; nick: string; name: string; team: string }[] = [
  { role: "탑", nick: "제우스", name: "최우제", team: "한화생명e스포츠" },
  { role: "정글", nick: "캐니언", name: "김건부", team: "젠지" },
  { role: "미드", nick: "페이커", name: "이상혁", team: "T1" },
  { role: "미드", nick: "제카", name: "김건우", team: "한화생명e스포츠" },
  { role: "원거리 딜러", nick: "구마유시", name: "이민형", team: "한화생명e스포츠" },
  { role: "서포터", nick: "케리아", name: "류민석", team: "T1" },
];
