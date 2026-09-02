import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { pickCatchupCycle, MORNING_WF, EVENING_WF } from "./post-catchup";
import type { OtherRun } from "./post-duplicate";

/** KST 시각을 UTC Date 로. */
const kst = (s: string) => new Date(`${s}+09:00`);

const posted = (startedKst: string): OtherRun => ({
  conclusion: "success",
  run_started_at: kst(startedKst).toISOString(),
  posted: true,
});
/** 돌긴 했지만 게시 스텝이 하나도 성공 안 한 실행(스킵된 실행이 여기 해당). */
const skipped = (startedKst: string): OtherRun => ({
  conclusion: "success",
  run_started_at: kst(startedKst).toISOString(),
  posted: false,
});

const R = (m: OtherRun[] = [], e: OtherRun[] = []) => ({ [MORNING_WF]: m, [EVENING_WF]: e });

test("아침 창인데 아무것도 안 올라갔으면 아침을 발동한다", () => {
  const { pick } = pickCatchupCycle(kst("2026-09-01T07:00:00"), R());
  assert.equal(pick?.slot, "morning");
  assert.equal(pick?.workflow, MORNING_WF);
  assert.equal(pick?.target, "2026-09-01");
});

test("아침이 이미 올라갔고 저녁 창은 아직이면 아무것도 발동하지 않는다", () => {
  const { pick } = pickCatchupCycle(
    kst("2026-09-01T07:00:00"),
    R([posted("2026-09-01T05:10:00")]),
  );
  assert.equal(pick, null);
});

test("창이 겹치는 시간(KST 15시)에는 아침을 먼저 구제한다", () => {
  const { pick } = pickCatchupCycle(kst("2026-09-01T15:00:00"), R());
  assert.equal(pick?.slot, "morning");
});

test("아침이 끝났으면 겹치는 시간에 저녁을 발동한다", () => {
  // KST 18시 — 저녁 예약(16:18)이 지났으므로 따라잡기가 걸 수 있다.
  const { pick } = pickCatchupCycle(
    kst("2026-09-01T18:00:00"),
    R([posted("2026-09-01T06:00:00")]),
  );
  assert.equal(pick?.slot, "evening");
  assert.equal(pick?.workflow, EVENING_WF);
  // 저녁은 내일 경기다.
  assert.equal(pick?.target, "2026-09-02");
});

test("저녁이 방금 올라갔으면 발동하지 않는다", () => {
  const { pick } = pickCatchupCycle(
    kst("2026-09-01T20:00:00"),
    R([], [posted("2026-09-01T19:00:00")]),
  );
  assert.equal(pick, null);
});

test("아침 창 마감(KST 18시) 이후에는 아침을 발동하지 않는다", () => {
  const { pick } = pickCatchupCycle(kst("2026-09-01T18:30:00"), R());
  // 아침은 창 밖이라 건너뛰고 저녁이 잡힌다.
  assert.equal(pick?.slot, "evening");
});

test("KST 새벽 3시에는 아무것도 발동하지 않는다 — 예약을 앞지르지 않는다", () => {
  // 🔴 2026-09-02 실측: 저녁분(내일 경기)이 KST 13:59 에 나갔다. 예약은 16:18,
  // 목표 게시 창은 18~19시다. 따라잡기가 창이 열리자마자 걸어서 그 시간대를 잃었다.
  // 아침도 마찬가지 — 새벽 3시에 대신 걸면 예약(04:53)이 올 자리를 뺏는다.
  assert.equal(pickCatchupCycle(kst("2026-09-01T03:00:00"), R()).pick, null);
  // 예약 시각 + 통상 지연이 지난 뒤에는 정상 발동한다.
  assert.equal(pickCatchupCycle(kst("2026-09-01T07:00:00"), R()).pick?.slot, "morning");
});

test("저녁은 KST 17시 전에 발동하지 않는다 — 낮에 내일 경기를 올리지 않는다", () => {
  // 아침은 이미 올라간 상태로 두어 저녁만 후보로 남긴다.
  const done = R([posted("2026-09-01T06:00:00")]);
  assert.equal(pickCatchupCycle(kst("2026-09-01T13:00:00"), done).pick, null);
  assert.equal(pickCatchupCycle(kst("2026-09-01T16:00:00"), done).pick, null);
  assert.equal(pickCatchupCycle(kst("2026-09-01T17:00:00"), done).pick?.slot, "evening");
});

test("🔴 스킵된 실행(게시 스텝 0건)은 '이미 올렸다'로 세지 않는다", () => {
  // 2026-08-30 사고의 핵심. 스킵도 conclusion=success 라 그냥 세면 스킵이 스킵을 부른다.
  const { pick } = pickCatchupCycle(
    kst("2026-09-01T07:00:00"),
    R([skipped("2026-09-01T05:10:00")]),
  );
  assert.equal(pick?.slot, "morning");
});

test("실패한 실행도 세지 않는다", () => {
  const failed: OtherRun = {
    conclusion: "failure",
    run_started_at: kst("2026-09-01T05:10:00").toISOString(),
  };
  const { pick } = pickCatchupCycle(kst("2026-09-01T07:00:00"), R([failed]));
  assert.equal(pick?.slot, "morning");
});

test("어제 같은 슬롯 게시는 오늘 판정에 영향을 주지 않는다", () => {
  const { pick } = pickCatchupCycle(
    kst("2026-09-01T07:00:00"),
    R([posted("2026-08-31T05:10:00")]),
  );
  assert.equal(pick?.slot, "morning");
});

