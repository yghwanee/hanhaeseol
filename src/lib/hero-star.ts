// src/lib/hero-star.ts
//
// 히어로 경기의 "팀 대표 선수" — 후킹 문장의 주어.
//
// 🔴 왜 있는가 (2026-11-20 화니 지적): 코리안리거가 없는 경기는 주어가 팀명 하나였다.
// `LA 레이커스 내일 어디서 보나` 처럼 팀명만 갈아 끼운 문장이라 후킹이 약했다. 사람들은
// 선수 이름으로 경기를 찾고 기억한다(선수 페이지 근거와 같다 — 작업125).
//
// 🔴 선수→팀을 코드에 적지 않는다(`feedback-no-hardcoded-rosters`: 이강인 PSG→AT 마드리드를
// 한 달 넘게 못 따라가 오보를 냈다). 이름은 **게시 직전에 네이버 시즌 기록**에서 받는다.
//   - 농구(NBA)  : 경기 프리뷰 `teamTopPlayer.<side>.teamTopScorePlayer` — 팀 득점 1위 + 평균
//   - 농구(KBL)  : 경기 프리뷰 `efficiencyTop3.<side>[0]` — 팀 공헌도 1위
//   - 배구(V리그): 경기 프리뷰 `topPlayer.<side>.POINT` — 팀 득점 1위 + 시즌 득점
//   - 축구       : 시즌 선수 기록 `/statistics/.../players` — 그 팀 최다 득점자(1골 이상)
//   - 그 외(WKBL 프리뷰 비어 있음 · 야구 비시즌 등)는 null → 팀명 주어로 돌아간다.
//
// 받아 오는 쪽은 `src/scripts/hero-star.ts`(네이버는 실제 브라우저 요청에만 응답해서
// 워크플로가 크로미움 프리로드로 돌린다). 결과는 `generated/instagram/hero-star.json` 한 파일 —
// 제목·캡션·커버가 같은 실행 안에서 이걸 읽는다. 파일이 없거나 다른 경기 것이면 무시한다.

import fs from "node:fs";
import path from "node:path";
import type { Schedule } from "@/types/schedule";
import { OUT_DIR } from "./manifest";

export interface HeroStar {
  /** 어느 경기의 선수인가 — 편성 표기 그대로(이 셋이 다르면 쓰지 않는다) */
  date: string;
  home: string;
  away: string;
  /** "루카 돈치치" */
  name: string;
  /** 선수가 속한 팀(편성 표기) — "LA 레이커스" */
  team: string;
  /** 근거 수치 — "평균 32.1점" · "시즌 7골" · "시즌 86득점" · "팀 공헌도 1위" */
  stat: string;
  /** 출처 메모(로그·감사용) */
  source: string;
}

export const HERO_STAR_PATH = path.join(OUT_DIR, "hero-star.json");

export interface StarPick {
  name: string;
  stat: string;
}

type Side = "home" | "away";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 사람 이름처럼 보이는가 — 빈 값·숫자·괄호 조각이 주어 자리에 들어가지 않게. */
export function isPlausibleName(name: unknown): name is string {
  if (typeof name !== "string") return false;
  const t = name.trim();
  return t.length >= 2 && t.length <= 20 && !/[\d()[\]{}|/]/.test(t);
}

