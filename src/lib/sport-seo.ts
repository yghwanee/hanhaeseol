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

/** `Schedule.sport` 값과 정확히 일치해야 한다. */
export const SPORT_SEO: SeoMeta[] = [
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
    title: "축구 한국어 해설 편성표 — 오늘 EPL·K리그 중계 | 한해설",
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
    title: "농구 한국어 해설 편성표 — 오늘 KBL 중계 일정 | 한해설",
    description:
      "농구 중계 편성표. KBL 프로농구 경기가 어느 채널에서 한국어 해설로 중계되는지 오늘부터 7일치로 확인하세요. 티빙·SBS Sports 등 국내 중계 플랫폼을 모두 모았습니다.",
    keywords: ["농구 편성표", "농구 중계 일정", "kbl 중계", "kbl 편성표", "프로농구 중계", "농구 한국어 해설"],
    intro:
      "KBL 프로농구 중계 편성표입니다. 각 경기가 어느 채널에서 한국어 해설로 중계되는지 오늘부터 7일치로 확인하세요.",
  },
  {
    slug: "volleyball",
    match: ["배구"],
    display: "배구",
    sport: "배구",
    title: "배구 한국어 해설 편성표 — 오늘 V리그 중계 일정 | 한해설",
    description:
      "배구 중계 편성표. V리그 경기가 어느 채널에서 한국어 해설로 중계되는지 오늘부터 7일치로 확인하세요. KBS N SPORTS·SBS Sports 등 국내 중계 플랫폼을 모두 모았습니다.",
    keywords: ["배구 편성표", "배구 중계 일정", "v리그 중계", "v리그 편성표", "프로배구 중계", "배구 한국어 해설"],
    intro:
      "V리그 배구 중계 편성표입니다. 각 경기가 어느 채널에서 한국어 해설로 중계되는지 오늘부터 7일치로 확인하세요.",
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

/** 편성에 실제로 경기가 충분히 있는 종목만. */
export function eligibleSports(schedules: Schedule[], today: string): SeoMeta[] {
  return SPORT_SEO.filter((meta) => countGames(schedules, meta, today) >= MIN_GAMES_FOR_SPORT_PAGE);
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

export function findSportBySlug(slug: string): SeoMeta | undefined {
  return SPORT_SEO.find((s) => s.slug === slug);
}
