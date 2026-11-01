import { test } from "node:test";
import assert from "node:assert/strict";
import { activeCategories, hasHotGame } from "./active-categories";

const at = (iso: string) => Date.parse(iso);
const game = { date: "2026-11-01", time: "19:00", league: "KBL" };

test("킥오프 15분 전부터 12시간 뒤까지만 리그를 고른다", () => {
  assert.deepEqual(activeCategories([game], at("2026-11-01T18:44:00+09:00")), []);
  assert.deepEqual(activeCategories([game], at("2026-11-01T18:46:00+09:00")), ["kbl"]);
  assert.deepEqual(activeCategories([game], at("2026-11-02T06:59:00+09:00")), ["kbl"]);
  assert.deepEqual(activeCategories([game], at("2026-11-02T07:01:00+09:00")), []);
});

test("V리그는 남녀 카테고리를 둘 다 고르고, 매핑 없는 리그는 건너뛴다", () => {
  const now = at("2026-11-01T19:00:00+09:00");
  assert.deepEqual(activeCategories([{ ...game, league: "V리그" }], now), ["kovo", "wkovo"]);
  assert.deepEqual(activeCategories([{ ...game, league: "고교야구" }], now), []);
});

test("경기 시간대에만 폴링한다", () => {
  assert.equal(hasHotGame([game], at("2026-11-01T18:44:00+09:00")), false);
  assert.equal(hasHotGame([game], at("2026-11-01T20:00:00+09:00")), true);
  assert.equal(hasHotGame([game], at("2026-11-01T23:01:00+09:00")), false);
});
