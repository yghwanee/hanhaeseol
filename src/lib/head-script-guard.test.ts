import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * head 인라인 스크립트에 리다이렉트로 보이는 코드를 두지 않는다.
 *
 * 2026-08-13 네이버 서치어드바이저 "사이트 간단 체크" 실측:
 *
 *   robots.txt        ! 사이트가 HTML이나 JavaScript를 활용한 redirect로 판단되며…
 *   로봇 메타 태그     ! (같음)
 *   사이트 제목        ✗ 사이트 제목이 없습니다
 *   사이트 설명        ✗ 사이트 설명이 없습니다
 *   Open Graph 제목    ✗ / Open Graph 설명 ✗
 *
 * 원인은 layout.tsx head 의 CSS 자가복구 스크립트에 있던 `location.reload()` 하나였다.
 * Yeti 유저에이전트로 직접 받아 보면 title·description·og:title 이 전부 들어 있으므로
 * **못 받은 게 아니라 읽고 버린 것**이다. 네이버가 홈을 "JS 리다이렉트 페이지"로
 * 분류하면 그 페이지의 메타를 색인에 넣지 않는다.
 *
 * 유입의 78%가 네이버인데 홈 메타가 통째로 비어 있었고, 브랜드 검색 `한해설` 에서
 * 홈 대신 하위 페이지(`/league/laliga`)가 뜨던 직접 원인이다.
 *
 * 자가복구가 필요하면 페이지를 이동시키지 말고 **스타일시트를 다시 주입**할 것.
 */

const APP_DIR = join(process.cwd(), "src", "app");
const LAYOUT = join(APP_DIR, "layout.tsx");

/** 리다이렉트로 오인될 수 있는 호출. `location` 계열 전부. */
const REDIRECTISH = /\b(?:window\s*\.\s*location|document\s*\.\s*location|location\s*\.\s*(?:reload|replace|assign|href)|location\s*\.\s*href\s*=)/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

/** 주석 제거 — 이 가드를 설명하는 주석 자체가 위반으로 잡히면 안 된다. */
function stripComments(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "") // JSX 주석
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * `dangerouslySetInnerHTML={{ __html: "..." }}` 의 문자열 리터럴을 뽑는다.
 * 스크립트 태그 파싱이 아니라 인라인 주입 지점을 본다 — head 에 들어가는 경로가 이것뿐이다.
 */
export function extractInlineHtmlLiterals(src: string): string[] {
  const out: string[] = [];
  const re = /__html:\s*([\s\S]*?)(?:,\s*\}|\s*\}\s*\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

test("layout.tsx head 인라인 스크립트에 location 계열이 없다", () => {
  const src = stripComments(readFileSync(LAYOUT, "utf8"));
  const literals = extractInlineHtmlLiterals(src);

  // 스캐너가 죽어서 0건이면 통과해버린다. layout 은 인라인 주입을 실제로 갖고 있다.
  assert.ok(
    literals.length >= 2,
    `layout.tsx 인라인 주입을 못 찾음(${literals.length}) — 가드 자체가 깨진 것`,
  );

  const bad = literals.filter((l) => REDIRECTISH.test(l));
  assert.deepEqual(
    bad,
    [],
    `head 인라인 스크립트에 리다이렉트로 보이는 코드가 있다. 네이버가 홈 메타를 통째로 버린다:\n${bad.join("\n")}`,
  );
});

test("meta http-equiv=refresh 를 쓰지 않는다", () => {
  const files = walk(APP_DIR);
  const bad: string[] = [];
  for (const file of files) {
    const src = stripComments(readFileSync(file, "utf8"));
    if (/http-equiv\s*=\s*["']?refresh/i.test(src)) bad.push(file);
  }
  assert.deepEqual(bad, [], `meta refresh 는 리다이렉트로 판정된다:\n${bad.join("\n")}`);
});

test("가드가 실제 위반을 잡는다(픽스처)", () => {
  const violating = `
    <script dangerouslySetInnerHTML={{
      __html: "try{if(!ok){sessionStorage.setItem('x','1');location.reload()}}catch(e){}",
    }} />
    <script dangerouslySetInnerHTML={{ __html: "console.log(1)" }} />
  `;
  const literals = extractInlineHtmlLiterals(violating);
  assert.equal(literals.length, 2, "픽스처에서 리터럴 2개를 뽑아야 한다");
  assert.equal(literals.filter((l) => REDIRECTISH.test(l)).length, 1);

  // 정상형(스타일시트 재주입)은 통과해야 한다.
  const ok = `<script dangerouslySetInnerHTML={{ __html: "fetch('/',{cache:'reload'}).then(function(r){return r.text()})" }} />`;
  assert.equal(extractInlineHtmlLiterals(ok).filter((l) => REDIRECTISH.test(l)).length, 0);
});
