import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTiktokCaption, speakTime } from "./tiktok-caption";

/**
 * 틱톡 캡션 스팸 신호 가드 (2026-07-19, 조회수 0 대응).
 * 캡션에 URL·태그 도배가 다시 들어오면 FYP 부적격 재발 위험 — 회귀를 테스트로 막는다.
 * buildTiktokCaption은 schedule.json 실데이터를 읽으므로 날짜는 오늘(KST) 기준.
 */

function kstToday(offsetDays = 0): string {
  const d = new Date(Date.now() + 9 * 3600_000 + offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

test("캡션에 URL이 없어야 한다 (틱톡 캡션 링크 = 클릭 불가 + 홍보 스팸 신호)", () => {
  for (const offset of [0, 1]) {
    const caption = buildTiktokCaption(kstToday(offset));
    assert.doesNotMatch(caption, /https?:\/\//, `offset=${offset}에 URL 포함:\n${caption}`);
    assert.doesNotMatch(caption, /haeseol\.com/, `offset=${offset}에 도메인 포함`);
  }
});

test("해시태그는 8개 이하 + 범용 도배 태그(#fyp/#추천) 금지", () => {
  for (const offset of [0, 1]) {
    const caption = buildTiktokCaption(kstToday(offset));
    const tags: string[] = caption.match(/#[^\s#]+/g) ?? [];
    assert.ok(tags.length <= 8, `태그 ${tags.length}개 (${tags.join(" ")})`);
    assert.ok(!tags.includes("#fyp") && !tags.includes("#추천"), `도배 태그 포함: ${tags.join(" ")}`);
  }
});

test("첫 줄(후킹)은 비어있지 않고 해시태그로 시작하지 않는다", () => {
  const caption = buildTiktokCaption(kstToday(1));
  const firstLine = caption.split("\n")[0];
  assert.ok(firstLine.trim().length > 0);
  assert.ok(!firstLine.trimStart().startsWith("#"));
});

test("후킹 문장은 날짜에 따라 순환한다 (같은 날짜 = 같은 문장, 결정적)", () => {
  const a = buildTiktokCaption(kstToday(1));
  const b = buildTiktokCaption(kstToday(1));
  assert.equal(a, b);
});

test("speakTime: 시간대 한국어 표기", () => {
  assert.equal(speakTime("04:00"), "새벽 4시");
  assert.equal(speakTime("18:30"), "저녁 6시 30분");
  assert.equal(speakTime("12:00"), "낮 12시");
  assert.equal(speakTime("22:05"), "밤 10시 5분");
  assert.equal(speakTime("미정"), "미정"); // 파싱 불가 값은 그대로
});
