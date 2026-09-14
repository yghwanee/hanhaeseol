import type { Schedule } from "@/types/schedule";
import { LEAGUE_SEO, type SeoMeta } from "@/lib/slugs";

/**
 * 종목별 편성표 페이지(`/sport/[slug]`).
 *
 * 왜 만드는가 — 네이버 30일 실측(2026-08-19)에서 **전용 페이지가 없는데도** 종목
 * 쿼리가 CTR 두 자릿수로 잡히고 있었다:
 *
 *   오늘 야구 해설        358노출  75클릭  20.9%
 *   야구 편성표           366     51      13.9%
 *   kbo 편성표             46     12      26.1%
 *   오늘 야구 해설 확인 방법  282     14       5%
 *
 * 그동안 라우트가 league·platform·standings·team·match·commentary·guide 뿐이라
 * 종목이 통째로 비어 있었고, 저 쿼리들은 `/league/kbo` 가 어정쩡하게 받고 있었다.
 *
 * 리그 페이지와 무엇이 다른가 — **여러 리그를 한 화면에 묶는다.** `야구 편성표` 를
 * 찾는 사람은 KBO 와 MLB 를 같이 보려는 것이고, `/league/kbo` 는 KBO 만 답한다.
 * 이 차이가 없으면 그냥 중복 콘텐츠다.
 *
 * 🔴 제목 규칙은 작업93 과 같다 — "해설" 을 앞쪽에, 40자 이내(네이버가 그 뒤를 자른다).
 */

/**
 * 개막 전 공개 설정.
 *
 * 🔴 왜 있나 (2026-09-14) — `프로배구 중계` · `프로농구 중계` 네이버 결과 화면 맨 위에
 * AI 브리핑이 뜨는데 우리는 없었다. 게이트가 "경기 10건" 이라 개막 **당일**에야 페이지가
 * 생기는데, 네이버 개별 색인은 몇 주 걸린다(9월 가이드 글이 아직 목록 페이지로만 잡힘).
 * 그러면 수요가 제일 큰 개막 주간을 통째로 놓친다.
 *
 * 빈 페이지 금지 원칙은 그대로다 — 개막 전 페이지는 경기 대신 **확인된 개막일·중계 채널**
 * 을 보여 준다. 개막 후 `PRESEASON_GRACE_DAYS` 가 지나도 경기가 안 차면 자동으로 빠진다
 * (개막일을 틀리게 적었거나 크롤이 끊긴 경우 페이지가 영원히 남지 않게).
 */
export type Preseason = {
  /** KST 개막일 YYYY-MM-DD. 공식 발표·보도로 확인한 값만. */
  opensOn: string;
  /** 개막을 알리는 한 문장. 날짜·대진은 확인된 것만. */
  opener: string;
  /** 확인된 중계 채널. 모르면 비워 두지 말고 이 설정을 만들지 말 것. */
  broadcasters: string[];
  /** 리그 페이지 슬러그(`/league/[slug]`). */
  leagueSlug: string;
  /** 근거. 사람이 다시 확인할 때 쓴다(화면에는 안 나온다). */
  source: string;
};

export type SportSeoMeta = SeoMeta & { preseason?: Preseason };

/** 개막 며칠 전부터 페이지를 여나. 네이버 색인 지연(수 주)을 흡수하는 폭. */
export const PRESEASON_OPEN_DAYS = 60;
/** 개막 후 며칠까지 경기 없이 버티나. 넘기면 게이트가 닫힌다. */
export const PRESEASON_GRACE_DAYS = 14;

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** 오늘이 개막 전 공개 구간 안인가. */
export function inPreseasonWindow(meta: SportSeoMeta, today: string): boolean {
  const p = meta.preseason;
  if (!p || p.broadcasters.length === 0) return false;
  const untilOpen = dayDiff(today, p.opensOn);
  return untilOpen <= PRESEASON_OPEN_DAYS && untilOpen >= -PRESEASON_GRACE_DAYS;
}

