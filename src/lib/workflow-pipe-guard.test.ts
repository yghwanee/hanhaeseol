import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

/**
 * 파이프가 종료코드를 삼키는 것을 막는 가드.
 *
 * 🔴 왜 있나 (2026-09-09 실측): `crawl.yml` 의 크롤 스텝이 이렇게 생겼었다.
 *
 *     npm run crawl 2>&1 | tee crawl.log
 *
 * 파이프라인의 종료코드는 **마지막 명령(`tee`)의 것**이다. `crawl.ts` 가
 * `process.exit(1)` 로 죽어도 `tee` 는 0 을 돌려주므로 스텝이 통과한다.
 * 그날 `TypeError: Cannot read properties of null (reading 'trim')` 으로 크롤이
 * 매번 죽고 있었는데, schedule.json 이 안 바뀌니 커밋 스텝은 `updated=false` 를
 * 찍고 워크플로는 초록으로 끝났다 — **나흘간 편성표가 얼어붙었고 아무 알림도 없었다.**
 *
 * 문서로는 못 막는다(같은 자리에 또 쓴다). `run:` 블록 안에서 파이프를 쓰면
 * 그 블록에 `set -o pipefail` 이 있어야 한다.
 *
 * 🔴 반대 함정도 같이 안다: `cmd | grep -q` 는 pipefail 과 같이 쓰면 grep 이 첫
 * 매치에서 파이프를 닫아 앞 명령이 SIGPIPE(141)로 죽고, 그 141 이 파이프라인
 * 상태로 올라와 **성공한 빌드가 실패로 보인다.** 그래서 pipefail 이 켜진 블록에
 * 한해 `| grep -q` 를 막는다(파일로 받아 판정할 것). pipefail 없는 블록의
 * `echo … | grep -q` 는 무해하므로 건드리지 않는다 — 넓히면 오탐이 나고,
 * 오탐이 나는 가드는 결국 무시된다.
 */

const WORKFLOW_DIR = path.resolve(".github/workflows");

/** 종료코드를 잃으면 안 되는 명령. 이걸 왼쪽에 두고 파이프로 넘기는 게 위험하다. */
const MUST_NOT_LOSE_EXIT = /^\s*(npm run |npx |node |tsx |pnpm run )/;

type Step = { file: string; name: string; run: string };

function allRunSteps(): Step[] {
  const out: Step[] = [];
  for (const file of fs.readdirSync(WORKFLOW_DIR).filter((f) => /\.ya?ml$/.test(f))) {
    const doc = yaml.load(fs.readFileSync(path.join(WORKFLOW_DIR, file), "utf8")) as {
      jobs?: Record<string, { steps?: Array<Record<string, unknown>> }>;
    } | null;
    const jobs = doc?.jobs ?? {};
    for (const job of Object.values(jobs)) {
      const steps = job?.steps ?? [];
      if (!Array.isArray(steps)) continue;
      for (const s of steps) {
        if (typeof s?.run !== "string") continue;
        out.push({ file, name: String(s.name ?? s.id ?? "(이름 없음)"), run: s.run });
      }
    }
  }
  return out;
}

/** 주석·문자열 안의 `|` 는 세지 않는다. 리다이렉트(`||`)도 파이프가 아니다. */
function pipedLines(run: string): string[] {
  return run
    .split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l))
    .filter((l) => /(?<!\|)\|(?!\|)/.test(l));
}

test("워크플로 run 블록이 하나라도 있다(가드가 헛돌지 않는다)", () => {
  const steps = allRunSteps();
  assert.ok(steps.length > 20, `run 스텝 ${steps.length}개 — 파싱이 깨졌다`);
});

/** `set -o pipefail` / `set -euo pipefail` 등 어떤 표기든 잡는다. */
function hasPipefail(run: string): boolean {
  return /^\s*set\s+-[A-Za-z]*o[A-Za-z]*\s+pipefail\b/m.test(run);
}

test("🔴 npm/node 명령을 파이프로 넘기는 블록은 set -o pipefail 을 갖는다", () => {
  const bad: string[] = [];
  for (const s of allRunSteps()) {
    const risky = pipedLines(s.run).filter((l) => MUST_NOT_LOSE_EXIT.test(l));
    if (risky.length === 0) continue;
    if (hasPipefail(s.run)) continue;
    bad.push(`${s.file} › ${s.name}\n      ${risky.join("\n      ")}`);
  }
  assert.deepEqual(
    bad,
    [],
    `파이프가 종료코드를 삼킨다 — 블록 맨 위에 \`set -o pipefail\` 을 넣을 것:\n  ${bad.join("\n  ")}`,
  );
});

test("🔴 pipefail 블록 안에서 grep -q 로 파이프를 닫지 않는다(SIGPIPE 141)", () => {
  // pipefail 이 없는 블록의 `echo … | grep -q` 는 무해하다(앞 명령이 죽어도 상태를 안 올린다).
  // 위험한 건 둘이 겹칠 때뿐이라 그 조합만 막는다 — 넓히면 오탐으로 가드가 무시된다.
  const bad: string[] = [];
  for (const s of allRunSteps()) {
    if (!hasPipefail(s.run)) continue;
    for (const l of pipedLines(s.run)) {
      if (/\|\s*grep\s+-\w*q/.test(l)) bad.push(`${s.file} › ${s.name}: ${l.trim()}`);
    }
  }
  assert.deepEqual(bad, [], `파일로 받아 판정할 것:\n  ${bad.join("\n  ")}`);
});
