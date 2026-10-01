// src/lib/cover-hook.ts
//
// 커버 카드(인스타 캐러셀 1장 = 릴스 cover = 쇼츠 첫 프레임)의 후킹 문구.
//
// 아침은 작은 윗줄 → 큰 아랫줄(대비 2줄), 저녁은 큰 줄 → 설명 줄로 그린다.
// 구조를 상하로 갈라 두면 레이아웃이 같아도 두 게시물이 같은 그림이 되지 않는다.
// (저녁판과 다음날 아침판은 대상 날짜·히어로·경기 수가 전부 같다 — 작업82 참조.)
//
// 풀은 슬롯당 8개다. 3~4개면 같은 틀이 사나흘마다 돌아와 몰아 보면 티가 난다.
// 문장 틀은 사람이 쓰고 코드는 값만 채운다 — LLM 생성은 비용·검증 부담만 붙는다.

import {
  findKoreanPlayerOnMatch,
  inferDayLabel,
  loadKoreanMatchesAll,
  pickHeroForDate,
} from "./instagram";
import { GLOBAL_BIG_CLUBS, NATIONAL_TEAM } from "./hero-pick";
import { nationalEventFor } from "./national-event";
import { withJosa } from "./josa";
import { getPostSlot, rotateIndex, type PostSlot } from "./post-slot";
import { speakTime } from "./tiktok-caption";

export type Daypart = "새벽" | "아침" | "낮" | "저녁";

export interface CoverHookCtx {
  /** 한국선수가 있으면 선수명, 없으면 팀명 하나(빅클럽 쪽 우선) */
  who: string;
  isPlayer: boolean;
  /** "새벽 3시 20분" */
  time: string;
  daypart: Daypart;
  /** 그날 한국어 해설 경기 수 */
  games: number;
  platform: string;
  isWeekday: boolean;
  /**
   * 🔴 대상 날짜를 **게시 시점 기준**으로 부르는 말. 슬롯에 박아 두면 안 된다.
   *
   * 2026-08-28 저녁 워크플로가 12시간 밀려 KST 8/29 04:27 에 발화했다.
   * 사이클 보정 덕에 대상 날짜(8/29)는 맞았지만 문구는 저녁 풀에 "내일"이
   * 하드코딩돼 있어 **오늘 밤 경기를 "내일"이라고 부르며** 나갔다
   * (실제 업로드된 쇼츠 제목: `내일 밤 10시 30분 이재성 … 8/29(토)`).
   * 날짜만 맞추고 부르는 말을 안 맞추면 사용자 눈에는 여전히 틀린 게시물이다.
   */
  dayWord: "오늘" | "내일";
  /**
   * 대한민국 대표팀 경기면 채워진다. 이때는 이름 하나(`who`)가 아니라 **매치업과 대회**가
   * 후킹이다 — `pickHeadliner` 는 원정팀을 집어서 `대한민국 vs 베네수엘라` 의 커버 주인공이
   * `베네수엘라` 가 됐다(2026-10-02 시뮬레이션).
   */
  national?: { matchup: string; opponent: string; event: string };
}

export interface CoverHook {
  /** 작은 줄 */
  small: string;
  /** 큰 줄 */
  big: string;
  /** small 또는 big 안에서 액센트 색으로 칠할 조각 */
  accent: string;
}

interface HookTemplate {
  build: (c: CoverHookCtx) => CoverHook;
  /**
   * 조건이 있으면 안 맞는 날엔 후보에서 빠진다.
   * `자기 전에`·`퇴근하고` 같은 말은 시간대가 안 맞으면 봇 티가 난다.
   */
  when?: (c: CoverHookCtx) => boolean;
}

// 🔴 who 는 이름 하나다(선수명 또는 팀명 하나). 팀에 "옵니다"를 붙이면 내한경기가
// 아닌 이상 비문이 된다 — "첼시 내일 옵니다". 팀에는 "경기 있습니다"를 쓴다.
const comes = (c: CoverHookCtx) => (c.isPlayer ? "나옵니다" : "경기 있습니다");

