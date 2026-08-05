import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCoverHook,
  MORNING_COVER_HOOKS,
  EVENING_COVER_HOOKS,
} from "./cover-hook";
import { getKstToday } from "./instagram";

test("풀은 슬롯당 8개다", () => {
  // 3~4개면 같은 틀이 사나흘마다 돌아와 몰아 보면 티가 난다.
  assert.equal(MORNING_COVER_HOOKS.length, 8);
  assert.equal(EVENING_COVER_HOOKS.length, 8);
});

test("같은 날짜의 아침과 저녁 문구가 절대 같지 않다", () => {
  // 작업82 재발 방지 — 저녁판과 다음날 아침판은 대상 날짜가 같다.
  for (let i = 0; i < 14; i++) {
    const { today } = getKstToday(i);
    const m = buildCoverHook(today, "morning");
    const e = buildCoverHook(today, "evening");
    assert.notEqual(`${m.small}|${m.big}`, `${e.small}|${e.big}`, `${today} 에서 충돌`);
  }
});

test("같은 날 같은 슬롯을 다시 부르면 같은 문구가 나온다", () => {
  const { today } = getKstToday(0);
  assert.deepEqual(buildCoverHook(today, "morning"), buildCoverHook(today, "morning"));
});

test("액센트 조각은 실제 문구 안에 있다", () => {
  for (let i = 0; i < 14; i++) {
    const { today } = getKstToday(i);
    for (const slot of ["morning", "evening"] as const) {
      const h = buildCoverHook(today, slot);
      const joined = `${h.small} ${h.big}`;
      assert.ok(joined.includes(h.accent), `${today}/${slot}: "${h.accent}" 없음`);
    }
  }
});

test("조사가 앞말에서 떨어지지 않는다", () => {
  // "맨시티 가 옵니다" 처럼 조사 앞에 공백이 생기면 실패.
  const JOSA_SPLIT = /\s(?:가|이|은|는|을|를|의|에|도)\s/;
  for (let i = 0; i < 14; i++) {
    const { today } = getKstToday(i);
    for (const slot of ["morning", "evening"] as const) {
      const h = buildCoverHook(today, slot);
      assert.ok(!JOSA_SPLIT.test(`${h.small} / ${h.big}`), `${today}/${slot}: ${h.big}`);
    }
  }
});
