import { test } from "node:test";
import assert from "node:assert/strict";
import { containsBettingTerms, BETTING_TERMS } from "./safety-filter";

test("flags 배당", () => {
  assert.equal(containsBettingTerms("이번 경기는 배당이 좋아 보입니다"), true);
});

test("flags 픽", () => {
  assert.equal(containsBettingTerms("오늘의 픽은 맨시티 승"), true);
});

test("flags 승률 예측", () => {
  assert.equal(containsBettingTerms("승률은 65%로 예측됩니다"), true);
});

test("flags 적중", () => {
  assert.equal(containsBettingTerms("3연속 적중"), true);
});

test("flags 토토 / 꽁머니", () => {
  assert.equal(containsBettingTerms("토토 정보"), true);
  assert.equal(containsBettingTerms("꽁머니 이벤트"), true);
});

test("passes clean viewing-guide text", () => {
  const safe = "맨시티는 최근 5경기 4승1무로 좋은 흐름. 홀란드의 폼이 관전 포인트";
  assert.equal(containsBettingTerms(safe), false);
});

test("BETTING_TERMS is exposed and non-empty", () => {
  assert.ok(BETTING_TERMS.length > 0);
});