export const MORNING_COVER_HOOKS: HookTemplate[] = [
  {
    build: (c) => ({
      small: `${c.dayWord} ${c.time} · ${c.platform}`,
      big: `${c.who} ${c.dayWord} ${comes(c)}`,
      accent: c.who,
    }),
  },
  {
    build: (c) => ({ small: `${c.dayWord} 뭐 보지 싶을 때`, big: `${c.who} 보세요`, accent: c.who }),
  },
  {
    build: (c) => ({ small: "퇴근하고 볼 거 있습니다", big: `${c.who} ${c.time}`, accent: c.who }),
    when: (c) => c.daypart === "저녁",
  },
  {
    build: (c) => ({
      small: `${c.dayWord} 중계 어디서 보나`,
      // 조사를 고정하면 `김혜성는`·`아스날는` 이 나온다. 받침으로 골라야 한다(작업58).
      big: `${withJosa(c.who, "은/는")} ${c.platform}`,
      accent: c.platform,
    }),
  },
  {
    build: (c) => ({
      small: "한국어 해설 됩니다",
      big: `${c.who} ${c.dayWord} ${c.time}`,
      accent: c.who,
    }),
  },
  {
    build: (c) => ({
      small: "이 시간 비워두세요",
      big: `${c.dayWord} ${c.time} ${c.who}`,
      accent: c.time,
    }),
  },
  {
    build: (c) => ({
      small: "아침에 봐두면 편합니다",
      big: `${c.dayWord}은 ${c.who}`,
      accent: c.who,
    }),
  },
  {
    build: (c) => ({
      small: "평일에 이런 게 다 있네요",
      big: `${c.who} ${c.dayWord} ${c.time}`,
      accent: c.who,
    }),
    when: (c) => c.isWeekday,
  },
];

export const EVENING_COVER_HOOKS: HookTemplate[] = [
  {
    build: (c) => ({
      big: `${c.dayWord} ${c.time}`,
      small: `${c.who} ${c.isPlayer ? "출전" : "경기"} · 한국어 해설 ${c.games}경기`,
      accent: c.time,
    }),
  },
  {
    build: (c) => ({
      big: `${c.who} ${c.dayWord} ${comes(c)}`,
      small: `${c.time} · ${c.platform}`,
      accent: c.who,
    }),
  },
  {
    build: (c) => ({
      big: `${c.dayWord} 놓치면 아까운 경기`,
      small: `${c.who} ${c.time}`,
      accent: c.who,
    }),
  },
  {
    build: (c) => ({
      big: `${c.dayWord} 볼 거 미리 찍어두세요`,
      small: `${c.who} ${c.time} · ${c.platform}`,
      accent: c.who,
    }),
  },
  {
    build: (c) => ({
      big: `${c.dayWord} ${c.who} 나오는 날`,
      small: `${c.time} · 한국어 해설`,
      accent: c.who,
    }),
  },
  {
    build: (c) => ({ big: "오늘 밤 지나면 바로", small: `${c.who} ${c.time}`, accent: c.who }),
    // "오늘 밤 지나면" 은 대상이 **내일**일 때만 참이다. 저녁분이 자정을 넘겨
    // 밀려 대상이 당일이 되면 이 문장은 거짓이 된다.
    when: (c) => c.daypart === "새벽" && c.dayWord === "내일",
  },
  {
    build: (c) => ({
      big: `${c.dayWord}치 편성 나왔습니다`,
      small: `${c.who} ${c.time} · ${c.platform}`,
      accent: c.who,
    }),
  },
  {
    build: (c) => ({
      big: c.dayWord === "내일" ? "미리 알려드립니다" : "바로 알려드립니다",
      small: `${c.dayWord} ${c.time} ${c.who}`,
      accent: c.time,
    }),
  },
];

// ── 대표팀 경기 전용 ──────────────────────────────────────────────────
// 큰 줄에 매치업을 그대로 올린다. 아침 큰 줄은 한 줄(줄바꿈 없음)이라 매치업보다 긴 문장을
// 넣지 않는다 — `오늘 저녁 7시 30분 대한민국 vs 우즈베키스탄` 은 최소 글자 크기에서도 넘친다.
// 아침·저녁은 small 의 어순이 달라 같은 문구가 될 수 없다.
type NationalCtx = CoverHookCtx & { national: NonNullable<CoverHookCtx["national"]> };

export const NATIONAL_MORNING_COVER_HOOKS: Array<(c: NationalCtx) => CoverHook> = [
  (c) => ({
    small: `${c.national.event} · ${c.dayWord} ${c.time}`,
    big: c.national.matchup,
    accent: NATIONAL_TEAM,
  }),
  (c) => ({
    small: `${c.dayWord} ${c.time} · ${c.platform}`,
    big: c.national.matchup,
    accent: c.national.opponent,
  }),
  (c) => ({
    small: `${c.national.matchup} · ${c.national.event}`,
    big: `${c.dayWord} ${c.time}`,
    accent: c.time,
  }),
];

export const NATIONAL_EVENING_COVER_HOOKS: Array<(c: NationalCtx) => CoverHook> = [
  (c) => ({
    big: c.national.matchup,
    small: `${c.dayWord} ${c.time} · ${c.national.event}`,
    accent: NATIONAL_TEAM,
  }),
  (c) => ({
    big: `${c.dayWord} ${c.time}`,
    small: `${c.national.event} · ${c.national.matchup}`,
    accent: c.time,
  }),
  // 시각은 어느 틀에서도 빠지면 안 된다 — 커버만 보고 "몇 시"를 알 수 있어야 한다.
  (c) => ({
    big: c.national.matchup,
    small: `${c.dayWord} ${c.time} 시작 · ${c.platform}`,
    accent: c.national.opponent,
  }),
];

