// src/lib/shorts-title.ts
//
// 유튜브 쇼츠 제목·후킹 문장 빌더.
//
// 종전 제목은 `${getMainHighlight(today)} 8/5(수) #Shorts` 하나뿐이었다.
// 대상 날짜만 쓰기 때문에 저녁(내일 경기)과 다음날 아침(오늘 경기)이
// 글자까지 똑같은 제목으로 11시간 간격 업로드됐고, 2026-08-04 저녁분부터
// Shorts 피드 배포가 끊겼다(피드 조회 3 vs 정상 400+, 채널 위반 없음).
//
// 여기서 두 가지를 바꾼다.
//   ① 슬롯(아침/오늘 · 저녁/내일)별로 다른 문장 풀 — 같은 제목이 구조적으로 불가능
//   ② 후킹 우선 — 첫 어절에 선수·매치업·시간을 두고, 검색 키워드("한국어 중계/해설")는
//      문장 안에 자연스럽게 넣는다. 쇼츠는 제목이 검색 대상이라 키워드를 버리면 안 된다.
//
// 문구는 날짜 기반 결정적 순환이라 같은 날 재실행해도 동일하다.

import { getMainHighlight, SPORT_EMOJI } from "./hashtags";
import { inferDayLabel, pickHeroForDate } from "./instagram";
import { coverHookContext } from "./cover-hook";
import { getPostSlot, rotateIndex, type PostSlot } from "./post-slot";

/** 유튜브 제목 상한. 넘으면 업로드가 거부된다. */
export const TITLE_MAX = 100;

const KST_DOW = ["일", "월", "화", "수", "목", "금", "토"];