/** 네이버 경기 프리뷰(`previewData`)에서 한쪽 팀의 대표 선수를 뽑는다. 없으면 null. */
export function starFromPreview(sport: string, preview: any, side: Side): StarPick | null {
  if (!preview || typeof preview !== "object") return null;

  if (sport === "농구") {
    const top = preview.teamTopPlayer?.[side]?.teamTopScorePlayer;
    const v = Number.parseFloat(top?.statValue);
    if (isPlausibleName(top?.playerName) && Number.isFinite(v) && v > 0) {
      return { name: top.playerName.trim(), stat: `평균 ${v}점` };
    }
    const eff = preview.efficiencyTop3?.[side]?.[0];
    if (isPlausibleName(eff?.playerName) && Number(eff?.efficiency) > 0) {
      return { name: eff.playerName.trim(), stat: "팀 공헌도 1위" };
    }
    return null;
  }

  if (sport === "배구") {
    const top = preview.topPlayer?.[side]?.POINT;
    const pt = Number(top?.point);
    if (!(pt > 0)) return null;
    // 🔴 V리그 외국인 선수는 등록명이 한 글자다(`쇼`). `쇼 오늘 저녁 7시 출격` 은 이름으로 안 읽힌다
    // (2026-11-20 화니 지적). 같은 응답의 `playerList` 에 정식 이름(`쉐론 베논 에반스`)이 있다.
    let name: unknown = top?.playerName;
    if (typeof name === "string" && name.trim().length < 2) {
      const full = (preview.playerList?.[side] ?? []).find(
        (p: any) => p && String(p.playerCode) === String(top?.playerId),
      );
      name = full?.playerName;
    }
    if (!isPlausibleName(name)) return null;
    return { name: name.trim(), stat: `시즌 ${pt}득점` };
  }

  return null;
}

/**
 * 끝난 경기 기록(`/schedule/games/{id}/record` 의 `recordData`)에서 한쪽 팀 득점 1위.
 * WKBL 처럼 프리뷰가 비어 있는 농구 리그의 대체 경로 — 그 팀의 **직전 경기** 기록을 쓴다.
 * 필드가 리그마다 다르다: WKBL `playerName`·`scoreTot` / NBA `firstName`+`lastName`·`pts`.
 * 10점 미만이면 세우지 않는다(`지난 경기 4점` 은 후킹이 아니다).
 */
export function starFromRecord(record: any, side: Side): StarPick | null {
  const players: any[] = record?.[`${side}PlayerStats`] ?? [];
  let best: { name: string; pts: number } | null = null;
  for (const p of players) {
    const name = p?.playerName ?? [p?.firstName, p?.lastName].filter(Boolean).join(" ");
    const pts = Number(p?.scoreTot ?? p?.pts);
    if (!isPlausibleName(name) || !Number.isFinite(pts)) continue;
    if (!best || pts > best.pts) best = { name: name.trim(), pts };
  }
  if (!best || best.pts < 10) return null;
  return { name: best.name, stat: `지난 경기 ${best.pts}점` };
}

/**
 * 축구 시즌 선수 기록(`seasonPlayerStats`)에서 그 팀 최다 득점자.
 * `isTeam` 은 네이버 팀명이 우리 팀인지 판정한다(별칭 표를 거치는 건 호출 쪽 몫).
 * 1골 이상만 — 0골 선수를 "대표 선수"로 세우지 않는다. 동률이면 공격포인트, 그다음 이름순(결정적).
 */
export function soccerStarFromSeason(
  stats: any[],
  isTeam: (naverTeam: string) => boolean,
): StarPick | null {
  const mine = (stats ?? []).filter(
    (p) => p && isPlausibleName(p.playerName) && typeof p.teamName === "string" && isTeam(p.teamName) && Number(p.goals) >= 1,
  );
  if (mine.length === 0) return null;
  mine.sort(
    (a, b) =>
      Number(b.goals) - Number(a.goals) ||
      Number(b.offencePoints ?? 0) - Number(a.offencePoints ?? 0) ||
      String(a.playerName).localeCompare(String(b.playerName)),
  );
  return { name: mine[0].playerName.trim(), stat: `시즌 ${Number(mine[0].goals)}골` };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/** 이 히어로 경기의 대표 선수. 파일이 없거나 다른 경기 것이면 null. */
export function loadHeroStar(hero: Schedule | null, file: string = HERO_STAR_PATH): HeroStar | null {
  if (!hero) return null;
  try {
    if (!fs.existsSync(file)) return null;
    const s = JSON.parse(fs.readFileSync(file, "utf-8")) as HeroStar;
    if (s.date !== hero.date || s.home !== hero.homeTeam || s.away !== (hero.awayTeam ?? "")) return null;
    if (!isPlausibleName(s.name) || !s.team || !s.stat) return null;
    if (s.team !== hero.homeTeam && s.team !== hero.awayTeam) return null;
    return s;
  } catch {
    return null;
  }
}