function daypartOf(hhmm: string): Daypart {
  const h = Number.parseInt(hhmm.slice(0, 2), 10);
  if (!Number.isFinite(h)) return "저녁";
  if (h < 7) return "새벽";
  if (h < 12) return "아침";
  if (h < 18) return "낮";
  return "저녁";
}

function isWeekdayKst(today: string): boolean {
  const [y, m, d] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow >= 1 && dow <= 5;
}

const norm = (s: string) => s.replace(/\s+/g, "");

/**
 * 두 팀 중 후킹으로 쓸 한 팀.
 * 매치업 전체("A vs B")는 큰 글자에 안 들어가므로 하나만 고른다 — 이름값이 큰 쪽이 후킹이다.
 * 빅클럽이 없으면 원정팀(보통 방문팀이 화제)을 쓴다.
 */
function pickHeadliner(home: string | null, away: string | null): string {
  if (away && GLOBAL_BIG_CLUBS.has(norm(away))) return away;
  if (home && GLOBAL_BIG_CLUBS.has(norm(home))) return home;
  return (away ?? home)!;
}

/** 히어로에서 후킹 재료를 뽑는다. 경기가 없으면 null. */
export function coverHookContext(today: string, now: Date = new Date()): CoverHookCtx | null {
  const hero = pickHeroForDate(today);
  if (!hero) return null;

  const home = hero.homeTeam !== "미정" ? hero.homeTeam : null;
  const away = hero.awayTeam && hero.awayTeam !== "미정" ? hero.awayTeam : null;
  if (!home && !away) return null;

  const national = nationalEventFor(hero);
  // 대표팀 경기에서 클럽 소속 코리안리거 이름을 주어로 세우지 않는다 — 주어는 대한민국이다.
  const player = national ? null : findKoreanPlayerOnMatch(hero.homeTeam, hero.awayTeam);

  return {
    who: national ? NATIONAL_TEAM : player ? player.name : pickHeadliner(home, away),
    isPlayer: Boolean(player),
    national: national
      ? { matchup: national.matchup, opponent: national.opponent, event: national.event }
      : undefined,
    time: speakTime(hero.time),
    daypart: daypartOf(hero.time),
    games: loadKoreanMatchesAll(today).length,
    platform: hero.platform,
    isWeekday: isWeekdayKst(today),
    dayWord: inferDayLabel(today, now),
  };
}

/** 후킹 재료가 없는 날(경기 0)에 쓰는 문구. */
function fallbackHook(slot: PostSlot, dayWord: "오늘" | "내일"): CoverHook {
  return slot === "morning"
    ? { small: `${dayWord} 편성 정리했습니다`, big: "한국어 해설 확인", accent: "한국어 해설" }
    : { big: `${dayWord}치 편성 나왔습니다`, small: "한국어 해설 편성표", accent: "한국어 해설" };
}

export function buildCoverHook(
  today: string,
  slot: PostSlot = getPostSlot(today),
  now: Date = new Date(),
): CoverHook {
  const ctx = coverHookContext(today, now);
  if (!ctx) return fallbackHook(slot, inferDayLabel(today, now));

  if (ctx.national) {
    const nat = ctx as NationalCtx;
    const natPool = slot === "morning" ? NATIONAL_MORNING_COVER_HOOKS : NATIONAL_EVENING_COVER_HOOKS;
    return natPool[rotateIndex(today, slot, natPool.length)](nat);
  }

  const pool = slot === "morning" ? MORNING_COVER_HOOKS : EVENING_COVER_HOOKS;
  const eligible = pool.filter((t) => !t.when || t.when(ctx));
  const usable = eligible.length > 0 ? eligible : pool;
  const idx = rotateIndex(today, slot, usable.length);
  const picked = usable[idx].build(ctx);

  // `when` 조건 때문에 후보 수가 슬롯마다 달라진다. rotateIndex 의 2칸 밀기만으로는
  // 두 슬롯이 같은 문구를 낼 수 있어(풀 길이가 갈리면 밀기가 무의미해진다) 직접 막는다.
  // morning 은 재귀하지 않으므로 무한 루프가 없다.
  if (slot === "evening") {
    const morning = buildCoverHook(today, "morning", now);
    if (`${picked.small}|${picked.big}` === `${morning.small}|${morning.big}`) {
      return usable[(idx + 1) % usable.length].build(ctx);
    }
  }
  return picked;
}
