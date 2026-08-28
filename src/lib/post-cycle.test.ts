// 게시 사이클 가드 — 대상 날짜가 하루 밀리는 사고(2026-08-27) 재발 방지.
//
// 사고: 저녁 워크플로가 GH Actions cron 지연으로 11시간 밀려 KST 8/28 03:18 에
// 발화했고, 종전 코드가 "실행 시각 + 1일"을 잡아 **8/29 경기**를 5채널 전부에
// 올렸다. 8/28 게시는 하루 통째로 비었다.
//
// 여기서 막는 것 둘:
//  1) 저녁 실행이 자정을 넘겨도 대상 날짜가 하루 앞서 나가지 않는다
//  2) 그 보정 때문에 슬롯이 morning 으로 오판되지 않는다(작업82 중복 재발)

import { test } from "node:test";
import assert from "node:assert/strict";
import { getKstToday, inferDayLabel, EVENING_CYCLE_START_HOUR } from "./instagram";
import { getPostSlot } from "./post-slot";
import { buildCoverHook } from "./cover-hook";

/** KST 벽시계 시각을 그 순간의 실제 Date 로 만든다(KST = UTC+9). */
function atKst(y: number, m: number, d: number, hh: number, mm = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, hh - 9, mm));
}

function withOffsetEnv<T>(value: string | undefined, fn: () => T): T {
  const prev = process.env.KST_OFFSET_DAYS;
  if (value === undefined) delete process.env.KST_OFFSET_DAYS;
  else process.env.KST_OFFSET_DAYS = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.KST_OFFSET_DAYS;
    else process.env.KST_OFFSET_DAYS = prev;
  }
}

test("🔴 2026-08-27 사고 재현 — 저녁분이 KST 03:18 에 돌아도 8/29 가 아니라 8/28", () => {
  // 실제 발화: UTC 2026-08-27T18:18Z = KST 2026-08-28 03:18.
  // 사고 당시 결과는 2026-08-29(로그의 main-0829.png)였다.
  const { today } = getKstToday(1, atKst(2026, 8, 28, 3, 18));
  assert.equal(today, "2026-08-28");
});

test("저녁 정상 실행(KST 16:18)은 내일을 잡는다", () => {
  const { today } = getKstToday(1, atKst(2026, 8, 27, 16, 18));
  assert.equal(today, "2026-08-28");
});

test("저녁 사이클 경계 — 정오 직전은 보정, 정오부터는 그대로", () => {
  assert.equal(EVENING_CYCLE_START_HOUR, 12);
  // 11:59 = 전날 저녁분이 밀린 것 → 기준일 -1 → 대상 = 실행일 당일
  assert.equal(getKstToday(1, atKst(2026, 8, 28, 11, 59)).today, "2026-08-28");
  // 12:00 = 당일 저녁 사이클 → 대상 = 내일
  assert.equal(getKstToday(1, atKst(2026, 8, 28, 12, 0)).today, "2026-08-29");
});

test("월말/연말 경계에서도 하루가 밀리지 않는다", () => {
  // 저녁분이 자정 직후로 밀린 경우들
  assert.equal(getKstToday(1, atKst(2026, 9, 1, 2, 0)).today, "2026-09-01");
  assert.equal(getKstToday(1, atKst(2027, 1, 1, 2, 0)).today, "2027-01-01");
  // 정상 저녁 실행
  assert.equal(getKstToday(1, atKst(2026, 8, 31, 16, 18)).today, "2026-09-01");
  assert.equal(getKstToday(1, atKst(2026, 12, 31, 16, 18)).today, "2027-01-01");
});

test("아침(offset 0)은 보정하지 않는다 — 지연돼도 날짜가 맞다", () => {
  // 예정 04:53
  assert.equal(getKstToday(0, atKst(2026, 8, 28, 4, 53)).today, "2026-08-28");
  // 오늘처럼 몇 시간 밀려도 여전히 당일
  assert.equal(getKstToday(0, atKst(2026, 8, 28, 9, 24)).today, "2026-08-28");
  // 저녁까지 밀려도 당일 (날짜는 틀리지 않는다)
  assert.equal(getKstToday(0, atKst(2026, 8, 28, 20, 0)).today, "2026-08-28");
});

test("🔴 보정된 저녁분이 morning 으로 오판되지 않는다", () => {
  // 보정 결과 대상 날짜(8/28)가 KST 오늘과 같아진다 — 날짜만 보면 morning 이다.
  const now = atKst(2026, 8, 28, 3, 18);
  const { today } = getKstToday(1, now);
  assert.equal(inferDayLabel(today, now), "오늘", "대상이 KST 오늘과 같은 상황이어야 이 검사가 의미 있다");

  // 워크플로 정체성(KST_OFFSET_DAYS)이 있으면 evening 으로 잡혀야 한다.
  assert.equal(withOffsetEnv("1", () => getPostSlot(today)), "evening");
  assert.equal(withOffsetEnv("0", () => getPostSlot(today)), "morning");
});

test("🔴 같은 날짜라도 아침·저녁 커버 문구가 갈린다(작업82 재발 방지)", () => {
  const today = "2026-08-28";
  const evening = withOffsetEnv("1", () => buildCoverHook(today, getPostSlot(today)));
  const morning = withOffsetEnv("0", () => buildCoverHook(today, getPostSlot(today)));
  assert.notEqual(
    `${evening.small}|${evening.big}`,
    `${morning.small}|${morning.big}`,
  );
});

test("env 가 없으면 종전 날짜 비교로 폴백한다", () => {
  const now = new Date();
  const { today: t0 } = getKstToday(0, now);
  const { today: t1 } = getKstToday(1, now);
  withOffsetEnv(undefined, () => {
    assert.equal(getPostSlot(t0), "morning");
    // t1 이 t0 와 같아지는 경우(정오 이전 실행)는 폴백이 morning 을 낼 수밖에 없다.
    // 그건 env 가 있는 실제 워크플로에서는 발생하지 않는다.
    if (t1 !== t0) assert.equal(getPostSlot(t1), "evening");
  });
});
