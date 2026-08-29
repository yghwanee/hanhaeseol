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

test("템플릿이 조사를 고정하지 않는다", () => {
  // `김혜성는`·`아스날는` 이 나오던 부류(작업58). 조사는 받침으로 골라야 한다.
  //
  // 생성된 문장을 정규식으로 훑는 방식은 못 쓴다 — `쿠팡플레이`처럼 고유명사가
  // 이/가/은/는 으로 끝나는 경우가 흔해 조사와 구분이 안 된다.
  // 대신 템플릿을 직접 불러 받침 있는 이름과 없는 이름을 넣어 본다.
  const base = {
    isPlayer: true,
    time: "저녁 7시",
    daypart: "저녁" as const,
    games: 12,
    platform: "티빙",
    isWeekday: true,
    dayWord: "내일" as const,
  };
  const withFinal = { ...base, who: "김혜성" }; // 받침 O
  const withoutFinal = { ...base, who: "맨시티", isPlayer: false }; // 받침 X

  for (const t of [...MORNING_COVER_HOOKS, ...EVENING_COVER_HOOKS]) {
    const a = t.build(withFinal);
    const b = t.build(withoutFinal);
    assert.ok(
      !`${a.small} ${a.big}`.includes("김혜성는"),
      `받침 있는 이름에 "는" — ${a.small} / ${a.big}`,
    );
    assert.ok(
      !`${b.small} ${b.big}`.includes("맨시티은"),
      `받침 없는 이름에 "은" — ${b.small} / ${b.big}`,
    );
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
