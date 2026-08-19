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

/**
 * 🔴 `으로/로` 는 받침 유무만으로 못 고른다. **ㄹ 받침 뒤에는 `로`** 다
 * ("서울로", "물로", "한국어 해설로"). 2026-08-19 에 이 짝을 처음 쓰면서
 * `한국어 해설으로` 가 나와 드러났다.
 */
test("으로/로 는 ㄹ 받침을 예외로 둔다", () => {
  // 받침 없음 → 로
  assert.equal(withJosa("티빙", "으로/로"), "티빙으로");
  assert.equal(withJosa("현지 해설", "으로/로"), "현지 해설로");
  // ㄹ 받침 → 로
  assert.equal(withJosa("서울", "으로/로"), "서울로");
  assert.equal(withJosa("한국어 해설", "으로/로"), "한국어 해설로");
  // 그 밖의 받침 → 으로
  assert.equal(withJosa("해설 확인중", "으로/로"), "해설 확인중으로");
  assert.equal(withJosa("해설 정보 미확인", "으로/로"), "해설 정보 미확인으로");
  // 다른 짝은 ㄹ 받침도 그냥 받침 취급이다.
  assert.equal(withJosa("서울", "이/가"), "서울이");
  assert.equal(withJosa("서울", "은/는"), "서울은");
});
