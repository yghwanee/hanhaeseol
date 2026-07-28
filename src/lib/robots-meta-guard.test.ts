import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * `robots: <조건> ? undefined : {...}` 패턴 금지 가드.
 *
 * 2026-07-28에 이걸로 사이트의 91%(매치 페이지 1,571개)가 robots·googlebot 메타를
 * 통째로 잃고 있었다. Next.js는 메타데이터 객체에 **명시적으로 존재하는 `undefined`를
 * "부모에서 상속"이 아니라 "해제"로 처리**한다. 그래서 색인 대상 페이지에서
 * layout.tsx의 `robots`(+ 디스커버 진입 조건인 `max-image-preview:large`,
 * `max-snippet:-1`)가 사라졌다. 빌드도 타입체크도 통과하고, 라이브 HTML을 직접
 * 봐야만 드러나는 종류의 결함이라 가드가 필요하다.
 *
 * 올바른 형태: `...(rich ? {} : { robots: { index: false, follow: true } })`
 *
 * 같은 이유로 `robots: undefined`와 `robots: null`도 막는다.
 */

const APP_DIR = join(process.cwd(), "src", "app");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

/** 주석은 제거하고 본다. 이 가드를 설명하는 주석 자체가 위반으로 잡히면 안 된다. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("robots 키에 undefined/null 을 직접 넣는 곳이 없다", () => {
  const files = walk(APP_DIR);
  assert.ok(files.length > 20, `앱 파일을 못 찾음(${files.length}) — 가드 자체가 깨진 것`);

  const violations: string[] = [];
  for (const file of files) {
    const src = stripComments(readFileSync(file, "utf8"));
    src.split("\n").forEach((line, i) => {
      // robots: <무엇> ? undefined : ... / robots: undefined / robots: null
      if (/\brobots\s*:\s*[^,\n]*\?\s*undefined\s*:/.test(line) ||
          /\brobots\s*:\s*(undefined|null)\b/.test(line)) {
        violations.push(`${file.replace(process.cwd(), "").replace(/\\/g, "/")}:${i + 1}  ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(
    violations,
    [],
    `robots에 undefined를 넣으면 layout의 robots가 상속되지 않고 삭제된다.\n조건부 스프레드를 쓸 것: ...(rich ? {} : { robots: {...} })\n\n${violations.join("\n")}`,
  );
});

test("매치 페이지가 조건부 스프레드로 noindex를 건다", () => {
  // 이 파일이 실제 회귀 지점이다. 패턴이 유지되는지 직접 확인한다.
  const src = readFileSync(join(APP_DIR, "match", "[slug]", "page.tsx"), "utf8");
  assert.match(
    src,
    /\.\.\.\(\s*rich\s*\?\s*\{\}\s*:\s*\{\s*robots\s*:/,
    "match/[slug]/page.tsx 가 조건부 스프레드 패턴을 쓰지 않는다",
  );
});

test("layout이 robots와 디스커버용 googleBot 지시자를 정의한다", () => {
  // 자식이 상속받을 원본이 사라지면 위 수정도 무의미해진다.
  const src = readFileSync(join(APP_DIR, "layout.tsx"), "utf8");
  assert.match(src, /robots\s*:/);
  assert.match(src, /"max-image-preview"\s*:\s*"large"/, "디스커버 진입 조건이 빠졌다");
  assert.match(src, /"max-snippet"\s*:\s*-1/);
});