/** `Schedule.sport` 값과 정확히 일치해야 한다. */
export const SPORT_SEO: SportSeoMeta[] = [
  {
    slug: "baseball",
    match: ["야구"],
    display: "야구",
    sport: "야구",
    title: "야구 한국어 해설 편성표 — 오늘 KBO·MLB 중계 일정 | 한해설",
    description:
      "야구 중계 편성표. KBO 프로야구와 MLB 메이저리그 경기를 한 화면에서 보고, 어느 채널이 한국어 해설을 하는지 오늘부터 7일치로 확인하세요. 티빙·SPOTV NOW·SBS Sports 등 국내 중계 플랫폼을 모두 모았습니다.",
    keywords: [
      "야구 편성표",
      "오늘 야구 해설",
      "야구 중계 일정",
      "야구중계",
      "프로야구중계",
      "프로야구 편성표",
      "kbo 편성표",
      "kbo 중계",
      "mlb 편성표",
      "메이저리그 중계",
      "오늘 프로야구 경기 일정",
      "야구 한국어 해설",
    ],
    intro:
      "KBO 프로야구와 MLB 메이저리그를 한 화면에 모았습니다. 각 경기가 어느 채널에서 한국어 해설로 중계되는지 오늘부터 7일치로 확인하세요.",
  },
  {
    slug: "soccer",
    match: ["축구"],
    display: "축구",
    sport: "축구",
    // 2026-09-14: `오늘 축구 중계` · `해외축구 중계 일정` 에 이 페이지가 안 떴다(야구는
    // 같은 모양 쿼리로 뜬다). 쿼리 문구를 제목 앞에 그대로 둔다.
    title: "오늘 축구 중계 한국어 해설 편성표 — 해외축구·K리그 | 한해설",
    h1: "오늘 축구 중계 편성표 (해외축구·K리그)",
    description:
      "축구 중계 편성표. EPL·라리가·세리에A·챔피언스리그·K리그를 한 화면에서 보고, 어느 채널이 한국어 해설을 하는지 오늘부터 7일치로 확인하세요. 쿠팡플레이·SPOTV NOW·tvN SPORTS 등 국내 중계 플랫폼을 모두 모았습니다.",
    keywords: [
      "축구 편성표",
      "축구중계일정",
      "축구 중계 일정",
      "해외축구 중계",
      "해외축구 편성표",
      "오늘 축구 중계",
      "epl 중계",
      "k리그 중계",
      "챔피언스리그 중계",
      "축구 한국어 해설",
    ],
    intro:
      "EPL·라리가·세리에A·챔피언스리그·K리그를 한 화면에 모았습니다. 각 경기가 어느 채널에서 한국어 해설로 중계되는지 오늘부터 7일치로 확인하세요.",
  },
  {
    slug: "basketball",
    match: ["농구"],
    display: "농구",
    sport: "농구",
    title: "프로농구 중계 한국어 해설 편성표 — KBL 일정 | 한해설",
    description:
      "프로농구 중계 편성표. KBL 경기가 어느 채널에서 한국어 해설로 중계되는지 오늘부터 7일치로 확인하세요. 2026-27 시즌은 10월 3일 개막하고 tvN SPORTS·티빙이 중계합니다.",
    keywords: ["프로농구 중계", "농구 편성표", "농구 중계 일정", "kbl 중계", "kbl 편성표", "프로농구 개막", "농구 한국어 해설"],
    intro:
      "KBL 프로농구 중계 편성표입니다. 각 경기가 어느 채널에서 한국어 해설로 중계되는지 오늘부터 7일치로 확인하세요.",
    preseason: {
      opensOn: "2026-10-03",
      opener: "2026-27 KBL 정규리그는 10월 3일 KCC와 LG의 개막전으로 시작해 2027년 4월 11일까지 팀당 54경기를 치릅니다.",
      broadcasters: ["tvN SPORTS", "티빙"],
      leagueSlug: "kbl",
      source: "네이트스포츠 2026-08-10(개막·폐막·개막전) / 점프볼 2024-06-27(CJ ENM 2024-25~2027-28 중계권)",
    },
  },
  {
    slug: "volleyball",
    match: ["배구"],
    display: "배구",
    sport: "배구",
    title: "프로배구 중계 한국어 해설 편성표 — V리그 일정 | 한해설",
    description:
      "프로배구 중계 편성표. V리그 남자부·여자부 경기가 어느 채널에서 한국어 해설로 중계되는지 오늘부터 7일치로 확인하세요. 2026-27 시즌은 10월 31일 개막하고 KBS N SPORTS가 중계권을 갖고 있습니다.",
    keywords: ["프로배구 중계", "배구 편성표", "배구 중계 일정", "v리그 중계", "v리그 편성표", "v리그 개막", "배구 한국어 해설"],
    intro:
      "V리그 배구 중계 편성표입니다. 각 경기가 어느 채널에서 한국어 해설로 중계되는지 오늘부터 7일치로 확인하세요.",
    preseason: {
      opensOn: "2026-10-31",
      opener: "2026-27 V리그는 10월 31일 인천 계양체육관의 대한항공과 현대캐피탈 남자부 경기로 개막하고, 같은 날 장충체육관에서 GS칼텍스와 한국도로공사가 여자부 개막전을 치릅니다.",
      broadcasters: ["KBS N SPORTS"],
      leagueSlug: "v-league",
      source: "서울경제 2026-08-18(개막일·개막전·폐막 4/2) / KBS N SPORTS-KOVO 2021-22~2026-27 6년 중계권 계약",
    },
  },
];

