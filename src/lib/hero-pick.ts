import type { Schedule, Sport } from "@/types/schedule";

// 한국 선수 → 소속 팀 (시즌마다 갱신 필요)
// schedule.json의 팀명 표기와 일치해야 함.
export const KOREAN_PLAYERS: Array<{ name: string; team: string }> = [
  // 축구 — 유럽
  { name: "황희찬", team: "울버햄튼" },
  { name: "이강인", team: "PSG" },
  { name: "김민재", team: "바이에른 뮌헨" },
  { name: "양민혁", team: "토트넘" },
  { name: "정우영", team: "슈투트가르트" },
  // 야구 — MLB
  { name: "김혜성", team: "LA 다저스" },
  { name: "이정후", team: "샌프란시스코 자이언츠" },
  { name: "김하성", team: "탬파베이 레이스" },
  { name: "배지환", team: "피츠버그 파이리츠" },
];

const KOREAN_PLAYER_TEAMS = new Set(KOREAN_PLAYERS.map((p) => p.team));

// ====================================================================
// Hero 매치 선정 — 종합 점수화
// ====================================================================
//
// 점수 = 한국선수(0/30) + 리그등급(5~20) + 한국시청시간대(0~15) + 빅매치업(0/5/10)
//
// 운영하면서 가중치 조정 시 이 상수만 만지면 됨.

export const HERO_WEIGHTS = {
  koreanPlayer: 30,

  leagueS: 20,
  leagueA: 15,
  leagueB: 10,
  leagueC: 5,

  primeEvening: 15,   // KST 19:00 ~ 24:00
  primeAfternoon: 10, // KST 12:00 ~ 19:00
  primeMorning: 5,    // KST 07:00 ~ 12:00
  primeDawn: 0,       // KST 00:00 ~ 07:00

  rivalry: 10,
  bigVsBig: 10,
  bigVsMid: 5,
};

// 리그 등급 (S/A/B/C)
const LEAGUE_TIER_S = new Set<string>([
  "프리미어리그",
  "챔피언스리그",
  "유로파리그",
  "라리가",
  "분데스리가",
]);
const LEAGUE_TIER_A = new Set<string>([
  "세리에A",
  "리그 1",
  "MLB",
  "K리그",
]);
const LEAGUE_TIER_B = new Set<string>([
  "KBO",
  "NBA",
  "MLS",
  "KBL",
  "ACL",
  "WKBL",
  "K리그2",
  "컨퍼런스리그",
]);

// 리그별 빅 팀 (시즌 시작에 한 번씩 갱신 권장).
// schedule.json 표기 그대로.
const BIG_TEAMS: Record<string, Set<string>> = {
  프리미어리그: new Set([
    "맨시티", "리버풀", "아스날", "첼시", "토트넘", "맨유", "뉴캐슬",
  ]),
  라리가: new Set([
    "레알 마드리드", "바르셀로나", "아틀레티코 마드리드", "AT.마드리드",
  ]),
  분데스리가: new Set([
    "바이에른 뮌헨", "도르트문트", "레버쿠젠",
  ]),
  세리에A: new Set([
    "유벤투스", "인터 밀란", "AC 밀란", "나폴리",
  ]),
  "리그 1": new Set([
    "PSG", "파리 생제르망", "마르세유", "리옹", "모나코",
  ]),
  챔피언스리그: new Set([
    "맨시티", "리버풀", "아스날", "첼시", "맨유", "토트넘",
    "레알 마드리드", "바르셀로나", "아틀레티코 마드리드",
    "바이에른 뮌헨", "도르트문트", "레버쿠젠",
    "유벤투스", "인터 밀란", "AC 밀란", "나폴리",
    "PSG",
  ]),
  MLB: new Set([
    "LA 다저스", "뉴욕 양키스", "샌프란시스코 자이언츠",
    "애틀랜타 브레이브스", "휴스턴 애스트로스",
    "뉴욕 메츠", "보스턴 레드삭스", "필라델피아 필리스",
  ]),
  KBO: new Set([
    "LG", "KIA", "두산", "삼성", "SSG",
  ]),
  NBA: new Set([
    "LA 레이커스", "골든스테이트", "보스턴", "마이애미",
    "덴버", "오클라호마시티", "뉴욕",
  ]),
  K리그: new Set([
    "울산", "전북", "포항", "서울", "FC서울",
  ]),
};

// 라이벌리 매치 — 별명 있으면 해시태그 슬롯 1에 사용.
// name 없는 라이벌리는 점수만 받고 해시태그 별명은 없음.
interface RivalryEntry {
  teams: [string, string];
  name?: string; // 해시태그 별명 (#포함)
}

