import { test } from "node:test";
import assert from "node:assert/strict";
import { hasFinalConsonant, josa, withJosa } from "./josa";

test("hasFinalConsonant: 받침 판정", () => {
  assert.equal(hasFinalConsonant("서울"), true);
  assert.equal(hasFinalConsonant("제주"), false);
  assert.equal(hasFinalConsonant("강원"), true);
  assert.equal(hasFinalConsonant("아스날"), true);
  assert.equal(hasFinalConsonant("한화"), false);
});

test("hasFinalConsonant: 숫자는 읽는 소리 기준", () => {
  assert.equal(hasFinalConsonant("승점 1"), true); // 일
  assert.equal(hasFinalConsonant("승점 2"), false); // 이
  assert.equal(hasFinalConsonant("8"), true); // 팔
});

test("hasFinalConsonant: 영문은 받침 없는 쪽으로", () => {
  assert.equal(hasFinalConsonant("KT"), false);
  assert.equal(hasFinalConsonant(""), false);
});

test("josa: 짝의 표기 순서와 무관하게 옳은 걸 고른다", () => {
  // 실제로 틀리게 나왔던 문장들
  assert.equal(withJosa("서울", "와/과"), "서울과");
  assert.equal(withJosa("제주", "와/과"), "제주와");
  assert.equal(withJosa("아스날", "은/는"), "아스날은");
  assert.equal(withJosa("한화", "은/는"), "한화는");

  assert.equal(josa("강원", "이/가"), "이");
  assert.equal(josa("제주", "이/가"), "가");
  assert.equal(josa("서울", "을/를"), "을");
  assert.equal(josa("제주", "을/를"), "를");
});
