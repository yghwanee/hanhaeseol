import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  EMPTY_LOG,
  RETAIN_DAYS,
  markNotified,
  markPosted,
  mergeLogs,
  missingChannels,
  normalizeLog,
  noticeKey,
  postKey,
  pruneLog,
  wasNotified,
  wasPosted,
  type PostLog,
} from "./post-log";
import { CHANNELS, SLOT_CHANNELS, channelsForSlot } from "./post-report";

const base = (): PostLog => ({ posted: {}, notified: {} });

test("키에 슬롯이 들어간다 — 저녁(D)과 다음날 아침(D+1)은 대상 날짜가 같다", () => {
  // 🔴 날짜+채널로만 묶으면 아침이 저녁 기록을 보고 통째로 건너뛴다.
  assert.notEqual(
    postKey("2026-09-02", "evening", "carousel"),
    postKey("2026-09-02", "morning", "carousel"),
  );
  const log = markPosted(base(), "2026-09-02", "evening", "carousel", { at: "x" });
  assert.equal(wasPosted(log, "2026-09-02", "evening", "carousel"), true);
  assert.equal(wasPosted(log, "2026-09-02", "morning", "carousel"), false);
});

test("2026-09-01 삼중 게시 재현 — 첫 실행이 기록하면 나머지는 올릴 게 없다", () => {
  // 그날 33543460694 / 33543539711 / 33543566592 세 실행이 70초 안에 전부 게시했다.
  // 게이트가 '완료된 GH 실행' 만 봤기 때문인데, post-log 는 게시 즉시 기록되므로
  // 두 번째 실행에는 남는 채널이 없어야 한다.
  const day = "2026-09-01";
  const expected = channelsForSlot("morning");
  let log = base();
  assert.deepEqual(missingChannels(log, day, "morning", expected), expected);

  for (const c of expected) {
    log = markPosted(log, day, "morning", c, { at: new Date().toISOString() });
  }
  assert.deepEqual(missingChannels(log, day, "morning", expected), []);
});

test("부분 실패는 빠진 것만 남는다 — 통째 재실행이 안전한 근거", () => {
  const day = "2026-09-02";
  const expected = channelsForSlot("evening");
  let log = base();
  for (const c of ["carousel", "story", "youtube"] as const) {
    log = markPosted(log, day, "evening", c, { at: "t" });
  }
  assert.deepEqual(missingChannels(log, day, "evening", expected), ["reel", "tiktok"]);
});

test("아침 분모에 틱톡이 없다 — 있으면 감시견이 매일 짖는다", () => {
  assert.equal(SLOT_CHANNELS.morning.includes("tiktok"), false);
  assert.equal(SLOT_CHANNELS.evening.includes("tiktok"), true);
  // 슬롯 목록은 전체 채널의 부분집합이어야 한다(오타 방지).
  for (const slot of ["morning", "evening"] as const) {
    for (const c of SLOT_CHANNELS[slot]) assert.ok(CHANNELS.includes(c), c);
  }
});

test("알림 표시는 종류별로 따로 — report/recover/watchdog 이 서로를 막지 않는다", () => {
  const log = markNotified(base(), "2026-09-02", "evening", "report", "t1");
  assert.equal(wasNotified(log, "2026-09-02", "evening", "report"), true);
  assert.equal(wasNotified(log, "2026-09-02", "evening", "recover"), false);
  assert.equal(wasNotified(log, "2026-09-02", "evening", "watchdog"), false);
  assert.notEqual(
    noticeKey("2026-09-02", "evening", "report"),
    noticeKey("2026-09-02", "evening", "watchdog"),
  );
});

test("병합은 원격을 지우지 않는다 — 지우면 그쪽 게시 사실이 사라져 중복이 난다", () => {
  const remote = markPosted(base(), "2026-09-02", "evening", "reel", { at: "2026-09-02T10:00:00Z" });
  const local = markPosted(base(), "2026-09-02", "evening", "story", { at: "2026-09-02T10:05:00Z" });
  const merged = mergeLogs(remote, local);
  assert.equal(wasPosted(merged, "2026-09-02", "evening", "reel"), true);
  assert.equal(wasPosted(merged, "2026-09-02", "evening", "story"), true);
});

test("🔴 병합은 추가 전용 — 지운 키가 되살아난다(의도)", () => {
  // 2026-09-02 자체 검증에서 실측한 성질. 게시 사실이 실수로 사라지면 그 채널이
  // 다시 올라가 중복 게시가 되므로, 삭제는 되지 않는 쪽이 안전하다.
  // 기록을 줄이는 경로는 pruneLog 하나뿐이다.
  const remote = markPosted(base(), "2026-09-02", "evening", "reel", { at: "t" });
  const dropped: PostLog = { posted: {}, notified: {} };
  assert.equal(wasPosted(mergeLogs(remote, dropped), "2026-09-02", "evening", "reel"), true);
  // 반대로 보관 기간이 지난 것은 병합 뒤 pruneLog 가 실제로 걷어낸다.
  const old = markPosted(base(), "2026-01-01", "evening", "reel", { at: "t" });
  assert.equal(wasPosted(pruneLog(mergeLogs(old, old), "2026-09-02"), "2026-01-01", "evening", "reel"), false);
});