/**
 * 페이지를 만들 최소 경기 수.
 *
 * 🔴 빈 페이지를 만들지 않는 게 이 게이트의 목적이다. 팀 페이지에서 개막 전 유럽
 * 138팀을 그대로 뽑았다가 "0승 0패" 페이지를 만들 뻔한 적이 있다(작업58).
 *
 * 실측(2026-08-19 7일치): 야구 99 · 축구 79 · 농구 2 · 배구 0. 농구 2건은 비시즌
 * 이벤트성 편성이라 페이지를 세울 근거가 못 된다. KBL 이 개막하면(10~4월) 자동으로
 * 편입되고, 비시즌에 들어가면 자동으로 빠진다.
 */
export const MIN_GAMES_FOR_SPORT_PAGE = 10;

/** 편성에 경기가 충분히 있거나, 확인된 개막 정보로 개막 전 공개 구간에 든 종목. */
export function eligibleSports(schedules: Schedule[], today: string): SportSeoMeta[] {
  return SPORT_SEO.filter(
    (meta) =>
      countGames(schedules, meta, today) >= MIN_GAMES_FOR_SPORT_PAGE || inPreseasonWindow(meta, today),
  );
}

/**
 * 오늘 이후 경기 수.
 *
 * 한 경기가 여러 채널에 걸리면 편성 데이터에 행이 여러 개 있다(사전방송/본방송 포함).
 * 그대로 세면 채널이 많은 종목이 부풀려지므로 **경기 단위**로 접어서 센다 —
 * 화면에 그리는 카드 수와도 일치한다.
 */
export function countGames(schedules: Schedule[], meta: SeoMeta, today: string): number {
  const keys = new Set<string>();
  for (const s of schedules) {
    if (!meta.match.includes(s.sport)) continue;
    if (s.date < today) continue;
    keys.add(`${s.date}|${s.homeTeam}|${s.awayTeam}`);
  }
  return keys.size;
}

/** 그 종목에 속한 리그 메타. 종목 페이지의 "리그별" 블록에 쓴다. */
export function leaguesOfSport(meta: SeoMeta): SeoMeta[] {
  return LEAGUE_SEO.filter((l) => l.sport && meta.match.includes(l.sport));
}

export function findSportBySlug(slug: string): SportSeoMeta | undefined {
  return SPORT_SEO.find((s) => s.slug === slug);
}