function dayOfWeekKr(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  return KST_DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

interface HookCtx {
  /** 선수명이 있으면 선수명, 없으면 매치업("다저스 vs 자이언츠") */
  who: string;
  /** who가 선수명인가 — 매치업에 "출격"·"나옵니다"를 붙이면 문장이 어색해진다. */
  isPlayer: boolean;
  /** "새벽 4시" */
  time: string;
  /** 그날 한국어 해설 경기 수 */
  games: number;
  emoji: string;
}

/** 선수면 "출격", 매치업이면 "시작" — 주어에 맞는 서술어. */
const start = (c: HookCtx) => (c.isPlayer ? "출격" : "시작");
const appear = (c: HookCtx) => (c.isPlayer ? "나옵니다" : "열립니다");

// 아침 = 오늘 경기. "지금 확인" 프레임.
// 풀은 8개다 — 4개면 같은 틀이 나흘마다 돌아와 몰아 보면 티가 난다.
export const MORNING_HOOKS: Array<(c: HookCtx) => string> = [
  (c) => `오늘 ${c.who} 경기 ${c.emoji} 한국어 중계 어디서 봐요?`,
  (c) => `${c.who} 오늘 ${c.time} ${start(c)} ${c.emoji} 한국어 중계 채널은`,
  (c) => `오늘 한국어 해설 ${c.games}경기 ${c.emoji} ${c.who}부터 확인`,
  (c) => `${c.who} 오늘 중계 ${c.emoji} 채널 하나로 정리했습니다`,
  (c) => `${c.who} 오늘 어디서 보나 ${c.emoji} 한국어 해설 채널 정리`,
  (c) => `오늘 ${c.time} ${c.who} ${c.emoji} 한국어 중계 되는 곳`,
  (c) => `오늘 볼 경기 골랐습니다 ${c.emoji} ${c.who} 한국어 중계`,
  (c) => `${c.who} 한국어 해설 ${c.emoji} 오늘 ${c.time} ${start(c)}`,
];

// 저녁 = 내일 경기. "예고·알람" 프레임.
export const EVENING_HOOKS: Array<(c: HookCtx) => string> = [
  (c) => `내일 ${c.who} ${appear(c)} ${c.emoji} ${c.time} 한국어 중계`,
  (c) => `${c.who} 내일 ${c.time} ${c.emoji} 한국어 중계 미리 확인`,
  (c) => `내일 놓치면 아까운 경기 ${c.emoji} ${c.who} 한국어 중계`,
  (c) => `내일 한국어 해설 ${c.games}경기 ${c.emoji} ${c.who} 알람 맞추세요`,
  (c) => `내일치 편성 나왔습니다 ${c.emoji} ${c.who} ${c.time} 한국어 중계`,
  (c) => `${c.who} 내일 어디서 보나 ${c.emoji} ${c.time} 한국어 해설`,
  (c) => `내일 볼 거 미리 찍어두세요 ${c.emoji} ${c.who} ${c.time}`,
  (c) => `내일 ${c.time} ${c.who} ${c.emoji} 한국어 중계 채널 정리`,
];

/**
 * 히어로 재료는 커버와 공유한다 — 커버와 제목의 주인공이 갈리면 안 된다.
 * (coverHookContext 는 pickHeroForDate 를 쓰므로 연속 방지 감점도 함께 적용된다.)
 */
function hookContext(today: string): HookCtx | null {
  const c = coverHookContext(today);
  if (!c) return null;
  const hero = pickHeroForDate(today);
  return {
    who: c.who,
    isPlayer: c.isPlayer,
    time: c.time,
    games: c.games,
    emoji: hero ? SPORT_EMOJI[hero.sport] : "⚽",
  };
}

/**
 * 후킹 문장을 쓰는 게시면. 한 번의 실행에서 이 셋이 **동시에** 나간다.
 *
 * 2026-08-07: 슬롯(아침/저녁)만 갈라 놨더니 같은 실행 안에서 인스타 캐러셀과 릴스가
 * 글자까지 같은 캡션으로 나가고 있었다(실측 — `[REELS] 오늘 KIA 경기 …` = `[FEED] 오늘 KIA 경기 …`).
 * 유튜브 피드 배포를 끊었던 것과 같은 중복 신호라 게시면도 축으로 세운다.
 */
export type HookSurface = "youtube-desc" | "ig-feed" | "ig-reel";

/** 제목(0)과도, 서로와도 겹치지 않도록 풀에서 떨어뜨리는 간격. 풀 크기 8 기준. */
const SURFACE_OFFSET: Record<HookSurface, number> = {
  "youtube-desc": 1,
  "ig-feed": 3,
  "ig-reel": 5,
};

/**
 * 히어로 재료가 없는 날(경기 0·편성 미수집)용.
 * 🔴 슬롯 × 게시면 둘 다 갈라야 한다. 종전엔 한 문장이라, 편성이 안 잡힌 날에는
 * 여섯 게시물이 전부 같은 첫 줄로 나갔다 — 정작 중복이 제일 위험한 날이다.
 */
const FALLBACK_HOOKS: Record<HookSurface, Record<PostSlot, string>> = {
  "youtube-desc": {
    morning: "오늘 한국어 해설 편성, 한 번에 정리했습니다",
    evening: "내일 한국어 해설 편성, 미리 정리해 뒀습니다",
  },
  "ig-feed": {
    morning: "오늘 한국어 중계되는 경기, 채널까지 같이 봤어요",
    evening: "내일 한국어 중계되는 경기, 채널까지 미리 확인하세요",
  },
  "ig-reel": {
    morning: "오늘 뭐 볼지 정하기 전에 30초만",
    evening: "내일 볼 거 지금 정해 두실 분",
  },
};

/**
 * 캡션·설명 첫 줄용 후킹 문장(날짜·해시태그 없음).
 * 제목과 같은 풀을 쓰되 게시면별로 다른 칸을 집어, 제목·유튜브설명·캐러셀·릴스 넷이
 * 같은 문장으로 겹치지 않게 한다.
 */
export function buildHookLine(
  today: string,
  slot: PostSlot = getPostSlot(today),
  surface: HookSurface = "youtube-desc",
): string {
  const ctx = hookContext(today);
  if (!ctx) return FALLBACK_HOOKS[surface][slot];

  const pool = slot === "morning" ? MORNING_HOOKS : EVENING_HOOKS;
  const idx = (rotateIndex(today, slot, pool.length) + SURFACE_OFFSET[surface]) % pool.length;
  return pool[idx](ctx);
}

/**
 * 쇼츠 제목. `{후킹} {M/D(요일)} #Shorts` 형태.
 * 아침/저녁 문장 풀이 분리돼 있어 같은 날짜라도 두 게시물의 제목이 절대 같지 않다.
 */
export function buildShortsTitle(
  mm: string,
  dd: string,
  today: string,
  slot: PostSlot = getPostSlot(today),
): string {
  const dateTag = `${parseInt(mm, 10)}/${parseInt(dd, 10)}(${dayOfWeekKr(today)}) #Shorts`;
  const ctx = hookContext(today);

  if (ctx) {
    const pool = slot === "morning" ? MORNING_HOOKS : EVENING_HOOKS;
    const hook = pool[rotateIndex(today, slot, pool.length)](ctx);
    const title = `${hook} ${dateTag}`;
    if (title.length <= TITLE_MAX) return title;
  }

  // 폴백: 후킹 재료가 없거나(경기 0) 제목이 너무 길 때.
  // 종전 포맷에 슬롯 라벨만 앞에 붙여 중복은 여전히 피한다.
  return `${inferDayLabel(today)} ${getMainHighlight(today)} ${dateTag}`.slice(0, TITLE_MAX);
}
