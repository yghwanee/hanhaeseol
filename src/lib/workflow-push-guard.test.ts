import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 스케줄러 push 재시도 루프 가드.
 *
 * 🔴 왜 있나 (2026-08-03): 데이터 커밋 워크플로 3개가 이렇게 생겼었다.
 *
 *     for i in 1 2 3 4 5; do
 *       git pull --rebase --autostash origin main && git push && break
 *       echo "push 충돌, 재시도 $i/5..."; sleep 5
 *     done
 *
 * 5회를 다 쓰고 실패해도 **루프의 마지막 명령이 `sleep` 이라 스텝이 exit 0 으로 끝난다.**
 * 결과·순위·편성이 몇 시간째 안 올라가도 Actions 는 계속 초록이었다(무성 실패).
 * `crawl.yml` 은 그 위에 `updated=true` 까지 찍어, push 도 안 된 SHA 로 Vercel 배포를
 * 6분 기다리다 TIMEOUT 으로 죽었다 — 실패 원인이 "빌드 실패"로 잘못 보고되는 경로였다.
 *
 * 그래서 문서가 아니라 검사로 막는다: `git push` 를 도는 재시도 루프는
 * 루프가 끝난 뒤 반드시 실패로 끊는 경로(`exit 1`)를 가져야 한다.
 */

const WORKFLOW_DIR = path.resolve(".github/workflows");

type Loop = { file: string; startLine: number; endLine: number; body: string[] };

/**
 * 재시도 루프 = 리터럴 숫자 목록을 도는 것(`for i in 1 2 3 4 5; do`).
 * `for row in $rows; do` 같은 **반복 처리 루프**는 대상이 아니다 — 그건 항목마다 실패를
 * 따로 처리하는 게 정상이라(auto-publish-draft 의 `|| tg "..."`) 여기 규칙을 적용하면
 * 오탐이 된다. 실제로 이 구분을 안 넣었더니 그 워크플로가 걸렸다.
 */
const RETRY_LOOP = /^for\s+\w+\s+in\s+(?:\d+\s+)*\d+\s*;\s*do$/;

/** 숫자 재시도 루프 중 `git push` 를 포함하는 것만 추린다(중첩 없음 — 실제로 없다). */
function findPushRetryLoops(): Loop[] {
  const loops: Loop[] = [];
  for (const file of fs.readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith(".yml"))) {
    const lines = fs.readFileSync(path.join(WORKFLOW_DIR, file), "utf8").split(/\r?\n/);
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (start === -1 && RETRY_LOOP.test(t)) start = i;
      else if (start !== -1 && t === "done") {
        const body = lines.slice(start, i + 1);
        if (body.some((l) => /\bgit push\b/.test(l))) {
          loops.push({ file, startLine: start + 1, endLine: i + 1, body });
        }
        start = -1;
      }
    }
  }
  return loops;
}

/** 루프 뒤 8줄 안에 실패로 끊는 경로가 있는지. */
function hasFailureExit(file: string, endLine: number): boolean {
  const lines = fs.readFileSync(path.join(WORKFLOW_DIR, file), "utf8").split(/\r?\n/);
  return lines.slice(endLine, endLine + 8).some((l) => /\bexit\s+1\b/.test(l));
}

test("스캐너가 실제로 push 재시도 루프를 찾는다 (검사 자체가 죽는 회귀 방지)", () => {
  const loops = findPushRetryLoops();
  assert.ok(
    loops.length >= 5,
    `push 재시도 루프를 ${loops.length}개만 찾았다. 스캐너가 깨졌거나 워크플로 구조가 바뀐 것.`,
  );
  // 데이터를 커밋하는 스케줄 워크플로는 전부 잡혀야 한다.
  for (const f of [
    "crawl.yml",
    "crawl-results.yml",
    "crawl-standings.yml",
    "crawl-starters.yml",
    "generate-match-insights.yml",
  ]) {
    assert.ok(
      loops.some((l) => l.file === f),
      `${f} 의 push 재시도 루프를 못 찾았다.`,
    );
  }
});

test("push 재시도 루프는 소진 시 반드시 실패한다", () => {
  const offenders = findPushRetryLoops()
    .filter((l) => !hasFailureExit(l.file, l.endLine))
    .map((l) => `${l.file}:${l.startLine}-${l.endLine}`);
  assert.deepEqual(
    offenders,
    [],
    `재시도를 다 쓰고도 실패시키지 않는 push 루프(무성 실패):\n  ${offenders.join("\n  ")}\n` +
      `루프 뒤에 \`if [ "$pushed" != true ]; then ... exit 1; fi\` 를 두세요.`,
  );
});

test("`&& git push && break` 형태(루프가 sleep 으로 끝나 exit 0)는 금지", () => {
  const offenders: string[] = [];
  for (const file of fs.readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith(".yml"))) {
    const lines = fs.readFileSync(path.join(WORKFLOW_DIR, file), "utf8").split(/\r?\n/);
    lines.forEach((l, i) => {
      if (/git push\s*&&\s*break\s*$/.test(l.trim())) offenders.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [], `무성 실패 패턴이 남아 있습니다: ${offenders.join(", ")}`);
});
