import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldRegenerate, isInsightTooOld } from "./freshness";

test("10/15 에 만든 10/21 경기 글: 10/19 부터 재생성 대상, 화면에선 숨김", () => {
  const gen = "2026-10-15T00:00:00Z";
  assert.equal(shouldRegenerate(gen, "2026-10-21", "2026-10-18"), false); // 아직 3일 남음
  assert.equal(shouldRegenerate(gen, "2026-10-21", "2026-10-19"), true);
  assert.equal(isInsightTooOld(gen, "2026-10-21"), true);
});

test("경기 하루 전에 만든 글은 그대로", () => {
  const gen = "2026-10-20T10:00:00Z";
  assert.equal(shouldRegenerate(gen, "2026-10-21", "2026-10-21"), false);
  assert.equal(isInsightTooOld(gen, "2026-10-21"), false);
});

test("KST 날짜로 센다(UTC 15시 이후는 다음 날)", () => {
  // 10/16 KST 00:30 = 10/15 15:30Z → 경기 10/20 은 4일 앞 → 숨기지 않음
  assert.equal(isInsightTooOld("2026-10-15T15:30:00Z", "2026-10-20"), false);
});
