import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStarter } from "./naver";

// KBO 응답 형태 (whip 있음, inn 소수표기)
const KBO_RAW = {
  playerInfo: { name: "네일" },
  currentSeasonStats: { era: "3.84", inn: "63.1", w: 2, l: 4, kk: 48, whip: "1.11" },
};
// MLB 응답 형태 (whip 없음)
const MLB_RAW = {
  playerInfo: { name: "잭스" },
  currentSeasonStats: { era: "3.30", inn: "30.0", w: 1, l: 3, kk: 27 },
};

test("KBO 선발 파싱 — whip 포함, 이닝 포맷", () => {
  const s = parseStarter(KBO_RAW);
  assert.deepEqual(s, { name: "네일", era: "3.84", ip: "63⅓", w: 2, l: 4, so: 48, whip: "1.11" });
});

test("MLB 선발 파싱 — whip 없음", () => {
  const s = parseStarter(MLB_RAW);
  assert.deepEqual(s, { name: "잭스", era: "3.30", ip: "30", w: 1, l: 3, so: 27 });
});

test("이름 없으면 null", () => {
  assert.equal(parseStarter({ currentSeasonStats: { era: "1.00" } }), null);
});

test("era 없으면 null", () => {
  assert.equal(parseStarter({ playerInfo: { name: "X" } }), null);
});

test("null/undefined 안전", () => {
  assert.equal(parseStarter(null), null);
  assert.equal(parseStarter(undefined), null);
});
