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
import {
  findSameSlotDuplicate,
  findTooCloseRun,
  isInCycleWindow,
  runDidPost,
  MIN_GAP_HOURS,
} from "./post-duplicate";

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

// ─────────────────────────────────────────────────────────────────────────────
// 2026-08-30 — 중복 검사가 **정상 운영을 매일 죽이고 있었다**.
//
// 세트 정의상 저녁(D)과 다음날 아침(D+1)은 대상 날짜가 항상 같다.
// 그런데 종전 검사는 "상대가 20시간 안에 같은 날짜를 올렸으면 중단"이라
// 아침이 매일 스킵됐다(2026-08-30 07:01 실행 로그로 확인).
//
// 🔴 종전 테스트에도 이 조합이 "반드시 확인해야 한다"고 적혀 있었는데,
// 대상 날짜만 계산해 보고 **검사 함수를 호출하지 않은 채 끝났다.**
// 여기서는 반드시 호출해서 단언한다.
// ─────────────────────────────────────────────────────────────────────────────

const run = (at: Date, conclusion = "success", posted?: boolean) => ({
  conclusion,
  run_started_at: at.toISOString(),
  html_url: "u",
  ...(posted === undefined ? {} : { posted }),
});

test("🔴 정상 세트(저녁 D → 다음날 아침 D)를 막지 않는다 — 2026-08-30 사고", () => {
  // 실제 사고: 저녁 08-29 22:10 KST(대상 08-30) → 아침 08-30 07:01 KST(대상 08-30).
  const morningNow = atKst(2026, 8, 30, 7, 1);
  const myTarget = getKstToday(0, morningNow).today;
  assert.equal(myTarget, "2026-08-30");

  const eveningRun = run(atKst(2026, 8, 29, 22, 10));
  assert.equal(getKstToday(1, atKst(2026, 8, 29, 22, 10)).today, myTarget, "날짜가 같은 게 정상이다");

  assert.equal(
    findTooCloseRun(myTarget, 1, [eveningRun], morningNow),
    null,
    "8시간 51분 떨어진 정상 세트를 막았다 — 아침 게시가 매일 죽는다",
  );

  // cron 이 제시간에 돌아도 마찬가지(저녁 16:18 → 아침 04:53, 12h35m).
  const onTimeMorning = atKst(2026, 8, 30, 4, 53);
  assert.equal(
    findTooCloseRun(getKstToday(0, onTimeMorning).today, 1, [run(atKst(2026, 8, 29, 16, 18))], onTimeMorning),
    null,
    "정시 운영도 막혔다",
  );
});

test("🔴 너무 붙어서 나가는 것은 막는다 (2026-08-28 사고 형태)", () => {
  // 저녁분이 KST 04:27 에 발화해 8/29 를 올렸고, 30분 뒤 아침분이 같은 날짜를 올리려 한다.
  const morningNow = atKst(2026, 8, 29, 5, 0);
  const myTarget = getKstToday(0, morningNow).today;
  const hit = findTooCloseRun(myTarget, 1, [run(atKst(2026, 8, 29, 4, 27))], morningNow);
  assert.ok(hit, `${MIN_GAP_HOURS}시간 안에 같은 날짜가 나갔는데 안 막았다`);

  // 경계: MIN_GAP_HOURS 를 지나면 통과한다.
  const later = atKst(2026, 8, 29, 4 + MIN_GAP_HOURS, 28);
  assert.equal(findTooCloseRun(myTarget, 1, [run(atKst(2026, 8, 29, 4, 27))], later), null);
});

test("🔴 같은 슬롯이 같은 날짜를 두 번 올리는 것은 막는다", () => {
  // 어제 cron 이 24시간 밀려 오늘 cron 과 같은 날짜를 잡는 경우.
  const now = atKst(2026, 8, 30, 4, 53);
  const myTarget = getKstToday(0, now).today;
  assert.ok(
    findSameSlotDuplicate(myTarget, 0, [run(atKst(2026, 8, 30, 1, 0))], now),
    "같은 아침 워크플로가 오늘치를 이미 올렸는데 또 올린다",
  );
  // 어제분(대상 08-29)은 날짜가 달라 안 막는다.
  assert.equal(
    findSameSlotDuplicate(myTarget, 0, [run(atKst(2026, 8, 29, 12, 0))], now),
    null,
  );
});

test("🔴 게시하지 않고 스킵된 실행은 '이미 올렸다'로 세지 않는다", () => {
  // 이걸 세면 스킵이 다음 스킵을 부른다(무한 침묵).
  const now = atKst(2026, 8, 29, 5, 0);
  const myTarget = getKstToday(0, now).today;
  const skipped = run(atKst(2026, 8, 29, 4, 27), "success", false);
  assert.equal(findTooCloseRun(myTarget, 1, [skipped], now), null);
  assert.equal(findSameSlotDuplicate(myTarget, 0, [skipped], now), null);
});

test("실패·미래·창 밖 실행은 세지 않는다", () => {
  const now = atKst(2026, 8, 29, 5, 0);
  const myTarget = getKstToday(0, now).today;
  assert.equal(
    findTooCloseRun(myTarget, 1, [run(atKst(2026, 8, 29, 4, 27), "failure")], now),
    null,
    "실패한 실행",
  );
  assert.equal(
    findTooCloseRun(myTarget, 1, [run(atKst(2026, 8, 29, 9, 0))], now),
    null,
    "아직 오지 않은 실행",
  );
  assert.equal(
    findSameSlotDuplicate(myTarget, 0, [run(atKst(2026, 8, 28, 4, 53))], now),
    null,
    "LOOKBACK 밖",
  );
});

test("🔴 게시 여부 판정 — '게시 대상 채널 결정'을 게시로 오판하지 않는다", () => {
  // 2026-08-30 스킵 실행의 실제 스텝 구성.
  const skippedRun = [
    { name: "게시 대상 채널 결정", conclusion: "success" },
    { name: "사이클 창·중복 검사", conclusion: "success" },
    { name: "게시 건너뜀 (Telegram 알림)", conclusion: "success" },
    { name: "카드 생성 (당일 경기)", conclusion: "skipped" },
    { name: "인스타 업로드용 JPEG 변환", conclusion: "skipped" },
    { name: "캐러셀 게시", conclusion: "skipped" },
    { name: "릴스 게시", conclusion: "skipped" },
    { name: "스토리 게시", conclusion: "skipped" },
    { name: "유튜브 쇼츠 업로드", conclusion: "skipped" },
  ];
  assert.equal(runDidPost(skippedRun), false, "스킵된 실행을 게시했다고 봤다");

  // 정상 게시 실행.
  assert.equal(
    runDidPost([...skippedRun.slice(0, 5), { name: "캐러셀 게시", conclusion: "success" }]),
    true,
  );
  // only=reel 재실행 — 한 채널만 성공해도 게시한 것이다.
  assert.equal(
    runDidPost([
      { name: "게시 대상 채널 결정", conclusion: "success" },
      { name: "캐러셀 게시", conclusion: "skipped" },
      { name: "릴스 게시", conclusion: "success" },
    ]),
    true,
  );
  // 준비 단계만 돌고 게시 직전에 죽은 실행.
  assert.equal(
    runDidPost([
      { name: "릴스 영상 생성 (신규 v2 — punch + xfade zoomin)", conclusion: "success" },
      { name: "인스타 업로드용 JPEG 변환", conclusion: "success" },
      { name: "캐러셀 게시", conclusion: "failure" },
    ]),
    false,
  );
});