const RIVALRIES: RivalryEntry[] = [
  // EPL
  { teams: ["토트넘", "아스날"], name: "#북런던더비" },
  { teams: ["맨유", "리버풀"], name: "#잉글랜드클래식" },
  { teams: ["맨시티", "맨유"], name: "#맨체스터더비" },
  { teams: ["맨시티", "리버풀"] },
  { teams: ["첼시", "아스날"] },
  { teams: ["에버턴", "리버풀"], name: "#머지사이드더비" },
  // 라리가
  { teams: ["레알 마드리드", "바르셀로나"], name: "#엘클라시코" },
  { teams: ["레알 마드리드", "아틀레티코 마드리드"], name: "#마드리드더비" },
  { teams: ["레알 마드리드", "AT.마드리드"], name: "#마드리드더비" },
  // 분데스
  { teams: ["바이에른 뮌헨", "도르트문트"], name: "#데어클라시커" },
  // 세리에A
  { teams: ["AC 밀란", "인터 밀란"], name: "#밀라노더비" },
  { teams: ["AS 로마", "라치오"], name: "#로마더비" },
  { teams: ["유벤투스", "AC 밀란"] },
  { teams: ["유벤투스", "인터 밀란"], name: "#이탈리아클래식" },
  // KBO
  { teams: ["LG", "두산"], name: "#잠실더비" },
  { teams: ["KIA", "롯데"] },
  { teams: ["SSG", "롯데"] },
  // K리그
  { teams: ["울산", "전북"], name: "#현대더비" },
];

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

const RIVALRY_KEYS = new Set(RIVALRIES.map((r) => pairKey(...r.teams)));
const RIVALRY_NAME_MAP = new Map<string, string>(
  RIVALRIES.filter((r) => r.name).map((r) => [pairKey(...r.teams), r.name!]),
);

/** 매치가 라이벌리이면 별명(#포함) 반환, 별명 없거나 라이벌리 아니면 undefined. */
export function getRivalryName(
  home: string,
  away: string | undefined,
): string | undefined {
  if (!away) return undefined;
  return RIVALRY_NAME_MAP.get(pairKey(home, away));
}

function hasKoreanPlayer(m: Schedule): boolean {
  if (KOREAN_PLAYER_TEAMS.has(m.homeTeam)) return true;
  if (m.awayTeam && KOREAN_PLAYER_TEAMS.has(m.awayTeam)) return true;
  return false;
}

function isRivalry(m: Schedule): boolean {
  if (!m.awayTeam) return false;
  return RIVALRY_KEYS.has(pairKey(m.homeTeam, m.awayTeam));
}

function scoreKoreanPlayer(m: Schedule): number {
  return hasKoreanPlayer(m) ? HERO_WEIGHTS.koreanPlayer : 0;
}

function scoreLeagueTier(m: Schedule): number {
  if (LEAGUE_TIER_S.has(m.league)) return HERO_WEIGHTS.leagueS;
  if (LEAGUE_TIER_A.has(m.league)) return HERO_WEIGHTS.leagueA;
  if (LEAGUE_TIER_B.has(m.league)) return HERO_WEIGHTS.leagueB;
  return HERO_WEIGHTS.leagueC;
}

function scorePrimeTimeKr(m: Schedule): number {
  // schedule.json의 time은 "HH:MM" KST 가정.
  const h = Number.parseInt(m.time.slice(0, 2), 10);
  if (!Number.isFinite(h)) return 0;
  if (h >= 19) return HERO_WEIGHTS.primeEvening;
  if (h >= 12) return HERO_WEIGHTS.primeAfternoon;
  if (h >= 7) return HERO_WEIGHTS.primeMorning;
  return HERO_WEIGHTS.primeDawn;
}

function scoreBigMatchup(m: Schedule): number {
  if (isRivalry(m)) return HERO_WEIGHTS.rivalry;
  const bigs = BIG_TEAMS[m.league];
  if (!bigs) return 0;
  const homeBig = bigs.has(m.homeTeam);
  const awayBig = m.awayTeam ? bigs.has(m.awayTeam) : false;
  if (homeBig && awayBig) return HERO_WEIGHTS.bigVsBig;
  if (homeBig || awayBig) return HERO_WEIGHTS.bigVsMid;
  return 0;
}

/** 종합 점수. 디버깅/로그용으로도 export. */
export function heroScore(m: Schedule): number {
  return (
    scoreKoreanPlayer(m) +
    scoreLeagueTier(m) +
    scorePrimeTimeKr(m) +
    scoreBigMatchup(m)
  );
}