test("🔴 상대 슬롯이 6시간 안에 같은 날짜를 올렸으면 발동하지 않는다", () => {
  // 저녁(8/31 22:00)이 9/1 을 올렸고, 두 시간 뒤 아침 따라잡기가 돌면
  // 같은 날짜가 붙어서 두 번 나간다 — 유튜브 피드 배포가 끊기던 조건(작업82).
  const { pick } = pickCatchupCycle(
    kst("2026-09-01T00:30:00"),
    R([], [posted("2026-08-31T22:00:00")]),
  );
  assert.equal(pick, null);
});

test("정상 세트 간격(저녁 16:18 → 아침 04:53)은 막지 않는다", () => {
  const { pick } = pickCatchupCycle(
    kst("2026-09-01T07:00:00"),
    R([], [posted("2026-08-31T16:18:00")]),
  );
  assert.equal(pick?.slot, "morning", "12시간 이상 떨어져 있으므로 아침은 나가야 한다");
});

// ── 배선 가드 ────────────────────────────────────────────────────────────────
// 순수 로직이 맞아도 워크플로에 안 붙어 있으면 아무 일도 일어나지 않는다.

const read = (p: string) => fs.readFileSync(p, "utf8");

test("🔴 모든 워크플로가 최상위 jobs 를 갖는다(YAML 파싱만으로는 못 잡는다)", () => {
  // 2026-09-01 실제 사고: 따라잡기 잡을 끼워 넣으면서 `jobs:` 키를 지웠는데,
  // YAML 은 여전히 **문법적으로 유효**해서(최상위 키가 catchup/deploy 가 됐을 뿐)
  // js-yaml 파싱 검사를 통과했다. deploy·uptime·crawl-results 셋이 동시에 죽었고,
  // workflow_dispatch 를 해 보고서야 422 로 드러났다. 파싱은 검증이 아니다.
  //
  // YAML 라이브러리를 쓰지 않고 최상위 키만 본다 — 타입 없는 전이 의존성에
  // 가드를 매달면 그 의존성이 빠지는 날 가드도 같이 사라진다.
  const ALLOWED = new Set([
    "name", "on", "run-name", "permissions", "env", "defaults", "concurrency", "jobs",
  ]);
  const bad: string[] = [];
  for (const f of fs.readdirSync(".github/workflows").filter((n) => n.endsWith(".yml"))) {
    const top = read(`.github/workflows/${f}`)
      .split(/\r?\n/)
      .filter((l) => /^[A-Za-z_][A-Za-z0-9_-]*:/.test(l))
      .map((l) => l.slice(0, l.indexOf(":")));
    if (!top.includes("jobs")) bad.push(`${f}: 최상위 jobs 없음`);
    for (const k of top) if (!ALLOWED.has(k)) bad.push(`${f}: 알 수 없는 최상위 키 '${k}'`);
  }
  assert.deepEqual(bad, [], "워크플로 구조가 깨졌다: " + bad.join(", "));
});

test("🔴 따라잡기를 호출하는 워크플로가 최소 3개 있어야 한다", () => {
  // cron 하나에 하루를 걸지 않는 게 이 설계의 전부다. 호출처가 하나로 줄면
  // 그 하나가 버려지는 날 게시가 통째로 사라진다.
  const callers = fs
    .readdirSync(".github/workflows")
    .filter((f) => f.endsWith(".yml"))
    .filter((f) => f !== "post-catchup.yml")
    .filter((f) => read(`.github/workflows/${f}`).includes("post-catchup.yml"));
  assert.ok(
    callers.length >= 3,
    `따라잡기 호출처가 ${callers.length}개다(최소 3). 지금: ${callers.join(", ")}`,
  );
  for (const c of callers) {
    assert.match(
      read(`.github/workflows/${c}`),
      /actions:\s*write/,
      `${c} 에 actions: write 가 없으면 발동 API 가 403 으로 조용히 실패한다`,
    );
  }
});

test("🔴 게시 워크플로 둘 다 gated 입력과 HHS_FORCE_GATE 를 갖는다", () => {
  for (const f of ["instagram-morning.yml", "instagram.yml"]) {
    const y = read(`.github/workflows/${f}`);
    assert.match(y, /^\s{6}gated:/m, `${f} 에 gated 입력이 없다`);
    assert.match(y, /HHS_FORCE_GATE:/, `${f} 에 HHS_FORCE_GATE 주입이 없다`);
  }
});

test("🔴 따라잡기 발동분은 수동 실행 면제를 받지 않는다", () => {
  // 이게 빠지면 따라잡기가 창·중복 검사를 통째로 우회해 중복 게시가 난다.
  const s = read("src/scripts/check-post-cycle.ts");
  assert.match(s, /HHS_FORCE_GATE === "1"/);
  assert.match(s, /!forced && process\.env\.GITHUB_EVENT_NAME === "workflow_dispatch"/);
});

test("🔴 고빈도 cron(30분 이하)을 다시 만들지 않는다", () => {
  // GH 가 이 레포의 예약 발화를 버리는 주된 이유가 고빈도 cron 이다(2026-09-01 실측).
  const bad: string[] = [];
  for (const f of fs.readdirSync(".github/workflows").filter((f) => f.endsWith(".yml"))) {
    for (const m of read(`.github/workflows/${f}`).matchAll(/^\s*-\s*cron:\s*'([^']+)'/gm)) {
      const minute = m[1].split(/\s+/)[0];
      const count = minute.includes("/")
        ? 60 / Number(minute.split("/")[1] || 60)
        : minute.split(",").length;
      if (count > 1) bad.push(`${f}: '${m[1]}' (시간당 ${count}회)`);
    }
  }
  assert.deepEqual(bad, [], `시간당 2회 이상 도는 cron 이 있다:\n${bad.join("\n")}`);
});
