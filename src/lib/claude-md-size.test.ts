import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 🔴 CLAUDE.md 가 커지면 클라우드 루틴이 죽는다 (2026-09-02 실측).
 *
 * claude.ai 루틴은 세션 시작 때 CLAUDE.md 를 통째로 읽는다. 완료 작업 기록이
 * 135,182자까지 쌓여 파일이 153,800자가 되자, 루틴이 **툴 호출 한 번 만에**
 * autocompact 를 3연속 맞고 `Autocompact is thrashing` 으로 중단됐다.
 *
 *   08-18  CLAUDE.md 195,648바이트 → 마지막 성공 (PR #43)
 *   08-19  217,065바이트          → 19분 돌고 빈손
 *   08-20~ 계속 증가              → 매일 4~5분 만에 FAILED
 *
 * 결과: 2026-08-20 ~ 09-02 **2주간 토픽 발행 0건**. 게다가 루틴 실패는 텔레그램으로
 * 오지 않아서(레포 밖 인프라라 워크플로가 모른다) 2주 동안 아무도 몰랐다.
 *
 * 그래서 크기를 검사로 막는다. 완료 기록은 `docs/worklog.md` 에 쌓고,
 * CLAUDE.md 에는 **앞으로 유효한 것만** 둔다.
 */

const LIMIT = 40_000;
/** 이 선을 넘으면 다음 작업 기록 하나에 한도를 넘길 수 있다. */
const WARN = 30_000;

function read(p: string) {
  return fs.readFileSync(path.resolve(p), "utf8");
}

test("CLAUDE.md 는 한도 안이다 — 넘으면 클라우드 루틴이 죽는다", () => {
  const size = read("CLAUDE.md").length;
  assert.ok(
    size <= LIMIT,
    `CLAUDE.md 가 ${size.toLocaleString()}자다(한도 ${LIMIT.toLocaleString()}). ` +
      `끝난 작업 서술을 docs/worklog.md 로 옮길 것 — 2026-08-20~09-02 에 이것 때문에 ` +
      `클라우드 루틴 두 개가 죽어 2주간 토픽 발행이 0건이었다.`,
  );
  if (size > WARN) {
    console.log(`⚠️  CLAUDE.md ${size.toLocaleString()}자 — 한도(${LIMIT.toLocaleString()})에 근접. 정리할 때가 됐다.`);
  }
});

test("완료 기록은 worklog 에 있고 CLAUDE.md 가 그걸 가리킨다", () => {
  const worklog = read("docs/worklog.md");
  // 기록이 실제로 옮겨져 있는지(빈 껍데기로 만들어 두고 가드만 통과시키는 것 방지).
  assert.ok(worklog.length > 50_000, `docs/worklog.md 가 ${worklog.length}자뿐이다 — 기록이 사라졌나?`);
  assert.match(worklog, /작업 로그/);

  const claude = read("CLAUDE.md");
  assert.match(claude, /docs\/worklog\.md/, "CLAUDE.md 에 worklog 포인터가 있어야 한다");
  // 옛 구조로 되돌아가면(완료 목록을 다시 CLAUDE.md 안에 쌓으면) 여기서 걸린다.
  assert.doesNotMatch(
    claude,
    /^### 완료된 작업\s*$/m,
    "완료 목록을 CLAUDE.md 로 되돌리지 말 것 — docs/worklog.md 에 쌓는다",
  );
});

test("다음 작업 섹션은 CLAUDE.md 에 남아 있다 — 이건 옮기면 안 된다", () => {
  // 앞으로 할 일은 매 세션이 읽어야 하므로 CLAUDE.md 에 둔다.
  assert.match(read("CLAUDE.md"), /### 다음 작업/);
});
