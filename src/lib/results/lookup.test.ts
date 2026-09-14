/**
 * findResult 한쪽 일치 안전망 가드.
 *
 * 배경(2026-09-15): 네이버가 "인테르 밀라노" → "인테르" 로 표기를 바꿔 인터-우디네세 5-3 이
 * 끝나고도 카드에 스코어가 안 붙었다. alias 표는 사람이 감사를 돌려야 채워져 매번 늦는다.
 * 안전망이 붙여야 할 것은 붙이고, 헷갈리는 것은 추측하지 않는지 지킨다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findResult } from "./lookup";
import type { MatchResult, ResultsData } from "@/types/results";
import type { Schedule } from "@/types/schedule";

function result(gameId: string, home: string, away: string, hs: number, as: number): MatchResult {
  return {
    date: "2026-09-15",
    categoryId: "seria",
    gameId,
    homeTeam: home,
    awayTeam: away,
    homeScore: hs,
    awayScore: as,
    status: "finished",
  } as MatchResult;
}

function data(entries: [string, MatchResult][]): ResultsData {
  return { lastUpdated: "", results: [], byKey: Object.fromEntries(entries) } as ResultsData;
}

function sched(home: string, away: string, league = "세리에A"): Schedule {
  return { id: "x", date: "2026-09-15", time: "03:45", sport: "축구", league, homeTeam: home, awayTeam: away, platform: "SPOTV NOW", koreanCommentary: false } as Schedule;
}

const inter = result("g1", "인테르", "우디네세 칼초", 5, 3);
const roma = result("g2", "토리노", "AS 로마", 0, 2);

test("원정이 같고 홈 표기만 다르면 같은 경기로 붙인다(인테르 ↔ 인터 밀란)", () => {
  const d = data([
    ["2026-09-15|seria|인테르|우디네세 칼초", inter],
    ["2026-09-15|seria|인테르|우디네세", inter],
    ["2026-09-15|seria|토리노|AS 로마", roma],
  ]);
  const r = findResult(d, sched("인터 밀란", "우디네세 칼초"));
  assert.equal(r?.homeScore, 5);
  assert.equal(r?.awayScore, 3);
  assert.equal(r?.homeTeam, "인터 밀란", "카드 기준 팀명으로 돌려줘야 한다");
});

test("fuzzy:false 면 붙이지 않는다(감사가 alias 빈칸을 계속 드러내야 한다)", () => {
  const d = data([["2026-09-15|seria|인테르|우디네세 칼초", inter]]);
  assert.equal(findResult(d, sched("인터 밀란", "우디네세 칼초"), { fuzzy: false }), undefined);
});

test("양쪽 다 다르면 남의 경기다 — 붙이지 않는다", () => {
  const d = data([["2026-09-15|seria|토리노|AS 로마", roma]]);
  assert.equal(findResult(d, sched("인터 밀란", "우디네세 칼초")), undefined);
});

test("한쪽 일치 후보가 서로 다른 경기 둘이면 추측하지 않는다", () => {
  const a = result("g3", "알 아흘리", "파흐타코르", 1, 1);
  const b = result("g4", "샤바브 알 아흘리", "파흐타코르", 2, 0);
  const d = data([
    ["2026-09-15|acl|알 아흘리|파흐타코르", a],
    ["2026-09-15|acl|샤바브 알 아흘리|파흐타코르", b],
  ]);
  assert.equal(findResult(d, sched("알 아흘리 SFC", "파흐타코르", "ACL")), undefined);
});

test("자리가 바뀐 일치(원정 팀이 결과의 홈)는 안전망이 잡지 않는다", () => {
  const d = data([["2026-09-15|seria|우디네세 칼초|인테르", result("g5", "우디네세 칼초", "인테르", 1, 0)]]);
  assert.equal(findResult(d, sched("인터 밀란", "우디네세 칼초")), undefined);
});

test("다른 날짜 결과는 보지 않는다", () => {
  const d = data([["2026-09-14|seria|인테르|우디네세 칼초", inter]]);
  assert.equal(findResult(d, sched("인터 밀란", "우디네세 칼초")), undefined);
});

test("정확 매칭은 그대로 우선한다", () => {
  const d = data([["2026-09-15|seria|토리노|AS 로마", roma]]);
  assert.equal(findResult(d, sched("토리노", "AS 로마"))?.awayScore, 2);
});
