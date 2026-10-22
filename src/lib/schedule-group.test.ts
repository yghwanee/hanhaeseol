import { test } from "node:test";
import assert from "node:assert/strict";
import { groupSameGame } from "./schedule-group";
import type { Schedule } from "@/types/schedule";

let n = 0;
const s = (p: Partial<Schedule>): Schedule => ({
  id: String(++n), date: "2026-10-22", time: "18:30", sport: "야구", league: "KBO",
  homeTeam: "LG", awayTeam: "KIA", platform: "티빙", koreanCommentary: true, ...p,
});

test("사전 방송(15분 전 TV)과 본 중계는 한 카드, 시각은 늦은 쪽", () => {
  const out = groupSameGame([s({ platform: "SPOTV2", time: "18:15" }), s({ platform: "티빙", time: "18:30" })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].time, "18:30");
  assert.deepEqual(out[0].coverage!.map((c) => c.platform).sort(), ["SPOTV2", "티빙"]);
});

test("더블헤더(몇 시간 차)는 두 카드", () => {
  assert.equal(groupSameGame([s({ time: "13:00" }), s({ time: "18:00" })]).length, 2);
});

test("홈/원정 반전·표기 차이도 같은 경기, 채널별 해설은 따로 남고 한국어가 앞", () => {
  const out = groupSameGame([
    s({ sport: "축구", league: "챔피언스리그", homeTeam: "맨시티", awayTeam: "아스날", platform: "SPOTV NOW", koreanCommentary: false, time: "04:00" }),
    s({ sport: "축구", league: "챔피언스리그", homeTeam: "맨체스터 시티", awayTeam: "아스널", platform: "쿠팡플레이", koreanCommentary: true, time: "04:00" }),
  ]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].coverage, [
    { platform: "쿠팡플레이", koreanCommentary: true },
    { platform: "SPOTV NOW", koreanCommentary: false },
  ]);
});

test("종목이 다르면 이름이 같아도 따로", () => {
  assert.equal(groupSameGame([s({}), s({ sport: "농구", league: "KBL", platform: "tvN SPORTS" })]).length, 2);
});
