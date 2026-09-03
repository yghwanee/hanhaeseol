import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

/**
 * 워크플로 YAML 전수 파싱 가드.
 *
 * 🔴 2026-09-04 에 `push-notify.yml` 을 편집하다 `run: |` 블록 안에 **실제 개행**이 들어가
 * YAML 이 깨졌다. 결과는 조용하지 않았지만 **엉뚱하게** 나타났다 —
 * GitHub 이 `HTTP 422: Workflow does not have 'workflow_dispatch' trigger` 를 돌려줬다.
 * 파일을 아예 못 읽어서 트리거가 없다고 답한 것이고, 트리거 문제로 착각하기 쉽다.
 *
 * 그때 내가 돌린 검사는 "탭 문자 있나 · 필수 키워드 있나" 수준이라 **통과했다.**
 * 문자열 검사로는 YAML 구조를 못 본다. 실제 파서로 읽는 게 유일한 방법이다.
 *
 * 예약 워크플로는 깨져도 다음 발화까지 아무 신호가 없다 — 이 레포는 그 침묵으로
 * 2주간 발행 0건을 겪은 곳이다(작업107). 그래서 CI 에서 막는다.
 */

const WF_DIR = path.join(process.cwd(), ".github/workflows");
const files = fs.readdirSync(WF_DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

/** `on:` 은 YAML 1.1 에서 불리언 `true` 로 파싱된다(js-yaml 기본). 둘 다 본다. */
function triggersOf(doc: Record<string, unknown>): Record<string, unknown> {
  const on = (doc.on ?? (doc as Record<string, unknown>)["true"] ?? doc[true as never]) as unknown;
  return on && typeof on === "object" ? (on as Record<string, unknown>) : {};
}

test("워크플로 파일이 있다", () => {
  assert.ok(files.length > 0, ".github/workflows 가 비어 있다");
});

test("🔴 모든 워크플로가 YAML 로 파싱된다", () => {
  const bad: string[] = [];
  for (const f of files) {
    try {
      const doc = yaml.load(fs.readFileSync(path.join(WF_DIR, f), "utf-8"));
      if (!doc || typeof doc !== "object") bad.push(`${f} — 문서가 객체가 아니다`);
    } catch (e) {
      bad.push(`${f} — ${(e as Error).message.split("\n")[0]}`);
    }
  }
  assert.deepEqual(
    bad,
    [],
    "YAML 파싱 실패. GitHub 은 이걸 트리거 없음(422)으로 보고해 원인을 헷갈리게 만든다:\n  " +
      bad.join("\n  "),
  );
});

test("🔴 모든 워크플로에 트리거와 jobs 가 있다", () => {
  const bad: string[] = [];
  for (const f of files) {
    const doc = yaml.load(fs.readFileSync(path.join(WF_DIR, f), "utf-8")) as Record<string, unknown>;
    const trig = triggersOf(doc);
    if (Object.keys(trig).length === 0) bad.push(`${f} — on: 이 비었거나 못 읽힌다`);
    const jobs = doc.jobs as Record<string, unknown> | undefined;
    if (!jobs || Object.keys(jobs).length === 0) bad.push(`${f} — jobs 가 없다`);
  }
  assert.deepEqual(bad, [], bad.join("\n  "));
});

test("🔴 수동 실행이 필요한 워크플로에 workflow_dispatch 가 살아 있다", () => {
  // 예약만 있고 수동 실행이 없으면 사고 났을 때 사람이 손으로 돌릴 수 없다.
  const bad: string[] = [];
  for (const f of files) {
    const doc = yaml.load(fs.readFileSync(path.join(WF_DIR, f), "utf-8")) as Record<string, unknown>;
    const trig = triggersOf(doc);
    if ("schedule" in trig && !("workflow_dispatch" in trig)) {
      bad.push(`${f} — 예약은 있는데 workflow_dispatch 가 없다(손으로 못 돌린다)`);
    }
  }
  assert.deepEqual(bad, [], bad.join("\n  "));
});

test("🔴 run: 블록이 열 0 으로 튀어나오지 않는다 — 블록 스칼라가 깨진 신호", () => {
  const bad: string[] = [];
  for (const f of files) {
    const lines = fs.readFileSync(path.join(WF_DIR, f), "utf-8").split("\n");
    let inRun = false;
    let indent = 0;
    lines.forEach((ln, i) => {
      const m = ln.match(/^(\s*)(- )?(?:name:.*)?run:\s*\|/);
      if (m) {
        inRun = true;
        indent = m[1].length;
        return;
      }
      if (!inRun) return;
      if (ln.trim() === "") return;
      const cur = ln.match(/^(\s*)/)![1].length;
      // 블록을 벗어난 줄은 원래 들여쓰기 이하로 돌아온다 — 정상 종료.
      if (cur <= indent) {
        inRun = false;
        // 🔴 열 0 으로 나오면서 YAML 키 모양도 아니면 블록이 깨진 것이다.
        if (cur === 0 && !/^[A-Za-z_][\w-]*:/.test(ln) && !ln.startsWith("#")) {
          bad.push(`${f}:${i + 1} — "${ln.slice(0, 50)}"`);
        }
      }
    });
  }
  assert.deepEqual(
    bad,
    [],
    "run 블록 안의 줄이 열 0 으로 튀어나왔다(개행이 잘못 들어간 신호):\n  " + bad.join("\n  "),
  );
});
