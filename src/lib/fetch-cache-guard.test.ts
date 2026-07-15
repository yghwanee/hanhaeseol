import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

/**
 * Next.js 런타임에서 도는 fetch 는 캐시 의도를 반드시 명시해야 한다.
 *
 * 왜 이 테스트가 있나 (2026-07-15 사고):
 * `/api/live` 가 끝난 경기를 하루 종일 "진행중"으로 내보냈다. 원인은
 * naverGet 의 fetch 에 cache 옵션이 없어 Next.js Data Cache 가 응답을
 * 붙잡은 것. dateRange() 의 from/to 가 KST 기준이라 URL 이 하루 내내
 * 고정이어서, 그날 첫 폴링(경기 진행중) 스냅샷이 종일 재생됐다.
 * 라우트의 `export const dynamic = "force-dynamic"` 은 라이브러리 내부
 * fetch 까지 막지 못한다 — 믿지 말 것.
 *
 * 규칙: src/app 에서 (전이적으로) 도달 가능한 서버 파일의 GET fetch 는
 * `cache:` 또는 `next:` 를 반드시 지정한다. 신선도는 응답의 s-maxage
 * (엣지 캐시)로 제어하고, Data Cache 는 명시적으로 켜거나 끈다.
 *
 * 대상 밖:
 * - "use client" 파일: 브라우저 fetch 라 Data Cache 와 무관
 * - method 가 GET 이 아닌 요청: Data Cache 는 GET 만 캐시
 * - src/lib/crawlers/*: GH Actions(tsx) 전용이라 app 에서 도달하지 않음
 *
 * 정말 예외가 필요하면 fetch 위 5줄 안에 `fetch-cache-ok: <이유>` 주석.
 */

const SRC = path.join(process.cwd(), "src");
const APP = path.join(SRC, "app");
const EXTS = [".ts", ".tsx"];

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (EXTS.includes(path.extname(e.name)) && !p.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

/** import 경로를 실제 파일로 해석. `@/x` 는 src/x, 상대경로는 그대로. */
function resolveImport(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // 외부 패키지

  for (const cand of [
    ...EXTS.map((e) => base + e),
    ...EXTS.map((e) => path.join(base, "index" + e)),
  ]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}

/** src/app 에서 전이적으로 도달 가능한 파일 전부. */
function reachableFromApp(): string[] {
  const queue = walk(APP);
  const seen = new Set(queue);
  while (queue.length) {
    const f = queue.shift()!;
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const r = resolveImport(m[1], f);
      if (r && !seen.has(r)) {
        seen.add(r);
        queue.push(r);
      }
    }
  }
  return [...seen];
}

/** `fetch(` 여는 괄호부터 짝이 맞는 닫는 괄호까지의 인자 텍스트. */
function argsOf(src: string, openParen: number): string {
  let depth = 0;
  for (let i = openParen; i < src.length; i++) {
    const c = src[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return src.slice(openParen + 1, i);
    }
  }
  return src.slice(openParen + 1);
}

type Violation = { file: string; line: number; snippet: string };

function scan(file: string): Violation[] {
  const src = fs.readFileSync(file, "utf8");
  // 클라이언트 컴포넌트는 브라우저에서 돌아 Data Cache 대상이 아니다.
  if (/^\s*["']use client["']/m.test(src.slice(0, 200))) return [];

  const out: Violation[] = [];
  for (const m of src.matchAll(/\bfetch\s*\(/g)) {
    const at = m.index! + m[0].length - 1;
    const args = argsOf(src, at);
    const line = src.slice(0, m.index!).split("\n").length;

    // 비-GET 은 Data Cache 대상이 아님.
    const method = /method\s*:\s*["']([A-Za-z]+)["']/.exec(args);
    if (method && method[1].toUpperCase() !== "GET") continue;

    // 캐시 의도를 명시했으면 통과.
    if (/\bcache\s*:/.test(args) || /\bnext\s*:\s*\{/.test(args)) continue;

    // 명시적 예외 주석(fetch 위 5줄 이내).
    const before = src.split("\n").slice(Math.max(0, line - 6), line).join("\n");
    if (/fetch-cache-ok:/.test(before)) continue;

    out.push({
      file: path.relative(process.cwd(), file).replace(/\\/g, "/"),
      line,
      snippet: args.replace(/\s+/g, " ").trim().slice(0, 60),
    });
  }
  return out;
}

test("Next 런타임에서 도달 가능한 GET fetch 는 캐시 의도를 명시한다", () => {
  const files = reachableFromApp();
  // 스캐너가 조용히 0개를 훑는 회귀 방지(경로/해석이 깨지면 여기서 잡힌다).
  assert.ok(files.length > 50, `도달 파일이 ${files.length}개뿐 — 스캐너가 깨졌다`);
  assert.ok(
    files.some((f) => f.endsWith(path.join("lib", "results", "naver.ts"))),
    "src/lib/results/naver.ts 가 도달 목록에 없다 — import 해석이 깨졌다",
  );

  const violations = files.flatMap(scan);
  assert.deepEqual(
    violations,
    [],
    "cache/next 옵션 없는 GET fetch:\n" +
      violations.map((v) => `  ${v.file}:${v.line}  fetch(${v.snippet}...)`).join("\n") +
      "\n\nNext.js Data Cache 가 응답을 붙잡아 옛 데이터를 계속 내보낼 수 있다." +
      "\ncache: \"no-store\" 또는 next: { revalidate: N } 을 명시할 것." +
      "\n(force-dynamic 은 라이브러리 내부 fetch 를 막지 못한다)",
  );
});

test("스캐너가 위반을 실제로 잡는다", () => {
  const tmp = path.join(process.cwd(), "src", "lib", "__fetch-guard-fixture.ts");
  try {
    fs.writeFileSync(tmp, 'export const x = () => fetch("https://example.com/a.json");\n');
    assert.equal(scan(tmp).length, 1, "옵션 없는 GET fetch 를 못 잡았다");

    fs.writeFileSync(
      tmp,
      'export const x = () => fetch("https://e.com/a", { cache: "no-store" });\n' +
        'export const y = () => fetch("https://e.com/b", { next: { revalidate: 60 } });\n' +
        'export const z = () => fetch("https://e.com/c", { method: "POST" });\n' +
        '// fetch-cache-ok: 테스트\nexport const w = () => fetch("https://e.com/d");\n',
    );
    assert.deepEqual(scan(tmp), [], "정상 케이스를 위반으로 잘못 잡았다");

    fs.writeFileSync(tmp, '"use client";\nexport const x = () => fetch("https://e.com/a");\n');
    assert.deepEqual(scan(tmp), [], "use client 파일은 대상이 아니어야 한다");
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});
