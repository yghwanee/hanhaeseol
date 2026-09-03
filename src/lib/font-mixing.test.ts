import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 한 문자열 안에서 폰트가 갈리는 것을 막는 가드.
 *
 * 이 레포에서 같은 원인으로 두 번 터졌다(둘 다 2026-09-03 사용자 지적):
 *  1. 본문 폰트가 **Geist** 였는데 Geist 에 한글 글리프가 없어, 모든 한글이 OS 폰트로
 *     떨어지고 라틴만 Geist 로 나왔다.
 *  2. `font-mono` 가 걸린 자리에 한글 날짜("9월 4일 (금) 18:15")가 들어가, 숫자는
 *     Consolas · 한글은 시스템 폰트로 갈렸다.
 *
 * 공통 원인은 하나다 — **한글 글리프가 없는 폰트에 한글을 넣는 것.** 눈으로만 보이고
 * 타입·빌드·기존 테스트 어디에도 안 걸리므로 여기서 문자열로 고정한다.
 */

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(p, "utf-8");

/** 한글을 만들어 내는 헬퍼. 이 결과가 `font-mono` 안에 들어가면 안 된다. */
const KOREAN_FORMATTERS = ["formatDateHeader", "formatShortDate"];

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      tsxFiles(p, out);
    } else if (e.name.endsWith(".tsx")) {
      out.push(p);
    }
  }
  return out;
}

/** `font-mono` 가 붙은 요소의 여는 태그 ~ 닫는 태그 사이 본문을 모아 준다(대략적). */
function monoBlocks(src: string): { line: number; body: string }[] {
  const out: { line: number; body: string }[] = [];
  const re = /className="[^"]*\bfont-mono\b[^"]*"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length;
    // 같은 요소의 닫는 태그까지. 중첩은 이 검사 목적상 무시해도 된다(본문에 한글 헬퍼가
    // 들어갔는지만 보면 되고, 넓게 잡으면 오탐이 아니라 더 보수적으로 잡힌다).
    const end = src.indexOf("</span>", start);
    const body = src.slice(start, end === -1 ? start + 300 : end);
    out.push({ line: src.slice(0, m.index).split("\n").length, body });
  }
  return out;
}

test("🔴 font-mono 안에 한글 날짜 헬퍼를 넣지 않는다", () => {
  const bad: string[] = [];
  for (const f of tsxFiles(path.join(ROOT, "src"))) {
    const src = read(f);
    if (!src.includes("font-mono")) continue;
    for (const { line, body } of monoBlocks(src)) {
      for (const fn of KOREAN_FORMATTERS) {
        if (body.includes(fn + "(")) {
          bad.push(`${path.relative(ROOT, f)}:${line} — font-mono 안에 ${fn}()`);
        }
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    "font-mono 스택(Consolas·Menlo…)엔 한글 글리프가 없다. 숫자만 mono 로 두고,\n" +
      "  한글이 섞이는 자리는 `tabular-nums` 를 쓸 것:\n  " +
      bad.join("\n  "),
  );
});

test("🔴 font-mono 안에 한글 리터럴을 넣지 않는다", () => {
  const bad: string[] = [];
  for (const f of tsxFiles(path.join(ROOT, "src"))) {
    const src = read(f);
    if (!src.includes("font-mono")) continue;
    for (const { line, body } of monoBlocks(src)) {
      // JSX 본문에 직접 박힌 한글(주석은 제외).
      const noComment = body.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
      if (/[가-힣]/.test(noComment)) {
        bad.push(`${path.relative(ROOT, f)}:${line} — "${noComment.trim().slice(0, 40)}"`);
      }
    }
  }
  assert.deepEqual(bad, [], "font-mono 안에 한글 리터럴이 있다:\n  " + bad.join("\n  "));
});

test("🔴 본문 폰트 폴백에 한글 폰트가 있다", () => {
  const css = read(path.join(ROOT, "src/app/globals.css"));
  const body = css.match(/\nbody\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(
    body,
    /--font-pretendard-ui/,
    "body 가 Pretendard 서브셋을 쓰지 않는다 — Geist 로 되돌리면 모든 한글이 OS 폰트로 떨어진다",
  );
  assert.ok(
    /Malgun Gothic|Apple SD Gothic Neo/.test(body),
    "body 폰트 폴백에 한글 폰트가 없다. 서브셋에 없는 글자가 아무 폰트로나 그려진다.",
  );
});

test("🔴 mono 스택 폴백에도 한글 폰트가 있다(놓친 자리 보험)", () => {
  const cfg = read(path.join(ROOT, "tailwind.config.ts"));
  const mono = cfg.match(/mono:\s*\[[\s\S]*?\]/)?.[0] ?? "";
  assert.ok(mono, "tailwind.config.ts 에 mono 스택 정의가 없다");
  assert.match(
    mono,
    /--font-pretendard-ui/,
    "mono 스택 끝에 본문 한글 폰트가 없다 — font-mono 자리에 한글이 섞이면 아무 폰트로나 그려진다",
  );
});

test("🔴 Pretendard 서브셋 파일이 존재하고 비어 있지 않다", () => {
  for (const w of ["Regular", "Bold"]) {
    const p = path.join(ROOT, `public/fonts/Pretendard-${w}.ui.woff2`);
    assert.ok(fs.existsSync(p), `${p} 가 없다. npm run fonts:subset:ui 를 돌릴 것.`);
    const kb = fs.statSync(p).size / 1024;
    assert.ok(kb > 50, `${w} 서브셋이 ${kb.toFixed(0)}KB 다. 너무 작다 — 글자가 빠졌을 수 있다.`);
    assert.ok(
      kb < 400,
      `${w} 서브셋이 ${kb.toFixed(0)}KB 다. 전체 폰트(771KB)를 통째로 구웠는지 확인할 것 —\n` +
        `  전송량 한도 사고 이력이 있어 방문자당 무게를 키우면 안 된다.`,
    );
  }
});
