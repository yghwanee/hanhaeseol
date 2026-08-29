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
import { buildHookLine, buildShortsTitle } from "./shorts-title";
import { findDuplicateRun, isInCycleWindow } from "./post-duplicate";

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

// ─────────────────────────────────────────────────────────────────────────────
// 2026-08-29 추가 — 날짜만 맞추는 걸로는 부족했다.
//
// 8/28 저녁분이 12시간 밀려 KST 8/29 04:27 에 발화했다. 사이클 보정 덕에 대상
// 날짜(8/29)는 맞았지만, 저녁 문구 풀에 "내일"이 하드코딩돼 있어 **오늘 밤 경기를
// "내일"이라 부르며** 나갔다. 실제 업로드된 쇼츠 제목:
//   `내일 밤 10시 30분 이재성 ⚽ 한국어 중계 채널 정리 8/29(토) #Shorts`
// 게다가 30분 뒤 아침분이 같은 8/29 를 또 올릴 상황이었다.
//
// 지켜야 할 세트: 아침 = 오늘 경기 / 저녁 = 내일 경기.
// ─────────────────────────────────────────────────────────────────────────────

test("🔴 밀린 저녁분의 문구가 '내일'로 나가지 않는다 (2026-08-29 사고)", () => {
  const now = atKst(2026, 8, 29, 4, 27); // 실제 발화 시각
  const { today, mm, dd } = getKstToday(1, now);
  assert.equal(today, "2026-08-29", "보정된 대상 날짜");
  assert.equal(inferDayLabel(today, now), "오늘", "그 시점엔 8/29 가 '오늘'이다");

  const title = buildShortsTitle(mm, dd, today, "evening", now);
  const hook = buildHookLine(today, "evening", "ig-feed", now);
  const cover = buildCoverHook(today, "evening", now);
  for (const [what, s] of [
    ["쇼츠 제목", title],
    ["훅", hook],
    ["커버", `${cover.small} ${cover.big}`],
  ] as const) {
    assert.ok(!s.includes("내일"), `${what} 이 오늘 경기를 '내일'이라 부른다 — ${s}`);
  }
});

test("정상 저녁(KST 18시)은 여전히 '내일'로 말한다", () => {
  const now = atKst(2026, 8, 28, 18, 0);
  const { today, mm, dd } = getKstToday(1, now);
  assert.equal(today, "2026-08-29");
  const title = buildShortsTitle(mm, dd, today, "evening", now);
  const cover = buildCoverHook(today, "evening", now);
  assert.ok(
    title.includes("내일") || `${cover.small} ${cover.big}`.includes("내일"),
    `정상 저녁인데 '내일'이 사라졌다 — ${title} / ${cover.small} ${cover.big}`,
  );
});

test("🔴 사이클 창 — 밀려서 남의 시간대로 넘어간 예약 발화는 게시하지 않는다", () => {
  // 저녁(내일치): KST 12~24시
  assert.equal(isInCycleWindow("evening", atKst(2026, 8, 28, 16, 18)), true, "정상 저녁");
  assert.equal(isInCycleWindow("evening", atKst(2026, 8, 28, 23, 59)), true, "자정 직전");
  assert.equal(isInCycleWindow("evening", atKst(2026, 8, 29, 4, 27)), false, "사고 시각");
  assert.equal(isInCycleWindow("evening", atKst(2026, 8, 29, 11, 59)), false, "정오 직전");

  // 아침(오늘치): KST 00~18시
  assert.equal(isInCycleWindow("morning", atKst(2026, 8, 29, 4, 53)), true, "정상 아침");
  assert.equal(isInCycleWindow("morning", atKst(2026, 8, 28, 12, 51)), true, "8/28 실제 복구분");
  assert.equal(isInCycleWindow("morning", atKst(2026, 8, 29, 19, 0)), false, "저녁까지 밀린 아침");
});

test("🔴 같은 날짜 중복은 막고, 정상 운영은 안 막는다", () => {
  const run = (iso: string, conclusion = "success") => ({
    conclusion,
    run_started_at: iso,
    html_url: "u",
  });

  // 오늘 아침(KST 8/29 04:53) 시점에서 상대(저녁, offset 1)를 본다.
  const morningNow = atKst(2026, 8, 29, 4, 53);
  const myTarget = getKstToday(0, morningNow).today; // 2026-08-29

  // ① 사고 그대로: 저녁분이 KST 8/29 04:27 에 돌아 8/29 를 이미 올렸다 → 막는다.
  assert.ok(
    findDuplicateRun(myTarget, 1, [run(atKst(2026, 8, 29, 4, 27).toISOString())], morningNow),
    "자정 넘겨 밀린 저녁분과 같은 날짜인데 안 막았다",
  );

  // ② 정상 운영: 전날 저녁 16:18 실행은 8/29 가 아니라... 8/29 다(내일치).
  //    그래서 날짜만으로는 겹치는데, 그 실행은 LOOKBACK 밖이 아니라 **12시간 전**이다.
  //    → 정상 세트에서도 아침이 막히면 안 되므로 이 조합은 반드시 확인해야 한다.
  const normalEvening = atKst(2026, 8, 28, 16, 18);
  assert.equal(getKstToday(1, normalEvening).today, "2026-08-29");

  // ③ 실패한 실행은 세지 않는다.
  assert.equal(
    findDuplicateRun(myTarget, 1, [run(atKst(2026, 8, 29, 4, 27).toISOString(), "failure")], morningNow),
    null,
  );

  // ④ 미래 시각·오래된 실행은 세지 않는다.
  assert.equal(
    findDuplicateRun(myTarget, 1, [run(atKst(2026, 8, 29, 9, 0).toISOString())], morningNow),
    null,
    "아직 오지 않은 실행",
  );
  assert.equal(
    findDuplicateRun(myTarget, 1, [run(atKst(2026, 8, 27, 16, 18).toISOString())], morningNow),
    null,
    "LOOKBACK 밖",
  );
});
