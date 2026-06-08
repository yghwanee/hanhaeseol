import { test } from "node:test";
import assert from "node:assert/strict";
import { pickHeroMatch } from "./hero-pick";
import type { Schedule } from "@/types/schedule";

function wc(
  home: string,
  away: string,
  league = "북중미 월드컵",
  time = "21:00",
): Schedule {
  return {
    id: `wc-${home}-${away}`,
    date: "2026-06-12",
    time,
    sport: "축구",
    league,
    homeTeam: home,
    awayTeam: away,
    platform: "JTBC",
    koreanCommentary: true,
  };
}

function club(
  home: string,
  away: string,
  league: string,
  time = "21:00",
): Schedule {
  return {
    id: `club-${home}-${away}`,
    date: "2026-06-12",
    time,
    sport: "축구",
    league,
    homeTeam: home,
    awayTeam: away,
    platform: "SPOTV NOW",
    koreanCommentary: true,
  };
}

test("월드컵 조별경기가 비월드컵 Tier S 빅매치보다 우선", () => {
  const wcGroup = wc("멕시코", "남아프리카 공화국");
  const ucl = club("레알 마드리드", "맨시티", "챔피언스리그");
  assert.equal(pickHeroMatch([ucl, wcGroup]), wcGroup);
});

test("같은 날 16강이 조별리그보다 우선 (라운드 우선)", () => {
  const r16 = wc("우루과이", "스코틀랜드", "북중미 월드컵 16강");
  const group = wc("브라질", "아르헨티나", "북중미 월드컵");
  assert.equal(pickHeroMatch([group, r16]), r16);
});

test("같은 라운드에서 대한민국 경기가 강호 vs 강호보다 우선", () => {
  const korea = wc("대한민국", "체코");
  const bigBig = wc("브라질", "프랑스");
  assert.equal(pickHeroMatch([bigBig, korea]), korea);
});

test("같은 라운드: 양팀 강호 > 한 팀 강호", () => {
  const bigBig = wc("브라질", "프랑스");
  const bigMid = wc("스페인", "파나마");
  assert.equal(pickHeroMatch([bigMid, bigBig]), bigBig);
});

test("같은 라운드·매치업 티어 → 이른 시간 우선", () => {
  const early = wc("브라질", "프랑스", "북중미 월드컵", "18:00");
  const late = wc("스페인", "독일", "북중미 월드컵", "22:00");
  assert.equal(pickHeroMatch([late, early]), early);
});

test("월드컵 없는 날: 기존 heroScore 순위 유지 (회귀 없음)", () => {
  const ucl = club("레알 마드리드", "맨시티", "챔피언스리그", "21:00");
  const kbo: Schedule = {
    id: "kbo-1",
    date: "2026-06-12",
    time: "18:30",
    sport: "야구",
    league: "KBO",
    homeTeam: "키움",
    awayTeam: "NC",
    platform: "SPOTV NOW",
    koreanCommentary: true,
  };
  assert.equal(pickHeroMatch([kbo, ucl]), ucl);
});
