import { test } from "node:test";
import assert from "node:assert/strict";
import { formatInnings } from "./format";

test("야구 소수표기 .1=⅓ .2=⅔", () => {
  assert.equal(formatInnings("63.1"), "63⅓");
  assert.equal(formatInnings("57.2"), "57⅔");
  assert.equal(formatInnings("30.0"), "30");
});

test("정수 이닝", () => {
  assert.equal(formatInnings("12"), "12");
});

test("0이닝대", () => {
  assert.equal(formatInnings("0.1"), "0⅓");
});

test("빈 문자열은 빈 문자열", () => {
  assert.equal(formatInnings(""), "");
});