test("같은 키가 양쪽에 있으면 먼저 올라간 시각을 남긴다", () => {
  const remote = markPosted(base(), "2026-09-02", "evening", "reel", { at: "2026-09-02T10:00:00Z" });
  const local = markPosted(base(), "2026-09-02", "evening", "reel", { at: "2026-09-02T11:00:00Z" });
  assert.equal(mergeLogs(remote, local).posted[postKey("2026-09-02", "evening", "reel")].at,
    "2026-09-02T10:00:00Z");
});

test("보관 기간이 지난 기록만 지운다", () => {
  let log = base();
  log = markPosted(log, "2026-08-01", "evening", "reel", { at: "t" });
  log = markPosted(log, "2026-09-02", "evening", "reel", { at: "t" });
  log = markNotified(log, "2026-08-01", "evening", "report", "t");
  const pruned = pruneLog(log, "2026-09-02");
  assert.equal(wasPosted(pruned, "2026-09-02", "evening", "reel"), true);
  assert.equal(wasPosted(pruned, "2026-08-01", "evening", "reel"), false);
  assert.equal(wasNotified(pruned, "2026-08-01", "evening", "report"), false);
  // 경계: 정확히 RETAIN_DAYS 전은 남는다.
  const edge = new Date("2026-09-02T00:00:00Z");
  edge.setUTCDate(edge.getUTCDate() - RETAIN_DAYS);
  const day = edge.toISOString().slice(0, 10);
  const kept = pruneLog(markPosted(base(), day, "evening", "reel", { at: "t" }), "2026-09-02");
  assert.equal(wasPosted(kept, day, "evening", "reel"), true);
});

test("깨진 입력에도 throw 하지 않는다 — 읽기 실패로 게시를 막으면 안 된다", () => {
  for (const bad of [null, undefined, 42, "x", [], { posted: 1 }]) {
    const log = normalizeLog(bad);
    assert.deepEqual(Object.keys(log).sort(), ["notified", "posted"]);
  }
  assert.deepEqual(EMPTY_LOG, { posted: {}, notified: {} });
});

// ── 구조 가드 ────────────────────────────────────────────────────────────────

test("게시 스크립트는 runChannel 만 쓴다 — 중복 방지 없는 경로를 남기지 않는다", () => {
  const dir = path.resolve("src/scripts");
  const posts = ["post-instagram-ig", "post-instagram-reel", "post-instagram-story",
    "post-tiktok", "post-youtube-shorts"];
  for (const name of posts) {
    const src = fs.readFileSync(path.join(dir, `${name}.ts`), "utf8");
    assert.match(src, /runChannel\(/, `${name}: runChannel 을 써야 한다`);
    assert.doesNotMatch(src, /runWithReport/, `${name}: runWithReport 는 제거됐다`);
  }
  // 중복 방지가 빠진 래퍼가 되살아나면 여기서 걸린다.
  const report = fs.readFileSync(path.resolve("src/lib/post-report.ts"), "utf8");
  assert.doesNotMatch(report, /export async function runWithReport/);
});

test("게시 워크플로는 직렬화돼 있다 — 동시 실행이 삼중 게시를 만들었다", () => {
  for (const wf of ["instagram.yml", "instagram-morning.yml"]) {
    const src = fs.readFileSync(path.resolve(".github/workflows", wf), "utf8");
    assert.match(src, /concurrency:\s*\n\s*group:\s*social-post\b/, `${wf}: concurrency 필요`);
    assert.match(src, /cancel-in-progress:\s*false/, `${wf}`);
    assert.match(src, /run: npm run post:plan/, `${wf}: 채널 계획 스텝 필요`);
    // 건너뜀 알림은 제거했다 — 되살리면 알림 폭풍이 돌아온다.
    assert.doesNotMatch(src, /게시 건너뜀 \(Telegram/, `${wf}: 건너뜀 알림은 보내지 않는다`);
  }
});

test("따라잡기·감시견은 조용하다 — 발동 자체는 정상 경로라 알리지 않는다", () => {
  const catchup = fs.readFileSync(path.resolve("src/scripts/post-catchup.ts"), "utf8");
  assert.doesNotMatch(catchup, /api\.telegram\.org/, "따라잡기는 텔레그램을 보내지 않는다");
  const wf = fs.readFileSync(path.resolve(".github/workflows/post-catchup.yml"), "utf8");
  assert.doesNotMatch(wf, /TELEGRAM_BOT_TOKEN/, "따라잡기 워크플로에 텔레그램 시크릿 불필요");
  assert.match(wf, /group:\s*post-catchup/, "따라잡기도 직렬화한다");
});

test("보고는 하루 한 통으로 막혀 있다", () => {
  const src = fs.readFileSync(path.resolve("src/scripts/telegram-social-report.ts"), "utf8");
  assert.match(src, /wasNotified\(/);
  assert.match(src, /summary\.fresh\.length === 0/);
  assert.match(src, /markNotified\(/);
});
