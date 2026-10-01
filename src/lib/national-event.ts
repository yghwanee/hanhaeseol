// src/lib/national-event.ts
//
// 대한민국 대표팀 경기의 "무슨 경기인가" 라벨.
//
// 종전 제목·커버는 주인공을 **이름 하나**(선수명 또는 팀명)로만 불렀다. 클럽 경기는
// 그걸로 충분한데 대표팀 경기는 사람들이 매치업과 대회로 찾는다 —
// `한국 일본 중계` · `아시안게임 축구 결승` · `A매치 중계 채널`. 2026-10-02 유튜브 실측에서
// 조회가 붙은 소규모 채널 쇼츠 제목이 전부 이 꼴이었다
// (`대한민국 vs 중국 오늘 15시 아시안게임 축구 4강` 1.2만 · `결승전은 한일전 … 일정` 5.3만).
//
// 편성 데이터의 리그명은 `아이치-나고야 아시안게임` · `남자축구 국가대표팀` 처럼 검색어와
// 거리가 멀고 **라운드가 없다**. 라운드는 아시안게임 종목 파일(`public/asian-games/*.json`)
// 에만 있어 거기서 best-effort 로 붙인다. 못 찾으면 대회명만 쓴다 — 틀린 라운드를 지어내지 않는다.

import fs from "node:fs";
import path from "node:path";
import type { Schedule } from "@/types/schedule";
import { isAgScheduleLeague } from "./asian-games/data";
import { isNationalTeamMatch, nationalOpponent, NATIONAL_TEAM } from "./hero-pick";

export interface NationalEvent {
  /** "일본" */
  opponent: string;
  /** "대한민국 vs 일본" — 편성 표기 순서(홈 vs 원정) 그대로 */
  matchup: string;
  /** "아시안게임 남자축구 결승 한일전" · "축구 A매치" */
  event: string;
  /** 해시태그용 대회 키워드(# 없음): "아시안게임" · "A매치" */
  eventTag: string;
  /** 상대가 일본이면 "한일전" */
  nickname: string | null;
}

const norm = (s: string) => s.replace(/\s+/g, "");

interface AgGameLite {
  date?: string;
  time?: string;
  discipline?: string;
  title?: string;
  home?: string;
  away?: string;
}

/**
 * 아시안게임 종목 파일에서 같은 경기를 찾아 "남자축구 결승" 꼴 라운드를 만든다.
 * 날짜·시각·두 팀(순서 무관)이 전부 맞는 **유일한** 경기만 쓴다.
 */
function agRoundLabel(m: Schedule): string | null {
  try {
    const dir = path.resolve("public/asian-games");
    const sides = [norm(m.homeTeam), norm(m.awayTeam ?? "")].sort().join("|");
    const hits: AgGameLite[] = [];
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8")) as {
        games?: AgGameLite[];
      };
      for (const g of data.games ?? []) {
        if (g.date !== m.date || g.time !== m.time) continue;
        if ([norm(g.home ?? ""), norm(g.away ?? "")].sort().join("|") !== sides) continue;
        hits.push(g);
      }
    }
    if (hits.length !== 1) return null;
    const { title, discipline } = hits[0];
    if (!title || !discipline) return null;

    // "남자 금메달전" + "축구" → "남자축구 결승". 사람들은 금메달전이 아니라 결승으로 찾는다.
    const round = title.replace(/금메달전/, "결승");
    const gender = /^(남자|여자|혼성)\s+(.+)$/.exec(round);
    return gender ? `${gender[1]}${discipline} ${gender[2]}` : `${discipline} ${round}`;
  } catch {
    return null;
  }
}

/** 대표팀 경기가 아니거나 상대가 미정이면 null. */
export function nationalEventFor(m: Schedule | null): NationalEvent | null {
  if (!m || !isNationalTeamMatch(m)) return null;
  const opponent = nationalOpponent(m);
  if (!opponent) return null;

  const nickname = norm(opponent) === "일본" ? "한일전" : null;

  let base: string;
  let eventTag: string;
  if (isAgScheduleLeague(m.league)) {
    base = `아시안게임 ${agRoundLabel(m) ?? m.sport}`;
    eventTag = "아시안게임";
  } else if (m.sport === "축구" && /국가대표/.test(m.league)) {
    // 남자 대표팀 경기는 친선·예선 가리지 않고 A매치로 부른다(검색어가 그렇다).
    base = /여자/.test(m.league) ? "여자축구 A매치" : "축구 A매치";
    eventTag = "A매치";
  } else {
    base = m.league;
    eventTag = norm(m.league);
  }

  return {
    opponent,
    matchup: `${m.homeTeam} vs ${m.awayTeam}`,
    event: nickname ? `${base} ${nickname}` : base,
    eventTag,
    nickname,
  };
}

export { NATIONAL_TEAM };
