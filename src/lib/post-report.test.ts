import assert from "node:assert/strict";
import test from "node:test";
import { expectedChannels, formatReport, summarize, type PostEntry } from "./post-report";

const entry = (channel: PostEntry["channel"], status: PostEntry["status"], detail = ""): PostEntry => ({
  channel,
  status,
  detail,
  at: "2026-08-02T09:27:19.000Z",
});

test("expectedChannels: HHS_CHANNELS 로 이번 실행 대상만 추린다", () => {
  assert.deepEqual(expectedChannels(",carousel,reel,"), ["carousel", "reel"]);
  assert.deepEqual(expectedChannels("reel"), ["reel"]);
  // 비었거나 알 수 없는 값이면 전체로 본다(분모를 잃지 않는다)
  assert.equal(expectedChannels("").length, 5);
  assert.equal(expectedChannels("nope").length, 5);
});

test("2026-08-02 저녁 실제 상황: 5개 중 릴스만 실패", () => {
  const expected = expectedChannels(",carousel,reel,story,youtube,tiktok,");
  const s = summarize(expected, [
    entry("carousel", "ok"),
    entry("reel", "fail", "컨테이너 처리 실패: ERROR (Media upload has failed with error code 2207052)"),
    entry("story", "ok"),
    entry("youtube", "ok"),
    entry("tiktok", "ok"),
  ]);
  assert.deepEqual(s.failed, ["reel"]);
  assert.equal(s.ok.length, 4);
  assert.equal(s.total, 5);

  const text = formatReport({ summary: s, title: "🌙 [저녁] 내일 경기", workflow: "instagram.yml" });
  assert.match(text, /총 5개 중 1개 안 올라감/);
  assert.match(text, /❌ 인스타 릴스 — .*2207052/);
  assert.match(text, /✅ 인스타 캐러셀/);
  // 재실행 명령은 실패한 것만 담아야 한다 — 전체 재실행하면 성공분이 중복 게시된다
  assert.match(text, /gh workflow run instagram\.yml -f only=reel/);
  assert.doesNotMatch(text, /only=.*carousel/);
});

test("기록이 없는 채널은 '실행되지 않음'으로 잡혀 재실행 목록에 들어간다", () => {
  const s = summarize(expectedChannels(",carousel,reel,story,"), [entry("carousel", "ok")]);
  assert.deepEqual(s.skipped, ["reel", "story"]);
  const text = formatReport({ summary: s, title: "T", workflow: "instagram.yml" });
  assert.match(text, /총 3개 중 2개 안 올라감/);
  assert.match(text, /only=reel,story/);
});

test("전부 성공이면 재실행 안내를 붙이지 않는다", () => {
  const s = summarize(expectedChannels(",carousel,reel,"), [entry("carousel", "ok"), entry("reel", "ok")]);
  const text = formatReport({ summary: s, title: "T", workflow: "instagram.yml" });
  assert.match(text, /2개 전부 성공/);
  assert.doesNotMatch(text, /gh workflow run/);
});

test("긴 에러 메시지는 텔레그램용으로 한 줄로 줄인다", () => {
  const s = summarize(expectedChannels("reel"), [entry("reel", "fail", "a\nb\n" + "x".repeat(500))]);
  const line = formatReport({ summary: s, title: "T", workflow: "w.yml" })
    .split("\n")
    .find((l) => l.startsWith("❌"))!;
  assert.ok(line.length < 220, `줄이 너무 길다: ${line.length}`);
  assert.ok(line.endsWith("…"));
});
