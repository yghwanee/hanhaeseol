import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveFlow,
  findFormContradictions,
  streakFromLast5,
} from "./form-claim";

test("흐름은 streak 우선, 없으면 최근 5경기 첫 글자", () => {
  assert.equal(deriveFlow("LLWWL", { type: "L", count: 2 }), "down");
  assert.equal(deriveFlow("WWLWW", { type: "W", count: 2 }), "up");
  assert.equal(deriveFlow("WLLDW"), "up");
  assert.equal(deriveFlow("LWWWW"), "down");
  assert.equal(deriveFlow("DWWLL"), "flat");
  assert.equal(deriveFlow(""), "unknown");
  assert.equal(deriveFlow(undefined, undefined), "unknown");
  // count 0 은 "연속 없음"이라 streak 로 못 쓴다.
  assert.equal(deriveFlow("LWWWW", { type: "W", count: 0 }), "down");
});

test("연속 기록을 최근 5경기에서 뽑는다 (네이버가 축구엔 안 준다)", () => {
  assert.deepEqual(streakFromLast5("WWLWW"), { type: "W", count: 2 });
  assert.deepEqual(streakFromLast5("LLLWW"), { type: "L", count: 3 });
  assert.deepEqual(streakFromLast5("D"), { type: "D", count: 1 });
  assert.equal(streakFromLast5(""), undefined);
  assert.equal(streakFromLast5(undefined), undefined);
});

// 실제로 저장돼 있던 문장들이다(2026-08-23 스캔).
test("실제 오보 문장을 잡는다", () => {
  const boston = findFormContradictions(
    "보스턴 레드삭스는 최근 경기에서 승패를 반복하며 흐름을 찾지 못하고 있습니다. 현재 연패를 기록하며 분위기 전환이 필요합니다.",
    [{ name: "보스턴 레드삭스", flow: "up" }],
  );
  assert.equal(boston.length, 1);
  assert.equal(boston[0].claimed, "down");

  const minnesota = findFormContradictions(
    "미네소타 트윈스는 직전 경기 승리로 분위기 전환에 성공하며 상승세를 이어가려 합니다.",
    [{ name: "미네소타 트윈스", flow: "down" }],
  );
  assert.equal(minnesota.length, 1);
  assert.equal(minnesota[0].claimed, "up");
});

test("주어가 생략된 다음 문장도 앞 문장 팀으로 본다", () => {
  const hits = findFormContradictions(
    "두산은 이번 시리즈를 앞두고 있습니다. 연승을 통해 상위권 도약을 노립니다.",
    [{ name: "두산", flow: "down" }],
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0].team, "두산");
});

test("맞는 서술은 통과시킨다", () => {
  const ok = findFormContradictions(
    "롯데는 상승세를 이어가고 있습니다. KIA는 부진에서 벗어나려 합니다.",
    [
      { name: "롯데", flow: "up" },
      { name: "KIA", flow: "down" },
    ],
  );
  assert.deepEqual(ok, []);
});

test("애매한 문장은 판정하지 않는다", () => {
  // 두 팀이 한 문장에 있으면 누구 얘기인지 못 가른다.
  assert.deepEqual(
    findFormContradictions("상승세의 롯데와 부진한 KIA가 만난다.", [
      { name: "롯데", flow: "down" },
      { name: "KIA", flow: "up" },
    ]),
    [],
  );
  // 한 문장에 두 방향이 다 있으면 판정하지 않는다.
  assert.deepEqual(
    findFormContradictions("KIA는 부진을 씻고 연승에 도전한다.", [{ name: "KIA", flow: "up" }]),
    [],
  );
  // 흐름을 모르면 검사 자체를 안 한다.
  assert.deepEqual(
    findFormContradictions("KIA는 연패에 빠졌다.", [{ name: "KIA", flow: "unknown" }]),
    [],
  );
});

test("'반등'은 뒤에 오는 말로 방향이 갈린다", () => {
  // "반등이 필요" = 지금 안 좋다는 뜻
  assert.equal(
    findFormContradictions("KIA는 반등이 필요한 시점입니다.", [{ name: "KIA", flow: "up" }]).length,
    1,
  );
  // "반등에 성공" = 지금 좋다는 뜻이므로 하락 주장으로 세면 안 된다
  assert.deepEqual(
    findFormContradictions("KIA는 반등에 성공했습니다.", [{ name: "KIA", flow: "up" }]),
    [],
  );
});