// ====================================================================
// 월드컵 우선 모드 (2026 북중미 월드컵, 개막 2026-06-12)
// 후보에 월드컵 경기가 있으면 무조건 최우선.
// 월드컵끼리: 라운드 티어 → 매치업 티어(대한민국 최우선 → 강호) → 시간.
// 데이터(public/worldcup.json) 부재 시 자동 비활성(대회 종료 후 현행 동작).
// ====================================================================

const WC_LEAGUE_PREFIX = "북중미 월드컵";

// 라운드 티어 (높을수록 우선). 조별리그 league는 정확히 "북중미 월드컵"이라
// 맵에 없으면 기본 1로 처리.
const WC_ROUND_TIER: Record<string, number> = {
  "북중미 월드컵 결승": 7,
  "북중미 월드컵 4강": 6,
  "북중미 월드컵 3·4위전": 5,
  "북중미 월드컵 8강": 4,
  "북중미 월드컵 16강": 3,
  "북중미 월드컵 32강": 2,
  "북중미 월드컵": 1,
};

// 강호 풀 (시즌 중 편집 가능). 대한민국은 별도 최우선 처리.
// schedule.json/worldcup.json 국가명 표기 그대로.
const WC_POWERHOUSES = new Set<string>([
  "브라질", "아르헨티나", "프랑스", "잉글랜드", "스페인", "독일",
  "포르투갈", "네덜란드", "벨기에", "크로아티아", "우루과이",
  "일본", "멕시코", "남아프리카 공화국", "체코",
]);

const WC_KOREA = "대한민국";

export function isWorldCup(m: Schedule): boolean {
  return m.league.startsWith(WC_LEAGUE_PREFIX);
}

/** 카드/캡션/제목 라벨용: 히어로가 월드컵이면 "월드컵", 아니면(또는 없으면) "빅매치". */
export function eventWord(hero: Schedule | null): "월드컵" | "빅매치" {
  return hero && isWorldCup(hero) ? "월드컵" : "빅매치";
}

function wcRoundTier(m: Schedule): number {
  return WC_ROUND_TIER[m.league] ?? 1;
}

function wcMatchupTier(m: Schedule): number {
  if (m.homeTeam === WC_KOREA || m.awayTeam === WC_KOREA) return 3;
  const homeBig = WC_POWERHOUSES.has(m.homeTeam);
  const awayBig = m.awayTeam ? WC_POWERHOUSES.has(m.awayTeam) : false;
  if (homeBig && awayBig) return 2;
  if (homeBig || awayBig) return 1;
  return 0;
}

/**
 * Hero 정렬 비교자. 음수면 a가 우선.
 * 1) 월드컵 vs 비월드컵 → 월드컵 우선
 * 2) 둘 다 월드컵 → 라운드 티어 desc → 매치업 티어 desc → 시간 asc
 * 3) 둘 다 비월드컵 → heroScore desc → 시간 asc
 */
export function compareHero(a: Schedule, b: Schedule): number {
  const wa = isWorldCup(a);
  const wb = isWorldCup(b);
  if (wa !== wb) return wa ? -1 : 1;

  if (wa && wb) {
    const ra = wcRoundTier(a);
    const rb = wcRoundTier(b);
    if (ra !== rb) return rb - ra;
    const ma = wcMatchupTier(a);
    const mb = wcMatchupTier(b);
    if (ma !== mb) return mb - ma;
    return a.time.localeCompare(b.time);
  }

  const sa = heroScore(a);
  const sb = heroScore(b);
  if (sa !== sb) return sb - sa;
  return a.time.localeCompare(b.time);
}

/**
 * 매치 배열에서 가장 점수 높은 hero 매치 1개를 픽.
 * 동점이면 시간 빠른 순.
 */
export function pickHeroMatch(matches: Schedule[]): Schedule | null {
  if (matches.length === 0) return null;
  return [...matches].sort(compareHero)[0];
}

/**
 * 종합 점수 + 종목 다양성으로 hero 매치 N개 픽.
 * 1차: 종목당 1개씩 점수 높은 순. 2차: 남은 슬롯을 점수 순으로 채움.
 * 캡션 "오늘의 빅매치 N개" 라인 생성에 사용.
 */
export function pickHeroMatchesTop(
  matches: Schedule[],
  max: number,
): Schedule[] {
  if (matches.length === 0 || max <= 0) return [];

  const sorted = [...matches].sort(compareHero);

  const out: Schedule[] = [];
  const seenSports = new Set<Sport>();
  // 1차: 종목당 1개씩 픽
  for (const m of sorted) {
    if (out.length >= max) break;
    if (seenSports.has(m.sport)) continue;
    out.push(m);
    seenSports.add(m.sport);
  }
  // 2차: 남은 슬롯 채움
  for (const m of sorted) {
    if (out.length >= max) break;
    if (out.includes(m)) continue;
    out.push(m);
  }
  return out;
}
