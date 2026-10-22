import { test } from "node:test";
import assert from "node:assert/strict";
import { staleSeriesClaims } from "./fact-check";

const done = [{ round: "semipo" as const, wins: { KIA: 3, LG: 0 }, winner: "KIA" }];

test("끝난 시리즈를 진행 중으로 쓴 문장을 잡는다 (2026-10-22 삼성 글 재현)", () => {
  const text = "지금 준플레이오프는 KIA와 LG가 치르고 있다. 5전 3선승제인데 2차전까지 KIA가 앞서고 있는 상황이다.";
  const claims = staleSeriesClaims(text, done);
  assert.ok(claims.length >= 1);
  assert.match(claims[0], /준플레이오프는 KIA 3승으로 이미 끝났다/);
});

test("끝난 시리즈를 과거형으로 쓰면 통과", () => {
  const text = "준플레이오프는 KIA가 LG를 3승 무패로 끝냈다.";
  assert.deepEqual(staleSeriesClaims(text, done), []);
});

test("진행 중인 시리즈는 진행형이어도 통과", () => {
  const text = "플레이오프는 삼성과 KIA가 치르고 있다.";
  assert.deepEqual(staleSeriesClaims(text, [{ round: "po", wins: { 삼성: 1, KIA: 1 }, winner: null }]), []);
});
